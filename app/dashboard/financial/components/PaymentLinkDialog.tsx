/**
 * Payment Link dialog — generate a Square checkout link for a booking's
 * deposit or remaining balance.
 *
 * The generated link can be copied and shared with the client via email
 * or SMS. When the client pays through it, the Square webhook auto-links
 * the payment to the booking.
 *
 * @module financial/components/PaymentLinkDialog
 * @see {@link ../payment-actions.ts} — `createPaymentLink`
 */
"use client";

import { useState, useTransition } from "react";
import { Link2, Check, Copy } from "lucide-react";
import { Dialog, Field, Input, DialogFooter } from "@/components/ui/dialog";
import { createPaymentLink } from "../payment-actions";
import type { BookingForPayment } from "../payment-actions";

export function PaymentLinkDialog({
  open,
  onClose,
  booking,
  depositInCents,
}: {
  open: boolean;
  onClose: () => void;
  booking: BookingForPayment | null;
  depositInCents?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [type, setType] = useState<"deposit" | "balance">("balance");
  const [customAmount, setCustomAmount] = useState("");

  if (!booking) return null;

  const hasDeposit = !!depositInCents && depositInCents > 0;
  const depositDollars = hasDeposit ? (depositInCents / 100).toFixed(2) : "0.00";
  const balanceDollars = (booking.remainingInCents / 100).toFixed(2);

  function handleClose() {
    setError(null);
    setGeneratedUrl(null);
    setCopied(false);
    setType("balance");
    setCustomAmount("");
    onClose();
  }

  function handleGenerate() {
    if (!booking) return;

    let amountInCents: number;
    if (type === "deposit" && hasDeposit) {
      amountInCents = depositInCents;
    } else if (customAmount) {
      amountInCents = Math.round(parseFloat(customAmount) * 100);
    } else {
      amountInCents = booking.remainingInCents;
    }

    if (!amountInCents || amountInCents <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    startTransition(async () => {
      const result = await createPaymentLink({
        bookingId: booking.id,
        amountInCents,
        type,
      });

      if (result.success && result.url) {
        setGeneratedUrl(result.url);
        setError(null);
      } else {
        setError(result.error ?? "Failed to create payment link.");
      }
    });
  }

  async function handleCopy() {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Send Payment Link"
      description={`${booking.clientName} — ${booking.service}`}
    >
      <div className="space-y-4">
        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Booking summary */}
        <div className="bg-surface border border-border/60 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Service</span>
            <span className="text-foreground font-medium">{booking.service}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted">Date</span>
            <span className="text-foreground">{booking.date}</span>
          </div>
          <div className="flex justify-between text-xs font-semibold border-t border-border/40 pt-1 mt-1">
            <span className="text-muted">Balance due</span>
            <span className="text-foreground">${balanceDollars}</span>
          </div>
        </div>

        {generatedUrl ? (
          /* Success state — show the link */
          <div className="space-y-3">
            <div className="bg-[#4e6b51]/8 border border-[#4e6b51]/15 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4 text-[#4e6b51]" />
                <span className="text-xs font-medium text-[#4e6b51]">Payment link created</span>
              </div>
              <p className="text-xs text-foreground break-all font-mono bg-surface rounded p-2 border border-border/40">
                {generatedUrl}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </>
              )}
            </button>
          </div>
        ) : (
          /* Form state — choose type and amount */
          <>
            {/* Payment type toggle */}
            {hasDeposit && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setType("deposit");
                    setCustomAmount("");
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    type === "deposit"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface text-muted border-border hover:text-foreground"
                  }`}
                >
                  Deposit (${depositDollars})
                </button>
                <button
                  type="button"
                  onClick={() => setType("balance")}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    type === "balance"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface text-muted border-border hover:text-foreground"
                  }`}
                >
                  Full Balance (${balanceDollars})
                </button>
              </div>
            )}

            {type === "balance" && (
              <Field label="Amount ($)">
                <Input
                  type="number"
                  placeholder={balanceDollars}
                  min={0.01}
                  step={0.01}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
                <p className="text-[10px] text-muted mt-1">
                  Leave blank to charge the full balance (${balanceDollars})
                </p>
              </Field>
            )}

            <DialogFooter
              onCancel={handleClose}
              onConfirm={handleGenerate}
              confirmLabel={isPending ? "Generating..." : "Generate Link"}
            />
          </>
        )}
      </div>
    </Dialog>
  );
}
