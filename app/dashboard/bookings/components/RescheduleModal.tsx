/**
 * Modal for rescheduling a booking to a new date and time.
 * Step 1: pick a date; Step 2: pick an available slot for the same service + staff.
 *
 * Related: app/dashboard/bookings/ClientBookingsPage.tsx
 */
"use client";

import { useState, useTransition } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientBookingRow } from "../client-actions";
import { getAvailableRescheduleSlots } from "../client-actions";

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
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<{ time: string; label: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [isLoadingSlots, startSlotTransition] = useTransition();

  // Minimum selectable date: tomorrow
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  function handleDateChange(dateISO: string) {
    setSelectedDate(dateISO);
    setSelectedSlot("");
    setSlots([]);
    if (!dateISO) return;

    startSlotTransition(async () => {
      const available = await getAvailableRescheduleSlots(booking.id, dateISO);
      setSlots(available);
    });
  }

  function handleConfirm() {
    if (!selectedDate || !selectedSlot) return;
    // Build local datetime string → convert to ISO UTC for server
    const localDT = `${selectedDate}T${selectedSlot}`;
    onConfirm(booking.id, new Date(localDT).toISOString());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Reschedule Appointment</p>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted">
            {booking.service} · currently {booking.date} at {booking.time}
          </p>

          {/* Step 1: Date picker */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Select a new date</p>
            <input
              type="date"
              value={selectedDate}
              min={minDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full text-sm text-foreground bg-surface border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>

          {/* Step 2: Time slot picker */}
          {selectedDate && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Select a time</p>
              {isLoadingSlots ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-xs text-muted py-2">No available slots for this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      onClick={() => setSelectedSlot(s.time)}
                      className={cn(
                        "py-2 rounded-lg border text-xs font-medium transition-colors",
                        selectedSlot === s.time
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted hover:border-accent/50 hover:text-foreground",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted">
            Your deposit will be kept. Your booking will return to pending and our team will confirm
            the new time.
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
            onClick={handleConfirm}
            disabled={isPending || !selectedDate || !selectedSlot}
            className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}
