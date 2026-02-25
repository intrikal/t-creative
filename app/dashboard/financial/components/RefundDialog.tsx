/**
 * Refund dialog — issue full or partial refunds from the Transactions tab.
 *
 * For Square card payments, warns that the refund will be processed through
 * Square. For cash payments, just updates the local record.
 *
 * @module financial/components/RefundDialog
 * @see {@link ../payment-actions.ts} — `processRefund`
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, Field, Input, Textarea, DialogFooter } from "@/components/ui/dialog";
import type { PaymentRow } from "../actions";
import { processRefund } from "../payment-actions";

export function RefundDialog({
  open,
  onClose,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  payment: PaymentRow | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [reason, setReason] = useState("");

  if (!payment) return null;

  const refundable = payment.amount - payment.refundedAmount;
  const isSquarePayment = !!payment.squarePaymentId;

  function handleClose() {
    setError(null);
    setIsPartial(false);
    setPartialAmount("");
    setReason("");
    onClose();
  }

  function handleSubmit() {
    if (!payment) return;

    const amountDollars = isPartial ? parseFloat(partialAmount) : refundable;
    if (!amountDollars || amountDollars <= 0) {
      setError("Please enter a valid refund amount.");
      return;
    }
    if (amountDollars > refundable) {
      setError(`Maximum refundable amount is $${refundable.toFixed(2)}`);
      return;
    }

    startTransition(async () => {
      const result = await processRefund({
        paymentId: payment.id,
        amountInCents: Math.round(amountDollars * 100),
        reason: reason.trim() || undefined,
      });

      if (result.success) {
        router.refresh();
        handleClose();
      } else {
        setError(result.error ?? "Refund failed.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Issue Refund"
      description={`Refund for ${payment.client} — ${payment.service}`}
    >
      <div className="space-y-4">
        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Payment summary */}
        <div className="bg-surface border border-border/60 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Original amount</span>
            <span className="text-foreground font-medium">${payment.amount.toFixed(2)}</span>
          </div>
          {payment.refundedAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted">Already refunded</span>
              <span className="text-foreground">-${payment.refundedAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs font-semibold border-t border-border/40 pt-1 mt-1">
            <span className="text-muted">Refundable</span>
            <span className="text-foreground">${refundable.toFixed(2)}</span>
          </div>
        </div>

        {/* Refund type toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsPartial(false)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
              !isPartial
                ? "bg-foreground text-background border-foreground"
                : "bg-surface text-muted border-border hover:text-foreground"
            }`}
          >
            Full Refund (${refundable.toFixed(2)})
          </button>
          <button
            type="button"
            onClick={() => setIsPartial(true)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
              isPartial
                ? "bg-foreground text-background border-foreground"
                : "bg-surface text-muted border-border hover:text-foreground"
            }`}
          >
            Partial Refund
          </button>
        </div>

        {isPartial && (
          <Field label="Refund Amount ($)" required>
            <Input
              type="number"
              placeholder="0.00"
              min={0.01}
              max={refundable}
              step={0.01}
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
            />
          </Field>
        )}

        <Field label="Reason">
          <Textarea
            rows={2}
            placeholder="Reason for refund (optional)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        {isSquarePayment && (
          <p className="text-xs text-[#7a5c10] bg-[#7a5c10]/8 border border-[#7a5c10]/15 rounded-lg px-3 py-2">
            This will process a refund through Square back to the original payment method.
          </p>
        )}

        <DialogFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          confirmLabel={isPending ? "Processing…" : "Issue Refund"}
        />
      </div>
    </Dialog>
  );
}
