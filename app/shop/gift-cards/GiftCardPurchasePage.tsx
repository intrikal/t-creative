/**
 * GiftCardPurchasePage — Public gift card purchase flow at /shop/gift-cards.
 *
 * Two-step flow rendered as a single page:
 *   1. Selection — Pick from six preset dollar amounts or enter a custom
 *      value ($25-$500), optionally name a recipient.
 *   2. Confirmation — After the `purchaseGiftCard` server action succeeds,
 *      show the generated card code and open the Square payment link in a
 *      new tab so the buyer can pay to activate the card.
 *
 * The server action creates the gift-card record in the DB and returns a
 * { success, giftCardCode, paymentUrl } response.
 *
 * This is a Client Component ("use client") because it manages interactive
 * state (amount selection, custom input, pending transition) and triggers
 * a window.open for the Square payment link.
 */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { purchaseGiftCard } from "./actions";

const PRESET_AMOUNTS = [25, 50, 75, 100, 150, 200];

export function GiftCardPurchasePage() {
  // --- Amount selection state ---
  // Preset and custom modes are mutually exclusive: selecting a preset
  // clears custom, and clicking "Custom" deselects the preset. Three
  // separate states instead of one object because the preset grid buttons,
  // the custom input, and the mode toggle each update independently.
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50); // Which preset pill is active (dollars, not cents)
  const [customAmount, setCustomAmount] = useState(""); // Raw text from the custom dollar input
  const [useCustom, setUseCustom] = useState(false); // Whether the custom input is active
  const [recipientName, setRecipientName] = useState(""); // Optional "To:" name included in the confirmation email
  const [isPending, startTransition] = useTransition();
  // Result of the purchaseGiftCard server action — holds the card code and
  // optional Square payment URL on success, or an error string on failure.
  const [result, setResult] = useState<{
    success: boolean;
    giftCardCode?: string;
    paymentUrl?: string;
    error?: string;
  } | null>(null);

  // Resolve the active amount to cents regardless of mode. Used for
  // validation and as the value sent to the server action.
  const resolvedAmountCents = useCustom
    ? Math.round(parseFloat(customAmount || "0") * 100)
    : (selectedAmount ?? 0) * 100;

  // Enforces the $25–$500 range for both preset and custom amounts.
  const isValidAmount = resolvedAmountCents >= 2500 && resolvedAmountCents <= 50000;

  // Calls the purchaseGiftCard server action which creates the gift card
  // record in the DB and returns a Square payment URL. On success, opens
  // the payment link in a new tab so the buyer can complete payment.
  function handleSubmit() {
    if (!isValidAmount) return;

    startTransition(async () => {
      const res = await purchaseGiftCard({
        amountInCents: resolvedAmountCents,
        recipientName: recipientName.trim() || undefined,
      });
      setResult(res);
      if (res.success && res.paymentUrl) {
        window.open(res.paymentUrl, "_blank");
      }
    });
  }

  // Success state
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
          <h1 className="text-2xl font-light tracking-tight text-foreground mb-4">
            Gift card created!
          </h1>
          <p className="text-sm text-muted mb-6">
            Your confirmation email has been sent. Here is your gift card code:
          </p>
          <div className="inline-block px-6 py-3 border border-foreground/20 font-mono text-xl tracking-widest text-foreground mb-8">
            {result.giftCardCode}
          </div>
          {result.paymentUrl ? (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted">
                A payment window has been opened. Complete your payment on Square to activate the
                card.
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
            <p className="text-sm text-muted">
              Complete payment at the studio to activate your gift card.
            </p>
          )}
          <div className="mt-8">
            <Link
              href="/shop"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              ← Back to Shop
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16 min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-foreground mb-2">
          Gift Cards
        </h1>
        <p className="text-sm text-muted mb-10">
          Give the gift of lash extensions, permanent jewelry, crochet, or consulting. Valid for any
          service or product at T Creative Studio.
        </p>

        {/* Amount selector */}
        <div className="mb-8">
          <h2 className="text-xs tracking-widest uppercase text-muted mb-4">Choose an Amount</h2>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => {
                  setSelectedAmount(amt);
                  setUseCustom(false);
                  setCustomAmount("");
                }}
                className={`py-3 text-sm border transition-colors ${
                  !useCustom && selectedAmount === amt
                    ? "border-accent bg-accent/5 text-foreground font-medium"
                    : "border-foreground/8 text-muted hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setUseCustom(true);
                setSelectedAmount(null);
              }}
              className={`shrink-0 px-4 py-2.5 text-xs tracking-widest uppercase border transition-colors ${
                useCustom
                  ? "border-accent bg-accent/5 text-foreground"
                  : "border-foreground/8 text-muted hover:border-foreground/20 hover:text-foreground"
              }`}
            >
              Custom
            </button>
            {useCustom && (
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  $
                </span>
                <input
                  type="number"
                  min="25"
                  max="500"
                  step="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="25 – 500"
                  autoFocus
                  className="w-full pl-7 pr-3 py-2.5 text-sm border border-foreground/8 bg-background placeholder:text-muted/40 focus:outline-none focus:border-foreground/30"
                />
              </div>
            )}
          </div>
          {useCustom && customAmount && !isValidAmount && (
            <p className="mt-2 text-xs text-red-600">Amount must be between $25 and $500</p>
          )}
          {isValidAmount && (
            <p className="mt-3 text-sm text-muted">
              Total:{" "}
              <span className="font-medium text-foreground">
                ${(resolvedAmountCents / 100).toFixed(2)}
              </span>
            </p>
          )}
        </div>

        {/* Recipient (optional) */}
        <div className="mb-8">
          <h2 className="text-xs tracking-widest uppercase text-muted mb-4">
            For Someone Special{" "}
            <span className="normal-case tracking-normal text-muted/60">(optional)</span>
          </h2>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Recipient's name"
            className="w-full px-3 py-2.5 text-sm border border-foreground/8 bg-background placeholder:text-muted/40 focus:outline-none focus:border-foreground/30"
          />
          <p className="mt-2 text-xs text-muted">
            We&apos;ll include their name on a delivery email you can forward to them.
          </p>
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
            disabled={isPending || !isValidAmount}
            className="px-8 py-3 text-xs tracking-widest uppercase bg-foreground text-background hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending ? "Creating…" : "Purchase Gift Card"}
          </button>
        </div>
      </div>
    </main>
  );
}
