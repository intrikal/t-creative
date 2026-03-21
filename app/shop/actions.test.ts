/**
 * Unit tests for shop actions: product queries, order placement, wishlist
 * management, and gift card lookup.
 *
 * Uses two mocking strategies:
 *   1. Top-level vi.mock() for the placeOrder tests (module-scope mocks)
 *   2. vi.doMock() + vi.resetModules() via setupShopMocks() for all other
 *      tests — this forces fresh module imports per test so module-level
 *      state (db singleton, cached queries) doesn't leak between tests.
 *
 * Related files:
 *   - app/shop/actions.ts — server actions under test (placeOrder, getClientOrders, wishlist, lookupGiftCard)
 *   - app/shop/queries.ts — getPublishedProducts query under test
 */

// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// vi.fn(): creates a mock function that records how it was called —
// these track individual DB operations so tests can assert which queries ran
const mockSelectWhere = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

// vi.mock("@/db"): replaces the Drizzle database module with a fake that
// chains select/insert/update calls through the mock functions above,
// so tests never hit a real database
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (...args: unknown[]) => {
          mockSelectWhere(...args);
          return mockSelectWhere.mock.results.at(-1)?.value ?? [];
        },
        orderBy: () => [],
      }),
    }),
    insert: () => ({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        return {
          returning: (...rArgs: unknown[]) => {
            mockInsertReturning(...rArgs);
            return mockInsertReturning.mock.results.at(-1)?.value ?? [{ id: 1 }];
          },
        };
      },
    }),
    update: () => ({
      set: (...args: unknown[]) => {
        mockUpdateSet(...args);
        return {
          where: (...wArgs: unknown[]) => {
            mockUpdateWhere(...wArgs);
          },
        };
      },
    }),
  },
}));

// vi.mock("@/db/schema"): replaces schema table references with plain
// string column maps — Drizzle uses these for query building, but tests
// only need the column name strings for equality checks
vi.mock("@/db/schema", () => ({
  products: { id: "id", isPublished: "isPublished", stockCount: "stockCount" },
  orders: { id: "id", clientId: "clientId", productId: "productId", status: "status" },
  profiles: { id: "id", email: "email", firstName: "firstName" },
  syncLog: {},
}));

// vi.mock("@/lib/resend"): replaces the email service so tests don't
// send real emails — returns a resolved promise to simulate success
vi.mock("@/lib/resend", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

// vi.mock("next/cache"): replaces Next.js cache invalidation — the real
// revalidatePath triggers ISR revalidation which doesn't exist in tests
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// vi.mock("@/utils/supabase/server"): replaces Supabase auth client so
// tests get a fake authenticated user ("user-123") without real OAuth
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: "user-123" } },
      })),
    },
  })),
}));

