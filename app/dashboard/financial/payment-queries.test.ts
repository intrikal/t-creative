/**
 * @file payment-queries.test.ts
 * Unit tests for financial/payment-queries.ts — read-only revenue, payment,
 * tax, P&L, expense, and deposit query functions.
 *
 * Covers:
 *  getPayments — throws when not authorized; returns mapped payment rows
 *  getRevenueStats — sums totals and computes avgTicket and pct delta
 *  getRevenueStats — empty table returns zero stats
 *  getCategoryRevenue — groups by service category and calculates pct
 *  getTaxEstimate — uses configured tax rate; falls back to 25%
 *  getProfitLoss — combines revenue and expense rows by month
 *  getProfitLoss — empty result returns empty array
 *  getExpenseStats — computes totals and month-over-month pct
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
    limit: () => chain,
    groupBy: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockRequireAdmin = vi.fn().mockResolvedValue({ id: "admin-1" });
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(dbOverrides: Partial<Record<string, unknown>> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
  };
  const db = { ...defaultDb, ...dbOverrides };

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    payments: {
      id: "id",
      bookingId: "bookingId",
      clientId: "clientId",
      amountInCents: "amountInCents",
      tipInCents: "tipInCents",
      taxAmountInCents: "taxAmountInCents",
      refundedInCents: "refundedInCents",
      method: "method",
      status: "status",
      paidAt: "paidAt",
      createdAt: "createdAt",
      squarePaymentId: "squarePaymentId",
    },
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      startsAt: "startsAt",
      depositPaidInCents: "depositPaidInCents",
    },
    services: {
      id: "id",
      name: "name",
      category: "category",
      depositInCents: "depositInCents",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
    expenses: {
      id: "id",
      amountInCents: "amountInCents",
      category: "category",
      expenseDate: "expenseDate",
    },
    orders: {
      id: "id",
      status: "status",
      finalInCents: "finalInCents",
    },
    settings: {
      key: "key",
      value: "value",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
    })),
  }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("financial/payment-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- getPayments ---- */

  describe("getPayments", () => {
    it("throws and calls Sentry when requireAdmin rejects", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValueOnce(new Error("Forbidden"));
      setupMocks();
      const { getPayments } = await import("./payment-queries");
      await expect(getPayments()).rejects.toThrow("Forbidden");
      expect(mockCaptureException).toHaveBeenCalled();
    });

    it("returns empty array when no payments exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getPayments } = await import("./payment-queries");
      const result = await getPayments();
      expect(result).toEqual([]);
    });

    it("maps DB rows to the PaymentRow display shape", async () => {
      vi.resetModules();
      const paidAt = new Date("2026-04-10T14:30:00Z");
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              paidAt,
              createdAt: paidAt,
              clientFirstName: "Jane",
              clientLastName: "Doe",
              serviceName: "Classic Full Set",
              serviceCategory: "lash",
              amountInCents: 12000,
              tipInCents: 1500,
              refundedInCents: 0,
              method: "square_card",
              status: "paid",
              squarePaymentId: "sq-abc",
            },
          ]),
        ),
      });
      const { getPayments } = await import("./payment-queries");
      const result = await getPayments();
      expect(result).toHaveLength(1);
      const row = result[0];
      expect(row.id).toBe(1);
      expect(row.client).toBe("Jane Doe");
      expect(row.service).toBe("Classic Full Set");
      expect(row.amount).toBe(120); // 12000 / 100
      expect(row.tip).toBe(15);    // 1500 / 100
      expect(row.method).toBe("square_card");
      expect(row.squarePaymentId).toBe("sq-abc");
    });

    it("falls back to 'Unknown' when client name parts are null", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 2,
              paidAt: null,
              createdAt: new Date(),
              clientFirstName: null,
              clientLastName: null,
              serviceName: null,
              serviceCategory: null,
              amountInCents: 5000,
              tipInCents: 0,
              refundedInCents: 0,
              method: "cash",
              status: "paid",
              squarePaymentId: null,
            },
          ]),
        ),
      });
      const { getPayments } = await import("./payment-queries");
      const result = await getPayments();
      expect(result[0].client).toBe("Unknown");
      expect(result[0].service).toBe("Unknown Service");
    });
  });

  /* ---- getRevenueStats ---- */

  describe("getRevenueStats", () => {
    it("throws when requireAdmin rejects", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValueOnce(new Error("Forbidden"));
      setupMocks();
      const { getRevenueStats } = await import("./payment-queries");
      await expect(getRevenueStats()).rejects.toThrow("Forbidden");
    });

    it("returns zero stats when no paid payments exist", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              totalRevenue: 0,
              totalTips: 0,
              count: 0,
              currentMonthRevenue: 0,
              priorMonthRevenue: 0,
              currentMonthTax: 0,
            },
          ]),
        ),
      });
      const { getRevenueStats } = await import("./payment-queries");
      const result = await getRevenueStats();
      expect(result.totalRevenue).toBe(0);
      expect(result.totalTips).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.avgTicket).toBe(0);
      expect(result.revenueVsPriorPeriodPct).toBeNull();
    });

    it("converts cents to dollars and computes avgTicket", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              totalRevenue: 300000, // $3000
              totalTips: 30000,    // $300
              count: 10,
              currentMonthRevenue: 150000,
              priorMonthRevenue: 100000,
              currentMonthTax: 5000, // $50
            },
          ]),
        ),
      });
      const { getRevenueStats } = await import("./payment-queries");
      const result = await getRevenueStats();
      expect(result.totalRevenue).toBe(3000);
      expect(result.totalTips).toBe(300);
      expect(result.transactionCount).toBe(10);
      expect(result.avgTicket).toBe(300); // 3000 / 10
      expect(result.taxCollected).toBe(50);
    });

    it("computes revenue vs prior period pct correctly", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              totalRevenue: 200000,
              totalTips: 0,
              count: 5,
              currentMonthRevenue: 150000,
              priorMonthRevenue: 100000,
              currentMonthTax: 0,
            },
          ]),
        ),
      });
      const { getRevenueStats } = await import("./payment-queries");
      const result = await getRevenueStats();
      // (150000 - 100000) / 100000 * 100 = 50
      expect(result.revenueVsPriorPeriodPct).toBe(50);
    });

    it("returns null pct when prior month had zero revenue", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              totalRevenue: 100000,
              totalTips: 0,
              count: 3,
              currentMonthRevenue: 100000,
              priorMonthRevenue: 0,
              currentMonthTax: 0,
            },
          ]),
        ),
      });
      const { getRevenueStats } = await import("./payment-queries");
      const result = await getRevenueStats();
      expect(result.revenueVsPriorPeriodPct).toBeNull();
    });
  });

  /* ---- getCategoryRevenue ---- */

  describe("getCategoryRevenue", () => {
    it("returns empty array when no payments exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getCategoryRevenue } = await import("./payment-queries");
      const result = await getCategoryRevenue();
      expect(result).toEqual([]);
    });

    it("groups revenue by category and computes percentage", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            { category: "lash", total: 80000 },
            { category: "jewelry", total: 20000 },
          ]),
        ),
      });
      const { getCategoryRevenue } = await import("./payment-queries");
      const result = await getCategoryRevenue();
      expect(result).toHaveLength(2);
      const lash = result.find((r) => r.category === "Lash Services");
      const jewelry = result.find((r) => r.category === "Jewelry");
      expect(lash?.amount).toBe(800); // 80000 / 100
      expect(lash?.pct).toBe(80);     // 80000 / 100000 * 100
      expect(jewelry?.amount).toBe(200);
      expect(jewelry?.pct).toBe(20);
    });
  });

  /* ---- getTaxEstimate ---- */

  describe("getTaxEstimate", () => {
    it("throws when requireAdmin rejects", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValueOnce(new Error("Forbidden"));
      setupMocks();
      const { getTaxEstimate } = await import("./payment-queries");
      await expect(getTaxEstimate()).rejects.toThrow("Forbidden");
    });

    it("uses configured tax rate from settings to estimate tax", async () => {
      vi.resetModules();
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount === 1) return makeChain([{ key: "financial_config", value: { estimatedTaxRate: 30 } }]);
          if (callCount === 2) return makeChain([{ total: 200000 }]); // $2000 revenue
          return makeChain([{ total: 50000 }]);                        // $500 expenses
        }),
      });
      const { getTaxEstimate } = await import("./payment-queries");
      const result = await getTaxEstimate();
      expect(result.taxRate).toBe(30);
      expect(result.revenue).toBe(2000);
      expect(result.expenses).toBe(500);
      expect(result.netIncome).toBe(1500);
      expect(result.estimatedTax).toBe(450); // 1500 * 0.30
    });

    it("falls back to 25% tax rate when settings row is absent", async () => {
      vi.resetModules();
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount === 1) return makeChain([]); // no settings row
          if (callCount === 2) return makeChain([{ total: 100000 }]);
          return makeChain([{ total: 0 }]);
        }),
      });
      const { getTaxEstimate } = await import("./payment-queries");
      const result = await getTaxEstimate();
      expect(result.taxRate).toBe(25);
    });

    it("clamps estimatedTax to 0 when net income is negative", async () => {
      vi.resetModules();
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount === 1) return makeChain([]);
          if (callCount === 2) return makeChain([{ total: 10000 }]);  // $100 revenue
          return makeChain([{ total: 50000 }]);                        // $500 expenses
        }),
      });
      const { getTaxEstimate } = await import("./payment-queries");
      const result = await getTaxEstimate();
      expect(result.netIncome).toBe(-400);
      expect(result.estimatedTax).toBe(0); // Math.max(0, negative)
    });
  });

  /* ---- getProfitLoss ---- */

  describe("getProfitLoss", () => {
    it("throws when requireAdmin rejects", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValueOnce(new Error("Forbidden"));
      setupMocks();
      const { getProfitLoss } = await import("./payment-queries");
      await expect(getProfitLoss()).rejects.toThrow("Forbidden");
    });

    it("returns empty array when no revenue or expense data exists", async () => {
      vi.resetModules();
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          return makeChain([]); // both revenue and expense queries return empty
        }),
      });
      const { getProfitLoss } = await import("./payment-queries");
      const result = await getProfitLoss();
      expect(result).toEqual([]);
    });

    it("computes profit as revenue minus expenses per month", async () => {
      vi.resetModules();
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount === 1) return makeChain([{ month: "2026-03", total: 300000 }]);
          return makeChain([{ month: "2026-03", total: 100000 }]);
        }),
      });
      const { getProfitLoss } = await import("./payment-queries");
      const result = await getProfitLoss();
      expect(result).toHaveLength(1);
      expect(result[0].revenue).toBe(3000);
      expect(result[0].expenses).toBe(1000);
      expect(result[0].profit).toBe(2000);
    });

    it("fills in zero expenses for months with revenue but no expenses", async () => {
      vi.resetModules();
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount === 1) return makeChain([{ month: "2026-02", total: 200000 }]);
          return makeChain([]); // no expenses
        }),
      });
      const { getProfitLoss } = await import("./payment-queries");
      const result = await getProfitLoss();
      expect(result).toHaveLength(1);
      expect(result[0].expenses).toBe(0);
      expect(result[0].profit).toBe(2000);
    });
  });

  /* ---- getExpenseStats ---- */

  describe("getExpenseStats", () => {
    it("throws when requireAdmin rejects", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValueOnce(new Error("Forbidden"));
      setupMocks();
      const { getExpenseStats } = await import("./payment-queries");
      await expect(getExpenseStats()).rejects.toThrow("Forbidden");
    });

    it("returns zero stats when no expenses exist", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ total: 0, count: 0 }])),
      });
      const { getExpenseStats } = await import("./payment-queries");
      const result = await getExpenseStats();
      expect(result.totalExpenses).toBe(0);
      expect(result.thisMonthExpenses).toBe(0);
      expect(result.expenseCount).toBe(0);
      expect(result.expenseVsPriorMonthPct).toBeNull();
    });

    it("computes month-over-month expense percentage change", async () => {
      vi.resetModules();
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          // 4 queries: total, thisMonth, priorMonth, sixMonthAvg
          if (callCount === 1) return makeChain([{ total: 600000, count: 20 }]);
          if (callCount === 2) return makeChain([{ total: 150000 }]); // this month: $1500
          if (callCount === 3) return makeChain([{ total: 100000 }]); // prior month: $1000
          return makeChain([{ total: 600000 }]);                       // 6-month total: $6000
        }),
      });
      const { getExpenseStats } = await import("./payment-queries");
      const result = await getExpenseStats();
      expect(result.thisMonthExpenses).toBe(1500);
      // (1500 - 1000) / 1000 * 100 = 50
      expect(result.expenseVsPriorMonthPct).toBe(50);
      expect(result.avgMonthlyExpenses).toBe(1000); // 6000 / 6
    });
  });
});
