import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockSelectWhere = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

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

vi.mock("@/db/schema", () => ({
  products: { id: "id", isPublished: "isPublished", stockCount: "stockCount" },
  orders: { id: "id", clientId: "clientId", productId: "productId", status: "status" },
  services: {},
  syncLog: {},
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: "user-123" } },
      })),
    },
  })),
}));

vi.mock("@/lib/square", () => ({
  isSquareConfigured: vi.fn(() => false),
  createSquareOrderPaymentLink: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

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
      services: {},
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

    const mod = await import("./actions");
    placeOrder = mod.placeOrder;
  });

  it("returns error for empty cart", async () => {
    const result = await placeOrder({ items: [], fulfillmentMethod: "pickup_cash" });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Cart is empty");
  });

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
