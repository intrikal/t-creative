import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * @file commission-flow.integration.test.ts
 * Integration tests for the commission request flow.
 *
 * These tests verify the complete lifecycle of `submitCommissionRequest`,
 * `acceptQuote`, and `declineQuote` using a shared stateful mock DB that
 * tracks state across DB calls to verify the correct sequence of mutations.
 */

/* ------------------------------------------------------------------ */
/*  Stateful DB mock                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

/**
 * Creates a mock DB that tracks inserted/updated rows in memory.
 * Test assertions read the _orders array to verify final state.
 */
function createStatefulDb() {
  const orders: MockRow[] = [];

  // Queue of rows to return for select calls, consumed in order
  const selectQueue: unknown[][] = [];

  let nextOrderId = 1;

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
    _orders: orders,

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
        // Route to orders when values carry order-specific fields
        if ("orderNumber" in values || "category" in values) {
          const id = nextOrderId++;
          orders.push({ ...values, id });
          return {
            returning: vi.fn().mockResolvedValue([{ id }]),
          };
        }
        return {
          returning: vi.fn().mockResolvedValue([{ id: nextOrderId++ }]),
        };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          if ("status" in values) {
            // Update the matching order — fall back to last order if no id match
            const order = orders[orders.length - 1];
            if (order) Object.assign(order, values);
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

/** Stub for supabase auth.getUser — controls whether the request is authenticated. */
const mockGetUser = vi.fn();
/** Captures Resend sendEmail calls; resolves to true by default (email sent OK). */
const mockSendEmail = vi.fn().mockResolvedValue(true);
/** Captures revalidatePath calls so tests can verify correct cache invalidation. */
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

/**
 * Registers all module mocks for the integration test using the
 * stateful DB instance, so mutations accumulate across action calls.
 */
function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    orders: {
      id: "id",
      orderNumber: "orderNumber",
      clientId: "clientId",
      productId: "productId",
      status: "status",
      category: "category",
      title: "title",
      description: "description",
      quantity: "quantity",
      quotedInCents: "quotedInCents",
      finalInCents: "finalInCents",
      metadata: "metadata",
      fulfillmentMethod: "fulfillmentMethod",
      cancelledAt: "cancelledAt",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      estimatedCompletionAt: "estimatedCompletionAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
      lastName: "lastName",
    },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
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

  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: vi.fn().mockResolvedValue(null),
  }));

  vi.doMock("@/lib/auth", () => ({
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1" }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: "client-1" }),
  }));

  vi.doMock("@/lib/audit", () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
  }));

  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

  vi.doMock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: mockGetUser },
    }),
  }));

  // Mock the email template so it doesn't need to resolve real imports
  vi.doMock("@/emails/CommissionReceived", () => ({
    CommissionReceived: vi.fn(() => null),
  }));

  // Mock posthog so trackEvent is a no-op
  vi.doMock("@/lib/posthog", () => ({
    trackEvent: vi.fn(),
  }));
}

/* ------------------------------------------------------------------ */
/*  Integration tests                                                  */
/* ------------------------------------------------------------------ */

describe("Commission flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    mockSendEmail.mockResolvedValue(true);
  });

  /* ---- submitCommissionRequest ---- */

  describe("submitCommissionRequest", () => {
    it("inserts an order with the correct fields", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // No profile select needed for insert path; queue an empty profile result
      // so the email block gracefully short-circuits (profile.email will be undefined)
      db._queueSelect([]);

      setupMocks(db);
      const { submitCommissionRequest } = await import("./actions");

      await submitCommissionRequest({
        title: "Custom necklace",
        description: "Gold",
        category: "crochet",
        quantity: 1,
      });

      expect(db._orders).toHaveLength(1);
      expect(db._orders[0]).toMatchObject({
        title: "Custom necklace",
        category: "crochet",
        clientId: "client-1",
        status: "inquiry",
      });
    });

    it("sends a confirmation email to the client", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Queue the buyer profile row returned after insert
      db._queueSelect([{ email: "alice@example.com", firstName: "Alice" }]);

      setupMocks(db);
      const { submitCommissionRequest } = await import("./actions");

      await submitCommissionRequest({
        title: "Custom necklace",
        description: "Gold",
        category: "crochet",
        quantity: 1,
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "alice@example.com",
          entityType: "commission_received",
        }),
      );
    });
  });

  /* ---- acceptQuote ---- */

  describe("acceptQuote", () => {
    it("updates order status to accepted", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed an order in the quoted state
      db._orders.push({
        id: 1,
        clientId: "client-1",
        status: "quoted",
        title: "Custom necklace",
        category: "crochet",
      });

      // Queue the SELECT that looks up the order by id
      db._queueSelect([{ id: 1, clientId: "client-1", status: "quoted" }]);

      setupMocks(db);
      const { acceptQuote } = await import("./actions");

      await acceptQuote(1);

      expect(db._orders[0].status).toBe("accepted");
    });

    it("throws when order not found", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Queue an empty result — no order found for id 999
      db._queueSelect([]);

      setupMocks(db);
      const { acceptQuote } = await import("./actions");

      await expect(acceptQuote(999)).rejects.toThrow();
    });
  });

  /* ---- declineQuote ---- */

  describe("declineQuote", () => {
    it("sets status to cancelled and sets cancelledAt", async () => {
      vi.resetModules();
      const db = createStatefulDb();

      // Seed an order in the quoted state
      db._orders.push({
        id: 1,
        clientId: "client-1",
        status: "quoted",
        title: "Custom necklace",
        category: "crochet",
        cancelledAt: null,
      });

      // Queue the SELECT that looks up the order by id
      db._queueSelect([{ id: 1, clientId: "client-1", status: "quoted" }]);

      setupMocks(db);
      const { declineQuote } = await import("./actions");

      await declineQuote(1);

      expect(db._orders[0].status).toBe("cancelled");
      expect(db._orders[0].cancelledAt).toBeDefined();
      expect(db._orders[0].cancelledAt).not.toBeNull();
    });
  });
});
