"use client";

/**
 * BookingRequestDialog — Multi-step booking request with real availability.
 *
 * Step 1: Calendar — shows the admin's available dates (from business_hours + time_off).
 *         Past dates and closed days are disabled.
 * Step 2: Time slots — generates slots from the admin's working hours, excluding lunch.
 * Step 3: Confirm — service summary, selected date/time, optional notes, send request.
 * Step 4: Pay (conditional) — when service has a deposit, collects payment inline
 *         via Square Web Payments SDK before submitting the request.
 *
 * The admin manually approves all bookings — this just ensures clients pick from
 * valid windows so the sister gets clean, actionable requests.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  X,
  CalendarDays,
  Sparkles,
  Send,
  ChevronLeft,
  Clock,
  ImagePlus,
  Trash2,
  CalendarPlus,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  getStudioAvailability,
  checkIsAuthenticated,
  checkClientWaivers,
  type StudioAvailability,
  type PendingWaiver,
} from "@/app/dashboard/book/actions";
import { createBookingRequest } from "@/app/dashboard/messages/actions";
import { getPublicPolicies } from "@/app/dashboard/settings/settings-actions";
import { Calendar } from "@/components/ui/calendar";
import { CADENCE_OPTIONS, rruleToCadenceLabel } from "@/lib/cadence";
import { cn } from "@/lib/utils";
import { SquarePaymentForm } from "./components/SquarePaymentForm";
import { formatPrice } from "./helpers";
import type { Service, ServiceAddOn } from "./types";

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
/*  Calendar helpers                                                    */
/* ------------------------------------------------------------------ */

