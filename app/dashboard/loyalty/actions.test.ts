/**
 * @file actions.test.ts
 * @description Unit tests for loyalty/actions (redeem points, cancel redemption,
 * client loyalty data with membership/referral/transaction mapping).
 *
 * Testing utilities: describe, it, expect, vi, vi.doMock, vi.resetModules,
 * vi.clearAllMocks, beforeEach.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a chainable mock that mimics Drizzle's query-builder API.
 */
function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

/** Stub for supabase auth.getUser. */
const mockGetUser = vi.fn();
/** Captures revalidatePath calls. */
const mockRevalidatePath = vi.fn();

/** Registers all module mocks; accepts optional custom db object. */
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "lt-1" }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    membershipPlans: {
      id: "id",
      name: "name",
      priceInCents: "priceInCents",
      fillsPerCycle: "fillsPerCycle",
      productDiscountPercent: "productDiscountPercent",
      perks: "perks",
    },
    membershipSubscriptions: {
      id: "id",
      clientId: "clientId",
      planId: "planId",
      status: "status",
      fillsRemainingThisCycle: "fillsRemainingThisCycle",
      cycleEndsAt: "cycleEndsAt",
      createdAt: "createdAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      referralCode: "referralCode",
      referredBy: "referredBy",
    },
    loyaltyTransactions: {
      id: "id",
      profileId: "profileId",
      points: "points",
      type: "type",
      description: "description",
      createdAt: "createdAt",
    },
    loyaltyRewards: {
      id: "id",
      label: "label",
      pointsCost: "pointsCost",
      discountInCents: "discountInCents",
      category: "category",
      description: "description",
      active: "active",
      sortOrder: "sortOrder",
    },
    loyaltyRedemptions: {
      id: "id",
      profileId: "profileId",
      rewardId: "rewardId",
      transactionId: "transactionId",
      status: "status",
      bookingId: "bookingId",
      createdAt: "createdAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    sum: vi.fn((...args: unknown[]) => ({ type: "sum", args })),
    count: vi.fn((...args: unknown[]) => ({ type: "count", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/middleware/action-rate-limit", () => ({
    createActionLimiter: () => vi.fn().mockResolvedValue(undefined),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("loyalty/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- redeemPoints ---- */

  describe("redeemPoints", () => {
    /** Mock data: a standard $10-off reward costing 200 loyalty points. */
    const MOCK_REWARD = {
      id: 1,
      label: "$10 Off",
      pointsCost: 200,
      discountInCents: 1000,
      category: "discount",
      active: true,
      sortOrder: 0,
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { redeemPoints } = await import("./actions");
      await expect(redeemPoints({ rewardId: 1 })).rejects.toThrow("Not authenticated");
    });

    it("throws when rewardId is invalid (non-positive)", async () => {
      vi.resetModules();
      setupMocks();
      const { redeemPoints } = await import("./actions");
      await expect(redeemPoints({ rewardId: 0 })).rejects.toThrow();
      await expect(redeemPoints({ rewardId: -1 })).rejects.toThrow();
    });

    it("throws when reward not found or inactive", async () => {
      vi.resetModules();
      // select returns empty (no active reward found)
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemPoints } = await import("./actions");
      await expect(redeemPoints({ rewardId: 999 })).rejects.toThrow(
        "Reward not found or no longer available",
      );
    });

    it("throws when user does not have enough points", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          // 1st select: reward lookup
          if (selectCount === 1) return makeChain([MOCK_REWARD]);
          // 2nd select: balance check (100 < 200 required)
          return makeChain([{ total: "100" }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemPoints } = await import("./actions");
      await expect(redeemPoints({ rewardId: 1 })).rejects.toThrow("Not enough points");
    });

    it("inserts negative points transaction and redemption record when sufficient balance", async () => {
      vi.resetModules();
      let selectCount = 0;
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "lt-2" }]),
      }));
      const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([MOCK_REWARD]);
          return makeChain([{ total: "1000" }]);
        }),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemPoints } = await import("./actions");
      await redeemPoints({ rewardId: 1 });

      // Should have been called twice: once for loyaltyTransactions, once for loyaltyRedemptions
      expect(mockInsert).toHaveBeenCalledTimes(2);

      // First insert: negative points transaction
      expect(mockInsertValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          profileId: "user-1",
          points: -200,
          type: "redeemed",
          description: "Redeemed: $10 Off",
        }),
      );

      // Second insert: redemption record
      expect(mockInsertValues).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          profileId: "user-1",
          rewardId: 1,
          transactionId: "lt-2",
          status: "pending",
        }),
      );
    });

    it("handles null total as 0 points balance", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([MOCK_REWARD]);
          return makeChain([{ total: null }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemPoints } = await import("./actions");
      await expect(redeemPoints({ rewardId: 1 })).rejects.toThrow("Not enough points");
    });

    it("revalidates /dashboard/loyalty", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([MOCK_REWARD]);
          return makeChain([{ total: "1000" }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "lt-3" }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemPoints } = await import("./actions");
      await redeemPoints({ rewardId: 1 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/loyalty");
    });
  });

  /* ---- cancelRedemption ---- */

  describe("cancelRedemption", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { cancelRedemption } = await import("./actions");
      await expect(cancelRedemption("a0000000-0000-4000-a000-000000000001")).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("throws when redemptionId is not a valid UUID", async () => {
      vi.resetModules();
      setupMocks();
      const { cancelRedemption } = await import("./actions");
      await expect(cancelRedemption("not-a-uuid")).rejects.toThrow();
    });

    it("throws when redemption not found or not pending", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelRedemption } = await import("./actions");
      await expect(cancelRedemption("a0000000-0000-4000-a000-000000000001")).rejects.toThrow(
        "Redemption not found or already applied",
      );
    });

    it("refunds points and marks redemption as cancelled", async () => {
      vi.resetModules();
      let selectCount = 0;
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "lt-refund" }]),
      }));
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          // 1st: fetch redemption
          if (selectCount === 1)
            return makeChain([
              { id: "red-1", profileId: "user-1", rewardId: 1, status: "pending" },
            ]);
          // 2nd: fetch reward for points cost
          return makeChain([{ pointsCost: 200, label: "$10 Off" }]);
        }),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelRedemption } = await import("./actions");
      await cancelRedemption("a0000000-0000-4000-a000-000000000001");

      // Should insert a refund transaction
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "user-1",
          points: 200,
          type: "manual_credit",
          description: "Cancelled: $10 Off (points refunded)",
        }),
      );

      // Should update redemption status to cancelled
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));

      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/loyalty");
    });
  });

  /* ---- getClientLoyaltyData ---- */

  describe("getClientLoyaltyData", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientLoyaltyData } = await import("./actions");
      await expect(getClientLoyaltyData()).rejects.toThrow("Not authenticated");
    });

    it("returns default values when no data found", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientLoyaltyData } = await import("./actions");
      const result = await getClientLoyaltyData();
      expect(result.firstName).toBe("");
      expect(result.totalPoints).toBe(0);
      expect(result.referralCode).toBe("");
      expect(result.referralCount).toBe(0);
      expect(result.membership).toBeNull();
      expect(result.transactions).toEqual([]);
      expect(result.rewards).toEqual([]);
      expect(result.pendingRedemptions).toEqual([]);
    });

    it("maps profile and points data correctly", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ firstName: "Jane", referralCode: "REF123" }]);
          if (selectCount === 2) return makeChain([{ total: "750" }]);
          if (selectCount === 3) return makeChain([]); // transactions
          if (selectCount === 4) return makeChain([]); // referral count
          return makeChain([]); // membership, rewards, pending
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientLoyaltyData } = await import("./actions");
      const result = await getClientLoyaltyData();
      expect(result.firstName).toBe("Jane");
      expect(result.totalPoints).toBe(750);
      expect(result.referralCode).toBe("REF123");
    });

    it("maps transactions to LoyaltyTransaction shape", async () => {
      vi.resetModules();
      const txRow = {
        id: "tx-1",
        points: 100,
        type: "booking_complete",
        description: "Booking completed",
        createdAt: new Date("2026-02-01T00:00:00Z"),
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ firstName: "Jane", referralCode: null }]);
          if (selectCount === 2) return makeChain([{ total: "100" }]);
          if (selectCount === 3) return makeChain([txRow]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientLoyaltyData } = await import("./actions");
      const result = await getClientLoyaltyData();
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        id: "tx-1",
        points: 100,
        type: "booking_complete",
        description: "Booking completed",
      });
      expect(typeof result.transactions[0].createdAt).toBe("string");
    });

    it("maps membership data when active subscription found", async () => {
      vi.resetModules();
      const memRow = {
        planName: "Lash Club Gold",
        priceInCents: 9900,
        fillsPerCycle: 2,
        fillsRemainingThisCycle: 1,
        productDiscountPercent: 10,
        cycleEndsAt: new Date("2026-04-01T00:00:00Z"),
        status: "active",
        perks: ["Priority booking", "10% off products"],
      };
      // When referralCode is null, referral count query is skipped.
      // Sequence: 1=profiles, 2=points, 3=transactions, 4=membership, 5=rewards, 6=pending
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ firstName: "Jane", referralCode: null }]);
          if (selectCount === 2) return makeChain([{ total: "500" }]);
          if (selectCount === 3) return makeChain([]); // transactions
          // selectCount 4 = membership (no referral count because referralCode is null)
          if (selectCount === 4) return makeChain([memRow]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientLoyaltyData } = await import("./actions");
      const result = await getClientLoyaltyData();
      expect(result.membership).not.toBeNull();
      expect(result.membership!.planName).toBe("Lash Club Gold");
      expect(result.membership!.status).toBe("active");
      expect(result.membership!.fillsPerCycle).toBe(2);
      expect(result.membership!.fillsRemainingThisCycle).toBe(1);
      expect(result.membership!.perks).toEqual(["Priority booking", "10% off products"]);
    });

    it("counts referrals when referralCode is set", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ firstName: "Jane", referralCode: "REF456" }]);
          if (selectCount === 2) return makeChain([{ total: "0" }]);
          if (selectCount === 3) return makeChain([]);
          if (selectCount === 4) return makeChain([{ n: 3 }]); // referral count
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientLoyaltyData } = await import("./actions");
      const result = await getClientLoyaltyData();
      expect(result.referralCount).toBe(3);
    });

    it("returns referralCount 0 when no referralCode", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ firstName: "Jane", referralCode: null }]);
          if (selectCount === 2) return makeChain([{ total: "0" }]);
          if (selectCount === 3) return makeChain([]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientLoyaltyData } = await import("./actions");
      const result = await getClientLoyaltyData();
      expect(result.referralCount).toBe(0);
    });
  });
});
