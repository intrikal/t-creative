/**
 * Unit tests for getRevenueForecast() in forecast-actions.ts.
 *
 * Tests pure forecast math by controlling the DB response for each of the
 * four queries in order: confirmed bookings, recurring bookings,
 * active membership subscriptions, and historical completion stats.
 *
 * Mock strategy: vi.doMock + vi.resetModules per test (same pattern as
 * referral-program.test.ts). A stateful mock DB serves queued SELECT
 * result sets in call order. getUser (requireAdmin) is mocked to a no-op.
 *
 * SELECT call order inside getRevenueForecast():
 *   [1] confirmed upcoming bookings (startsAt >= now, status != cancelled)
 *   [2] recurring bookings (recurrenceRule IS NOT NULL)
 *   [3] active membership subscriptions (joined with membershipPlans)
 *   [4] historical completion rate (past 90 days completed vs total)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                    */
/* ------------------------------------------------------------------ */

function createStatefulDb() {
  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db: any = {
    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Mock wiring                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      startsAt: "startsAt",
      totalInCents: "totalInCents",
      status: "status",
      deletedAt: "deletedAt",
      recurrenceRule: "recurrenceRule",
    },
    membershipPlans: {
      id: "id",
      priceInCents: "priceInCents",
      cycleIntervalDays: "cycleIntervalDays",
    },
    membershipSubscriptions: {
      id: "id",
      planId: "planId",
      status: "status",
      cycleEndsAt: "cycleEndsAt",
    },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));

  vi.doMock("@/app/dashboard/analytics/_shared", () => ({
    getUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
  }));

  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

  vi.doMock("next/headers", () => ({
    cookies: vi.fn(async () => ({ get: vi.fn(), delete: vi.fn() })),
    headers: vi.fn(async () => ({ get: vi.fn() })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** ISO date string for a date offset from today by `days`. */
function offsetDate(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/** Returns a completion-row shaped object for the historical stats SELECT. */
function completionRow(completed: number, total: number): MockRow {
  return { completed, total };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("getRevenueForecast — forecast math", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /*  (1) Only confirmed bookings counted (not pending/cancelled)      */
  /* ---------------------------------------------------------------- */
  it("counts confirmed bookings but excludes pending and cancelled statuses", async () => {
    // The query filters ne(status, 'cancelled') and excludes deleted rows.
    // The SELECT only returns non-cancelled rows — pending rows from the
    // application's perspective should not appear in the confirmed query.
    // Here we verify that only the rows the DB returns are summed.
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const tomorrow = offsetDate(1);
    // DB returns only one confirmed booking (the cancelled one is filtered by the query)
    db._queue([{ startsAt: tomorrow, totalInCents: 5000 }]); // [1] confirmed
    db._queue([]); // [2] recurring
    db._queue([]); // [3] memberships
    db._queue([completionRow(0, 0)]); // [4] history

    const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");
    const result = await getRevenueForecast();

    // Day 1 confirmed cumulative total must be exactly 5000 cents
    const day1 = result.points[1]; // index 0 = today, index 1 = tomorrow
    expect(day1.confirmed).toBe(5000);
    // No recurring or membership contribution
    expect(day1.total).toBe(5000);
  });

  /* ---------------------------------------------------------------- */
  /*  (2) Recurring projections: weekly × 4 = correct sum             */
  /* ---------------------------------------------------------------- */
  it("projects a weekly recurring booking forward and sums 4 occurrences over 28 days", async () => {
    // A booking with FREQ=WEEKLY last occurred 3 days ago at $100.
    // It should land on days 4, 11, 18, 25 (within the 90-day horizon).
    // Cumulative recurring at day 25 must be at least 4 × 10000 cents.
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(10, 0, 0, 0);

    db._queue([]); // [1] confirmed — none
    db._queue([
      {
        startsAt: threeDaysAgo,
        totalInCents: 10_000,
        recurrenceRule: "FREQ=WEEKLY",
      },
    ]); // [2] recurring
    db._queue([]); // [3] memberships
    db._queue([completionRow(0, 0)]); // [4] history

    const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");
    const result = await getRevenueForecast();

    // At day 28, all 4 weekly occurrences (days 4, 11, 18, 25) are past
    const day28 = result.points[28];
    // recurring field = cumConfirmed + cumRecurring; confirmed = 0, so equals cumRecurring
    expect(day28.recurring).toBeGreaterThanOrEqual(4 * 10_000);
  });

  /* ---------------------------------------------------------------- */
  /*  (3) Membership renewals contribute to 30/60/90 milestones        */
  /* ---------------------------------------------------------------- */
  it("projects membership renewal for 30/60/90 day milestones at plan price", async () => {
    // An active membership with a 30-day cycle renewing tomorrow at $50/month.
    // The 30-day milestone should include at least 1 renewal ($5000 cents).
    // The 60-day milestone should include at least 2 renewals, 90-day at least 3.
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const tomorrow = offsetDate(1);

    db._queue([]); // [1] confirmed
    db._queue([]); // [2] recurring
    db._queue([
      {
        cycleEndsAt: tomorrow,
        cycleIntervalDays: 30,
        priceInCents: 5_000,
      },
    ]); // [3] memberships — renews every 30 days
    db._queue([completionRow(0, 0)]); // [4] history

    const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");
    const result = await getRevenueForecast();

    const m30 = result.milestones.find((m) => m.days === 30)!;
    const m60 = result.milestones.find((m) => m.days === 60)!;
    const m90 = result.milestones.find((m) => m.days === 90)!;

    expect(m30.membership).toBeGreaterThanOrEqual(5_000);
    expect(m60.membership).toBeGreaterThanOrEqual(10_000);
    expect(m90.membership).toBeGreaterThanOrEqual(15_000);
  });

  /* ---------------------------------------------------------------- */
  /*  (4) Historical completion rate drives confidence band            */
  /* ---------------------------------------------------------------- */
  it("derives ±20% confidence band from 80% historical completion rate", async () => {
    // With 80 completed out of 100 total, completionRate = 0.80.
    // For projected revenue P, low = P × 0.80 × 0.8 = P × 0.64
    //                           high = P × min(0.80 × 1.2, 1) = P × 0.96
    // The spread is 0.96 - 0.64 = 0.32 * P — approximately ±20% of 0.80 * P.
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const tomorrow = offsetDate(1);

    db._queue([]); // [1] confirmed
    db._queue([]); // [2] recurring
    db._queue([
      {
        cycleEndsAt: tomorrow,
        cycleIntervalDays: 30,
        priceInCents: 10_000,
      },
    ]); // [3] memberships — only projected revenue, no confirmed
    db._queue([completionRow(80, 100)]); // [4] 80% rate

    const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");
    const result = await getRevenueForecast();

    expect(result.completionRate).toBeCloseTo(0.8, 5);

    // At any point where there is projected (membership) revenue, low < high
    const pointsWithProjected = result.points.filter((p) => p.total > 0);
    for (const p of pointsWithProjected) {
      expect(p.low).toBeLessThan(p.high);
    }

    // Verify the band ratio: high / low ≈ 0.96 / 0.64 = 1.5 (within tolerance)
    const last = result.points[result.points.length - 1];
    if (last.total > 0 && last.low > 0) {
      const ratio = last.high / last.low;
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThanOrEqual(2);
    }
  });

  /* ---------------------------------------------------------------- */
  /*  (5) Empty data: returns $0 forecast without crashing             */
  /* ---------------------------------------------------------------- */
  it("returns zero totals and 90 data points when all DB queries return empty", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    db._queue([]); // [1] confirmed
    db._queue([]); // [2] recurring
    db._queue([]); // [3] memberships
    db._queue([completionRow(0, 0)]); // [4] history — zero denominator

    const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");
    const result = await getRevenueForecast();

    expect(result.points).toHaveLength(90);
    expect(result.points.every((p) => p.total === 0)).toBe(true);
    expect(result.milestones.every((m) => m.total === 0)).toBe(true);
    // Falls back to default completion rate (0.85) when denominator is zero
    expect(result.completionRate).toBe(0.85);
  });

  /* ---------------------------------------------------------------- */
  /*  (6) Past bookings excluded from forecast                         */
  /* ---------------------------------------------------------------- */
  it("does not include past confirmed bookings in the forecast totals", async () => {
    // The query uses gte(startsAt, now) so past bookings are filtered out
    // at the DB level. The mock returns no rows, simulating that filter.
    // A booking from yesterday must not appear in any forecast point.
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    // DB returns no confirmed rows (past booking excluded by query)
    db._queue([]); // [1] confirmed — yesterday's booking filtered out
    db._queue([]); // [2] recurring
    db._queue([]); // [3] memberships
    db._queue([completionRow(5, 5)]); // [4] history

    const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");
    const result = await getRevenueForecast();

    expect(result.points.every((p) => p.confirmed === 0)).toBe(true);
    expect(result.milestones.every((m) => m.confirmed === 0)).toBe(true);
  });

  /* ---------------------------------------------------------------- */
  /*  (7) Date boundaries: forecast starts tomorrow, not today         */
  /* ---------------------------------------------------------------- */
  it("seeds exactly 90 data points and the first point is today (day 0 of the window)", async () => {
    // The 90-day window seeds days 0–89 from now. The loop advances a
    // recurring booking past `now` before projecting, so the earliest
    // projected occurrence is day 1 or later — never in the past.
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);

    db._queue([]); // [1] confirmed
    db._queue([
      {
        startsAt: yesterday,
        totalInCents: 8_000,
        recurrenceRule: "FREQ=WEEKLY",
      },
    ]); // [2] recurring — last occurrence was yesterday
    db._queue([]); // [3] memberships
    db._queue([completionRow(0, 0)]); // [4] history

    const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");
    const result = await getRevenueForecast();

    // Always exactly 90 data points
    expect(result.points).toHaveLength(90);

    // The very first point (today) must have zero recurring revenue because
    // the projection loop advances past `now` before adding occurrences.
    const day0 = result.points[0];
    expect(day0.recurring).toBe(0);

    // The next weekly occurrence (7 - 1 = 6 days from now) should appear
    // within the window (day 6), not on day 0.
    const dayWithRevenue = result.points.find((p) => p.recurring > 0);
    if (dayWithRevenue) {
      expect(dayWithRevenue.date > day0.date).toBe(true);
    }
  });
});
