/**
 * Integration tests for guest checkout (unauthenticated placeOrder).
 *
 * Verifies that orders can be placed without a user session, guest contact
 * info is stored correctly, emails go to the guest address, and validation
 * catches invalid guest input.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStatefulDb,
  setupMocks,
  mockSendEmail,
  makeProduct,
  makeGuestInfo,
} from "./__test-utils__";

describe("placeOrder — guest checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
  });

  it("creates order with guest info when user is not authenticated", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ title: "Lash Aftercare Kit", priceInCents: 1800 });
    db._seedProduct(product);
    db._queue([product]);

    setupMocks(db, { authenticated: false });
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
      guestInfo: makeGuestInfo(),
    });

    expect(result.success).toBe(true);
    expect(db._orders).toHaveLength(1);
    expect(db._orders[0].clientId).toBeNull();
    expect(db._orders[0].guestEmail).toBe("guest@example.com");
    expect(db._orders[0].guestName).toBe("Jane Guest");
    expect(db._orders[0].guestPhone).toBe("555-1234");
  });

  it("sends confirmation email to guest email address", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct();
    db._seedProduct(product);
    db._queue([product]);

    setupMocks(db, { authenticated: false });
    const { placeOrder } = await import("./actions");

    await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_online",
      guestInfo: makeGuestInfo(),
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "guest@example.com" }),
    );
  });

  it("returns error when no user and no guest info provided", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db, { authenticated: false });
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/log in|contact information/i);
  });

  it("returns error when guest email is invalid", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db, { authenticated: false });
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
      guestInfo: makeGuestInfo({ email: "not-an-email" }),
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/valid email/i);
  });

  it("returns error when guest name is too short", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db, { authenticated: false });
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_cash",
      guestInfo: makeGuestInfo({ name: "J" }),
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/name/i);
  });

  it("still decrements stock for guest orders", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ stockCount: 5 });
    db._seedProduct(product);
    db._queue([product]);

    setupMocks(db, { authenticated: false });
    const { placeOrder } = await import("./actions");

    await placeOrder({
      items: [{ productId: 1, quantity: 2 }],
      fulfillmentMethod: "pickup_cash",
      guestInfo: makeGuestInfo(),
    });

    expect(db._products[0].stockCount).toBe(3);
  });

  it("guest checkout with gift card applies discount correctly", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ priceInCents: 8000 });
    const giftCard = {
      id: 1,
      code: "TC-GC-GUEST",
      balanceInCents: 2000,
      status: "active",
      expiresAt: null,
    };
    db._seedProduct(product);
    db._seedGiftCard(giftCard);
    db._queue([product]);
    db._queue([giftCard]);

    setupMocks(db, { authenticated: false });
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "pickup_online",
      giftCardCode: "TC-GC-GUEST",
      guestInfo: makeGuestInfo(),
    });

    expect(result.success).toBe(true);
    expect(db._giftCards[0].balanceInCents).toBe(0);
  });
});
