import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the full loyalty redemption flow.
 *
 * These tests verify the complete lifecycle: reward creation by admin,
 * redemption by client, and cancellation. Unlike the unit tests that mock
 * individual DB operations, these integration tests use a shared mock DB
 * that tracks state across calls to verify the correct sequence of operations.
 */

/* ------------------------------------------------------------------ */
/*  Stateful DB mock                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const loyaltyTransactions: MockRow[] = [];
  const loyaltyRewards: MockRow[] = [];
  const loyaltyRedemptions: MockRow[] = [];

  let nextTxId = 1;
  let nextRewardId = 1;
  let nextRedemptionId = 1;

  function makeChain(rows: unknown[]) {
    const resolved = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: (predicate?: any) => {
        // Simple filtering — check if predicate matches any conditions
        return chain;
      },
      leftJoin: () => chain,
      innerJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: (fields?: any) => resolved,
      then: resolved.then.bind(resolved),
      catch: resolved.catch.bind(resolved),
      finally: resolved.finally.bind(resolved),
    };
    return chain;
  }

  // Track which table each select/insert/update targets via the mock
  let selectCallCount = 0;
  const insertTarget: string | null = null;

  return {
    // State accessors for assertions
    _transactions: loyaltyTransactions,
    _rewards: loyaltyRewards,
    _redemptions: loyaltyRedemptions,
    _resetCallCount: () => {
      selectCallCount = 0;
    },

    select: vi.fn((...args: unknown[]) => {
      selectCallCount++;
      // Return different data based on call order — set up per test
      return makeChain([]);
    }),

    insert: vi.fn((table: any) => ({
      values: vi.fn((values: MockRow) => {
        // Determine which table based on the values shape
        if ("points" in values && "type" in values) {
          const id = `tx-${nextTxId++}`;
          loyaltyTransactions.push({ ...values, id });
          return {
            returning: vi.fn().mockResolvedValue([{ id }]),
          };
        } else if (
          "pointsCost" in values ||
          ("label" in values && "category" in values && !("rewardId" in values))
        ) {
          const id = nextRewardId++;
          loyaltyRewards.push({ ...values, id, active: true });
          return {
            returning: vi.fn().mockResolvedValue([{ id }]),
          };
        } else if ("rewardId" in values && "transactionId" in values) {
          const id = `red-${nextRedemptionId++}`;
          loyaltyRedemptions.push({ ...values, id });
          return {
            returning: vi.fn().mockResolvedValue([{ id }]),
          };
        }
        return {
          returning: vi.fn().mockResolvedValue([{ id: "unknown" }]),
        };
      }),
    })),

    update: vi.fn(() => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          // Apply updates to the relevant collection
          if ("active" in values && !("status" in values)) {
            // Reward deactivation
            const reward = loyaltyRewards[loyaltyRewards.length - 1];
            if (reward) Object.assign(reward, values);
          } else if ("status" in values) {
            // Redemption status update
            const redemption = loyaltyRedemptions[loyaltyRedemptions.length - 1];
            if (redemption) Object.assign(redemption, values);
          }
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };
}

/* ------------------------------------------------------------------ */
/*  Shared setup                                                       */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockRevalidatePath = vi.fn();

function setupIntegrationMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
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
}

/* ------------------------------------------------------------------ */
/*  Integration tests                                                  */
/* ------------------------------------------------------------------ */

