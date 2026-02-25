import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore, cartTotalInCents, cartItemCount, type CartItem } from "./useCartStore";

describe("useCartStore", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it("starts with an empty cart", () => {
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("adds an item to the cart", () => {
    useCartStore.getState().addItem({
      productId: 1,
      title: "Lash Aftercare Kit",
      priceInCents: 1800,
      imageUrl: null,
    });

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe(1);
    expect(items[0].quantity).toBe(1);
  });

  it("increments quantity when adding the same item", () => {
    const item = {
      productId: 1,
      title: "Lash Aftercare Kit",
      priceInCents: 1800,
      imageUrl: null,
    };

    useCartStore.getState().addItem(item);
    useCartStore.getState().addItem(item);

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("removes an item from the cart", () => {
    useCartStore.getState().addItem({
      productId: 1,
      title: "Lash Aftercare Kit",
      priceInCents: 1800,
      imageUrl: null,
    });
    useCartStore.getState().addItem({
      productId: 2,
      title: "Lash Cleanser",
      priceInCents: 1400,
      imageUrl: null,
    });

    useCartStore.getState().removeItem(1);

    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe(2);
  });

  it("updates quantity of an item", () => {
    useCartStore.getState().addItem({
      productId: 1,
      title: "Lash Aftercare Kit",
      priceInCents: 1800,
      imageUrl: null,
    });

    useCartStore.getState().updateQuantity(1, 5);

    const { items } = useCartStore.getState();
    expect(items[0].quantity).toBe(5);
  });

  it("removes item when quantity is set to 0", () => {
    useCartStore.getState().addItem({
      productId: 1,
      title: "Lash Aftercare Kit",
      priceInCents: 1800,
      imageUrl: null,
    });

    useCartStore.getState().updateQuantity(1, 0);

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("clears the cart", () => {
    useCartStore.getState().addItem({
      productId: 1,
      title: "Lash Aftercare Kit",
      priceInCents: 1800,
      imageUrl: null,
    });
    useCartStore.getState().addItem({
      productId: 2,
      title: "Lash Cleanser",
      priceInCents: 1400,
      imageUrl: null,
    });

    useCartStore.getState().clearCart();

    expect(useCartStore.getState().items).toHaveLength(0);
  });
});

describe("cartTotalInCents", () => {
  it("returns 0 for empty cart", () => {
    expect(cartTotalInCents([])).toBe(0);
  });

  it("calculates total correctly", () => {
    const items: CartItem[] = [
      { productId: 1, title: "Kit", priceInCents: 1800, quantity: 2, imageUrl: null },
      { productId: 2, title: "Cleanser", priceInCents: 1400, quantity: 1, imageUrl: null },
    ];
    // 1800 * 2 + 1400 * 1 = 5000
    expect(cartTotalInCents(items)).toBe(5000);
  });
});

describe("cartItemCount", () => {
  it("returns 0 for empty cart", () => {
    expect(cartItemCount([])).toBe(0);
  });

  it("sums all quantities", () => {
    const items: CartItem[] = [
      { productId: 1, title: "Kit", priceInCents: 1800, quantity: 2, imageUrl: null },
      { productId: 2, title: "Cleanser", priceInCents: 1400, quantity: 3, imageUrl: null },
    ];
    expect(cartItemCount(items)).toBe(5);
  });
});
