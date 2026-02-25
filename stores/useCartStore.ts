/**
 * useCartStore — Zustand store for the shopping cart.
 *
 * Persisted to localStorage so cart survives page refreshes.
 * Used by both the public shop (/shop) and the client dashboard shop.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: number;
  title: string;
  priceInCents: number;
  quantity: number;
  imageUrl: string | null;
};

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find((i) => i.productId === item.productId);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i,
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, quantity: 1 }] });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => i.productId !== productId) });
          return;
        }
        set({
          items: get().items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
        });
      },

      clearCart: () => set({ items: [] }),
    }),
    { name: "tc-cart" },
  ),
);

/** Derived helpers (call inside components). */
export function cartTotalInCents(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.priceInCents * i.quantity, 0);
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
