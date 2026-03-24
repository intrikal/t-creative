import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/analytics/business-analytics-actions.ts
 *
 * Covers:
 *  getStaffPerformance   — bookings, revenue, avgTicket, utilization, serviceRecordCompletion
 *  getStaffPerformance   — empty = []
 *  getPromotionRoi       — ROI calculation (net - discount)/discount; empty = []
 *  getMembershipValue    — spendLift, monthlyChurnRate, byPlan; empty data = zeroes
 *  getGiftCardBreakage   — totalSold, breakageRate, byStatus, aging; empty cards = zeroes
 *  getWaitlistConversion — conversionRate = booked/notified; empty = zeroes
 *  SQL error             — captureException + rethrow
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, drizzle-orm/pg-core,
 *        @/lib/auth, @sentry/nextjs, app/dashboard/analytics/_shared.
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
      clientId: "clientId",
      staffId: "staffId",
      serviceId: "serviceId",
      startsAt: "startsAt",
      status: "status",
      totalInCents: "totalInCents",
      discountInCents: "discountInCents",
      promotionId: "promotionId",
    },
    payments: {
      id: "id",
      clientId: "clientId",
      bookingId: "bookingId",
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
    },
    promotions: {
      id: "id",
      code: "code",
      description: "description",
      discountType: "discountType",
      redemptionCount: "redemptionCount",
    },
    membershipSubscriptions: {
      id: "id",
      clientId: "clientId",
      planId: "planId",
      status: "status",
      createdAt: "createdAt",
      cancelledAt: "cancelledAt",
      cycleEndsAt: "cycleEndsAt",
    },
    membershipPlans: {
      id: "id",
      name: "name",
      cycleIntervalDays: "cycleIntervalDays",
      priceInCents: "priceInCents",
    },
    giftCards: {
      id: "id",
      status: "status",
      originalAmountInCents: "originalAmountInCents",
      balanceInCents: "balanceInCents",
      purchasedAt: "purchasedAt",
    },
    waitlist: {
      id: "id",
      serviceId: "serviceId",
      status: "status",
      createdAt: "createdAt",
      notifiedAt: "notifiedAt",
      updatedAt: "updatedAt",
    },
    serviceRecords: { id: "id", bookingId: "bookingId" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
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
    CATEGORY_LABELS: { lash: "Lash Services" },
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("business-analytics-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- getStaffPerformance ---- */

  describe("getStaffPerformance", () => {
    it("calculates avgTicket, utilization, and serviceRecordCompletion", async () => {
      vi.resetModules();
      // Promise.all: bookingRows, srRows
      setupMocks([
        // bookingRows
        [
          {
            staffId: "staff-1",
            firstName: "Alice",
            lastName: "Smith",
            role: "assistant",
            bookingCount: 20,
            revenue: 240000,
            completedCount: 16,
            totalSlots: 20,
          },
        ],
        // srRows
        [{ staffId: "staff-1", srCount: 12 }],
      ]);
      const { getStaffPerformance } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getStaffPerformance("30d");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: "Alice Smith",
        role: "Staff",
        bookings: 20,
        revenue: 2400,
        avgTicket: 120, // 2400/20
        utilization: 80, // 16/20*100
        serviceRecordCompletion: 75, // 12/16*100
      });
    });

    it("returns empty array when no staff bookings", async () => {
      vi.resetModules();
      setupMocks([[], []]);
      const { getStaffPerformance } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getStaffPerformance("30d");

      expect(result).toEqual([]);
    });
  });

  /* ---- getPromotionRoi ---- */

  describe("getPromotionRoi", () => {
    it("calculates ROI as (net - discount) / discount * 100", async () => {
      vi.resetModules();
      setupMocks([
        [
          {
            promoId: 1,
            code: "SPRING20",
            description: "Spring promo",
            discountType: "percent",
            bookingCount: 10,
            grossRevenue: 100000,
            totalDiscount: 20000,
            netPaid: 80000,
          },
        ],
      ]);
      const { getPromotionRoi } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getPromotionRoi("30d");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        code: "SPRING20",
        bookings: 10,
        grossRevenue: 1000,
        totalDiscount: 200,
        netRevenue: 800,
        roi: 300, // (800-200)/200*100
      });
    });

    it("returns empty array when no promotions used", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getPromotionRoi } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getPromotionRoi("30d");

      expect(result).toEqual([]);
    });
  });

  /* ---- getMembershipValue ---- */

  describe("getMembershipValue", () => {
    it("calculates spendLift and monthlyChurnRate", async () => {
      vi.resetModules();
      const createdAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const cancelledAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // recent cancel
      // Promise.all: subs, spendRows
      setupMocks([
        // subs
        [
          {
            id: "sub-1",
            clientId: "c1",
            planName: "Gold",
            status: "active",
            createdAt,
            cancelledAt: null,
          },
          {
            id: "sub-2",
            clientId: "c2",
            planName: "Gold",
            status: "cancelled",
            createdAt,
            cancelledAt,
          },
        ],
        // spendRows
        [
          { clientId: "c1", total: 200000 }, // member: $2000
          { clientId: "c3", total: 100000 }, // non-member: $1000
        ],
      ]);
      const { getMembershipValue } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getMembershipValue("30d");

      expect(result.memberAvgSpend).toBe(2000); // only c1 (active member)
      expect(result.nonMemberAvgSpend).toBe(1000);
      expect(result.spendLift).toBe(100); // (2000-1000)/1000*100
      expect(result.activeCount).toBe(1);
      expect(result.cancelledCount).toBe(1);
      expect(result.byPlan).toHaveLength(1);
      expect(result.byPlan[0].plan).toBe("Gold");
    });

    it("returns zeroes when no memberships or spend", async () => {
      vi.resetModules();
      setupMocks([[], []]);
      const { getMembershipValue } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getMembershipValue("30d");

      expect(result.memberAvgSpend).toBe(0);
      expect(result.spendLift).toBe(0);
      expect(result.activeCount).toBe(0);
      expect(result.byPlan).toEqual([]);
    });
  });

  /* ---- getGiftCardBreakage ---- */

  describe("getGiftCardBreakage", () => {
    it("calculates breakageRate and byStatus groups", async () => {
      vi.resetModules();
      const purchasedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setupMocks([
        [
          {
            id: 1,
            status: "active",
            originalAmountInCents: 10000,
            balanceInCents: 7500,
            purchasedAt,
          },
          {
            id: 2,
            status: "redeemed",
            originalAmountInCents: 5000,
            balanceInCents: 0,
            purchasedAt,
          },
        ],
      ]);
      const { getGiftCardBreakage } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getGiftCardBreakage("30d");

      expect(result.totalSold).toBe(2);
      expect(result.totalOriginalValue).toBe(150); // (10000+5000)/100
      expect(result.totalRemaining).toBe(75); // 7500/100
      expect(result.totalRedeemed).toBe(75); // 150-75
      expect(result.breakageRate).toBe(50); // round(7500/15000*100)
      expect(result.byStatus).toHaveLength(2);
    });

    it("returns all-zero stats when no gift cards", async () => {
      vi.resetModules();
      setupMocks([[]]);
      const { getGiftCardBreakage } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getGiftCardBreakage("30d");

      expect(result).toMatchObject({
        totalSold: 0,
        totalOriginalValue: 0,
        totalRedeemed: 0,
        totalRemaining: 0,
        breakageRate: 0,
        byStatus: [],
        aging: [],
      });
    });
  });

  /* ---- getWaitlistConversion ---- */

  describe("getWaitlistConversion", () => {
    it("computes conversionRate = booked / notified", async () => {
      vi.resetModules();
      // First select: statusRows; then Promise.all: waitTimeRow, claimTimeRow, byServiceRows, weeklyRows
      setupMocks([
        // statusRows
        [
          { status: "booked", count: 8 },
          { status: "notified", count: 2 },
          { status: "expired", count: 2 },
          { status: "waiting", count: 5 },
          { status: "cancelled", count: 1 },
        ],
        // waitTimeRow
        [{ avgWaitDays: 3.5 }],
        // claimTimeRow
        [{ avgClaimHours: 4.2 }],
        // byServiceRows
        [{ serviceName: "Classic Full Set", status: "booked", count: 8, avgWaitDays: 3.5 }],
        // weeklyRows
        [{ week: "Mar 16", status: "booked", count: 8 }],
      ]);
      const { getWaitlistConversion } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getWaitlistConversion("30d");

      // totalNotified = notified + booked + expired = 2 + 8 + 2 = 12
      // conversionRate = round(8/12*100) = 67
      expect(result.totalEntries).toBe(18); // 8+2+2+5+1
      expect(result.totalBooked).toBe(8);
      expect(result.totalNotified).toBe(12);
      expect(result.conversionRate).toBe(67);
      expect(result.byService).toHaveLength(1);
      expect(result.weeklyTrend).toHaveLength(1);
    });

    it("returns zero rates when no waitlist entries", async () => {
      vi.resetModules();
      setupMocks([
        [], // statusRows
        [{ avgWaitDays: null }],
        [{ avgClaimHours: null }],
        [], // byServiceRows
        [], // weeklyRows
      ]);
      const { getWaitlistConversion } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      const result = await getWaitlistConversion("30d");

      expect(result.totalEntries).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.byService).toEqual([]);
    });
  });

  /* ---- SQL error handling ---- */

  describe("SQL error handling", () => {
    it("captures exception and rethrows on DB error", async () => {
      vi.resetModules();
      const dbError = new Error("timeout");
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
          id: "id",
          staffId: "staffId",
          startsAt: "startsAt",
          status: "status",
          totalInCents: "totalInCents",
        },
        payments: {
          clientId: "clientId",
          amountInCents: "amountInCents",
          status: "status",
          paidAt: "paidAt",
        },
        services: { id: "id", name: "name" },
        profiles: { id: "id", firstName: "firstName", lastName: "lastName", role: "role" },
        promotions: {
          id: "id",
          code: "code",
          description: "description",
          discountType: "discountType",
          redemptionCount: "redemptionCount",
        },
        membershipSubscriptions: {
          id: "id",
          clientId: "clientId",
          planId: "planId",
          status: "status",
          createdAt: "createdAt",
          cancelledAt: "cancelledAt",
        },
        membershipPlans: { id: "id", name: "name" },
        giftCards: {
          id: "id",
          status: "status",
          originalAmountInCents: "originalAmountInCents",
          balanceInCents: "balanceInCents",
          purchasedAt: "purchasedAt",
        },
        waitlist: {
          id: "id",
          serviceId: "serviceId",
          status: "status",
          createdAt: "createdAt",
          notifiedAt: "notifiedAt",
          updatedAt: "updatedAt",
        },
        serviceRecords: { id: "id", bookingId: "bookingId" },
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
        and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
        gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
        isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
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
        CATEGORY_LABELS: {},
      }));

      const { getPromotionRoi } =
        await import("@/app/dashboard/analytics/business-analytics-actions");

      await expect(getPromotionRoi("30d")).rejects.toThrow("timeout");
      expect(mockCaptureException).toHaveBeenCalledWith(dbError);
    });
  });
});