describe("Loyalty redemption flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("complete redemption lifecycle: redeem creates transaction + redemption record", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Mock select to return active reward on first call, then balance on second
    let selectCount = 0;
    db.select.mockImplementation(() => {
      selectCount++;
      const rows =
        selectCount === 1
          ? [
              {
                id: 1,
                label: "$10 Off",
                pointsCost: 200,
                discountInCents: 1000,
                category: "discount",
                active: true,
              },
            ]
          : [{ total: "500" }]; // balance
      const resolved = Promise.resolve(rows);
      const chain: any = {
        from: () => chain,
        where: () => chain,
        innerJoin: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
        finally: resolved.finally.bind(resolved),
      };
      return chain;
    });

    setupIntegrationMocks(db);
    const { redeemPoints } = await import("./actions");

    await redeemPoints({ rewardId: 1 });

    // Verify transaction was created with correct negative points
    expect(db._transactions).toHaveLength(1);
    expect(db._transactions[0]).toMatchObject({
      profileId: "user-1",
      points: -200,
      type: "redeemed",
      description: "Redeemed: $10 Off",
    });

    // Verify redemption record was created
    expect(db._redemptions).toHaveLength(1);
    expect(db._redemptions[0]).toMatchObject({
      profileId: "user-1",
      rewardId: 1,
      status: "pending",
    });
    // transactionId should reference the created transaction
    expect(db._redemptions[0].transactionId).toBe(db._transactions[0].id);
  });

  it("redemption fails gracefully when balance is insufficient", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    let selectCount = 0;
    db.select.mockImplementation(() => {
      selectCount++;
      const rows =
        selectCount === 1
          ? [
              {
                id: 1,
                label: "Expensive",
                pointsCost: 5000,
                discountInCents: 5000,
                category: "discount",
                active: true,
              },
            ]
          : [{ total: "100" }]; // only 100 points
      const resolved = Promise.resolve(rows);
      const chain: any = {
        from: () => chain,
        where: () => chain,
        innerJoin: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
        finally: resolved.finally.bind(resolved),
      };
      return chain;
    });

    setupIntegrationMocks(db);
    const { redeemPoints } = await import("./actions");

    await expect(redeemPoints({ rewardId: 1 })).rejects.toThrow("Not enough points");

    // No transaction or redemption should have been created
    expect(db._transactions).toHaveLength(0);
    expect(db._redemptions).toHaveLength(0);
  });

  it("cancellation refunds points and updates redemption status", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Pre-populate a pending redemption
    db._redemptions.push({
      id: "red-existing",
      profileId: "user-1",
      rewardId: 1,
      transactionId: "tx-original",
      status: "pending",
    });

    let selectCount = 0;
    db.select.mockImplementation(() => {
      selectCount++;
      const rows =
        selectCount === 1
          ? [{ id: "red-existing", profileId: "user-1", rewardId: 1, status: "pending" }]
          : [{ pointsCost: 200, label: "$10 Off" }]; // reward details
      const resolved = Promise.resolve(rows);
      const chain: any = {
        from: () => chain,
        where: () => chain,
        innerJoin: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
        finally: resolved.finally.bind(resolved),
      };
      return chain;
    });

    setupIntegrationMocks(db);
    const { cancelRedemption } = await import("./actions");

    await cancelRedemption("a0000000-0000-4000-a000-000000000001");

    // Should have inserted a refund transaction
    expect(db._transactions).toHaveLength(1);
    expect(db._transactions[0]).toMatchObject({
      profileId: "user-1",
      points: 200,
      type: "manual_credit",
      description: "Cancelled: $10 Off (points refunded)",
    });

    // Should have updated the redemption status
    expect(db._redemptions[0].status).toBe("cancelled");
  });

  it("redeemPoints validates that the reward is active", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Return empty (no active reward found)
    db.select.mockImplementation(() => {
      const resolved = Promise.resolve([]);
      const chain: any = {
        from: () => chain,
        where: () => chain,
        innerJoin: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
        finally: resolved.finally.bind(resolved),
      };
      return chain;
    });

    setupIntegrationMocks(db);
    const { redeemPoints } = await import("./actions");

    await expect(redeemPoints({ rewardId: 999 })).rejects.toThrow(
      "Reward not found or no longer available",
    );

    expect(db._transactions).toHaveLength(0);
    expect(db._redemptions).toHaveLength(0);
  });

  it("multiple redemptions create independent records", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    let selectCount = 0;
    db.select.mockImplementation(() => {
      selectCount++;
      // Alternating: reward lookup, balance check
      const isRewardLookup = selectCount % 2 === 1;
      const rows = isRewardLookup
        ? [
            {
              id: 1,
              label: "$5 Off",
              pointsCost: 100,
              discountInCents: 500,
              category: "discount",
              active: true,
            },
          ]
        : [{ total: "1000" }];
      const resolved = Promise.resolve(rows);
      const chain: any = {
        from: () => chain,
        where: () => chain,
        innerJoin: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
        finally: resolved.finally.bind(resolved),
      };
      return chain;
    });

    setupIntegrationMocks(db);
    const { redeemPoints } = await import("./actions");

    await redeemPoints({ rewardId: 1 });
    await redeemPoints({ rewardId: 1 });

    expect(db._transactions).toHaveLength(2);
    expect(db._redemptions).toHaveLength(2);

    // Each should have a unique ID
    expect(db._transactions[0].id).not.toBe(db._transactions[1].id);
    expect(db._redemptions[0].id).not.toBe(db._redemptions[1].id);
  });
});
