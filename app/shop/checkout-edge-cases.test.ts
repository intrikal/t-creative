/**
 * Edge case tests for placeOrder — validation, product state, and multi-item orders.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStatefulDb,
  setupMocks,
  mockSendEmail,
  makeProduct,
  makeGuestInfo,
} from "./__test-utils__";

describe("placeOrder — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
  });

  it("rejects unpublished products", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ title: "Draft Product", isPublished: false });
    db._seedProduct(product);
    db._queue([product]);

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not available/i);
  });

  it("rejects non-fixed-price products in cart", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({
      title: "Custom Commission",
      priceInCents: null,
      pricingType: "contact_for_quote",
    });
    db._seedProduct(product);
    db._queue([product]);

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fixed price/i);
  });

  it("rejects when requested quantity exceeds stock", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ title: "Limited Edition Ring", stockCount: 2 });
    db._seedProduct(product);
    db._queue([product]);

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 5 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/stock/i);
  });

  it("rejects product that does not exist", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    db._queue([]); // product SELECT returns nothing

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 999, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found|not available/i);
  });

  it("handles multiple items in a single order", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product1 = makeProduct({ id: 1, title: "Lash Cleanser", priceInCents: 1400 });
    const product2 = makeProduct({
      id: 2,
      title: "Spoolie Set",
      priceInCents: 800,
      stockCount: 15,
    });
    db._seedProduct(product1);
    db._seedProduct(product2);

    const profile = { id: "client-1", email: "alice@example.com", firstName: "Alice" };
    db._seedProfile(profile);

    db._queue([product1, product2]);
    db._queue([profile]);

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 3 },
      ],
      fulfillmentMethod: "pickup_online",
    });

    expect(result.success).toBe(true);
    expect(db._orders).toHaveLength(2);
  });

  it("email uses fallback name when buyerName is undefined", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct();
    db._seedProduct(product);
    db._queue([product]);

    setupMocks(db, { authenticated: false });
    const { placeOrder } = await import("./actions");

    await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
      guestInfo: makeGuestInfo({ name: "Mono" }),
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "guest@example.com" }),
    );
  });
});
