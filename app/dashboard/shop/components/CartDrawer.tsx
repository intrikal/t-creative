/**
 * CartDrawer -- slide-out cart panel with quantity controls and checkout
 * buttons (pay online / pay cash).
 *
 * @see ../ShopPage.tsx  (parent)
 * @see ./shop-helpers.ts
 */
"use client";

import { ShoppingCart, X, Plus, Minus } from "lucide-react";
import { useCartStore, cartTotalInCents, cartItemCount } from "@/stores/useCartStore";

export function CartDrawer({
  onClose,
  onCheckout,
  checkingOut,
}: {
  onClose: () => void;
  onCheckout: (method: "pickup_cash" | "pickup_online") => void;
  checkingOut: boolean;
}) {
  const { items, updateQuantity, removeItem } = useCartStore();
  const total = cartTotalInCents(items);
  const count = cartItemCount(items);

  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="flex-1 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="w-80 bg-background border-l border-border flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Cart ({count})</p>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">Your cart is empty</p>
            </div>
          ) : (
            /* map: render one line-item row per cart entry with title,
               unit price, quantity controls, and a remove action */
            items.map((item) => (
              <div
                key={item.productId}
                className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
                  <p className="text-xs text-muted mt-0.5">
                    ${(item.priceInCents / 100).toFixed(0)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    // ternary: if quantity would drop to 0, remove the
                    // item entirely; otherwise just decrement the count
                    onClick={() =>
                      item.quantity <= 1
                        ? removeItem(item.productId)
                        : updateQuantity(item.productId, item.quantity - 1)
                    }
                    className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-medium text-foreground w-5 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">Subtotal</p>
              <p className="text-base font-bold text-foreground">${(total / 100).toFixed(0)}</p>
            </div>
            <p className="text-[11px] text-muted">
              Orders are available for pickup at the studio or can be added to your next
              appointment.
            </p>
            <button
              onClick={() => onCheckout("pickup_online")}
              disabled={checkingOut}
              className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {checkingOut ? "Placing order…" : "Pay Now"}
            </button>
            <button
              onClick={() => onCheckout("pickup_cash")}
              disabled={checkingOut}
              className="w-full py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
            >
              Pick Up & Pay Cash
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
