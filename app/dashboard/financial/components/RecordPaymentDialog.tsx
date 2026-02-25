/**
 * Record Payment dialog — lets admin record a cash or Square payment
 * against a booking.
 *
 * Pre-fills the amount from the booking's remaining balance. For Square
 * payments, allows entering the Square Payment ID from the terminal.
 *
 * @module financial/components/RecordPaymentDialog
 * @see {@link ../payment-actions.ts} — `recordPayment`, `getBookingsForPayment`
 */
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, Field, Input, Select, Textarea, DialogFooter } from "@/components/ui/dialog";
import { recordPayment } from "../payment-actions";
import type { BookingForPayment } from "../payment-actions";

type PaymentMethodOption = "cash" | "square_card" | "square_other";

const METHOD_OPTIONS: { value: PaymentMethodOption; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "square_card", label: "Square — Card" },
  { value: "square_other", label: "Square — Other" },
];

export function RecordPaymentDialog({
  open,
  onClose,
  bookings,
}: {
  open: boolean;
  onClose: () => void;
  bookings: BookingForPayment[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethodOption>("cash");
  const formRef = useRef<HTMLFormElement>(null);

  const selectedBooking = bookings.find((b) => String(b.id) === selectedBookingId);

  function handleClose() {
    setError(null);
    setSelectedBookingId("");
    setMethod("cash");
    onClose();
  }

  function handleSubmit() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);

    if (!selectedBooking) {
      setError("Please select a booking.");
      return;
    }

    const amount = parseFloat(data.get("amount") as string);
    if (!amount || amount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    const tip = parseFloat(data.get("tip") as string) || 0;
    const squarePaymentId = (data.get("squarePaymentId") as string)?.trim() || undefined;
    const notes = (data.get("notes") as string)?.trim() || undefined;

    startTransition(async () => {
      try {
        await recordPayment({
          bookingId: selectedBooking.id,
          clientId: selectedBooking.clientId,
          amountInCents: Math.round(amount * 100),
          tipInCents: Math.round(tip * 100),
          method,
          squarePaymentId,
          notes,
        });
        router.refresh();
        handleClose();
      } catch {
        setError("Failed to record payment.");
      }
    });
  }

  const isSquare = method !== "cash";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Record Payment"
      description="Record a payment against a booking."
    >
      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {error && <p className="text-xs text-destructive">{error}</p>}

        <Field label="Booking" required>
          <Select
            name="bookingId"
            value={selectedBookingId}
            onChange={(e) => setSelectedBookingId(e.target.value)}
          >
            <option value="">Select a booking…</option>
            {bookings.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.clientName} — {b.service} ({b.date}) — ${(b.remainingInCents / 100).toFixed(2)}{" "}
                due
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Payment Method" required>
          <Select
            name="method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethodOption)}
          >
            {METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)" required>
            <Input
              name="amount"
              type="number"
              placeholder="0.00"
              min={0}
              step={0.01}
              defaultValue={
                selectedBooking ? (selectedBooking.remainingInCents / 100).toFixed(2) : ""
              }
              key={selectedBookingId}
            />
          </Field>
          <Field label="Tip ($)">
            <Input name="tip" type="number" placeholder="0.00" min={0} step={0.01} />
          </Field>
        </div>

        {isSquare && (
          <Field label="Square Payment ID">
            <Input name="squarePaymentId" placeholder="From Square Terminal (optional)" />
          </Field>
        )}

        <Field label="Notes">
          <Textarea name="notes" rows={2} placeholder="Any notes…" />
        </Field>

        <DialogFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          confirmLabel={isPending ? "Saving…" : "Record Payment"}
        />
      </form>
    </Dialog>
  );
}
