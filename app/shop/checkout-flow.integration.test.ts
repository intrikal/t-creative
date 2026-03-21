// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the placeOrder checkout flow.
 *
 * Uses a stateful mock DB so the full sequence of DB calls can be verified:
 * product lookup → order INSERT → stock UPDATE → gift card SELECT/UPDATE/INSERT
 * → syncLog INSERT → profile SELECT.
 *
 * Each test calls vi.resetModules() + vi.doMock() so module-level state is
 * completely fresh, matching the pattern used throughout this codebase.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock handles (declared before any doMock calls)             */
/* ------------------------------------------------------------------ */

// Shared mock handle for the email service — declared before doMock so
// the same fn reference is accessible in both setup and assertions
const mockSendEmail = vi.fn().mockResolvedValue(true);

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

// createStatefulDb builds an in-memory fake database that tracks inserts
// and updates across tables (_orders, _products, _giftCards, etc.).
// Unlike simple vi.fn() mocks, this preserves state across chained calls
// within a single test, allowing assertions on final DB state rather than
// just which methods were called.

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const _orders: MockRow[] = [];
  const _products: MockRow[] = [];
  const _giftCards: MockRow[] = [];
  const _giftCardTransactions: MockRow[] = [];
  const _profiles: MockRow[] = [];
  const _syncLog: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      leftJoin: () => chain,
      innerJoin: () => chain,
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
    _orders,
    _products,
    _giftCards,
    _giftCardTransactions,
    _profiles,
    _syncLog,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },
    _seedProduct: (product: MockRow) => _products.push(product),
    _seedGiftCard: (gc: MockRow) => _giftCards.push(gc),
    _seedProfile: (profile: MockRow) => _profiles.push(profile),

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = (values.id as number) ?? nextId++;
        const row = { ...values, id };

        // Route inserts to the correct table by inspecting the values shape
        if ("orderNumber" in values) {
          _orders.push(row);
          const p = Promise.resolve([{ id }]);
          return {
            returning: vi.fn().mockResolvedValue([{ id }]),
            then: p.then.bind(p),
            catch: p.catch.bind(p),
            finally: p.finally.bind(p),
          };
        }
        if ("giftCardId" in values && "type" in values) {
          _giftCardTransactions.push(row);
          return { returning: vi.fn().mockResolvedValue([{ id }]) };
        }
        if ("provider" in values && "direction" in values) {
          _syncLog.push(row);
          return { returning: vi.fn().mockResolvedValue([{ id }]) };
        }

        return { returning: vi.fn().mockResolvedValue([{ id }]) };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn().mockImplementation(() => {
          // Route updates to the correct table by inspecting the values shape
          if ("stockCount" in values) {
            // Update the matching product (last one inserted / seeded)
            const product = _products[_products.length - 1];
            if (product) {
              Object.assign(product, values);
            }
          } else if ("balanceInCents" in values && !("stockCount" in values)) {
            // Check it's not a stock update masquerading as a balance update
            // Update the matching gift card
            const gc = _giftCards[_giftCards.length - 1];
            if (gc) {
              Object.assign(gc, values);
            }
          } else if ("squareOrderId" in values) {
            // Update the matching order
            const order = _orders[_orders.length - 1];
            if (order) {
              Object.assign(order, values);
            }
          } else if ("role" in values) {
            const profile = _profiles[_profiles.length - 1];
            if (profile) {
              Object.assign(profile, values);
            }
          }
          return Promise.resolve(undefined);
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),

    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      await fn(db);
    }),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Mock setup helper                                                  */
/* ------------------------------------------------------------------ */

