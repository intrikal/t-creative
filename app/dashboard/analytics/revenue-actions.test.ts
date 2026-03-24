import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/analytics/revenue-actions.ts
 *
 * Covers:
 *  getKpiStats       — revenue, bookings, newClients, noShowRate, fillRate, avgTicket + deltas
 *  getKpiStats       — empty period → zeroes, null deltas
 *  getRevenueTrend   — weekly revenue rows; empty = []
 *  getRevenueByService — by service with pct; only 'paid' payments; empty = []
 *  getRevenuePerHour — revenue per available hour by day of week; no business hours = 0
 *  getRevenueGoal    — returns matched month goal; falls back to financial_config; default 12000
 *  SQL error         — captureException + rethrow
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

function setupMocks(selectResponses: unknown[][] = [], executeFn?: ReturnType<typeof vi.fn>) {
  let callIdx = 0;
  const selectFn = vi.fn(() => {
    const rows = selectResponses[callIdx] ?? [];
    callIdx++;
    return makeChain(rows);
  });

  const execFn = executeFn ?? vi.fn().mockResolvedValue([]);

  vi.doMock("@/db", () => ({
    db: { select: selectFn, execute: execFn, insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  }));
  vi.doMock("@/db/schema", () => ({
    bookings: { id: "id", startsAt: "startsAt", status: "status", totalInCents: "totalInCents" },
    payments: {
      id: "id",
      clientId: "clientId",
      bookingId: "bookingId",
      amountInCents: "amountInCents",
      status: "status",
      paidAt: "paidAt",
    },
    services: { id: "id", name: "name", category: "category" },
    profiles: { id: "id", role: "role", createdAt: "createdAt" },
    settings: { id: "id", key: "key", value: "value" },
    businessHours: {
      id: "id",
      staffId: "staffId",
      dayOfWeek: "dayOfWeek",
      isOpen: "isOpen",
      opensAt: "opensAt",
      closesAt: "closesAt",
    },
    timeOff: {
      id: "id",
      staffId: "staffId",
      startDate: "startDate",
      endDate: "endDate",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lt: vi.fn((...a: unknown[]) => ({ type: "lt", a })),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    sql: makeSql(),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@/app/dashboard/analytics/_shared", () => ({
    getUser: mockRequireAdmin,
    rangeToInterval: vi.fn(() => "30 days"),
    weekLabel: vi.fn((d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ),
    CATEGORY_LABELS: { lash: "Lash Services", jewelry: "Jewelry" },
  }));

  return { selectFn, execFn };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("revenue-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- getKpiStats ---- */

  describe("getKpiStats", () => {
    it("calculates revenue, bookings, clients, noShowRate, fillRate, avgTicket with deltas", async () => {
      vi.resetModules();
      // computeKpiForPeriod is called twice (current + prior), each needing 4 selects
      // Order per call: revRow, bookRow, clientRow, statusRow (all via .then())
      // 8 total selects: current period [0-3], prior period [4-7]
      setupMocks([
        // current period
        [{ total: 200000, count: 20 }], // revRow: $2000, 20 payments
        [{ count: 25 }], // bookRow: 25 bookings
        [{ count: 5 }], // clientRow: 5 new clients
        [{ noShows: 2, completed: 20, total: 25 }], // statusRow
        // prior period
        [{ total: 100000, count: 10 }], // revRow: $1000
        [{ count: 10 }], // bookRow
        [{ count: 2 }], // clientRow
        [{ noShows: 1, completed: 8, total: 10 }], // statusRow
      ]);
      const { getKpiStats } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getKpiStats("30d");

      expect(result.revenueMtd).toBe(2000);
      expect(result.bookingCount).toBe(25);
      expect(result.newClients).toBe(5);
      expect(result.avgTicket).toBe(100); // 2000 / 20
      expect(result.noShowRate).toBe(8); // round(2/25*100)
      expect(result.fillRate).toBe(80); // round(20/25*100)
      // Deltas: current vs prior
      expect(result.revenueMtdDelta).toBe(100); // (2000-1000)/1000*100
      expect(result.bookingCountDelta).toBe(150); // (25-10)/10*100
    });

    it("returns zeroes and null deltas when no prior data", async () => {
      vi.resetModules();
      setupMocks([
        // current period
        [{ total: 0, count: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
        [{ noShows: 0, completed: 0, total: 0 }],
        // prior period (all zero)
        [{ total: 0, count: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
        [{ noShows: 0, completed: 0, total: 0 }],
      ]);
      const { getKpiStats } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getKpiStats("30d");

      expect(result.revenueMtd).toBe(0);
      expect(result.avgTicket).toBe(0);
      expect(result.noShowRate).toBe(0);
      expect(result.fillRate).toBe(0);
      // pctDelta(0, 0) → null (prior = 0)
      expect(result.revenueMtdDelta).toBeNull();
    });
  });

  /* ---- getRevenueTrend ---- */

  describe("getRevenueTrend", () => {
    it("converts cents to dollars from materialized view", async () => {
      vi.resetModules();
      const execFn = vi.fn().mockResolvedValue([
        { week_start: new Date("2026-03-16"), total: "300000" },
        { week_start: new Date("2026-03-23"), total: "450000" },
      ]);
      setupMocks([], execFn);
      const { getRevenueTrend } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getRevenueTrend("30d");

      expect(result).toHaveLength(2);
      expect(result[0].revenue).toBe(3000); // 300000/100
      expect(result[1].revenue).toBe(4500);
    });

    it("returns empty array when no revenue data", async () => {
      vi.resetModules();
      setupMocks([], vi.fn().mockResolvedValue([]));
      const { getRevenueTrend } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getRevenueTrend("30d");

      expect(result).toEqual([]);
    });
  });

  /* ---- getRevenueByService ---- */

  describe("getRevenueByService", () => {
    it("computes pct share and converts cents to dollars", async () => {
      vi.resetModules();
      const execFn = vi.fn().mockResolvedValue([
        {
          service_name: "Classic Full Set",
          service_category: "lash",
          revenue: "480000",
          booking_count: "40",
        },
        {
          service_name: "Permanent Bracelet",
          service_category: "jewelry",
          revenue: "120000",
          booking_count: "10",
        },
      ]);
      setupMocks([], execFn);
      const { getRevenueByService } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getRevenueByService("30d");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        service: "Classic Full Set",
        category: "Lash Services",
        revenue: 4800,
        bookings: 40,
        pct: 80, // 480000 / 600000 * 100
      });
      expect(result[1].pct).toBe(20);
    });

    it("returns empty array when no revenue rows", async () => {
      vi.resetModules();
      setupMocks([], vi.fn().mockResolvedValue([]));
      const { getRevenueByService } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getRevenueByService("30d");

      expect(result).toEqual([]);
    });
  });

  /* ---- getRevenuePerHour ---- */

  describe("getRevenuePerHour", () => {
    it("returns 7 day entries; revenuePerHour=0 when no business hours configured", async () => {
      vi.resetModules();
      // getRevenuePerHour uses Promise.all: hours, lunchRow, timeOffRows, revenueRows
      setupMocks([
        [], // businessHours: empty → no open days
        [], // settings (lunch): empty
        [], // timeOff: empty
        [], // revenueRows: empty
      ]);
      const { getRevenuePerHour } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getRevenuePerHour("30d");

      expect(result).toHaveLength(7);
      expect(result.every((r) => r.revenuePerHour === 0)).toBe(true);
    });
  });

  /* ---- getRevenueGoal ---- */

  describe("getRevenueGoal", () => {
    it("returns matching monthly goal from revenue_goals setting", async () => {
      vi.resetModules();
      const currentMonth = new Date().toISOString().slice(0, 7);
      setupMocks([[{ key: "revenue_goals", value: [{ month: currentMonth, amount: 15000 }] }]]);
      const { getRevenueGoal } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getRevenueGoal();

      expect(result).toBe(15000);
    });

    it("falls back to financial_config.revenueGoalMonthly when no month match", async () => {
      vi.resetModules();
      setupMocks([
        [
          { key: "revenue_goals", value: [{ month: "2020-01", amount: 5000 }] }, // wrong month
          { key: "financial_config", value: { revenueGoalMonthly: 18000 } },
        ],
      ]);
      const { getRevenueGoal } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getRevenueGoal();

      expect(result).toBe(18000);
    });

    it("returns default 12000 when no settings exist", async () => {
      vi.resetModules();
      setupMocks([[]]); // no settings rows
      const { getRevenueGoal } = await import("@/app/dashboard/analytics/revenue-actions");

      const result = await getRevenueGoal();

      expect(result).toBe(12000);
    });
  });

  /* ---- SQL error handling ---- */

  describe("SQL error handling", () => {
    it("captures exception and rethrows on DB error", async () => {
      vi.resetModules();
      const dbError = new Error("query failed");
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
        bookings: { startsAt: "startsAt", status: "status" },
        payments: { amountInCents: "amountInCents", status: "status", paidAt: "paidAt" },
        services: { id: "id", name: "name", category: "category" },
        profiles: { id: "id", role: "role", createdAt: "createdAt" },
        settings: { key: "key", value: "value" },
        businessHours: {
          dayOfWeek: "dayOfWeek",
          isOpen: "isOpen",
          opensAt: "opensAt",
          closesAt: "closesAt",
          staffId: "staffId",
        },
        timeOff: { startDate: "startDate", endDate: "endDate", staffId: "staffId" },
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
        and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
        gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
        lt: vi.fn((...a: unknown[]) => ({ type: "lt", a })),
        inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
        sql: makeSql(),
      }));
      vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
      vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
      vi.doMock("@/app/dashboard/analytics/_shared", () => ({
        getUser: mockRequireAdmin,
        rangeToInterval: vi.fn(() => "30 days"),
        weekLabel: vi.fn(),
        CATEGORY_LABELS: {},
      }));

      const { getRevenueGoal } = await import("@/app/dashboard/analytics/revenue-actions");

      await expect(getRevenueGoal()).rejects.toThrow("query failed");
      expect(mockCaptureException).toHaveBeenCalledWith(dbError);
    });
  });
});
