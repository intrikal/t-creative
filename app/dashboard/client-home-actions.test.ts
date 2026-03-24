import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/client-home-actions.ts
 *
 * Covers:
 *  getClientHomeData — upcoming bookings for authenticated client (pending/confirmed, future)
 *  getClientHomeData — loyalty points (sum of transactions, capped at 0)
 *  getClientHomeData — membership since date from profile
 *  getClientHomeData — non-client (unauthenticated) rejected with "Unauthorized"
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, drizzle-orm/pg-core, @/lib/auth.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
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
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetCurrentUser = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(
  user: { id: string; email: string; profile?: { firstName?: string; createdAt?: Date } } | null,
  selectResponses: unknown[][] = [],
) {
  mockGetCurrentUser.mockResolvedValue(user);

  let callIdx = 0;
  const selectFn = vi.fn(() => {
    const rows = selectResponses[callIdx] ?? [];
    callIdx++;
    return makeChain(rows);
  });

  vi.doMock("@/db", () => ({
    db: {
      select: selectFn,
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      staffId: "staffId",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      status: "status",
    },
    services: { id: "id", name: "name", category: "category" },
    profiles: { id: "id", firstName: "firstName", createdAt: "createdAt" },
    loyaltyTransactions: {
      profileId: "profileId",
      points: "points",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    sum: vi.fn((...a: unknown[]) => ({ type: "sum", a })),
    count: vi.fn((...a: unknown[]) => ({ type: "count", a })),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: unknown, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/lib/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("client-home-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- unauthenticated ---- */

  describe("unauthenticated", () => {
    it("throws Unauthorized when user is null", async () => {
      vi.resetModules();
      setupMocks(null);
      const { getClientHomeData } = await import("@/app/dashboard/client-home-actions");

      await expect(getClientHomeData()).rejects.toThrow("Unauthorized");
    });
  });

  /* ---- upcoming bookings ---- */

  describe("upcoming bookings", () => {
    it("returns pending and confirmed future bookings for the authenticated client", async () => {
      vi.resetModules();
      const memberSince = new Date("2025-01-01");
      setupMocks(
        {
          id: "client-1",
          email: "client@example.com",
          profile: { firstName: "Jane", createdAt: memberSince },
        },
        [
          // upcomingBookings
          [
            {
              id: 5,
              startsAt: new Date("2026-04-10T14:00:00Z"),
              durationMinutes: 90,
              status: "confirmed",
              serviceName: "Classic Full Set",
              staffName: "Alice",
            },
          ],
          // pastBookings
          [],
          // stats
          [{ totalVisits: 8, lifetimeSpendCents: "96000" }],
          // monthStats
          [{ spendCents: "12000" }],
          // loyaltyResult
          [{ totalPoints: "150" }],
        ],
      );
      const { getClientHomeData } = await import("@/app/dashboard/client-home-actions");

      const data = await getClientHomeData();

      expect(data.upcomingBookings).toHaveLength(1);
      expect(data.upcomingBookings[0]).toMatchObject({
        id: 5,
        status: "confirmed",
        serviceName: "Classic Full Set",
        staffName: "Alice",
      });
    });
  });

  /* ---- loyalty points ---- */

  describe("loyalty points", () => {
    it("sums loyalty transactions and returns the total", async () => {
      vi.resetModules();
      setupMocks({ id: "client-1", email: "client@example.com" }, [
        [], // upcomingBookings
        [], // pastBookings
        [{ totalVisits: 0, lifetimeSpendCents: null }],
        [{ spendCents: null }],
        [{ totalPoints: "320" }], // loyalty
      ]);
      const { getClientHomeData } = await import("@/app/dashboard/client-home-actions");

      const data = await getClientHomeData();

      expect(data.loyaltyPoints).toBe(320);
    });

    it("caps loyalty points at 0 when sum is negative", async () => {
      vi.resetModules();
      setupMocks({ id: "client-1", email: "client@example.com" }, [
        [],
        [],
        [{ totalVisits: 0, lifetimeSpendCents: null }],
        [{ spendCents: null }],
        [{ totalPoints: "-50" }], // negative total → capped at 0
      ]);
      const { getClientHomeData } = await import("@/app/dashboard/client-home-actions");

      const data = await getClientHomeData();

      expect(data.loyaltyPoints).toBe(0);
    });
  });

  /* ---- membership since ---- */

  describe("membership since", () => {
    it("returns memberSince from user profile.createdAt", async () => {
      vi.resetModules();
      const memberSince = new Date("2024-06-15");
      setupMocks(
        {
          id: "client-1",
          email: "client@example.com",
          profile: { firstName: "Jane", createdAt: memberSince },
        },
        [
          [],
          [],
          [{ totalVisits: 0, lifetimeSpendCents: null }],
          [{ spendCents: null }],
          [{ totalPoints: null }],
        ],
      );
      const { getClientHomeData } = await import("@/app/dashboard/client-home-actions");

      const data = await getClientHomeData();

      expect(data.memberSince).toEqual(memberSince);
    });
  });
});