/** Build a Google Calendar "add event" URL for a booking request. */
function buildGoogleCalendarUrl(service: Service, date: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(date);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (service.durationMinutes ?? 60) * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${service.name} at T Creative Studio`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: "Your booking request has been submitted. We'll confirm your appointment soon.",
    location: "T Creative Studio",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Trigger an ICS file download for Apple Calendar / Outlook. */
function downloadIcs(service: Service, date: Date, time: string): void {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(date);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (service.durationMinutes ?? 60) * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//T Creative Studio//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${service.name} at T Creative Studio`,
    "DESCRIPTION:Your booking request has been submitted. We'll confirm your appointment soon.",
    "LOCATION:T Creative Studio",
    "STATUS:TENTATIVE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "appointment.ics";
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

type Step = "date" | "time" | "confirm" | "pay";

type PhotoPreview = { file: File; preview: string };

export function BookingRequestDialog({
  service,
  addOns = [],
  open,
  onClose,
}: {
  service: Service;
  addOns?: ServiceAddOn[];
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("date");
  const [availability, setAvailability] = useState<StudioAvailability | null>(null);
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [cadence, setCadence] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [depositPaid, setDepositPaid] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Cached photo URLs — uploaded once on confirm, reused in pay step. */
  const uploadedPhotosRef = useRef<string[]>([]);
  const [pendingWaivers, setPendingWaivers] = useState<PendingWaiver[]>([]);
  const [waiversChecked, setWaiversChecked] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [policyText, setPolicyText] = useState("");
  const [tosVersion, setTosVersion] = useState("");

  const hasDeposit = !!service.depositInCents && service.depositInCents > 0;
  const totalSteps = hasDeposit ? 4 : 3;

  const selectedAddOns = addOns.filter((a) => selectedAddOnIds.has(a.id));
  const addOnTotal = selectedAddOns.reduce((sum, a) => sum + a.priceInCents, 0);
  const addOnMinutes = selectedAddOns.reduce((sum, a) => sum + a.additionalMinutes, 0);
  const adjustedPrice = (service.priceInCents ?? 0) + addOnTotal;
  const adjustedDuration = (service.durationMinutes ?? 0) + addOnMinutes;

  // Fetch availability, auth status, and policy on open
  useEffect(() => {
    if (!open) return;
    Promise.all([getStudioAvailability(), checkIsAuthenticated(), getPublicPolicies()]).then(
      ([avail, authed, policies]) => {
        setAvailability(avail);
        setIsGuest(!authed);
        setPolicyText(policies.cancellationPolicy);
        setTosVersion(policies.tosVersion);
      },
    );
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

  /** Called by SquarePaymentForm after successful card tokenisation. */
  const handleDepositPayment = useCallback(
    async (token: string) => {
      if (submitting || !selectedDate) return;

      setSubmitting(true);
      setError("");

      const preferredDates = `${fmtDateLabel(selectedDate)} at ${fmt12(selectedTime)}`;
      const idempotencyKey = crypto.randomUUID();
      const addOnPayload = selectedAddOns.map((a) => ({
        name: a.name,
        priceInCents: a.priceInCents,
      }));

      try {
        const res = await fetch("/api/book/pay-deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: token,
            serviceId: service.id,
            preferredDate: preferredDates,
            notes: notes.trim(),
            referencePhotoUrls: uploadedPhotosRef.current,
            recurrenceRule: cadence || undefined,
            idempotencyKey,
            selectedAddOns: addOnPayload,
            tosAccepted: true,
            tosVersion,
            // Guest fields
            ...(isGuest
              ? {
                  name: guestName.trim(),
                  email: guestEmail.trim(),
                  phone: guestPhone.trim(),
                  turnstileToken,
                }
              : {}),
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Payment failed. Please try again.");
        }

        setDepositPaid(true);
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      submitting,
      selectedDate,
      selectedTime,
      service.id,
      notes,
      cadence,
      isGuest,
      guestName,
      guestEmail,
      guestPhone,
      turnstileToken,
      selectedAddOns,
      tosVersion,
    ],
  );

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

    // Check waivers for authenticated users when entering confirm step
    if (isGuest === false && !waiversChecked) {
      checkClientWaivers(service.category).then((waivers) => {
        setPendingWaivers(waivers);
        setWaiversChecked(true);
      });
    }
  }

  function goBack() {
    if (step === "time") {
      setStep("date");
      setSelectedTime("");
    } else if (step === "confirm") {
      setStep("time");
    } else if (step === "pay") {
      setStep("confirm");
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = 5 - photos.length;
    const toAdd = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...toAdd]);
    // Reset input so same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function uploadPhotos(): Promise<string[]> {
    if (photos.length === 0) return [];
    const urls: string[] = [];
    for (const { file } of photos) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/book/upload-reference", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Photo upload failed");
      const { url } = (await res.json()) as { url: string };
      urls.push(url);
    }
    return urls;
  }

  /** Serialisable add-on payload for server actions + API routes. */
  function getAddOnPayload() {
    return selectedAddOns.map((a) => ({
      name: a.name,
      priceInCents: a.priceInCents,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !selectedDate) return;

    if (isGuest && (!guestName.trim() || !guestEmail.trim())) {
      setError("Please enter your name and email.");
      return;
    }

    if (!tosAccepted) {
      setError("Please accept the cancellation policy to continue.");
      return;
    }

    const addOnPayload = getAddOnPayload();

    // If service has deposit, proceed to pay step instead of submitting
    if (hasDeposit) {
      // Upload photos now so they're ready for the pay step
      setSubmitting(true);
      setError("");
      try {
        uploadedPhotosRef.current = await uploadPhotos();
      } catch {
        setError("Photo upload failed. Please try again.");
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setStep("pay");
      return;
    }

    // No deposit — submit as before
    setSubmitting(true);
    setError("");

    const preferredDates = `${fmtDateLabel(selectedDate)} at ${fmt12(selectedTime)}`;

    try {
      const referencePhotoUrls = await uploadPhotos();

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
            referencePhotoUrls,
            preferredCadence: cadence ? rruleToCadenceLabel(cadence) : undefined,
            turnstileToken,
            selectedAddOns: addOnPayload,
            tosAccepted: true,
            tosVersion,
          }),
        });
        if (!res.ok) throw new Error("Failed to send request");
      } else {
        await createBookingRequest({
          serviceId: service.id,
          message: notes.trim() || `I'd like to book ${service.name} on ${preferredDates}.`,
          preferredDates,
          referencePhotoUrls,
          recurrenceRule: cadence || undefined,
          selectedAddOns: addOnPayload,
          tosAccepted: true,
          tosVersion,
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
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setSubmitted(false);
    setDepositPaid(false);
    setStep("date");
    setSelectedDate(undefined);
    setSelectedTime("");
    setNotes("");
    setCadence("");
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setPhotos([]);
    setSelectedAddOnIds(new Set());
    setError("");
    setTurnstileToken("");
    setPendingWaivers([]);
    setWaiversChecked(false);
    setTosAccepted(false);
    uploadedPhotosRef.current = [];
    onClose();
  }

  const stepNum = step === "date" ? 1 : step === "time" ? 2 : step === "confirm" ? 3 : 4;

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
              aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          {!submitted && (
            <div className="flex gap-1 mt-4">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
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
            {depositPaid ? (
              <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/50 rounded-lg px-3 py-2.5 max-w-xs mx-auto text-left leading-relaxed flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium">Deposit paid:</span> Your{" "}
                  {formatPrice(service.depositInCents)} deposit has been collected. Your spot is
                  secured!
                </span>
              </p>
            ) : service.depositInCents ? (
              <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200/50 rounded-lg px-3 py-2.5 max-w-xs mx-auto text-left leading-relaxed">
                <span className="font-medium">Deposit required:</span> Once confirmed, you&apos;ll
                receive a {formatPrice(service.depositInCents)} deposit link by email to secure your
                spot.
              </p>
            ) : null}
            {selectedDate && selectedTime && (
              <div className="mt-5 w-full max-w-xs mx-auto space-y-2">
                <p className="text-xs text-stone-500 font-medium flex items-center justify-center gap-1.5">
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Add to your calendar
                </p>
                <div className="flex gap-2">
                  <a
                    href={buildGoogleCalendarUrl(service, selectedDate, selectedTime)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 rounded-xl border border-stone-200 text-xs text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    Google
                  </a>
                  <button
                    onClick={() => downloadIcs(service, selectedDate, selectedTime)}
                    className="flex-1 py-2 rounded-xl border border-stone-200 text-xs text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    Apple / Outlook
                  </button>
                </div>
              </div>
            )}
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
                    aria-label="Go back"
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
                    aria-label="Go back"
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
                  {(service.durationMinutes || addOnMinutes > 0) && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-500">Duration</span>
                      <span className="flex items-center gap-1 font-medium text-stone-900">
                        <Clock className="w-3 h-3 text-stone-400" />
                        {adjustedDuration} min
                      </span>
                    </div>
                  )}
                  {selectedAddOns.length > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm pt-1 border-t border-stone-200">
                        <span className="text-stone-500">Base price</span>
                        <span className="font-medium text-stone-900">
                          {formatPrice(service.priceInCents)}
                        </span>
                      </div>
                      {selectedAddOns.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-sm">
                          <span className="text-stone-500 pl-2">+ {a.name}</span>
                          <span className="font-medium text-stone-900">
                            {formatPrice(a.priceInCents)}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-stone-200">
                    <span className="text-stone-500">
                      {selectedAddOns.length > 0 ? "Total" : "Price"}
                    </span>
                    <span className="font-semibold text-stone-900">
                      {formatPrice(adjustedPrice)}
                    </span>
                  </div>
                  {cadence && (
                    <div className="flex items-center justify-between text-sm pt-1 border-t border-stone-200">
                      <span className="text-stone-500">Repeats</span>
                      <span className="font-medium text-[#96604a]">
                        {rruleToCadenceLabel(cadence)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Add-on upsells */}
                {addOns.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-stone-600">Enhance your appointment</p>
                    <div className="space-y-1.5">
                      {addOns.map((addon) => {
                        const isSelected = selectedAddOnIds.has(addon.id);
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() =>
                              setSelectedAddOnIds((prev) => {
                                const next = new Set(prev);
                                if (isSelected) next.delete(addon.id);
                                else next.add(addon.id);
                                return next;
                              })
                            }
                            className={cn(
                              "w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                              isSelected
                                ? "border-[#96604a] bg-[#faf6f1]"
                                : "border-stone-200 hover:border-[#e8c4b8] hover:bg-[#faf6f1]/50",
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                  isSelected ? "border-[#96604a] bg-[#96604a]" : "border-stone-300",
                                )}
                              >
                                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <div>
                                <span className="text-sm font-medium text-stone-900">
                                  {addon.name}
                                </span>
                                {addon.description && (
                                  <p className="text-[11px] text-stone-400 leading-tight mt-0.5">
                                    {addon.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-[#96604a] shrink-0 ml-2">
                              +{formatPrice(addon.priceInCents)}
                              {addon.additionalMinutes > 0 && (
                                <span className="block text-[10px] font-normal text-stone-400 text-right">
                                  +{addon.additionalMinutes}min
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hasDeposit && (
                  <p className="text-xs text-[#96604a] bg-[#faf6f1] border border-[#e8c4b8]/50 rounded-lg px-3 py-2">
                    A {formatPrice(service.depositInCents)} deposit will be collected on the next
                    step to secure your spot.
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

                {/* Cadence */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">
                    Repeat <span className="text-stone-400">(optional)</span>
                  </label>
                  <select
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition"
                  >
                    {CADENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

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

                {/* Reference photos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-stone-600">
                      Inspo photos <span className="text-stone-400">(optional, up to 5)</span>
                    </label>
                    {photos.length < 5 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs text-[#96604a] hover:text-[#7a4e3a] transition-colors"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        Add photo
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {photos.map((p, i) => (
                        <div
                          key={i}
                          className="relative group w-16 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.preview}
                            alt={`Reference ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label="Remove photo"
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ))}
                      {photos.length < 5 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-16 h-16 rounded-lg border border-dashed border-stone-300 flex items-center justify-center text-stone-400 hover:border-[#96604a] hover:text-[#96604a] transition-colors shrink-0"
                        >
                          <ImagePlus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  {photos.length === 0 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-stone-200 text-xs text-stone-400 hover:border-[#96604a] hover:text-[#96604a] transition-colors"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      Upload lash style, design, or inspo
                    </button>
                  )}
                </div>

                {isGuest && (
                  <Turnstile
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                    onSuccess={handleTurnstileSuccess}
                    onExpire={() => setTurnstileToken("")}
                    options={{ theme: "light", size: "flexible" }}
                  />
                )}

                {pendingWaivers.length > 0 && !isGuest && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-amber-800">
                          Waiver required before your appointment
                        </p>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                          You&apos;ll receive a waiver to sign by email once your request is
                          reviewed. Your booking can only be confirmed after it&apos;s completed.
                        </p>
                        <ul className="mt-1.5 space-y-0.5">
                          {pendingWaivers.map((w) => (
                            <li
                              key={w.formId}
                              className="text-[11px] text-amber-700 flex items-center gap-1"
                            >
                              <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                              {w.formName}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cancellation policy / TOS acceptance */}
                {policyText && (
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      required
                      checked={tosAccepted}
                      onChange={(e) => setTosAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 shrink-0 accent-[#96604a] cursor-pointer"
                    />
                    <span className="text-[11px] text-stone-600 leading-relaxed">{policyText}</span>
                  </label>
                )}

                {error && (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2"
                  >
                    {error}
                  </p>
                )}

                <p className="text-[11px] text-stone-400 leading-relaxed">
                  This sends a request — we&apos;ll confirm your appointment personally and follow
                  up in your messages.
                </p>

                <button
                  type="submit"
                  disabled={submitting || (isGuest === true && !turnstileToken) || !tosAccepted}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors",
                    submitting
                      ? "bg-stone-300 text-stone-500 cursor-wait"
                      : "bg-[#96604a] text-white hover:bg-[#7a4e3a] active:scale-[0.98]",
                  )}
                >
                  {submitting ? (
                    "Sending..."
                  ) : hasDeposit ? (
                    <>
                      <Send className="w-4 h-4" />
                      Continue to payment
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send request
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── Step 4: Pay deposit ── */}
            {availability && step === "pay" && selectedDate && hasDeposit && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={goBack}
                    aria-label="Go back"
                    className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <p className="text-sm font-medium text-stone-700">Pay deposit</p>
                    <p className="text-xs text-stone-400">
                      {formatPrice(service.depositInCents)} to secure your spot
                    </p>
                  </div>
                </div>

                {/* Compact booking summary */}
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500">Service</span>
                    <span className="font-medium text-stone-900">{service.name}</span>
                  </div>
                  {selectedAddOns.length > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500">Add-ons</span>
                      <span className="font-medium text-stone-900">
                        {selectedAddOns.map((a) => a.name).join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500">Date & time</span>
                    <span className="font-medium text-stone-900">
                      {fmtDateLabel(selectedDate)} at {fmt12(selectedTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200">
                    <span className="text-stone-500">Deposit due now</span>
                    <span className="font-semibold text-[#96604a]">
                      {formatPrice(service.depositInCents)}
                    </span>
                  </div>
                  {adjustedPrice > 0 && service.depositInCents && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-400">Remaining at appointment</span>
                      <span className="text-stone-500">
                        {formatPrice(adjustedPrice - service.depositInCents)}
                      </span>
                    </div>
                  )}
                </div>

                {error && (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2"
                  >
                    {error}
                  </p>
                )}

                <SquarePaymentForm
                  amountInCents={service.depositInCents!}
                  onTokenise={handleDepositPayment}
                  submitting={submitting}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
