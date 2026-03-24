import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/analytics/referral-actions.ts
 *
 * Covers:
 *  getReferralStats — totalReferrals, completedReferrals, pendingReferrals, totalRewardsPaid
 *  getReferralStats — topReferrers sorted by count with totalReward in cents
 *  getReferralStats — recentReferrals with referrer/referred names and status
 *  getReferralStats — empty data returns all-zero counts and empty arrays
 *  SQL error        — captureException + rethrow
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
    db: {
      select: selectFn,
      execute: execFn,
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    referrals: {
      id: "id",
      referrerId: "referrerId",
      referredId: "referredId",
      status: "status",
      rewardAmountInCents: "rewardAmountInCents",
      createdAt: "createdAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    sql: makeSql(),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@/app/dashboard/analytics/_shared", () => ({
    getUser: mockRequireAdmin,
    rangeToInterval: vi.fn(() => "30 days"),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("referral-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- happy path ---- */

  describe("getReferralStats — happy path", () => {
    it("returns counts, topReferrers, and recentReferrals", async () => {
      vi.resetModules();
      // getReferralStats: 3 queries
      // 1. select totals from referrals
      // 2. select topReferrersRows (innerJoin profiles)
      // 3. db.execute (raw SQL for recent referrals)
      const execFn = vi.fn().mockResolvedValue([
        {
          referrer_first: "Alice",
          referrer_last: "Smith",
          referred_first: "Bob",
          referred_last: "Jones",
          status: "completed",
          reward_amount_in_cents: 2500,
          created_at: "2026-03-01T10:00:00Z",
        },
        {
          referrer_first: "Alice",
          referrer_last: "Smith",
          referred_first: "Carol",
          referred_last: "White",
          status: "pending",
          reward_amount_in_cents: 0,
          created_at: "2026-03-10T09:00:00Z",
        },
      ]);
      setupMocks(
        [
          // totals row
          [{ total: 10, completed: 6, pending: 4, rewardsPaid: 15000 }],
          // topReferrersRows
          [
            { firstName: "Alice", lastName: "Smith", referralCount: 6, totalReward: 15000 },
            { firstName: "Bob", lastName: "Jones", referralCount: 2, totalReward: 5000 },
          ],
        ],
        execFn,
      );
      const { getReferralStats } = await import("@/app/dashboard/analytics/referral-actions");

      const result = await getReferralStats();

      expect(result.totalReferrals).toBe(10);
      expect(result.completedReferrals).toBe(6);
      expect(result.pendingReferrals).toBe(4);
      expect(result.totalRewardsPaid).toBe(15000); // stays in cents
      expect(result.topReferrers).toHaveLength(2);
      expect(result.topReferrers[0]).toMatchObject({
        name: "Alice Smith",
        referralCount: 6,
        totalReward: 15000,
      });
      expect(result.recentReferrals).toHaveLength(2);
      expect(result.recentReferrals[0]).toMatchObject({
        referrerName: "Alice Smith",
        referredName: "Bob Jones",
        status: "completed",
        rewardAmountInCents: 2500,
      });
    });
  });

  /* ---- empty data ---- */

  describe("getReferralStats — empty data", () => {
    it("returns all-zero counts and empty arrays when no referrals", async () => {
      vi.resetModules();
      setupMocks(
        [
          [{ total: 0, completed: 0, pending: 0, rewardsPaid: 0 }],
          [], // no top referrers
        ],
        vi.fn().mockResolvedValue([]),
      );
      const { getReferralStats } = await import("@/app/dashboard/analytics/referral-actions");

      const result = await getReferralStats();

      expect(result.totalReferrals).toBe(0);
      expect(result.completedReferrals).toBe(0);
      expect(result.pendingReferrals).toBe(0);
      expect(result.totalRewardsPaid).toBe(0);
      expect(result.topReferrers).toEqual([]);
      expect(result.recentReferrals).toEqual([]);
    });
  });

  /* ---- name fallback ---- */

  describe("getReferralStats — name fallback", () => {
    it("uses Unknown when referrer name fields are null", async () => {
      vi.resetModules();
      const execFn = vi.fn().mockResolvedValue([
        {
          referrer_first: null,
          referrer_last: null,
          referred_first: null,
          referred_last: null,
          status: "pending",
          reward_amount_in_cents: 0,
          created_at: "2026-03-15T00:00:00Z",
        },
      ]);
      setupMocks([[{ total: 1, completed: 0, pending: 1, rewardsPaid: 0 }], []], execFn);
      const { getReferralStats } = await import("@/app/dashboard/analytics/referral-actions");

      const result = await getReferralStats();

      expect(result.recentReferrals[0].referrerName).toBe("Unknown");
      expect(result.recentReferrals[0].referredName).toBe("Unknown");
    });
  });

  /* ---- SQL error handling ---- */

  describe("SQL error handling", () => {
    it("captures exception and rethrows on DB error", async () => {
      vi.resetModules();
      const dbError = new Error("referral query failed");
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
        referrals: {
          id: "id",
          referrerId: "referrerId",
          status: "status",
          rewardAmountInCents: "rewardAmountInCents",
        },
        profiles: { id: "id", firstName: "firstName", lastName: "lastName" },
      }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
        and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
        gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
        sql: makeSql(),
      }));
      vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
      vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
      vi.doMock("@/app/dashboard/analytics/_shared", () => ({
        getUser: mockRequireAdmin,
      }));

      const { getReferralStats } = await import("@/app/dashboard/analytics/referral-actions");

      await expect(getReferralStats()).rejects.toThrow("referral query failed");
      expect(mockCaptureException).toHaveBeenCalledWith(dbError);
    });
  });
});
