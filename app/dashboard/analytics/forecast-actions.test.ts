import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/analytics/forecast-actions.ts
 *
 * Covers:
 *  getRevenueForecast — confirmed bookings appear in daily forecast
 *  getRevenueForecast — recurring bookings projected forward by interval
 *  getRevenueForecast — membership renewals projected by cycleIntervalDays
 *  getRevenueForecast — 30/60/90-day milestones present in result
 *  getRevenueForecast — historical completion rate used for confidence bands
 *  getRevenueForecast — empty data → 90 points with total=0, completionRate=0.85 default
 *  SQL error          — captureException + rethrow
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, @/lib/auth, @sentry/nextjs,
 *        app/dashboard/analytics/_shared.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    limit: () => chain,
    then(onFulfilled: (v: unknown) => unknown) {
      return resolved.then(onFulfilled);
    },
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mocks                                                       */
/* ------------------------------------------------------------------ */

const mockRequireAdmin = vi.fn().mockResolvedValue({ id: "admin-1" });
const mockCaptureException = vi.fn();

function makeSql() {
  const fn: any = vi.fn((..._a: unknown[]) => ({ type: "sql", as: vi.fn() }));
  fn.raw = vi.fn(() => ({ type: "sql.raw" }));
  fn.as = vi.fn();
  return fn;
}

