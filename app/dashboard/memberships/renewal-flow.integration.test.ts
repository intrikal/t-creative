import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * @file renewal-flow.integration.test.ts
 * Integration tests for the membership renewal and fill-usage flows.
 *
 * These tests verify the complete lifecycle of `renewMembership` and
 * `useMembershipFill` using a shared stateful mock DB that tracks state
 * across DB calls to verify the correct sequence of mutations.
 */

/* ------------------------------------------------------------------ */
/*  Stateful DB mock                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

/**
 * Creates a mock DB that tracks membership rows in memory.
 * Test assertions read _memberships to verify final state after mutations.
 */
function createStatefulDb() {
  const memberships: MockRow[] = [];

  // Queue of rows to return for select calls, consumed in order
  const selectQueue: unknown[][] = [];

  function makeChain(rows: unknown[]) {
    const resolved = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: (_fields?: any) => resolved,
      then: resolved.then.bind(resolved),
      catch: resolved.catch.bind(resolved),
      finally: resolved.finally.bind(resolved),
    };
    return chain;
  }

  return {
    // State accessors for assertions
    _memberships: memberships,

    // Queue the next set of rows that a select call should return
    _queueSelect: (rows: unknown[]) => {
      selectQueue.push(rows);
    },

    select: vi.fn((_fields?: any) => {
      const rows = selectQueue.shift() ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow) => {
        // Route to memberships when values carry membership fields
        if ("fillsRemainingThisCycle" in values && "cycleStartAt" in values) {
          const id = `sub-${memberships.length + 1}`;
          memberships.push({ ...values, id });
          return {
            returning: vi.fn().mockResolvedValue([{ id }]),
          };
        }
        return {
          returning: vi.fn().mockResolvedValue([{ id: "unknown" }]),
        };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          if ("status" in values) {
            // renewMembership update — status + fills + cycle dates + pausedAt
            const membership = memberships[memberships.length - 1];
            if (membership) Object.assign(membership, values);
          } else if ("fillsRemainingThisCycle" in values) {
            // useMembershipFill update — decrement fills
            const membership = memberships[memberships.length - 1];
            if (membership) Object.assign(membership, values);
          }
          return Promise.resolve();
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

/** Stub for requireAdmin — resolves to an admin user by default. */
const mockRequireAdmin = vi.fn().mockResolvedValue({ id: "admin-1" });
/** Captures revalidatePath calls. */
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

/** Registers all module mocks using the stateful DB instance. */
function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    membershipSubscriptions: {
      id: "id",
      clientId: "clientId",
      planId: "planId",
      status: "status",
      fillsRemainingThisCycle: "fillsRemainingThisCycle",
      cycleStartAt: "cycleStartAt",
      cycleEndsAt: "cycleEndsAt",
      cancelledAt: "cancelledAt",
      pausedAt: "pausedAt",
      notes: "notes",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    membershipPlans: {
      id: "id",
      name: "name",
      slug: "slug",
      description: "description",
      priceInCents: "priceInCents",
      fillsPerCycle: "fillsPerCycle",
      cycleIntervalDays: "cycleIntervalDays",
      isActive: "isActive",
      displayOrder: "displayOrder",
      perks: "perks",
      productDiscountPercent: "productDiscountPercent",
    },
    membershipStatusEnum: {
      enumValues: ["active", "paused", "cancelled", "expired"],
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
    },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));

  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({ aliasName: name })),
    pgTable: vi.fn(),
    pgEnum: vi.fn(),
    text: vi.fn(),
    integer: vi.fn(),
    boolean: vi.fn(),
    timestamp: vi.fn(),
    uuid: vi.fn(),
  }));

  vi.doMock("@/lib/auth", () => ({
    requireAdmin: mockRequireAdmin,
    getCurrentUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
  }));

  vi.doMock("@/lib/resend", () => ({
    sendEmail: vi.fn().mockResolvedValue(true),
    getEmailRecipient: vi.fn().mockResolvedValue(null),
  }));

  vi.doMock("@/lib/audit", () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

  vi.doMock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
  }));

  // The actions file uses @/utils/supabase/server for getUser internally
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
      },
    }),
  }));
}

/* ------------------------------------------------------------------ */
/*  Integration tests                                                  */
/* ------------------------------------------------------------------ */

