/**
 * @file actions.test.ts
 * @description Unit tests for earnings/actions (assistant earnings calculations,
 * commission types, weekly bars, pending vs paid status).
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

/** Stub for supabase auth.getUser. */
const mockGetUser = vi.fn();
/** Captures revalidatePath calls. */
const mockRevalidatePath = vi.fn();

/** Registers all module mocks; accepts optional custom db object. */
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      staffId: "staffId",
      status: "status",
      startsAt: "startsAt",
      totalInCents: "totalInCents",
      completedAt: "completedAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
    },
    services: {
      id: "id",
      name: "name",
    },
    assistantProfiles: {
      profileId: "profileId",
      commissionType: "commissionType",
      commissionRatePercent: "commissionRatePercent",
      commissionFlatFeeInCents: "commissionFlatFeeInCents",
      tipSplitPercent: "tipSplitPercent",
    },
    payments: {
      id: "id",
      bookingId: "bookingId",
      tipInCents: "tipInCents",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => {
        const obj = { type: "sql", args, as: vi.fn(() => ({ type: "sql_as" })) };
        return obj;
      }),
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
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("earnings/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getAssistantEarnings ---- */

  describe("getAssistantEarnings", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getAssistantEarnings } = await import("./actions");
      await expect(getAssistantEarnings()).rejects.toThrow("Not authenticated");
    });

    it("returns EarningsData shape with empty entries when no bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { getAssistantEarnings } = await import("./actions");
      const result = await getAssistantEarnings();
      expect(result).toMatchObject({
        entries: [],
        weeklyBars: expect.any(Array),
        commissionType: expect.any(String),
        commissionRate: expect.any(Number),
        flatFeeInCents: expect.any(Number),
        tipSplitPercent: expect.any(Number),
        stats: {
          weekNet: expect.any(Number),
          weekGross: expect.any(Number),
          weekTips: expect.any(Number),
          pendingTotal: expect.any(Number),
          monthNet: expect.any(Number),
        },
        weekLabel: expect.any(String),
      });
    });

    it("returns 7 weekly bars even with no bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { getAssistantEarnings } = await import("./actions");
      const result = await getAssistantEarnings();
      expect(result.weeklyBars).toHaveLength(7);
    });

    it("uses assistant profile commission settings when available", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            // assistantProfile query
            return makeChain([
              {
                commissionType: "percentage",
                commissionRatePercent: 70,
                commissionFlatFeeInCents: 0,
                tipSplitPercent: 80,
              },
            ]);
          }
          return makeChain([]); // bookings query
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantEarnings } = await import("./actions");
      const result = await getAssistantEarnings();
      expect(result.commissionRate).toBe(70);
      expect(result.tipSplitPercent).toBe(80);
    });

    it("falls back to default commission rate of 60 when no assistant profile", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])), // no assistant profile and no bookings
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantEarnings } = await import("./actions");
      const result = await getAssistantEarnings();
      expect(result.commissionRate).toBe(60); // DEFAULT_COMMISSION
    });

    it("maps booking rows to EarningEntry shape with percentage commission", async () => {
      vi.resetModules();
      // Use a date in the past (more than 7 days ago) so status = "paid"
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 14);

      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                commissionType: "percentage",
                commissionRatePercent: 60,
                commissionFlatFeeInCents: 0,
                tipSplitPercent: 100,
              },
            ]);
          }
          // bookings query
          return makeChain([
            {
              id: 1,
              startsAt: pastDate,
              totalInCents: 10000,
              completedAt: pastDate,
              clientFirstName: "Jane",
              clientLastName: "Doe",
              serviceName: "Lash Extensions",
              tipInCents: 1000,
            },
          ]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantEarnings } = await import("./actions");
      const result = await getAssistantEarnings();
      expect(result.entries).toHaveLength(1);
      const entry = result.entries[0];
      expect(entry).toMatchObject({
        id: 1,
        service: "Lash Extensions",
        client: expect.stringContaining("Jane"),
        gross: 100, // 10000 cents → $100
        tip: 10, // 1000 cents → $10
        status: "paid",
      });
      // net = 100 * 0.60 = $60
      expect(entry.net).toBe(60);
    });

    it("computes flat_fee net correctly", async () => {
      vi.resetModules();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 14);

      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                commissionType: "flat_fee",
                commissionRatePercent: 60,
                commissionFlatFeeInCents: 5000, // $50 flat fee
                tipSplitPercent: 100,
              },
            ]);
          }
          return makeChain([
            {
              id: 2,
              startsAt: pastDate,
              totalInCents: 20000,
              completedAt: pastDate,
              clientFirstName: "Bob",
              clientLastName: "Jones",
              serviceName: "Brows",
              tipInCents: 0,
            },
          ]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantEarnings } = await import("./actions");
      const result = await getAssistantEarnings();
      expect(result.entries[0].net).toBe(50); // flat_fee = $50
    });

    it("marks recent booking (< 7 days) as 'pending'", async () => {
      vi.resetModules();
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2);

      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                commissionType: "percentage",
                commissionRatePercent: 60,
                commissionFlatFeeInCents: 0,
                tipSplitPercent: 100,
              },
            ]);
          }
          return makeChain([
            {
              id: 3,
              startsAt: recentDate,
              totalInCents: 5000,
              completedAt: recentDate,
              clientFirstName: "Alice",
              clientLastName: "Brown",
              serviceName: "Nails",
              tipInCents: 0,
            },
          ]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantEarnings } = await import("./actions");
      const result = await getAssistantEarnings();
      expect(result.entries[0].status).toBe("pending");
    });

    it("computes pendingTotal from pending entries", async () => {
      vi.resetModules();
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 1);

      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                commissionType: "percentage",
                commissionRatePercent: 50,
                commissionFlatFeeInCents: 0,
                tipSplitPercent: 100,
              },
            ]);
          }
          return makeChain([
            {
              id: 4,
              startsAt: recentDate,
              totalInCents: 20000, // $200 gross, $100 net at 50%
              completedAt: recentDate,
              clientFirstName: "Carol",
              clientLastName: "White",
              serviceName: "Lash",
              tipInCents: 0,
            },
          ]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantEarnings } = await import("./actions");
      const result = await getAssistantEarnings();
      expect(result.stats.pendingTotal).toBe(100);
    });
  });
});
