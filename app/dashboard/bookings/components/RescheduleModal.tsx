/**
 * Modal for rescheduling a booking to a new date and time.
 *
 * Related: app/dashboard/bookings/ClientBookingsPage.tsx
 */
"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import type { ClientBookingRow } from "../client-actions";

export function RescheduleModal({
  booking,
  onClose,
  onConfirm,
  isPending,
  errorMsg,
}: {
  booking: ClientBookingRow;
  onClose: () => void;
  onConfirm: (id: number, newStartsAt: string) => void;
  isPending: boolean;
  errorMsg: string | null;
}) {
  const [newDateTime, setNewDateTime] = useState("");

  // Build a min value: 24h + 1min from now, rounded to nearest minute
  const minValue = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 1000);
    return `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, "0")}-${String(minDate.getDate()).padStart(2, "0")}T${String(minDate.getHours()).padStart(2, "0")}:${String(minDate.getMinutes()).padStart(2, "0")}`;
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Reschedule Appointment</p>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted">
            {booking.service} · currently {booking.date} at {booking.time}
          </p>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">New date & time</p>
            <input
              type="datetime-local"
              value={newDateTime}
              min={minValue}
              onChange={(e) => setNewDateTime(e.target.value)}
              className="w-full text-sm text-foreground bg-surface border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>
          <p className="text-[11px] text-muted">
            Your booking will return to pending and our team will confirm the new time.
          </p>
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
            Keep Current
          </button>
          <button
            onClick={() =>
              newDateTime && onConfirm(booking.id, new Date(newDateTime).toISOString())
            }
            disabled={isPending || !newDateTime || !!errorMsg}
            className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}