function setupMocks(selectResponses: unknown[][] = []) {
  let callIdx = 0;
  const selectFn = vi.fn(() => {
    const rows = selectResponses[callIdx] ?? [];
    callIdx++;
    return makeChain(rows);
  });

  vi.doMock("@/db", () => ({
    db: {
      select: selectFn,
      execute: vi.fn().mockResolvedValue([]),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      startsAt: "startsAt",
      totalInCents: "totalInCents",
      status: "status",
      recurrenceRule: "recurrenceRule",
      deletedAt: "deletedAt",
    },
    membershipSubscriptions: {
      id: "id",
      clientId: "clientId",
      planId: "planId",
      status: "status",
      cycleEndsAt: "cycleEndsAt",
    },
    membershipPlans: {
      id: "id",
      name: "name",
      cycleIntervalDays: "cycleIntervalDays",
      priceInCents: "priceInCents",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lt: vi.fn((...a: unknown[]) => ({ type: "lt", a })),
    ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
    sql: makeSql(),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@/app/dashboard/analytics/_shared", () => ({
    getUser: mockRequireAdmin,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("forecast-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- empty data ---- */

  describe("getRevenueForecast — empty data", () => {
    it("returns 90 data points all with total=0 and default completionRate=0.85", async () => {
      vi.resetModules();
      setupMocks([
        [], // confirmedRows
        [], // recurringRows
        [], // activeSubs
        [{ completed: 0, total: 0 }], // completionRow
      ]);
      const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");

      const result = await getRevenueForecast();

      expect(result.points).toHaveLength(90);
      expect(result.points.every((p) => p.total === 0)).toBe(true);
      expect(result.completionRate).toBe(0.85); // default when total=0
      expect(result.milestones).toHaveLength(3);
      expect(result.milestones[0].days).toBe(30);
      expect(result.milestones[2].days).toBe(90);
      // all milestone totals = 0
      expect(result.milestones.every((m) => m.total === 0)).toBe(true);
    });
  });

  /* ---- confirmed bookings ---- */

  describe("getRevenueForecast — confirmed bookings", () => {
    it("includes confirmed booking revenue in daily points", async () => {
      vi.resetModules();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setupMocks([
        // confirmedRows: one booking tomorrow for $120
        [{ startsAt: tomorrow, totalInCents: 12000 }],
        // recurringRows: none
        [],
        // activeSubs: none
        [],
        // completionRow
        [{ completed: 85, total: 100 }],
      ]);
      const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");

      const result = await getRevenueForecast();

      // total confirmed by day 1 should reflect the booking
      const tomorrowISO = tomorrow.toISOString().slice(0, 10);
      const tomorrowPoint = result.points.find((p) => p.date === tomorrowISO);
      expect(tomorrowPoint).toBeDefined();
      expect(tomorrowPoint!.confirmed).toBeGreaterThan(0);
      expect(result.completionRate).toBe(0.85);
    });
  });

  /* ---- recurring bookings ---- */

  describe("getRevenueForecast — recurring bookings", () => {
    it("projects weekly recurring booking into future dates", async () => {
      vi.resetModules();
      // A booking from 7 days ago with FREQ=WEEKLY rule
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      setupMocks([
        // confirmedRows: none
        [],
        // recurringRows: weekly recurring booking worth $100
        [{ startsAt: lastWeek, totalInCents: 10000, recurrenceRule: "FREQ=WEEKLY;INTERVAL=1" }],
        // activeSubs: none
        [],
        // completionRow
        [{ completed: 80, total: 100 }],
      ]);
      const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");

      const result = await getRevenueForecast();

      // At least one future point should have non-zero recurring
      const hasRecurring = result.points.some((p) => p.recurring > p.confirmed);
      expect(hasRecurring).toBe(true);
    });
  });

  /* ---- membership renewals ---- */

  describe("getRevenueForecast — memberships", () => {
    it("includes membership renewal revenue in forecast", async () => {
      vi.resetModules();
      // Membership renewal in 10 days
      const cycleEndsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      setupMocks([
        [], // confirmedRows
        [], // recurringRows
        // activeSubs: one active membership at $50/month
        [{ cycleEndsAt, cycleIntervalDays: 30, priceInCents: 5000 }],
        [{ completed: 90, total: 100 }],
      ]);
      const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");

      const result = await getRevenueForecast();

      const renewalDate = cycleEndsAt.toISOString().slice(0, 10);
      const renewalPoint = result.points.find((p) => p.date === renewalDate);
      expect(renewalPoint).toBeDefined();
      // total should include the membership amount
      expect(renewalPoint!.total).toBeGreaterThan(0);
    });
  });

  /* ---- milestones ---- */

  describe("getRevenueForecast — milestones", () => {
    it("always returns milestones at 30, 60, and 90 days", async () => {
      vi.resetModules();
      setupMocks([[], [], [], [{ completed: 0, total: 0 }]]);
      const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");

      const result = await getRevenueForecast();

      const days = result.milestones.map((m) => m.days);
      expect(days).toEqual([30, 60, 90]);
    });
  });

  /* ---- SQL error handling ---- */

  describe("SQL error handling", () => {
    it("captures exception and rethrows on DB error", async () => {
      vi.resetModules();
      const dbError = new Error("forecast DB error");
      vi.doMock("@/db", () => ({
        db: {
          select: vi.fn(() => {
            throw dbError;
          }),
          execute: vi.fn().mockRejectedValue(dbError),
          insert: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
      }));
      vi.doMock("@/db/schema", () => ({
        bookings: {
          startsAt: "startsAt",
          totalInCents: "totalInCents",
          status: "status",
          recurrenceRule: "recurrenceRule",
          deletedAt: "deletedAt",
        },
        membershipSubscriptions: { status: "status", cycleEndsAt: "cycleEndsAt", planId: "planId" },
        membershipPlans: {
          id: "id",
          cycleIntervalDays: "cycleIntervalDays",
          priceInCents: "priceInCents",
        },
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
        and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
        gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
        lt: vi.fn((...a: unknown[]) => ({ type: "lt", a })),
        ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
        isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
        sql: makeSql(),
      }));
      vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
      vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
      vi.doMock("@/app/dashboard/analytics/_shared", () => ({
        getUser: mockRequireAdmin,
      }));

      const { getRevenueForecast } = await import("@/app/dashboard/analytics/forecast-actions");

      await expect(getRevenueForecast()).rejects.toThrow("forecast DB error");
      expect(mockCaptureException).toHaveBeenCalledWith(dbError);
    });
  });
});
