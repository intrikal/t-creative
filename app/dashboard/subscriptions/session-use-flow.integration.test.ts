import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for subscription lifecycle mutations.
 *
 * Calls `createSubscription` and `updateSubscriptionStatus` from
 * actions.ts and verifies FINAL STATE in the stateful mock DB:
 *
 * Flow A — createSubscription:   row inserted with sessionsUsed = 0
 * Flow B — updateSubscriptionStatus → cancelled
 * Flow C — updateSubscriptionStatus → completed
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const subscriptionsTable: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: vi.fn().mockResolvedValue(rows.map((r) => ({ id: r.id ?? nextId++ }))),
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _subscriptions: subscriptionsTable,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const row = { ...values, id };
        subscriptionsTable.push(row);
        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          // Apply update to the first matching subscription in state
          if (subscriptionsTable.length > 0) {
            Object.assign(subscriptionsTable[0], values);
          }
          return Promise.resolve();
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } });
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    bookingSubscriptions: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      name: "name",
      totalSessions: "totalSessions",
      sessionsUsed: "sessionsUsed",
      intervalDays: "intervalDays",
      pricePerSessionInCents: "pricePerSessionInCents",
      totalPaidInCents: "totalPaidInCents",
      status: "status",
      notes: "notes",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
    services: {
      id: "id",
      name: "name",
      category: "category",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    or: vi.fn((...a: unknown[]) => ({ type: "or", a })),
    ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Subscription session-use flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  });

  /* --- Flow A: createSubscription initialises sessionsUsed to 0 --- */

  it("Flow A: createSubscription inserts a subscription with sessionsUsed = 0", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db);
    const { createSubscription } = await import("./actions");

    await createSubscription({
      clientId: "client-1",
      serviceId: 2,
      name: "Lash Package",
      totalSessions: 5,
      intervalDays: 14,
      pricePerSessionInCents: 5000,
      totalPaidInCents: 25000,
    });

    expect(db._subscriptions).toHaveLength(1);
    expect(db._subscriptions[0].sessionsUsed).toBe(0);
    expect(db._subscriptions[0].name).toBe("Lash Package");
    expect(db._subscriptions[0].clientId).toBe("client-1");
    expect(db._subscriptions[0].totalSessions).toBe(5);
  });

  /* --- Flow B: updateSubscriptionStatus → cancelled --- */

  it("Flow B: updateSubscriptionStatus updates status to cancelled", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Seed an active subscription so the update tracker has a row to mutate
    db._subscriptions.push({
      id: 1,
      clientId: "client-1",
      serviceId: 2,
      name: "Lash Package",
      totalSessions: 5,
      sessionsUsed: 2,
      intervalDays: 14,
      pricePerSessionInCents: 5000,
      totalPaidInCents: 25000,
      status: "active",
      notes: null,
    });

    setupMocks(db);
    const { updateSubscriptionStatus } = await import("./actions");

    await updateSubscriptionStatus(1, "cancelled");

    expect(db._subscriptions[0].status).toBe("cancelled");
  });

  /* --- Flow C: updateSubscriptionStatus → completed --- */

  it("Flow C: updateSubscriptionStatus updates status to completed", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Seed an active subscription
    db._subscriptions.push({
      id: 1,
      clientId: "client-1",
      serviceId: 2,
      name: "Lash Package",
      totalSessions: 5,
      sessionsUsed: 4,
      intervalDays: 14,
      pricePerSessionInCents: 5000,
      totalPaidInCents: 25000,
      status: "active",
      notes: null,
    });

    setupMocks(db);
    const { updateSubscriptionStatus } = await import("./actions");

    await updateSubscriptionStatus(1, "completed");

    expect(db._subscriptions[0].status).toBe("completed");
  });
});