// vi.mock("@/lib/square"): replaces Square payment integration — disabled
// by default (isSquareConfigured → false) so order tests skip payment link creation
vi.mock("@/lib/square", () => ({
  isSquareConfigured: vi.fn(() => false),
  createSquareOrderPaymentLink: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper (for additional tests below)             */
/* ------------------------------------------------------------------ */

// makeChain builds a thenable object that mimics Drizzle's chainable
// query API (from/where/leftJoin/orderBy/limit) and resolves to `rows`.
// This lets tests control exactly what data the DB "returns" per query.
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

const mockGetUser = vi.fn();
const mockRevalidatePath2 = vi.fn();

// setupShopMocks: re-registers all module mocks via vi.doMock() after
// vi.resetModules() clears previous registrations. This ensures each test
// gets a completely fresh module graph with isolated mock state.
// Accepts an optional custom db object to override the default mock DB.
function setupShopMocks(db: Record<string, unknown> | null = null) {
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
    products: {
      id: "id",
      title: "title",
      slug: "slug",
      description: "description",
      category: "category",
      pricingType: "pricingType",
      priceInCents: "priceInCents",
      priceMinInCents: "priceMinInCents",
      priceMaxInCents: "priceMaxInCents",
      availability: "availability",
      stockCount: "stockCount",
      imageUrl: "imageUrl",
      serviceId: "serviceId",
      tags: "tags",
      isFeatured: "isFeatured",
      isPublished: "isPublished",
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
      createdAt: "createdAt",
      squareOrderId: "squareOrderId",
    },
    profiles: { id: "id", email: "email", firstName: "firstName" },
    syncLog: {},
    giftCards: {
      id: "id",
      code: "code",
      balanceInCents: "balanceInCents",
      originalAmountInCents: "originalAmountInCents",
      status: "status",
      expiresAt: "expiresAt",
    },
    giftCardTransactions: {},
    wishlistItems: { id: "id", clientId: "clientId", productId: "productId" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    isNotNull: vi.fn((...args: unknown[]) => ({ type: "isNotNull", args })),
    ilike: vi.fn((...args: unknown[]) => ({ type: "ilike", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath2 }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: vi.fn() }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn(() => false),
    createSquareOrderPaymentLink: vi.fn(),
  }));
  vi.doMock("@/lib/zoho", () => ({ createZohoDeal: vi.fn() }));
  vi.doMock("@/lib/zoho-books", () => ({ createZohoBooksInvoice: vi.fn() }));
  vi.doMock("@/emails/OrderConfirmation", () => ({ OrderConfirmation: vi.fn(() => null) }));
}

/* ------------------------------------------------------------------ */
/*  getPublishedProducts                                               */
/* ------------------------------------------------------------------ */

// Tests the query that fetches published shop products and transforms
// the raw DB rows (e.g., splitting comma-separated tags into arrays)
describe("getPublishedProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("returns empty array when no products exist", async () => {
    vi.resetModules();
    setupShopMocks();
    const { getPublishedProducts } = await import("./queries");
    const result = await getPublishedProducts();
    expect(result).toEqual([]);
  });

  it("splits tags string into array", async () => {
    vi.resetModules();
    setupShopMocks({
      select: vi.fn(() =>
        makeChain([
          {
            id: 1,
            title: "Lash Serum",
            slug: "lash-serum",
            description: "Growth serum",
            category: "aftercare",
            pricingType: "fixed_price",
            priceInCents: 2500,
            priceMinInCents: null,
            priceMaxInCents: null,
            availability: "in_stock",
            stockCount: 10,
            imageUrl: null,
            serviceId: null,
            tags: "serum, lash, aftercare",
            isFeatured: true,
          },
        ]),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { getPublishedProducts } = await import("./queries");
    const result = await getPublishedProducts();
    expect(result[0].tags).toEqual(["serum", "lash", "aftercare"]);
  });

  it("returns empty tags array when tags field is null", async () => {
    vi.resetModules();
    setupShopMocks({
      select: vi.fn(() =>
        makeChain([
          {
            id: 2,
            title: "Kit",
            slug: "kit",
            description: null,
            category: "jewelry",
            pricingType: "fixed_price",
            priceInCents: 1500,
            priceMinInCents: null,
            priceMaxInCents: null,
            availability: "in_stock",
            stockCount: 5,
            imageUrl: null,
            serviceId: null,
            tags: null,
            isFeatured: false,
          },
        ]),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { getPublishedProducts } = await import("./queries");
    const result = await getPublishedProducts();
    expect(result[0].tags).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  getClientOrders                                                    */
/* ------------------------------------------------------------------ */

// Tests the action that fetches a client's order history, verifying
// auth gating, empty-state handling, and date serialization
describe("getClientOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("throws when user is not authenticated", async () => {
    vi.resetModules();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    setupShopMocks();
    const { getClientOrders } = await import("./actions");
    await expect(getClientOrders()).rejects.toThrow("Not authenticated");
  });

  it("returns empty array when client has no orders", async () => {
    vi.resetModules();
    setupShopMocks();
    const { getClientOrders } = await import("./actions");
    const result = await getClientOrders();
    expect(result).toEqual([]);
  });

  it("maps rows and formats createdAt as a date string", async () => {
    vi.resetModules();
    const createdAt = new Date("2026-02-15T10:00:00Z");
    setupShopMocks({
      select: vi.fn(() =>
        makeChain([
          {
            id: 1,
            orderNumber: "ord-abc123-1",
            title: "Lash Serum",
            status: "accepted",
            quantity: 2,
            finalInCents: 5000,
            fulfillmentMethod: "pickup_cash",
            createdAt,
          },
        ]),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { getClientOrders } = await import("./actions");
    const result = await getClientOrders();
    expect(result).toHaveLength(1);
    expect(typeof result[0].createdAt).toBe("string");
    expect(result[0].orderNumber).toBe("ord-abc123-1");
  });
});

/* ------------------------------------------------------------------ */
/*  getWishlistProductIds / addToWishlist / removeFromWishlist         */
/* ------------------------------------------------------------------ */

// Tests wishlist read — fetching saved product IDs for the current user
describe("getWishlistProductIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("throws when user is not authenticated", async () => {
    vi.resetModules();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    setupShopMocks();
    const { getWishlistProductIds } = await import("./actions");
    await expect(getWishlistProductIds()).rejects.toThrow("Not authenticated");
  });

  it("returns empty array when wishlist is empty", async () => {
    vi.resetModules();
    setupShopMocks();
    const { getWishlistProductIds } = await import("./actions");
    expect(await getWishlistProductIds()).toEqual([]);
  });

  it("returns product IDs from wishlist rows", async () => {
    vi.resetModules();
    setupShopMocks({
      select: vi.fn(() => makeChain([{ productId: 3 }, { productId: 7 }])),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { getWishlistProductIds } = await import("./actions");
    expect(await getWishlistProductIds()).toEqual([3, 7]);
  });
});

// Tests wishlist write — adding a product, deduplication, and cache revalidation
describe("addToWishlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("throws when user is not authenticated", async () => {
    vi.resetModules();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    setupShopMocks();
    const { addToWishlist } = await import("./actions");
    await expect(addToWishlist(1)).rejects.toThrow("Not authenticated");
  });

  it("inserts wishlist entry when product is not already saved", async () => {
    vi.resetModules();
    const mockInsertValues = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    }));
    setupShopMocks({
      select: vi.fn(() => makeChain([])),
      insert: vi.fn(() => ({ values: mockInsertValues })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { addToWishlist } = await import("./actions");
    await addToWishlist(5);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "user-1", productId: 5 }),
    );
  });

  it("skips insert when product is already in wishlist", async () => {
    vi.resetModules();
    const mockInsertValues = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    }));
    setupShopMocks({
      select: vi.fn(() => makeChain([{ id: 99 }])),
      insert: vi.fn(() => ({ values: mockInsertValues })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { addToWishlist } = await import("./actions");
    await addToWishlist(5);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("revalidates /dashboard/shop", async () => {
    vi.resetModules();
    setupShopMocks();
    const { addToWishlist } = await import("./actions");
    await addToWishlist(5);
    expect(mockRevalidatePath2).toHaveBeenCalledWith("/dashboard/shop");
  });
});

// Tests wishlist deletion — removing a product and cache revalidation
describe("removeFromWishlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("throws when user is not authenticated", async () => {
    vi.resetModules();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    setupShopMocks();
    const { removeFromWishlist } = await import("./actions");
    await expect(removeFromWishlist(1)).rejects.toThrow("Not authenticated");
  });

  it("calls db.delete for the wishlist entry", async () => {
    vi.resetModules();
    const mockDeleteWhere = vi.fn();
    setupShopMocks({
      select: vi.fn(() => makeChain([])),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: mockDeleteWhere })),
    });
    const { removeFromWishlist } = await import("./actions");
    await removeFromWishlist(3);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("revalidates /dashboard/shop", async () => {
    vi.resetModules();
    setupShopMocks();
    const { removeFromWishlist } = await import("./actions");
    await removeFromWishlist(3);
    expect(mockRevalidatePath2).toHaveBeenCalledWith("/dashboard/shop");
  });
});