describe("Membership renewal flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- renewMembership ---- */

  describe("renewMembership", () => {
    it("resets fillsRemainingThisCycle to plan's fillsPerCycle", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed a membership to update
      db._memberships.push({
        id: "sub-1",
        status: "active",
        fillsRemainingThisCycle: 0,
        cycleStartAt: new Date("2026-01-01"),
        cycleEndsAt: new Date("2026-02-01"),
        pausedAt: null,
      });

      // Queue the SELECT response: joined row with cycleEndsAt, fillsPerCycle, cycleIntervalDays
      db._queueSelect([
        {
          cycleEndsAt: new Date("2026-02-01"),
          fillsPerCycle: 4,
          cycleIntervalDays: 30,
        },
      ]);

      setupMocks(db);
      const { renewMembership } = await import("./actions");

      await renewMembership("sub-1");

      expect(db._memberships[0].fillsRemainingThisCycle).toBe(4);
      expect(db._memberships[0].status).toBe("active");
    });

    it("advances cycleEndsAt by cycleIntervalDays", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      const oldCycleEnd = new Date("2026-02-01");

      db._memberships.push({
        id: "sub-1",
        status: "active",
        fillsRemainingThisCycle: 2,
        cycleStartAt: new Date("2026-01-01"),
        cycleEndsAt: oldCycleEnd,
        pausedAt: null,
      });

      db._queueSelect([
        {
          cycleEndsAt: oldCycleEnd,
          fillsPerCycle: 2,
          cycleIntervalDays: 30,
        },
      ]);

      setupMocks(db);
      const { renewMembership } = await import("./actions");

      await renewMembership("sub-1");

      const updatedCycleEndsAt = db._memberships[0].cycleEndsAt as Date;
      expect(updatedCycleEndsAt).toBeInstanceOf(Date);

      // newCycleEnd = addDays(oldCycleEnd, 30) ≈ 2026-03-03
      const expectedEnd = new Date(oldCycleEnd);
      expectedEnd.setDate(expectedEnd.getDate() + 30);

      const diffMs = Math.abs(updatedCycleEndsAt.getTime() - expectedEnd.getTime());
      // Allow up to 1 second of drift from any test execution timing
      expect(diffMs).toBeLessThan(1000);
    });

    it("clears pausedAt after renewal", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      const oldCycleEnd = new Date("2026-02-01");

      db._memberships.push({
        id: "sub-1",
        status: "paused",
        fillsRemainingThisCycle: 1,
        cycleStartAt: new Date("2026-01-01"),
        cycleEndsAt: oldCycleEnd,
        pausedAt: new Date("2026-01-20"),
      });

      db._queueSelect([
        {
          cycleEndsAt: oldCycleEnd,
          fillsPerCycle: 3,
          cycleIntervalDays: 30,
        },
      ]);

      setupMocks(db);
      const { renewMembership } = await import("./actions");

      await renewMembership("sub-1");

      expect(db._memberships[0].pausedAt).toBeNull();
    });
  });

  /* ---- useMembershipFill ---- */

  describe("useMembershipFill", () => {
    it("decrements fillsRemainingThisCycle by 1", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      db._memberships.push({
        id: "sub-1",
        status: "active",
        fillsRemainingThisCycle: 3,
        cycleStartAt: new Date("2026-01-01"),
        cycleEndsAt: new Date("2026-02-01"),
        pausedAt: null,
      });

      // Queue the SELECT that returns current fills count
      db._queueSelect([{ fillsRemainingThisCycle: 3 }]);

      setupMocks(db);
      const { useMembershipFill } = await import("./actions");

      await useMembershipFill("sub-1");

      expect(db._memberships[0].fillsRemainingThisCycle).toBe(2);
    });

    it("throws when no fills remaining", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      db._memberships.push({
        id: "sub-1",
        status: "active",
        fillsRemainingThisCycle: 0,
        cycleStartAt: new Date("2026-01-01"),
        cycleEndsAt: new Date("2026-02-01"),
        pausedAt: null,
      });

      // Queue the SELECT that returns 0 fills
      db._queueSelect([{ fillsRemainingThisCycle: 0 }]);

      setupMocks(db);
      const { useMembershipFill } = await import("./actions");

      await expect(useMembershipFill("sub-1")).rejects.toThrow(/no fills/i);
    });
  });
});
