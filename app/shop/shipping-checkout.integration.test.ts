/**
 * Integration tests for the shipping checkout flow.
 *
 * Verifies that shipping orders require address + rate IDs, store shipping
 * data on the order row, and work for both authenticated and guest users.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStatefulDb,
  setupMocks,
  mockSendEmail,
  makeProduct,
  makeGuestInfo,
} from "./__test-utils__";

describe("placeOrder — shipping flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
  });

  it("returns error when shipping selected but no address provided", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "ship_standard",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/shipping address/i);
  });

  it("returns error when shipping selected but no rate IDs provided", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "ship_standard",
      shippingAddress: {
        name: "Jane",
        street1: "123 Main St",
        city: "San Jose",
        state: "CA",
        zip: "95112",
        country: "US",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/shipping rate/i);
  });

  it("creates order with shipping data when all fields provided", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ title: "Crochet Blanket", priceInCents: 12000 });
    const profile = { id: "client-1", email: "alice@example.com", firstName: "Alice" };
    db._seedProduct(product);
    db._seedProfile(profile);
    db._queue([product]);
    db._queue([profile]);

    setupMocks(db);
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "ship_standard",
      shippingAddress: {
        name: "Alice Smith",
        street1: "123 Main St",
        city: "San Jose",
        state: "CA",
        zip: "95112",
        country: "US",
      },
      easypostShipmentId: "shp_abc123",
      easypostRateId: "rate_xyz789",
      shippingCostInCents: 899,
    });

    expect(result.success).toBe(true);
    expect(db._orders).toHaveLength(1);
    expect(db._orders[0].fulfillmentMethod).toBe("ship_standard");
    expect(db._orders[0].shippingAddress).toEqual(
      expect.objectContaining({ city: "San Jose", state: "CA" }),
    );
    expect(db._orders[0].easypostShipmentId).toBe("shp_abc123");
    expect(db._orders[0].shippingCostInCents).toBe(899);
  });

  it("guest checkout with shipping works end-to-end", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const product = makeProduct({ title: "Crochet Blanket", priceInCents: 12000 });
    db._seedProduct(product);
    db._queue([product]);

    setupMocks(db, { authenticated: false });
    const { placeOrder } = await import("./actions");

    const result = await placeOrder({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentMethod: "ship_standard",
      shippingAddress: {
        name: "Guest Buyer",
        street1: "456 Oak Ave",
        city: "Palo Alto",
        state: "CA",
        zip: "94301",
        country: "US",
      },
      easypostShipmentId: "shp_guest123",
      easypostRateId: "rate_guest456",
      shippingCostInCents: 1299,
      guestInfo: makeGuestInfo({ name: "Guest Buyer" }),
    });

    expect(result.success).toBe(true);
    expect(db._orders[0].clientId).toBeNull();
    expect(db._orders[0].guestEmail).toBe("guest@example.com");
    expect(db._orders[0].fulfillmentMethod).toBe("ship_standard");
    expect(db._orders[0].shippingCostInCents).toBe(1299);
  });
});