/* ------------------------------------------------------------------ */
/*  lookupGiftCard                                                     */
/* ------------------------------------------------------------------ */

// Tests gift card validation: code lookup, status checks (active, redeemed,
// expired, zero balance), and successful return of card details
describe("lookupGiftCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 'Gift card not found' when code does not match", async () => {
    vi.resetModules();
    setupShopMocks({
      select: vi.fn(() => makeChain([])),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { lookupGiftCard } = await import("./actions");
    await expect(lookupGiftCard("INVALID")).rejects.toThrow("Gift card not found");
  });

  it("throws when gift card status is not active", async () => {
    vi.resetModules();
    setupShopMocks({
      select: vi.fn(() =>
        makeChain([
          {
            id: 1,
            balanceInCents: 5000,
            originalAmountInCents: 5000,
            status: "redeemed",
            expiresAt: null,
          },
        ]),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { lookupGiftCard } = await import("./actions");
    await expect(lookupGiftCard("USED")).rejects.toThrow("already been used");
  });

  it("throws when gift card has no remaining balance", async () => {
    vi.resetModules();
    setupShopMocks({
      select: vi.fn(() =>
        makeChain([
          {
            id: 1,
            balanceInCents: 0,
            originalAmountInCents: 5000,
            status: "active",
            expiresAt: null,
          },
        ]),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { lookupGiftCard } = await import("./actions");
    await expect(lookupGiftCard("EMPTY")).rejects.toThrow("no remaining balance");
  });

  it("throws when gift card is expired", async () => {
    vi.resetModules();
    setupShopMocks({
      select: vi.fn(() =>
        makeChain([
          {
            id: 1,
            balanceInCents: 5000,
            originalAmountInCents: 5000,
            status: "active",
            expiresAt: new Date("2020-01-01"),
          },
        ]),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { lookupGiftCard } = await import("./actions");
    await expect(lookupGiftCard("EXPIRED")).rejects.toThrow("expired");
  });

  it("returns id, balanceInCents, and originalAmountInCents for a valid card", async () => {
    vi.resetModules();
    setupShopMocks({
      select: vi.fn(() =>
        makeChain([
          {
            id: 5,
            balanceInCents: 7500,
            originalAmountInCents: 10000,
            status: "active",
            expiresAt: null,
          },
        ]),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    });
    const { lookupGiftCard } = await import("./actions");
    const result = await lookupGiftCard("VALID75");
    expect(result).toEqual({ id: 5, balanceInCents: 7500, originalAmountInCents: 10000 });
  });
});

/* ------------------------------------------------------------------ */

// Tests the placeOrder server action end-to-end: cart validation,
// product availability checks, fulfillment method handling, stock
// decrement, and error cases (unpublished, out of stock, quote-only,
// insufficient stock)
describe("placeOrder", () => {
  let placeOrder: typeof import("./actions").placeOrder;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockInsertReturning.mockReturnValue([{ id: 1 }]);

    vi.resetModules();

    // Re-apply mocks after reset
    vi.doMock("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: (...args: unknown[]) => {
              mockSelectWhere(...args);
              return mockSelectWhere.mock.results.at(-1)?.value ?? [];
            },
            orderBy: () => [],
          }),
        }),
        insert: () => ({
          values: (...args: unknown[]) => {
            mockInsertValues(...args);
            return {
              returning: (...rArgs: unknown[]) => {
                mockInsertReturning(...rArgs);
                return mockInsertReturning.mock.results.at(-1)?.value ?? [{ id: 1 }];
              },
            };
          },
        }),
        update: () => ({
          set: (...args: unknown[]) => {
            mockUpdateSet(...args);
            return {
              where: (...wArgs: unknown[]) => {
                mockUpdateWhere(...wArgs);
              },
            };
          },
        }),
      },
    }));

    vi.doMock("@/db/schema", () => ({
      products: { id: "id", isPublished: "isPublished", stockCount: "stockCount" },
      orders: { id: "id", clientId: "clientId", productId: "productId", status: "status" },
      profiles: { id: "id", email: "email", firstName: "firstName" },
      syncLog: {},
    }));

    vi.doMock("next/cache", () => ({
      revalidatePath: vi.fn(),
    }));

    vi.doMock("@/utils/supabase/server", () => ({
      createClient: vi.fn(() => ({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: { id: "user-123" } },
          })),
        },
      })),
    }));

    vi.doMock("@/lib/square", () => ({
      isSquareConfigured: vi.fn(() => false),
      createSquareOrderPaymentLink: vi.fn(),
    }));

    vi.doMock("@/lib/resend", () => ({
      sendEmail: vi.fn().mockResolvedValue(true),
    }));

    const mod = await import("./actions");
    placeOrder = mod.placeOrder;
  });

  // Validates that an empty cart is rejected before any DB operations
  it("returns error for empty cart", async () => {
    const result = await placeOrder({ items: [], fulfillmentMethod: "pickup_cash" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Cart is empty");
  });

  // Verifies the happy path: valid product → order created with
  // pickup_cash fulfillment, accepted status, and no payment URL
  it("creates order with pickup_cash fulfillment method", async () => {
    // Mock: product lookup returns a valid product
    mockSelectWhere.mockReturnValueOnce([
      {
        id: 10,
        title: "Lash Aftercare Kit",
        priceInCents: 1800,
        pricingType: "fixed_price",
        availability: "in_stock",
        stockCount: 5,
        isPublished: true,
      },
    ]);

    const result = await placeOrder({
      items: [{ productId: 10, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(true);
    expect(result.orderNumber).toBeDefined();
    expect(result.paymentUrl).toBeUndefined();

    // Should have inserted an order row
    expect(mockInsertValues).toHaveBeenCalled();
    const orderData = mockInsertValues.mock.calls[0][0];
    expect(orderData.fulfillmentMethod).toBe("pickup_cash");
    expect(orderData.status).toBe("accepted");
  });

  // Verifies pickup_online falls back gracefully when Square is disabled
  it("creates order with pickup_online and no Square configured", async () => {
    mockSelectWhere.mockReturnValueOnce([
      {
        id: 10,
        title: "Lash Aftercare Kit",
        priceInCents: 1800,
        pricingType: "fixed_price",
        availability: "in_stock",
        stockCount: 5,
        isPublished: true,
      },
    ]);

    const result = await placeOrder({
      items: [{ productId: 10, quantity: 1 }],
      fulfillmentMethod: "pickup_online",
    });

    expect(result.success).toBe(true);
    expect(result.orderNumber).toBeDefined();
    // No payment URL since Square is not configured
    expect(result.paymentUrl).toBeUndefined();
  });

  // Draft products should not be orderable even if they exist in the DB
  it("returns error for unpublished product", async () => {
    mockSelectWhere.mockReturnValueOnce([
      {
        id: 10,
        title: "Draft Product",
        priceInCents: 1800,
        pricingType: "fixed_price",
        availability: "in_stock",
        stockCount: 5,
        isPublished: false,
      },
    ]);

    const result = await placeOrder({
      items: [{ productId: 10, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no longer available");
  });

  // Out-of-stock products should be rejected at order time
  it("returns error for out of stock product", async () => {
    mockSelectWhere.mockReturnValueOnce([
      {
        id: 10,
        title: "Sold Out Item",
        priceInCents: 1800,
        pricingType: "fixed_price",
        availability: "out_of_stock",
        stockCount: 0,
        isPublished: true,
      },
    ]);

    const result = await placeOrder({
      items: [{ productId: 10, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("out of stock");
  });

  // Products with contact_for_quote pricing can't be added to cart
  it("returns error for contact_for_quote product", async () => {
    mockSelectWhere.mockReturnValueOnce([
      {
        id: 10,
        title: "Custom Crochet",
        priceInCents: null,
        pricingType: "contact_for_quote",
        availability: "made_to_order",
        stockCount: 0,
        isPublished: true,
      },
    ]);

    const result = await placeOrder({
      items: [{ productId: 10, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("requires a quote");
  });

  // Prevents overselling by checking requested quantity against stockCount
  it("returns error when requesting more than available stock", async () => {
    mockSelectWhere.mockReturnValueOnce([
      {
        id: 10,
        title: "Limited Item",
        priceInCents: 2800,
        pricingType: "fixed_price",
        availability: "in_stock",
        stockCount: 2,
        isPublished: true,
      },
    ]);

    const result = await placeOrder({
      items: [{ productId: 10, quantity: 5 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Only 2");
  });

  // Verifies the stock decrement side effect — stockCount should
  // decrease by the ordered quantity after a successful order
  it("decrements stock for in_stock items", async () => {
    mockSelectWhere.mockReturnValueOnce([
      {
        id: 10,
        title: "Tote Bag",
        priceInCents: 2800,
        pricingType: "fixed_price",
        availability: "in_stock",
        stockCount: 3,
        isPublished: true,
      },
    ]);

    await placeOrder({
      items: [{ productId: 10, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    // Should update product stock
    expect(mockUpdateSet).toHaveBeenCalled();
    const stockUpdate = mockUpdateSet.mock.calls.find(
      (call: unknown[]) =>
        call[0] &&
        typeof call[0] === "object" &&
        "stockCount" in (call[0] as Record<string, unknown>),
    );
    expect(stockUpdate).toBeDefined();
    expect((stockUpdate![0] as Record<string, unknown>).stockCount).toBe(2);
  });
});
