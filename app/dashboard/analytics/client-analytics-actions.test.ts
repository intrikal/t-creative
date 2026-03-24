import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/analytics/client-analytics-actions.ts
 *
 * Covers:
 *  getRetentionTrend     — 30d range: new vs returning from CTE; 90d: materialized view
 *  getAtRiskClients      — inactive 30+ days; urgency levels; empty = []
 *  getClientSources      — source distribution with pct; empty = []
 *  getClientLifetimeValues — top 10 by spend, cents→dollars; empty = []
 *  getVisitFrequency     — bucket distribution; all-zero when no completed bookings
 *  getRebookRates        — rebook rate per service; empty = []
 *  getCancellationReasons — reason breakdown with pct; "No reason given" fallback
 *  SQL error             — captureException + rethrow
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
    having: () => chain,
    limit: () => chain,
    selectDistinctOn: () => chain,
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

  // selectDistinctOn needs to be on db directly (used in getAtRiskClients)
  const selectDistinctOnFn = vi.fn(() => {
    const rows = selectResponses[callIdx] ?? [];
    callIdx++;
    return makeChain(rows);
  });

  const execFn = executeFn ?? vi.fn().mockResolvedValue([]);

  vi.doMock("@/db", () => ({
    db: {
      select: selectFn,
      selectDistinctOn: selectDistinctOnFn,
      execute: execFn,
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      staffId: "staffId",
      serviceId: "serviceId",
      startsAt: "startsAt",
      status: "status",
      cancellationReason: "cancellationReason",
    },
    payments: {
      id: "id",
      clientId: "clientId",
      amountInCents: "amountInCents",
      status: "status",
      paidAt: "paidAt",
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
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lt: vi.fn((...a: unknown[]) => ({ type: "lt", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
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
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("client-analytics-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- getRetentionTrend ---- */

  describe("getRetentionTrend", () => {
    it("uses db.execute CTE for 30d range and computes returning = unique - new", async () => {
      vi.resetModules();
      const execFn = vi.fn().mockResolvedValue([
        { week_start: new Date("2026-03-16"), unique_clients: 20, new_clients: 8 },
        { week_start: new Date("2026-03-23"), unique_clients: 25, new_clients: 5 },
      ]);
      setupMocks([], execFn);
      const { getRetentionTrend } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getRetentionTrend("30d");

      expect(result).toHaveLength(2);
      expect(result[0].newClients).toBe(8);
      expect(result[0].returning).toBe(12); // 20 - 8
      expect(result[1].returning).toBe(20); // 25 - 5
    });

    it("uses materialized view for 90d range", async () => {
      vi.resetModules();
      const execFn = vi.fn().mockResolvedValue([
        { month: new Date("2026-01-01"), new_clients: "15", returning_clients: "40" },
        { month: new Date("2026-02-01"), new_clients: "12", returning_clients: "50" },
        { month: new Date("2026-03-01"), new_clients: "18", returning_clients: "55" },
      ]);
      setupMocks([], execFn);
      const { getRetentionTrend } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getRetentionTrend("90d");

      expect(result).toHaveLength(3);
      expect(result[0].newClients).toBe(15);
      expect(result[0].returning).toBe(40);
    });

    it("returns empty array when no retention data", async () => {
      vi.resetModules();
      setupMocks([], vi.fn().mockResolvedValue([]));
      const { getRetentionTrend } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getRetentionTrend("30d");

      expect(result).toEqual([]);
    });
  });

  /* ---- getAtRiskClients ---- */

  describe("getAtRiskClients", () => {
    it("returns at-risk clients with daysSince and urgency level", async () => {
      vi.resetModules();
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      // getAtRiskClients: select(atRiskRows), then selectDistinctOn(lastServiceRows)
      setupMocks([
        [
          {
            clientId: "client-1",
            firstName: "Jane",
            lastName: "Doe",
            lastVisit: oldDate,
          },
        ],
        // selectDistinctOn for last service
        [{ clientId: "client-1", serviceName: "Classic Full Set" }],
      ]);
      const { getAtRiskClients } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getAtRiskClients();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Jane Doe");
      expect(result[0].service).toBe("Classic Full Set");
      expect(result[0].daysSince).toBeGreaterThanOrEqual(59);
      expect(result[0].urgency).toBe("high"); // > 50 days
    });

    it("returns empty array when no at-risk clients", async () => {
      vi.resetModules();
      setupMocks([[], []]);
      const { getAtRiskClients } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getAtRiskClients();

      expect(result).toEqual([]);
    });
  });

  /* ---- getClientSources ---- */

  describe("getClientSources", () => {
    it("computes pct distribution across acquisition sources", async () => {
      vi.resetModules();
      setupMocks([
        [
          { source: "instagram", count: 60 },
          { source: "referral", count: 30 },
          { source: "google", count: 10 },
        ],
      ]);
      const { getClientSources } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getClientSources();

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ source: "instagram", count: 60, pct: 60 });
      expect(result[1]).toMatchObject({ source: "referral", count: 30, pct: 30 });
      expect(result[2]).toMatchObject({ source: "google", count: 10, pct: 10 });
    });

    it("returns empty array when no source data", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getClientSources } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getClientSources();

      expect(result).toEqual([]);
    });
  });

  /* ---- getClientLifetimeValues ---- */

  describe("getClientLifetimeValues", () => {
    it("converts total spend from cents to dollars", async () => {
      vi.resetModules();
      setupMocks([
        [
          { clientId: "c1", firstName: "Jane", lastName: "Doe", totalSpend: 120000, txCount: 8 },
          { clientId: "c2", firstName: "Bob", lastName: null, totalSpend: 60000, txCount: 4 },
        ],
      ]);
      const { getClientLifetimeValues } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getClientLifetimeValues();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        clientId: "c1",
        name: "Jane Doe",
        totalSpend: 1200,
        transactionCount: 8,
      });
      expect(result[1]).toMatchObject({ name: "Bob", totalSpend: 600 });
    });

    it("returns empty array when no payments", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getClientLifetimeValues } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getClientLifetimeValues();

      expect(result).toEqual([]);
    });
  });

  /* ---- getVisitFrequency ---- */

  describe("getVisitFrequency", () => {
    it("buckets clients into visit frequency ranges", async () => {
      vi.resetModules();
      // 3 clients: 1 visit, 2 visits, 5 visits
      setupMocks([
        [
          { clientId: "c1", visits: 1 },
          { clientId: "c2", visits: 2 },
          { clientId: "c3", visits: 5 },
        ],
      ]);
      const { getVisitFrequency } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getVisitFrequency("30d");

      expect(result).toHaveLength(5); // 5 buckets always
      const oneVisit = result.find((b) => b.label === "1 visit");
      const twoThree = result.find((b) => b.label === "2–3 visits");
      const fourSix = result.find((b) => b.label === "4–6 visits");
      expect(oneVisit?.clients).toBe(1);
      expect(twoThree?.clients).toBe(1);
      expect(fourSix?.clients).toBe(1);
    });

    it("returns all-zero buckets when no completed bookings", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getVisitFrequency } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getVisitFrequency("30d");

      expect(result.every((b) => b.clients === 0 && b.pct === 0)).toBe(true);
    });
  });

  /* ---- getRebookRates ---- */

  describe("getRebookRates", () => {
    it("calculates rebook rate per service", async () => {
      vi.resetModules();
      setupMocks([
        [
          { serviceName: "Classic Full Set", totalClients: 20, rebookedClients: 15 },
          { serviceName: "Permanent Bracelet", totalClients: 10, rebookedClients: 4 },
        ],
      ]);
      const { getRebookRates } = await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getRebookRates();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ service: "Classic Full Set", rate: 75 }); // 15/20
      expect(result[1]).toMatchObject({ service: "Permanent Bracelet", rate: 40 }); // 4/10
    });

    it("returns empty array when no bookings", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getRebookRates } = await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getRebookRates();

      expect(result).toEqual([]);
    });
  });

  /* ---- getCancellationReasons ---- */

  describe("getCancellationReasons", () => {
    it("returns reason breakdown with pct and fallback label", async () => {
      vi.resetModules();
      setupMocks([
        [
          { reason: "schedule_conflict", count: 5 },
          { reason: null, count: 3 },
        ],
      ]);
      const { getCancellationReasons } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getCancellationReasons();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ reason: "schedule_conflict", count: 5, pct: 63 }); // round(5/8*100)
      expect(result[1].reason).toBe("No reason given");
    });

    it("returns empty array when no cancellations", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getCancellationReasons } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      const result = await getCancellationReasons();

      expect(result).toEqual([]);
    });
  });

  /* ---- SQL error handling ---- */

  describe("SQL error handling", () => {
    it("captures exception and rethrows on DB error", async () => {
      vi.resetModules();
      const dbError = new Error("connection refused");
      vi.doMock("@/db", () => ({
        db: {
          select: vi.fn(() => {
            throw dbError;
          }),
          selectDistinctOn: vi.fn(() => {
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
          clientId: "clientId",
          status: "status",
          cancellationReason: "cancellationReason",
        },
        payments: { clientId: "clientId", amountInCents: "amountInCents", status: "status" },
        services: { id: "id", name: "name" },
        profiles: {
          id: "id",
          firstName: "firstName",
          lastName: "lastName",
          role: "role",
          source: "source",
        },
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
        and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
        gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
        desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
        inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
        isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
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

      const { getCancellationReasons } =
        await import("@/app/dashboard/analytics/client-analytics-actions");

      await expect(getCancellationReasons()).rejects.toThrow("connection refused");
      expect(mockCaptureException).toHaveBeenCalledWith(dbError);
    });
  });
});