// setupMocks registers all module-level mocks via vi.doMock() (not vi.mock())
// so they apply after vi.resetModules() clears the module cache. Each external
// dependency is replaced:
//   - @/db: uses the stateful mock DB passed in
//   - @/db/schema: provides column name strings for Drizzle query building
//   - drizzle-orm: stubs query operators (eq, and, desc, etc.)
//   - @/utils/supabase/server: fakes an authenticated user ("client-1")
//   - @/lib/square, easypost, zoho, etc.: disabled integrations
//   - @/lib/resend: captures email sends for assertion
//   - next/cache: stubs revalidatePath
function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    products: {
      id: "id",
      title: "title",
      priceInCents: "priceInCents",
      pricingType: "pricingType",
      availability: "availability",
      stockCount: "stockCount",
      isPublished: "isPublished",
      slug: "slug",
      description: "description",
      category: "category",
      priceMinInCents: "priceMinInCents",
      priceMaxInCents: "priceMaxInCents",
      imageUrl: "imageUrl",
      serviceId: "serviceId",
      tags: "tags",
      isFeatured: "isFeatured",
      sortOrder: "sortOrder",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    orders: {
      id: "id",
      orderNumber: "orderNumber",
      clientId: "clientId",
      productId: "productId",
      status: "status",
      title: "title",
      quantity: "quantity",
      finalInCents: "finalInCents",
      fulfillmentMethod: "fulfillmentMethod",
      shippingAddress: "shippingAddress",
      easypostShipmentId: "easypostShipmentId",
      shippingCostInCents: "shippingCostInCents",
      squareOrderId: "squareOrderId",
      trackingNumber: "trackingNumber",
      trackingUrl: "trackingUrl",
      createdAt: "createdAt",
    },
    giftCards: {
      id: "id",
      code: "code",
      balanceInCents: "balanceInCents",
      originalAmountInCents: "originalAmountInCents",
      status: "status",
      expiresAt: "expiresAt",
    },
    giftCardTransactions: {
      id: "id",
      giftCardId: "giftCardId",
      type: "type",
      amountInCents: "amountInCents",
      balanceAfterInCents: "balanceAfterInCents",
      bookingId: "bookingId",
      performedBy: "performedBy",
      notes: "notes",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
    },
    syncLog: {
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      localId: "localId",
      remoteId: "remoteId",
      message: "message",
      payload: "payload",
    },
    wishlistItems: {
      id: "id",
      clientId: "clientId",
      productId: "productId",
    },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    isNotNull: vi.fn((...args: unknown[]) => ({ type: "isNotNull", args })),
    ilike: vi.fn((...args: unknown[]) => ({ type: "ilike", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    sql: Object.assign(vi.fn((...args: unknown[]) => ({ type: "sql", args })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "client-1" } },
        }),
      },
    })),
  }));

  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(false),
    createSquarePaymentLink: vi.fn().mockRejectedValue(new Error("not configured")),
    createSquareOrderPaymentLink: vi.fn().mockRejectedValue(new Error("not configured")),
    squareClient: {},
    SQUARE_LOCATION_ID: "",
  }));

  vi.doMock("@/lib/easypost", () => ({
    isEasyPostConfigured: vi.fn().mockReturnValue(false),
    fetchShippingRates: vi.fn(),
    getShippingRates: vi.fn(),
  }));

  vi.doMock("@/lib/zoho", () => ({
    createZohoDeal: vi.fn(),
    upsertZohoContact: vi.fn(),
  }));

  vi.doMock("@/lib/zoho-books", () => ({
    createZohoBooksInvoice: vi.fn(),
  }));

  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: vi.fn(),
  }));

  vi.doMock("@/lib/posthog", () => ({
    trackEvent: vi.fn(),
    identifyUser: vi.fn(),
  }));

  vi.doMock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
  }));

  vi.doMock("next/cache", () => ({
    revalidatePath: vi.fn(),
  }));

  vi.doMock("@/emails/OrderConfirmation", () => ({
    OrderConfirmation: vi.fn().mockReturnValue(null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

// End-to-end integration tests for placeOrder: verifies the full flow from
// product lookup through order creation, stock decrement, gift card application,
// and confirmation email. Each test creates a fresh stateful DB and seeds it
// with specific product/gift card/profile data, then asserts on final DB state.
describe("placeOrder — checkout flow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
  });

  /* ---------------------------------------------------------------- */
  // Happy path: valid product + pickup_cash → order row created with correct title
  it("placeOrder creates an order for a valid in-stock product", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const product = {
      id: 1,
      title: "Crystal Ring",
      priceInCents: 5000,
      pricingType: "fixed_price",
      availability: "in_stock",
      stockCount: 10,
      isPublished: true,
    };
    db._seedProduct(product);

    // Queue: [1] product SELECT, [2] profile SELECT (for confirmation email)
    db._queue([product]);
    db._queue([]); // profile select returns empty — no email sent

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(true);
    expect(db._orders).toHaveLength(1);
    expect(db._orders[0].title).toBe("Crystal Ring");
  });

  /* ---------------------------------------------------------------- */
  // Verifies the inventory side effect: stockCount should decrease after order
  it("placeOrder decrements stock count for in-stock item", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const product = {
      id: 1,
      title: "Crystal Ring",
      priceInCents: 5000,
      pricingType: "fixed_price",
      availability: "in_stock",
      stockCount: 10,
      isPublished: true,
    };
    db._seedProduct(product);

    db._queue([product]);
    db._queue([]); // profile select

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(db._products[0].stockCount).toBe(9);
  });

  /* ---------------------------------------------------------------- */
  // Cart validation: empty items array should fail before any DB writes
  it("placeOrder returns error when cart is empty", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  /* ---------------------------------------------------------------- */
  // Availability check: out_of_stock products should be rejected
  it("placeOrder returns error when product is out of stock", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const product = {
      id: 1,
      title: "Crystal Ring",
      priceInCents: 5000,
      pricingType: "fixed_price",
      availability: "out_of_stock",
      stockCount: 0,
      isPublished: true,
    };
    db._seedProduct(product);

    db._queue([product]);

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/out of stock/i);
  });

  /* ---------------------------------------------------------------- */
  // Gift card integration: verifies discount = min(balance, total), and
  // the card's balance is decremented to zero in the stateful DB
  it("placeOrder applies gift card discount and decrements balance", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const product = {
      id: 1,
      title: "Gold Necklace",
      priceInCents: 10000,
      pricingType: "fixed_price",
      availability: "in_stock",
      stockCount: 5,
      isPublished: true,
    };
    const giftCard = {
      id: 1,
      code: "TC-GC-001",
      balanceInCents: 3000,
      status: "active",
      expiresAt: null,
    };
    db._seedProduct(product);
    db._seedGiftCard(giftCard);

    // Queue: [1] product SELECT, [2] gift card SELECT, [3] profile SELECT
    db._queue([product]);
    db._queue([giftCard]);
    db._queue([]); // profile select

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
      giftCardCode: "TC-GC-001",
    });

    expect(result.success).toBe(true);
    // Gift card had 3000 balance, order total was 10000, discount is min(3000, 10000) = 3000
    // New balance = 3000 - 3000 = 0
    expect(db._giftCards[0].balanceInCents).toBe(0);
  });

  /* ---------------------------------------------------------------- */
  // Email integration: when a profile exists with an email, a confirmation
  // email should be sent to that address after a successful order
  it("placeOrder sends a confirmation email after order placed", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const product = {
      id: 1,
      title: "Crystal Ring",
      priceInCents: 5000,
      pricingType: "fixed_price",
      availability: "in_stock",
      stockCount: 10,
      isPublished: true,
    };
    db._seedProduct(product);

    const profile = { id: "client-1", email: "alice@example.com", firstName: "Alice" };
    db._seedProfile(profile);

    // Queue: [1] product SELECT, [2] profile SELECT
    db._queue([product]);
    db._queue([profile]);

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
      }),
    );
  });
});
