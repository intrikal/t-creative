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
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockRevalidatePath = vi.fn();

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
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
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
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { redeemPoints } = await import("./actions");
      await expect(redeemPoints({ label: "Free fill", points: 500 })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("throws when reward points is <= 0", async () => {
      vi.resetModules();
      setupMocks();
      const { redeemPoints } = await import("./actions");
      await expect(redeemPoints({ label: "Invalid", points: 0 })).rejects.toThrow("Invalid reward");
      await expect(redeemPoints({ label: "Negative", points: -10 })).rejects.toThrow(
        "Invalid reward",
      );
    });

    it("throws when user does not have enough points", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ total: "100" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemPoints } = await import("./actions");
      await expect(redeemPoints({ label: "Expensive", points: 500 })).rejects.toThrow(
        "Not enough points",
      );
    });

    it("inserts negative points transaction when sufficient balance", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "lt-2" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ total: "1000" }])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemPoints } = await import("./actions");
      await redeemPoints({ label: "Free fill", points: 500 });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "user-1",
          points: -500,
          type: "redeemed",
          description: "Redeemed: Free fill",
        }),
      );
    });

    it("handles null total as 0 points balance", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ total: null }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemPoints } = await import("./actions");
      await expect(redeemPoints({ label: "Anything", points: 1 })).rejects.toThrow(
        "Not enough points",
      );
    });

    it("revalidates /dashboard/loyalty", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ total: "1000" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { redeemPoints } = await import("./actions");
      await redeemPoints({ label: "Free fill", points: 100 });
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
          return makeChain([]); // membership
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
      // Sequence: 1=profiles, 2=points, 3=transactions, 4=membership
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ firstName: "Jane", referralCode: null }]);
          if (selectCount === 2) return makeChain([{ total: "500" }]);
          if (selectCount === 3) return makeChain([]); // transactions
          // selectCount 4 = membership (no referral count because referralCode is null)
          return makeChain([memRow]);
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
