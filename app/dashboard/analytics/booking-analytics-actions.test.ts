import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/analytics/booking-analytics-actions.ts
 *
 * Covers:
 *  getBookingsTrend    — pivots rows into { week, lash, jewelry, ... }; empty = []
 *  getServiceMix       — computes pct share; empty = []; null category filtered out
 *  getAttendanceStats  — completion rate, no-show, cancelled, revenueLost; empty = zeroes
 *  getPeakTimes        — byHour / byDay load percentages; empty = all-zero loads
 *  getTopServices      — top 6 by count, revenue cents→dollars; empty = []
 *  exportBookingsCsv   — formats date, price, staff/client names; empty = []
 *  SQL error           — Sentry.captureException called, error rethrown
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, drizzle-orm/pg-core,
 *        @/lib/auth, @sentry/nextjs,
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
    having: () => chain,
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
/*  Mock setup                                                         */
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
    db: {
      select: selectFn,
      execute: execFn,
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      staffId: "staffId",
      serviceId: "serviceId",
      startsAt: "startsAt",
      completedAt: "completedAt",
      status: "status",
      totalInCents: "totalInCents",
      durationMinutes: "durationMinutes",
      clientNotes: "clientNotes",
      cancellationReason: "cancellationReason",
    },
    services: { id: "id", name: "name", category: "category" },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      role: "role",
      source: "source",
      createdAt: "createdAt",
    },
    payments: {
      id: "id",
      clientId: "clientId",
      bookingId: "bookingId",
      amountInCents: "amountInCents",
      status: "status",
      paidAt: "paidAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lt: vi.fn((...a: unknown[]) => ({ type: "lt", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    sql: makeSql(),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: unknown, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@/app/dashboard/analytics/_shared", () => ({
    getUser: mockRequireAdmin,
    rangeToInterval: vi.fn(() => "30 days"),
    weekLabel: vi.fn((d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ),
    CATEGORY_LABELS: {
      lash: "Lash Services",
      jewelry: "Jewelry",
      crochet: "Crochet",
      consulting: "Consulting",
    },
  }));

  return { selectFn, execFn };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("booking-analytics-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- getBookingsTrend ---- */

  describe("getBookingsTrend", () => {
    it("pivots rows into weekly category buckets", async () => {
      vi.resetModules();
      const weekStart = new Date("2026-03-16");
      setupMocks([
        [
          { weekStart, category: "lash", count: 10 },
          { weekStart, category: "jewelry", count: 4 },
        ],
      ]);
      const { getBookingsTrend } =
        await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getBookingsTrend("30d");

      expect(result).toHaveLength(1);
      expect(result[0].lash).toBe(10);
      expect(result[0].jewelry).toBe(4);
      expect(result[0].crochet).toBe(0);
    });

    it("returns empty array when no rows", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getBookingsTrend } =
        await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getBookingsTrend("30d");

      expect(result).toEqual([]);
    });
  });

  /* ---- getServiceMix ---- */

  describe("getServiceMix", () => {
    it("computes pct share for each category", async () => {
      vi.resetModules();
      setupMocks([
        [
          { category: "lash", count: 75 },
          { category: "jewelry", count: 25 },
        ],
      ]);
      const { getServiceMix } = await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getServiceMix("30d");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ label: "Lash Services", pct: 75, count: 75 });
      expect(result[1]).toMatchObject({ label: "Jewelry", pct: 25, count: 25 });
    });

    it("filters out null category rows", async () => {
      vi.resetModules();
      setupMocks([
        [
          { category: null, count: 5 },
          { category: "lash", count: 20 },
        ],
      ]);
      const { getServiceMix } = await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getServiceMix("30d");

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Lash Services");
    });

    it("returns empty array when no bookings", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getServiceMix } = await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getServiceMix("30d");

      expect(result).toEqual([]);
    });
  });

  /* ---- getAttendanceStats ---- */

  describe("getAttendanceStats", () => {
    it("calculates total, revenueLost, and rates correctly", async () => {
      vi.resetModules();
      setupMocks([[{ completed: 80, noShow: 10, cancelled: 10, lostCents: 50000 }]]);
      const { getAttendanceStats } =
        await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getAttendanceStats("30d");

      expect(result).toMatchObject({
        completed: 80,
        noShow: 10,
        cancelled: 10,
        total: 100,
        revenueLost: 500, // 50000 / 100
      });
    });

    it("returns zeroes for empty data", async () => {
      vi.resetModules();
      setupMocks([[{ completed: 0, noShow: 0, cancelled: 0, lostCents: 0 }]]);
      const { getAttendanceStats } =
        await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getAttendanceStats("30d");

      expect(result.total).toBe(0);
      expect(result.revenueLost).toBe(0);
    });
  });

  /* ---- getPeakTimes ---- */

  describe("getPeakTimes", () => {
    it("returns byHour and byDay with load percentages", async () => {
      vi.resetModules();
      // getPeakTimes uses Promise.all: two parallel selects
      let callIdx = 0;
      const selectFn = vi.fn(() => {
        callIdx++;
        if (callIdx === 1) return makeChain([{ hour: 11, count: 20 }]); // byHour
        return makeChain([{ dow: 5, count: 15 }]); // byDay (Friday)
      });
      vi.doMock("@/db", () => ({
        db: {
          select: selectFn,
          execute: vi.fn().mockResolvedValue([]),
          insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
          update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
          delete: vi.fn(() => ({ where: vi.fn() })),
        },
      }));
      vi.doMock("@/db/schema", () => ({
        bookings: { startsAt: "startsAt", status: "status", totalInCents: "totalInCents" },
        services: { id: "id", name: "name", category: "category" },
        profiles: { id: "id", firstName: "firstName", lastName: "lastName" },
        payments: { id: "id", amountInCents: "amountInCents", status: "status", paidAt: "paidAt" },
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
        and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
        gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
        sql: makeSql(),
        desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn((_t: unknown, name: string) => ({ _alias: name })),
      }));
      vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
      vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
      vi.doMock("@/app/dashboard/analytics/_shared", () => ({
        getUser: mockRequireAdmin,
        rangeToInterval: vi.fn(() => "30 days"),
        weekLabel: vi.fn((d: Date) => d.toLocaleDateString()),
        CATEGORY_LABELS: {},
      }));

      const { getPeakTimes } = await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getPeakTimes("30d");

      expect(result.byHour).toHaveLength(10); // 9am–6pm
      expect(result.byDay).toHaveLength(7); // Sun–Sat
      // Hour 11 (index 2 in 9am-based array) should be 100% since it's the max
      expect(result.byHour[2].load).toBe(100);
    });

    it("returns all-zero loads when no bookings", async () => {
      vi.resetModules();
      let callIdx = 0;
      const selectFn = vi.fn(() => {
        callIdx++;
        return makeChain([]);
      });
      vi.doMock("@/db", () => ({
        db: {
          select: selectFn,
          execute: vi.fn().mockResolvedValue([]),
          insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
          update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
          delete: vi.fn(() => ({ where: vi.fn() })),
        },
      }));
      vi.doMock("@/db/schema", () => ({
        bookings: { startsAt: "startsAt", status: "status", totalInCents: "totalInCents" },
        services: { id: "id", name: "name", category: "category" },
        profiles: { id: "id", firstName: "firstName", lastName: "lastName" },
        payments: { id: "id", amountInCents: "amountInCents", status: "status", paidAt: "paidAt" },
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
        and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
        gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
        sql: makeSql(),
        desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn((_t: unknown, name: string) => ({ _alias: name })),
      }));
      vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
      vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
      vi.doMock("@/app/dashboard/analytics/_shared", () => ({
        getUser: mockRequireAdmin,
        rangeToInterval: vi.fn(() => "30 days"),
        weekLabel: vi.fn((d: Date) => d.toLocaleDateString()),
        CATEGORY_LABELS: {},
      }));

      const { getPeakTimes } = await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getPeakTimes("30d");

      expect(result.byHour.every((s) => s.load === 0)).toBe(true);
      expect(result.byDay.every((s) => s.load === 0)).toBe(true);
    });
  });

  /* ---- getTopServices ---- */

  describe("getTopServices", () => {
    it("converts cents to dollars and returns top services", async () => {
      vi.resetModules();
      setupMocks([
        [
          { serviceName: "Classic Full Set", bookingCount: 40, revenue: 480000 },
          { serviceName: "Permanent Bracelet", bookingCount: 15, revenue: 120000 },
        ],
      ]);
      const { getTopServices } =
        await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getTopServices("30d");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        service: "Classic Full Set",
        bookings: 40,
        revenue: 4800, // 480000 / 100
      });
    });

    it("returns empty array when no bookings", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getTopServices } =
        await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await getTopServices("30d");

      expect(result).toEqual([]);
    });
  });

  /* ---- exportBookingsCsv ---- */

  describe("exportBookingsCsv", () => {
    it("formats booking rows with price and staff/client names", async () => {
      vi.resetModules();
      setupMocks([
        [
          {
            startsAt: new Date("2026-04-01T10:00:00Z"),
            clientFirst: "Jane",
            clientLast: "Doe",
            serviceName: "Classic Full Set",
            status: "completed",
            durationMin: 90,
            totalInCents: 12000,
            staffFirst: "Alice",
            staffLast: "Smith",
            notes: "New client",
          },
        ],
      ]);
      const { exportBookingsCsv } =
        await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await exportBookingsCsv();

      expect(result).toHaveLength(1);
      expect(result[0].client).toBe("Jane Doe");
      expect(result[0].staff).toBe("Alice Smith");
      expect(result[0].priceUsd).toBe("$120.00");
      expect(result[0].service).toBe("Classic Full Set");
    });

    it("returns empty array and no error when no bookings", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { exportBookingsCsv } =
        await import("@/app/dashboard/analytics/booking-analytics-actions");

      const result = await exportBookingsCsv();

      expect(result).toEqual([]);
    });
  });

  /* ---- SQL error handling ---- */

  describe("SQL error handling", () => {
    it("captures exception and rethrows when DB throws", async () => {
      vi.resetModules();
      const dbError = new Error("DB connection failed");
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
        bookings: { startsAt: "startsAt", status: "status", totalInCents: "totalInCents" },
        services: { id: "id", name: "name", category: "category" },
        profiles: { id: "id", firstName: "firstName", lastName: "lastName" },
        payments: { id: "id", amountInCents: "amountInCents", status: "status", paidAt: "paidAt" },
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
        and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
        gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
        desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
        sql: makeSql(),
      }));
      vi.doMock("drizzle-orm/pg-core", () => ({
        alias: vi.fn((_t: unknown, name: string) => ({ _alias: name })),
      }));
      vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
      vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
      vi.doMock("@/app/dashboard/analytics/_shared", () => ({
        getUser: mockRequireAdmin,
        rangeToInterval: vi.fn(() => "30 days"),
        weekLabel: vi.fn(),
        CATEGORY_LABELS: {},
      }));

      const { getTopServices } =
        await import("@/app/dashboard/analytics/booking-analytics-actions");

      await expect(getTopServices("30d")).rejects.toThrow("DB connection failed");
      expect(mockCaptureException).toHaveBeenCalledWith(dbError);
    });
  });
});
