/**
 * CheckoutPage — Order summary with payment method choice.
 *
 * Two options:
 * 1. "Pay Now" — generates a Square payment link, redirects to Square checkout
 * 2. "Pick Up & Pay Cash" — creates the order without payment
 */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useCartStore, cartTotalInCents } from "@/stores/useCartStore";
import { placeOrder } from "../actions";

type FulfillmentMethod = "pickup_online" | "pickup_cash";

export function CheckoutPage() {
  const { items, clearCart } = useCartStore();
  const total = cartTotalInCents(items);
  const [method, setMethod] = useState<FulfillmentMethod>("pickup_online");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    orderNumber?: string;
    paymentUrl?: string;
    error?: string;
  } | null>(null);

  function handleSubmit() {
    if (items.length === 0) return;

    startTransition(async () => {
      const res = await placeOrder({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        fulfillmentMethod: method,
      });

      setResult(res);

      if (res.success) {
        clearCart();
        if (res.paymentUrl) {
          window.open(res.paymentUrl, "_blank");
        }
      }
    });
  }

  // Empty cart
  if (items.length === 0 && !result) {
    return (
      <main className="pt-16 min-h-screen">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="text-2xl font-light tracking-tight text-foreground mb-4">
            Your cart is empty
          </h1>
          <p className="text-sm text-muted mb-8">Add some products to your cart to check out.</p>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-8 py-3 text-xs tracking-widest uppercase bg-foreground text-background hover:bg-muted transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  // Order placed successfully
  if (result?.success) {
    return (
      <main className="pt-16 min-h-screen">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-light tracking-tight text-foreground mb-4">Order placed!</h1>
          <p className="text-sm text-muted mb-2">
            Order number: <span className="font-medium text-foreground">{result.orderNumber}</span>
          </p>
          {result.paymentUrl ? (
            <div className="space-y-4 mt-6">
              <p className="text-sm text-muted">
                A payment window has been opened. Complete your payment on Square.
              </p>
              <a
                href={result.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 text-xs tracking-widest uppercase bg-foreground text-background hover:bg-muted transition-colors"
              >
                Pay Now
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted mt-4">
              Pick up your order at the studio and pay in cash. We&apos;ll have it ready for you!
            </p>
          )}
          <Link
            href="/shop"
            className="inline-block mt-8 text-xs text-muted hover:text-foreground transition-colors"
          >
            ← Back to Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16 min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-foreground mb-2">
          Checkout
        </h1>
        <p className="text-sm text-muted mb-10">Review your order and choose how to pay.</p>

        {/* Order summary */}
        <div className="border border-foreground/8 mb-8">
          <div className="p-4 border-b border-foreground/5">
            <h2 className="text-xs tracking-widest uppercase text-muted">Order Summary</h2>
          </div>
          <div className="divide-y divide-foreground/5">
            {items.map((item) => (
              <div key={item.productId} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-10 h-10 object-cover bg-surface shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-surface shrink-0 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-muted/20" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted">Qty: {item.quantity}</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground shrink-0">
                  ${((item.priceInCents * item.quantity) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-foreground/8 flex items-center justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="text-lg font-medium text-accent">${(total / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="mb-8">
          <h2 className="text-xs tracking-widest uppercase text-muted mb-4">Payment Method</h2>
          <div className="space-y-3">
            <label
              className={`block p-4 border cursor-pointer transition-colors ${
                method === "pickup_online"
                  ? "border-accent bg-accent/5"
                  : "border-foreground/8 hover:border-foreground/20"
              }`}
            >
              <input
                type="radio"
                name="fulfillment"
                value="pickup_online"
                checked={method === "pickup_online"}
                onChange={() => setMethod("pickup_online")}
                className="sr-only"
              />
              <span className="text-sm font-medium text-foreground">Pay Now</span>
              <p className="text-xs text-muted mt-1">
                Pay securely online via Square. Pick up your order at the studio.
              </p>
            </label>

            <label
              className={`block p-4 border cursor-pointer transition-colors ${
                method === "pickup_cash"
                  ? "border-accent bg-accent/5"
                  : "border-foreground/8 hover:border-foreground/20"
              }`}
            >
              <input
                type="radio"
                name="fulfillment"
                value="pickup_cash"
                checked={method === "pickup_cash"}
                onChange={() => setMethod("pickup_cash")}
                className="sr-only"
              />
              <span className="text-sm font-medium text-foreground">Pick Up & Pay Cash</span>
              <p className="text-xs text-muted mt-1">
                Pick up your order at the studio and pay in cash.
              </p>
            </label>
          </div>
        </div>

        {/* Error */}
        {result?.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-sm text-red-700">
            {result.error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/shop" className="text-xs text-muted hover:text-foreground transition-colors">
            ← Back to Shop
          </Link>
          <button
            onClick={handleSubmit}
            disabled={isPending || items.length === 0}
            className="px-8 py-3 text-xs tracking-widest uppercase bg-foreground text-background hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending ? "Placing order…" : "Place Order"}
          </button>
        </div>
      </div>
    </main>
  );
}
