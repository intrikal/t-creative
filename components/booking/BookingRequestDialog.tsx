"use client";

/**
 * BookingRequestDialog — Multi-step booking request with real availability.
 *
 * Step 1: Calendar — shows the admin's available dates (from business_hours + time_off).
 *         Past dates and closed days are disabled.
 * Step 2: Time slots — generates slots from the admin's working hours, excluding lunch.
 * Step 3: Confirm — service summary, selected date/time, optional notes, send request.
 *
 * The admin manually approves all bookings — this just ensures clients pick from
 * valid windows so the sister gets clean, actionable requests.
 */

import { useState, useEffect, useMemo } from "react";
import { X, CalendarDays, Sparkles, Send, ChevronLeft, Clock } from "lucide-react";
import {
  getStudioAvailability,
  checkIsAuthenticated,
  type StudioAvailability,
} from "@/app/dashboard/book/actions";
import { createBookingRequest } from "@/app/dashboard/messages/actions";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatPrice } from "./helpers";
import type { Service } from "./types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Convert JS Date.getDay() (0=Sun) to ISO day-of-week (1=Mon, 7=Sun). */
function toISO(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/** Check if a date string falls within any time-off block. */
function isBlockedDate(dateStr: string, blocks: { startDate: string; endDate: string }[]): boolean {
  return blocks.some((b) => dateStr >= b.startDate && dateStr <= b.endDate);
}

/** Format date as "YYYY-MM-DD". */
function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Format date as "Wed, Mar 5". */
function fmtDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Format "HH:MM" 24h to "9:00am" 12h. */
function fmt12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}${ap}`;
}

/**
 * Generate 30-minute time slots between open and close,
 * excluding any that fall within the lunch break window.
 */
function generateSlots(
  opensAt: string,
  closesAt: string,
  lunch: { enabled: boolean; start: string; end: string } | null,
): string[] {
  const slots: string[] = [];
  const [oh, om] = opensAt.split(":").map(Number);
  const [ch, cm] = closesAt.split(":").map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;

  let lunchStart = -1;
  let lunchEnd = -1;
  if (lunch?.enabled) {
    const [lh, lm] = lunch.start.split(":").map(Number);
    const [leh, lem] = lunch.end.split(":").map(Number);
    lunchStart = lh * 60 + lm;
    lunchEnd = leh * 60 + lem;
  }

  for (let min = openMin; min < closeMin; min += 30) {
    // Skip slots that overlap with lunch break
    if (lunchStart >= 0 && min >= lunchStart && min < lunchEnd) continue;

    const hh = String(Math.floor(min / 60)).padStart(2, "0");
    const mm = String(min % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }

  return slots;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

type Step = "date" | "time" | "confirm";

export function BookingRequestDialog({
  service,
  open,
  onClose,
}: {
  service: Service;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("date");
  const [availability, setAvailability] = useState<StudioAvailability | null>(null);
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Fetch availability + auth status on open
  useEffect(() => {
    if (!open) return;
    Promise.all([getStudioAvailability(), checkIsAuthenticated()]).then(([avail, authed]) => {
      setAvailability(avail);
      setIsGuest(!authed);
    });
  }, [open]);

  // Compute which dates to disable on the calendar
  const disabledDates = useMemo(() => {
    if (!availability) return undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build set of closed ISO day-of-week numbers
    const closedDays = new Set<number>();
    for (const h of availability.hours) {
      if (!h.isOpen) closedDays.add(h.dayOfWeek);
    }

    return (date: Date) => {
      // Past dates
      if (date < today) return true;
      // Closed day of week
      if (closedDays.has(toISO(date.getDay()))) return true;
      // Time-off block
      if (isBlockedDate(fmtISO(date), availability.timeOff)) return true;
      return false;
    };
  }, [availability]);

  // Generate time slots for the selected date
  const timeSlots = useMemo(() => {
    if (!selectedDate || !availability) return [];
    const dow = toISO(selectedDate.getDay());
    const dayHours = availability.hours.find((h) => h.dayOfWeek === dow);
    if (!dayHours?.isOpen || !dayHours.opensAt || !dayHours.closesAt) return [];
    return generateSlots(dayHours.opensAt, dayHours.closesAt, availability.lunchBreak);
  }, [selectedDate, availability]);

  if (!open) return null;

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    setSelectedDate(date);
    setSelectedTime("");
    setStep("time");
  }

  function handleTimeSelect(time: string) {
    setSelectedTime(time);
    setStep("confirm");
  }

  function goBack() {
    if (step === "time") {
      setStep("date");
      setSelectedTime("");
    } else if (step === "confirm") {
      setStep("time");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !selectedDate) return;

    if (isGuest && (!guestName.trim() || !guestEmail.trim())) {
      setError("Please enter your name and email.");
      return;
    }

    setSubmitting(true);
    setError("");

    const preferredDates = `${fmtDateLabel(selectedDate)} at ${fmt12(selectedTime)}`;

    try {
      if (isGuest) {
        const res = await fetch("/api/book/guest-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: guestName.trim(),
            email: guestEmail.trim(),
            phone: guestPhone.trim(),
            serviceId: service.id,
            preferredDate: preferredDates,
            notes: notes.trim(),
          }),
        });
        if (!res.ok) throw new Error("Failed to send request");
      } else {
        await createBookingRequest({
          serviceId: service.id,
          message: notes.trim() || `I'd like to book ${service.name} on ${preferredDates}.`,
          preferredDates,
        });
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setSubmitted(false);
    setStep("date");
    setSelectedDate(undefined);
    setSelectedTime("");
    setNotes("");
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setError("");
    onClose();
  }

  const stepNum = step === "date" ? 1 : step === "time" ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#faf6f1] flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-[#96604a]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-stone-900">{service.name}</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {formatPrice(service.priceInCents)}
                  {service.durationMinutes ? ` · ${service.durationMinutes} min` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          {!submitted && (
            <div className="flex gap-1 mt-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-0.5 flex-1 rounded-full transition-colors duration-300",
                    i <= stepNum ? "bg-[#96604a]" : "bg-stone-200",
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {submitted ? (
          /* ── Success state ── */
          <div className="px-6 py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-[#faf6f1] flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-[#96604a]" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 mb-1">Request sent!</h3>
            <p className="text-sm text-stone-500 max-w-xs mx-auto leading-relaxed">
              We&apos;ll review your request and reach out soon to confirm your appointment. Check
              your messages for updates.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 px-6 py-2.5 rounded-xl bg-[#96604a] text-white text-sm font-medium hover:bg-[#7a4e3a] transition-colors"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="px-6 py-5">
            {/* Loading state */}
            {!availability && (
              <div className="py-10 text-center">
                <p className="text-sm text-stone-400">Loading availability...</p>
              </div>
            )}

            {/* ── Step 1: Pick a date ── */}
            {availability && step === "date" && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-stone-700">Pick a date</p>
                <div className="flex justify-center rounded-xl border border-stone-200 py-2">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={disabledDates}
                    className="!bg-white"
                  />
                </div>
                <p className="text-[11px] text-stone-400 text-center">
                  Only available dates are selectable
                </p>
              </div>
            )}

            {/* ── Step 2: Pick a time ── */}
            {availability && step === "time" && selectedDate && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={goBack}
                    className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <p className="text-sm font-medium text-stone-700">Pick a time</p>
                    <p className="text-xs text-stone-400">{fmtDateLabel(selectedDate)}</p>
                  </div>
                </div>

                {timeSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => handleTimeSelect(slot)}
                        className={cn(
                          "py-2.5 rounded-xl border text-sm font-medium transition-colors",
                          selectedTime === slot
                            ? "border-[#96604a] bg-[#faf6f1] text-[#96604a]"
                            : "border-stone-200 text-stone-700 hover:border-[#e8c4b8] hover:bg-[#faf6f1]/50",
                        )}
                      >
                        {fmt12(slot)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 text-center py-6">
                    No available slots for this date.
                  </p>
                )}
              </div>
            )}

            {/* ── Step 3: Confirm & send ── */}
            {availability && step === "confirm" && selectedDate && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-medium text-stone-700">Confirm your request</p>
                </div>

                {/* Booking summary */}
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Service</span>
                    <span className="font-medium text-stone-900">{service.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Date</span>
                    <span className="font-medium text-stone-900">{fmtDateLabel(selectedDate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Time</span>
                    <span className="font-medium text-stone-900">{fmt12(selectedTime)}</span>
                  </div>
                  {service.durationMinutes && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-500">Duration</span>
                      <span className="flex items-center gap-1 font-medium text-stone-900">
                        <Clock className="w-3 h-3 text-stone-400" />
                        {service.durationMinutes} min
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-stone-200">
                    <span className="text-stone-500">Price</span>
                    <span className="font-semibold text-stone-900">
                      {formatPrice(service.priceInCents)}
                    </span>
                  </div>
                </div>

                {service.depositInCents && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/50 rounded-lg px-3 py-2">
                    A {formatPrice(service.depositInCents)} deposit is required to confirm this
                    booking.
                  </p>
                )}

                {/* Guest contact fields */}
                {isGuest && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-medium text-stone-600">Your contact info</p>
                    <input
                      type="text"
                      placeholder="Full name *"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition"
                    />
                    <input
                      type="email"
                      placeholder="Email address *"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition"
                    />
                    <input
                      type="tel"
                      placeholder="Phone (optional)"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition"
                    />
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">
                    Anything we should know? <span className="text-stone-400">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="First time getting lashes, have sensitive eyes, preferred time of day..."
                    rows={2}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <p className="text-[11px] text-stone-400 leading-relaxed">
                  This sends a request — we&apos;ll confirm your appointment personally and follow
                  up in your messages.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors",
                    submitting
                      ? "bg-stone-300 text-stone-500 cursor-wait"
                      : "bg-[#96604a] text-white hover:bg-[#7a4e3a] active:scale-[0.98]",
                  )}
                >
                  {submitting ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send request
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
