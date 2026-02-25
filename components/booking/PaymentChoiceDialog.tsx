/**
 * PaymentChoiceDialog — Shown after a booking is confirmed.
 *
 * Offers two options:
 * 1. "Send Payment Link" — creates a Square payment link for the deposit
 *    or full amount and copies it to clipboard for sharing with the client
 * 2. "Pay at Appointment" — closes the dialog, no payment action
 *
 * Used on the admin bookings page when confirming a booking.
 */
"use client";

import { useState, useTransition } from "react";
import { createPaymentLink } from "@/app/dashboard/financial/payment-actions";

type Props = {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  serviceName: string;
  totalInCents: number;
  depositInCents: number | null;
};

export function PaymentChoiceDialog({
  open,
  onClose,
  bookingId,
  serviceName,
  totalInCents,
  depositInCents,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const hasDeposit = depositInCents && depositInCents > 0;
  const amountInCents = hasDeposit ? depositInCents : totalInCents;
  const type = hasDeposit ? ("deposit" as const) : ("balance" as const);
  const amountLabel = `$${(amountInCents / 100).toFixed(2)}`;

  function handleSendLink() {
    startTransition(async () => {
      setError(null);
      const result = await createPaymentLink({
        bookingId,
        amountInCents,
        type,
      });

      if (result.success && result.url) {
        setPaymentUrl(result.url);
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        setError(result.error ?? "Failed to create payment link");
      }
    });
  }

  function handleClose() {
    setPaymentUrl(null);
    setError(null);
    setCopied(false);
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={handleClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background border border-foreground/8 w-full max-w-md shadow-xl">
          <div className="p-6 border-b border-foreground/5">
            <h2 className="text-sm font-medium tracking-wide uppercase">Payment</h2>
            <p className="text-xs text-muted mt-1">
              {serviceName} — {hasDeposit ? `${amountLabel} deposit` : amountLabel}
            </p>
          </div>

          <div className="p-6">
            {paymentUrl ? (
              /* Success — show copied link */
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600"
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
                <p className="text-sm font-medium text-foreground mb-2">Payment link created!</p>
                <p className="text-xs text-muted mb-4">
                  {copied ? "Copied to clipboard!" : "Link ready to share with client."}
                </p>
                <div className="bg-surface border border-foreground/8 p-3 text-xs text-foreground break-all mb-4">
                  {paymentUrl}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  }}
                  className="text-xs text-accent hover:underline"
                >
                  {copied ? "Copied!" : "Copy again"}
                </button>
              </div>
            ) : (
              /* Choose payment method */
              <div className="space-y-3">
                <button
                  onClick={handleSendLink}
                  disabled={isPending}
                  className="w-full p-4 border border-foreground/8 hover:border-accent/40 text-left transition-colors disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-foreground">
                    {isPending ? "Creating link…" : "Send Payment Link"}
                  </span>
                  <p className="text-xs text-muted mt-1">
                    Generate a Square checkout link ({amountLabel}
                    {hasDeposit ? " deposit" : ""}) to share with the client via text or email.
                  </p>
                </button>

                <button
                  onClick={handleClose}
                  className="w-full p-4 border border-foreground/8 hover:border-foreground/20 text-left transition-colors"
                >
                  <span className="text-sm font-medium text-foreground">Pay at Appointment</span>
                  <p className="text-xs text-muted mt-1">
                    Client will pay in person at the studio (cash or Square POS).
                  </p>
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-foreground/5 flex justify-end">
            <button
              onClick={handleClose}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              {paymentUrl ? "Done" : "Skip"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
