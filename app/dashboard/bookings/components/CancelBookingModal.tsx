/**
 * Confirmation modal shown before cancelling a booking.
 *
 * Related: app/dashboard/bookings/ClientBookingsPage.tsx
 */
"use client";

import { X } from "lucide-react";
import type { ClientBookingRow } from "@/lib/types/booking.types";

export function CancelBookingModal({
  booking,
  onClose,
  onConfirm,
  isPending,
  errorMsg,
  cancelWindowHours = 48,
  lateCancelFeePercent = 0,
}: {
  booking: ClientBookingRow;
  onClose: () => void;
  onConfirm: (id: number) => void;
  isPending: boolean;
  errorMsg: string | null;
  cancelWindowHours?: number;
  lateCancelFeePercent?: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Cancel Booking</p>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          <p className="text-sm text-foreground">
            Are you sure you want to cancel this appointment?
          </p>
          <p className="text-xs text-muted">
            {booking.service} · {booking.date} at {booking.time}
          </p>
          {/* Cancellation policy */}
          <div className="text-xs text-muted bg-surface border border-border/60 rounded-lg px-3 py-2 space-y-1">
            <p className="font-medium text-foreground">Cancellation policy</p>
            <p>Free cancellation up to {cancelWindowHours} hours before your appointment.</p>
            {lateCancelFeePercent > 0 && (
              <p>
                Cancellations within {cancelWindowHours} hours may incur a {lateCancelFeePercent}%
                late-cancel fee.
              </p>
            )}
          </div>
          {booking.depositPaid && (
            <p className="text-xs text-[#4e6b51] bg-[#4e6b51]/8 border border-[#4e6b51]/20 rounded-lg px-3 py-2">
              A deposit was collected for this booking. A refund will be processed automatically.
            </p>
          )}
          {errorMsg && (
            <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Keep Booking
          </button>
          <button
            onClick={() => onConfirm(booking.id)}
            disabled={isPending || !!errorMsg}
            className="flex-1 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-40"
          >
            Cancel Appointment
          </button>
        </div>
      </div>
    </div>
  );
}
