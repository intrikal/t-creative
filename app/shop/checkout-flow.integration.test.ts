/**
 * Integration tests for the authenticated placeOrder checkout flow.
 *
 * Uses a stateful mock DB so the full sequence of DB calls can be verified:
 * product lookup → order INSERT → stock UPDATE → gift card SELECT/UPDATE/INSERT
 * → syncLog INSERT → profile SELECT.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStatefulDb, setupMocks, mockSendEmail, makeProduct } from "./__test-utils__";

describe("placeOrder — authenticated checkout flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
  });

  it("creates an order for a valid in-stock product", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ title: "Crystal Ring" });
    db._seedProduct(product);
    db._queue([product]);
    db._queue([]); // profile select

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

  it("decrements stock count for in-stock item", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ stockCount: 10 });
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

  it("returns error when cart is empty", async () => {
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

  it("returns error when product is out of stock", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ availability: "out_of_stock", stockCount: 0 });
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

  it("applies gift card discount and decrements balance", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ title: "Gold Necklace", priceInCents: 10000 });
    const giftCard = {
      id: 1,
      code: "TC-GC-001",
      balanceInCents: 3000,
      status: "active",
      expiresAt: null,
    };
    db._seedProduct(product);
    db._seedGiftCard(giftCard);
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
    expect(db._giftCards[0].balanceInCents).toBe(0);
  });

  it("sends a confirmation email after order placed", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct();
    const profile = { id: "client-1", email: "alice@example.com", firstName: "Alice" };
    db._seedProduct(product);
    db._seedProfile(profile);
    db._queue([product]);
    db._queue([profile]);

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "alice@example.com" }),
    );
  });
});
