/**
 * CheckoutPage — Order review + placement for /shop/checkout.
 *
 * Supports authenticated + guest checkout, pickup + shipping fulfillment,
 * gift card redemption, and Square payment links.
 */
"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
} from "lucide-react";
import posthog from "posthog-js";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ShippingAddress } from "@/db/schema/orders";
import { useCartStore, cartTotalInCents } from "@/stores/useCartStore";
import {
  placeOrder,
  lookupGiftCard,
  fetchShippingRates,
  type GiftCardLookupResult,
} from "../actions";

type FulfillmentMethod = "pickup_online" | "pickup_cash" | "ship_standard" | "ship_express";

type ShippingRate = {
  rateId: string;
  carrier: string;
  service: string;
  rateInCents: number;
  estimatedDays: number | null;
};

export function CheckoutPage({ user }: { user: { id: string; email: string } | null }) {
  const { items, clearCart } = useCartStore();
  const total = cartTotalInCents(items);
  const [method, setMethod] = useState<FulfillmentMethod>("pickup_online");
  const isShipping = method === "ship_standard" || method === "ship_express";

  // Guest checkout fields
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // Shipping address
  const [address, setAddress] = useState<ShippingAddress>({
    name: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
    phone: "",
  });

  // Shipping rates
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [isFetchingRates, startRatesFetch] = useTransition();

  const selectedRate = rates.find((r) => r.rateId === selectedRateId) ?? null;
  const shippingCost = selectedRate?.rateInCents ?? 0;

  useEffect(() => {
    if (items.length > 0) {
      posthog.capture("checkout_started", {
        itemCount: items.length,
        totalInCents: total,
        isGuest: !user,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    orderNumber?: string;
    paymentUrl?: string;
    error?: string;
  } | null>(null);

  // Gift card state
  const [giftCardInput, setGiftCardInput] = useState("");
  const [appliedCard, setAppliedCard] = useState<GiftCardLookupResult | null>(null);
  const [appliedCode, setAppliedCode] = useState<string>("");
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [isApplyingCard, startApplyTransition] = useTransition();

  const discountInCents = appliedCard ? Math.min(appliedCard.balanceInCents, total) : 0;
  const subtotalAfterDiscount = total - discountInCents;
  const chargeInCents = subtotalAfterDiscount + (isShipping ? shippingCost : 0);

  function handleApplyGiftCard() {
    if (!giftCardInput.trim()) return;
    setGiftCardError(null);
    startApplyTransition(async () => {
      try {
        const code = giftCardInput.trim();
        const card = await lookupGiftCard(code);
        setAppliedCard(card);
        setAppliedCode(code);
        setGiftCardInput("");
      } catch (err) {
        setGiftCardError(err instanceof Error ? err.message : "Invalid gift card");
      }
    });
  }

  function handleFetchRates() {
    if (!address.name || !address.street1 || !address.city || !address.state || !address.zip) {
      setRatesError("Please fill in all required address fields.");
      return;
    }
    setRatesError(null);
    setRates([]);
    setSelectedRateId(null);
    startRatesFetch(async () => {
      try {
        const result = await fetchShippingRates(address);
        setShipmentId(result.shipmentId);
        setRates(result.rates);
        if (result.rates.length > 0) {
          // Auto-select cheapest
          setSelectedRateId(result.rates[0].rateId);
          // Map to ship_standard or ship_express based on estimated days
          const cheapest = result.rates[0];
          setMethod(
            cheapest.estimatedDays && cheapest.estimatedDays <= 3
              ? "ship_express"
              : "ship_standard",
          );
        }
      } catch (err) {
        setRatesError(err instanceof Error ? err.message : "Unable to get shipping rates");
      }
    });
  }

  function handleSubmit() {
    if (items.length === 0) return;
    if (!user && (!guestEmail.trim() || !guestName.trim())) return;
    if (isShipping && (!shipmentId || !selectedRateId)) return;

    startTransition(async () => {
      const res = await placeOrder({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        fulfillmentMethod: method,
        giftCardCode: appliedCard ? appliedCode : undefined,
        ...(isShipping && {
          shippingAddress: address,
          easypostShipmentId: shipmentId!,
          easypostRateId: selectedRateId!,
          shippingCostInCents: shippingCost,
        }),
        ...(!user && {
          guestInfo: {
            email: guestEmail.trim(),
            name: guestName.trim(),
            phone: guestPhone.trim() || undefined,
          },
        }),
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

  const canSubmit =
    !isPending &&
    items.length > 0 &&
    (user || (guestEmail.trim() && guestName.trim())) &&
    (!isShipping || (shipmentId && selectedRateId));

  const inputClasses =
    "w-full px-4 py-3 text-sm bg-surface rounded-lg border border-muted/20 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:border-transparent transition-colors placeholder:text-muted/50";

  // Empty cart
  if (items.length === 0 && !result) {
    return (
      <main className="pt-16 min-h-screen">
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <ShoppingBag size={32} className="text-muted/40 mx-auto mb-4" />
          <h1 className="text-2xl font-light tracking-tight text-foreground mb-3">
            Your cart is empty
          </h1>
          <p className="text-sm text-muted mb-8">Add some products to your cart to check out.</p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-8 py-3 text-xs tracking-wide uppercase rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors"
          >
            Continue Shopping
            <ArrowRight size={12} />
          </Link>
        </div>
      </main>
    );
  }

  // Order placed successfully
  if (result?.success) {
    return (
      <main className="pt-16 min-h-screen">
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-green-600" />
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
                className="inline-flex items-center gap-2 px-8 py-3 text-xs tracking-wide uppercase rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors"
              >
                Pay Now
                <ArrowRight size={12} />
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted mt-4">
              Pick up your order at the studio and pay in cash. We&apos;ll have it ready!
            </p>
          )}

          {!user && (
            <Card className="mt-8 border-muted/15 shadow-none text-left max-w-sm mx-auto">
              <CardContent className="pt-5 pb-5">
                <p className="text-sm font-medium text-foreground mb-1">
                  Want to track your orders?
                </p>
                <p className="text-xs text-muted mb-3">
                  Create a free account to view order history, earn rewards, and rebook easily.
                </p>
                <Link
                  href={`/login?redirect=/dashboard&email=${encodeURIComponent(guestEmail)}`}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs tracking-wide uppercase rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors"
                >
                  Create an Account
                  <ArrowRight size={12} />
                </Link>
              </CardContent>
            </Card>
          )}

          <Link
            href="/shop"
            className="inline-flex items-center gap-2 mt-8 text-xs text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={12} />
            Back to Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16 min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-20">
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-foreground mb-2">
          Checkout
        </h1>
        <p className="text-sm text-muted mb-10">Review your order and choose how to pay.</p>

        {/* Order summary */}
        <Card className="border-muted/15 shadow-none mb-8">
          <div className="px-5 py-3 border-b border-muted/15">
            <h2 className="text-xs tracking-widest uppercase text-muted">Order Summary</h2>
          </div>
          <div className="divide-y divide-muted/10">
            {items.map((item) => (
              <div
                key={item.productId}
                className="px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-lg object-cover bg-surface shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface shrink-0 flex items-center justify-center">
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
          {appliedCard && (
            <div className="px-5 py-2.5 border-t border-muted/10 flex items-center justify-between text-sm">
              <span className="text-muted">Gift card discount</span>
              <span className="text-green-700">−${(discountInCents / 100).toFixed(2)}</span>
            </div>
          )}
          {isShipping && selectedRate && (
            <div className="px-5 py-2.5 border-t border-muted/10 flex items-center justify-between text-sm">
              <span className="text-muted">
                Shipping ({selectedRate.carrier} {selectedRate.service})
              </span>
              <span className="text-foreground">
                ${(selectedRate.rateInCents / 100).toFixed(2)}
              </span>
            </div>
          )}
          <Separator />
          <div className="px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="text-lg font-medium text-accent">
              ${(chargeInCents / 100).toFixed(2)}
            </span>
          </div>
        </Card>

        {/* Guest contact info */}
        {!user && (
          <div className="mb-8">
            <h2 className="text-xs tracking-widest uppercase text-muted mb-4">
              Contact Information
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Full name *"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className={inputClasses}
                required
              />
              <input
                type="email"
                placeholder="Email address *"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className={inputClasses}
                required
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className={inputClasses}
              />
            </div>
            <p className="text-xs text-muted mt-3">
              We&apos;ll send your order confirmation to this email.{" "}
              <Link
                href="/login?redirect=/shop/checkout"
                className="underline hover:text-foreground transition-colors"
              >
                Already have an account? Log in
              </Link>
            </p>
          </div>
        )}

        {/* Gift card */}
        <div className="mb-8">
          <h2 className="text-xs tracking-widest uppercase text-muted mb-4">Gift Card</h2>
          {appliedCard ? (
            <Card className="border-green-200 bg-green-50 shadow-none">
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">{appliedCode}</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    ${(discountInCents / 100).toFixed(2)} applied · $
                    {((appliedCard.balanceInCents - discountInCents) / 100).toFixed(2)} remaining
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAppliedCard(null);
                    setAppliedCode("");
                  }}
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  Remove
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={giftCardInput}
                  onChange={(e) => {
                    setGiftCardInput(e.target.value.toUpperCase());
                    setGiftCardError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyGiftCard()}
                  placeholder="TC-GC-001"
                  className={`flex-1 font-mono uppercase ${inputClasses}`}
                />
                <button
                  onClick={handleApplyGiftCard}
                  disabled={!giftCardInput.trim() || isApplyingCard}
                  className="px-5 py-3 text-xs tracking-wide uppercase rounded-lg bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-40"
                >
                  {isApplyingCard ? "…" : "Apply"}
                </button>
              </div>
              {giftCardError && <p className="text-xs text-red-600">{giftCardError}</p>}
            </div>
          )}
        </div>

        {/* Fulfillment method */}
        <div className="mb-8">
          <h2 className="text-xs tracking-widest uppercase text-muted mb-4">Fulfillment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                value: "pickup_online" as const,
                icon: MapPin,
                label: "Pay Now & Pick Up",
                desc: "Pay online via Square",
              },
              {
                value: "pickup_cash" as const,
                icon: Package,
                label: "Pick Up & Pay Cash",
                desc: "Pay in person at the studio",
              },
              {
                value: "ship_standard" as const,
                icon: Truck,
                label: "Ship to Me",
                desc: "Enter address for rates",
              },
            ].map((opt) => {
              const isActive = opt.value === "ship_standard" ? isShipping : method === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setMethod(opt.value);
                    if (opt.value !== "ship_standard") {
                      setRates([]);
                      setSelectedRateId(null);
                      setShipmentId(null);
                    }
                  }}
                  className={`flex flex-col items-center gap-2 p-5 rounded-lg border text-center transition-colors ${
                    isActive ? "border-accent bg-accent/5" : "border-muted/20 hover:border-muted/40"
                  }`}
                >
                  <opt.icon size={20} className={isActive ? "text-accent" : "text-muted"} />
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                  <span className="text-[10px] text-muted">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shipping address + rate selection */}
        {isShipping && (
          <div className="mb-8 space-y-6">
            {/* Address form */}
            <div>
              <h2 className="text-xs tracking-widest uppercase text-muted mb-4">
                Shipping Address
              </h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Full name *"
                  value={address.name}
                  onChange={(e) => setAddress({ ...address, name: e.target.value })}
                  className={inputClasses}
                />
                <input
                  type="text"
                  placeholder="Street address *"
                  value={address.street1}
                  onChange={(e) => setAddress({ ...address, street1: e.target.value })}
                  className={inputClasses}
                />
                <input
                  type="text"
                  placeholder="Apt, suite, unit (optional)"
                  value={address.street2}
                  onChange={(e) => setAddress({ ...address, street2: e.target.value })}
                  className={inputClasses}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="City *"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    className={inputClasses}
                  />
                  <input
                    type="text"
                    placeholder="State *"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    className={inputClasses}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="ZIP code *"
                    value={address.zip}
                    onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                    className={inputClasses}
                  />
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    className={inputClasses}
                  />
                </div>
              </div>
              <button
                onClick={handleFetchRates}
                disabled={isFetchingRates}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-xs tracking-wide uppercase rounded-lg bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-50"
              >
                {isFetchingRates ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Getting rates…
                  </>
                ) : (
                  "Get Shipping Rates"
                )}
              </button>
              {ratesError && <p className="text-xs text-red-600 mt-2">{ratesError}</p>}
            </div>

            {/* Rate selection */}
            {rates.length > 0 && (
              <div>
                <h2 className="text-xs tracking-widest uppercase text-muted mb-4">
                  Select Shipping Rate
                </h2>
                <div className="space-y-2">
                  {rates.map((rate) => (
                    <label
                      key={rate.rateId}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedRateId === rate.rateId
                          ? "border-accent bg-accent/5"
                          : "border-muted/20 hover:border-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shipping_rate"
                          value={rate.rateId}
                          checked={selectedRateId === rate.rateId}
                          onChange={() => {
                            setSelectedRateId(rate.rateId);
                            setMethod(
                              rate.estimatedDays && rate.estimatedDays <= 3
                                ? "ship_express"
                                : "ship_standard",
                            );
                          }}
                          className="sr-only"
                        />
                        <Truck
                          size={16}
                          className={selectedRateId === rate.rateId ? "text-accent" : "text-muted"}
                        />
                        <div>
                          <span className="text-sm font-medium text-foreground">
                            {rate.carrier} — {rate.service}
                          </span>
                          {rate.estimatedDays && (
                            <span className="text-xs text-muted block">
                              Est. {rate.estimatedDays} business day
                              {rate.estimatedDays > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-accent shrink-0">
                        ${(rate.rateInCents / 100).toFixed(2)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {result?.error && (
          <Card className="mb-6 border-red-200 bg-red-50 shadow-none">
            <CardContent className="pt-4 pb-4 text-sm text-red-700">{result.error}</CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={12} />
            Back to Shop
          </Link>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-8 py-3 text-xs tracking-wide uppercase rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending ? "Placing order…" : "Place Order"}
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </main>
  );
}
