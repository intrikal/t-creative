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

import { useReducer, useEffect, useMemo, useRef, useCallback } from "react";
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
import {
  getActiveIntakeFormsForBooking,
  getLastSubmissionForCurrentUser,
  type IntakeFormDefinitionRow,
} from "@/app/dashboard/services/intake-form-actions";
import { getPublicPolicies } from "@/app/dashboard/settings/settings-actions";
import { Calendar } from "@/components/ui/calendar";
import type { IntakeFormField } from "@/db/schema";
import { enqueuePendingBooking } from "@/lib/booking-sync-db";
import { CADENCE_OPTIONS, rruleToCadenceLabel } from "@/lib/cadence";
import { useRecaptcha } from "@/lib/useRecaptcha";
import { cn } from "@/lib/utils";
import { SquarePaymentForm } from "./components/SquarePaymentForm";
import { formatPrice } from "./helpers";
import { IntakeFormStep } from "./IntakeFormStep";
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
/*  Reducer                                                             */
/* ------------------------------------------------------------------ */

type Step = "date" | "time" | "intake" | "confirm" | "pay";

type PhotoPreview = { file: File; preview: string };

interface BookingState {
  step: Step;
  // Async data loaded on open
  availability: StudioAvailability | null;
  isGuest: boolean | null;
  policyText: string;
  tosVersion: string;
  // Navigation
  selectedDate: Date | undefined;
  selectedTime: string;
  // User input
  notes: string;
  cadence: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  photos: PhotoPreview[];
  selectedAddOnIds: Set<number>;
  tosAccepted: boolean;
  // Intake forms
  intakeForms: IntakeFormDefinitionRow[];
  intakePrefill: Record<number, Record<string, unknown>>;
  intakeResponses: Array<{
    formDefinitionId: number;
    formVersion: number;
    responses: Record<string, unknown>;
  }>;
  intakeFormsLoaded: boolean;
  // Waiver
  pendingWaivers: PendingWaiver[];
  waiversChecked: boolean;
  // Submission
  submitting: boolean;
  submitted: boolean;
  savedOffline: boolean;
  depositPaid: boolean;
  error: string;
}

const INITIAL_STATE: BookingState = {
  step: "date",
  availability: null,
  isGuest: null,
  policyText: "",
  tosVersion: "",
  selectedDate: undefined,
  selectedTime: "",
  notes: "",
  cadence: "",
  guestName: "",
  guestEmail: "",
  guestPhone: "",
  photos: [],
  selectedAddOnIds: new Set(),
  tosAccepted: false,
  intakeForms: [],
  intakePrefill: {},
  intakeResponses: [],
  intakeFormsLoaded: false,
  pendingWaivers: [],
  waiversChecked: false,
  submitting: false,
  submitted: false,
  savedOffline: false,
  depositPaid: false,
  error: "",
};

type BookingAction =
  | {
      type: "LOADED";
      availability: StudioAvailability;
      isGuest: boolean;
      policyText: string;
      tosVersion: string;
    }
  | { type: "PREFILL"; date: Date; time: string }
  | { type: "SELECT_DATE"; date: Date }
  | { type: "SELECT_TIME"; time: string }
  | { type: "GO_BACK" }
  | { type: "SET_NOTES"; value: string }
  | { type: "SET_CADENCE"; value: string }
  | { type: "SET_GUEST_NAME"; value: string }
  | { type: "SET_GUEST_EMAIL"; value: string }
  | { type: "SET_GUEST_PHONE"; value: string }
  | { type: "TOGGLE_ADDON"; id: number }
  | { type: "ADD_PHOTOS"; photos: PhotoPreview[] }
  | { type: "REMOVE_PHOTO"; index: number; revokedUrl: string }
  | { type: "SET_TOS_ACCEPTED"; value: boolean }
  | {
      type: "SET_INTAKE_FORMS";
      forms: IntakeFormDefinitionRow[];
      prefill: Record<number, Record<string, unknown>>;
    }
  | {
      type: "SET_INTAKE_RESPONSES";
      responses: Array<{
        formDefinitionId: number;
        formVersion: number;
        responses: Record<string, unknown>;
      }>;
    }
  | { type: "SET_WAIVERS"; waivers: PendingWaiver[] }
  | { type: "SUBMITTING" }
  | { type: "SUBMITTED" }
  | { type: "SAVED_OFFLINE" }
  | { type: "DEPOSIT_PAID" }
  | { type: "GO_TO_PAY" }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET"; revokedUrls: string[] };

function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case "LOADED":
      return {
        ...state,
        availability: action.availability,
        isGuest: action.isGuest,
        policyText: action.policyText,
        tosVersion: action.tosVersion,
      };
    case "PREFILL":
      return {
        ...state,
        selectedDate: action.date,
        selectedTime: action.time,
        step: state.intakeFormsLoaded && state.intakeForms.length > 0 ? "intake" : "confirm",
      };
    case "SELECT_DATE":
      return { ...state, selectedDate: action.date, selectedTime: "", step: "time" };
    case "SELECT_TIME":
      return {
        ...state,
        selectedTime: action.time,
        // Route to intake step if forms are loaded and present
        step: state.intakeFormsLoaded && state.intakeForms.length > 0 ? "intake" : "confirm",
      };
    case "GO_BACK":
      if (state.step === "time") return { ...state, step: "date", selectedTime: "" };
      if (state.step === "intake") return { ...state, step: "time" };
      if (state.step === "confirm") {
        // Go back to intake if forms exist, otherwise time
        return {
          ...state,
          step: state.intakeForms.length > 0 ? "intake" : "time",
        };
      }
      if (state.step === "pay") return { ...state, step: "confirm" };
      return state;
    case "SET_NOTES":
      return { ...state, notes: action.value };
    case "SET_CADENCE":
      return { ...state, cadence: action.value };
    case "SET_GUEST_NAME":
      return { ...state, guestName: action.value };
    case "SET_GUEST_EMAIL":
      return { ...state, guestEmail: action.value };
    case "SET_GUEST_PHONE":
      return { ...state, guestPhone: action.value };
    case "TOGGLE_ADDON": {
      const next = new Set(state.selectedAddOnIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selectedAddOnIds: next };
    }
    case "ADD_PHOTOS":
      return { ...state, photos: [...state.photos, ...action.photos] };
    case "REMOVE_PHOTO":
      return { ...state, photos: state.photos.filter((_, i) => i !== action.index) };
    case "SET_TOS_ACCEPTED":
      return { ...state, tosAccepted: action.value };
    case "SET_INTAKE_FORMS":
      return {
        ...state,
        intakeForms: action.forms,
        intakePrefill: action.prefill,
        intakeFormsLoaded: true,
      };
    case "SET_INTAKE_RESPONSES":
      return { ...state, intakeResponses: action.responses, step: "confirm" };
    case "SET_WAIVERS":
      return { ...state, pendingWaivers: action.waivers, waiversChecked: true };
    case "SUBMITTING":
      return { ...state, submitting: true, error: "" };
    case "SUBMITTED":
      return { ...state, submitting: false, submitted: true };
    case "SAVED_OFFLINE":
      return { ...state, submitting: false, savedOffline: true };
    case "DEPOSIT_PAID":
      return { ...state, submitting: false, submitted: true, depositPaid: true };
    case "GO_TO_PAY":
      return { ...state, submitting: false, step: "pay" };
    case "SET_ERROR":
      return { ...state, submitting: false, error: action.error };
    case "RESET":
      return { ...INITIAL_STATE };
  }
}

export function BookingRequestDialog({
  service,
  addOns = [],
  open,
  onClose,
  prefillDate,
  prefillTime,
  prefillStaffId,
}: {
  service: Service;
  addOns?: ServiceAddOn[];
  open: boolean;
  onClose: () => void;
  /** Pre-select date from email link (YYYY-MM-DD). */
  prefillDate?: string | null;
  /** Pre-select time slot from email link (HH:MM 24h). */
  prefillTime?: string | null;
  /** Pre-select staff from email link (staff profile ID). */
  prefillStaffId?: string | null;
}) {
  const [state, dispatch] = useReducer(bookingReducer, INITIAL_STATE);
  const {
    step,
    availability,
    isGuest,
    policyText,
    tosVersion,
    selectedDate,
    selectedTime,
    notes,
    cadence,
    guestName,
    guestEmail,
    guestPhone,
    photos,
    selectedAddOnIds,
    intakeForms,
    intakePrefill,
    intakeResponses,
    tosAccepted,
    pendingWaivers,
    waiversChecked,
    submitting,
    submitted,
    savedOffline,
    depositPaid,
    error,
  } = state;

  const { executeRecaptcha } = useRecaptcha();

  // Listen for SW message when a queued offline booking is successfully retried
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    function onSwMessage(event: MessageEvent) {
      if ((event.data as { type?: string })?.type === "BOOKING_SYNC_SUCCESS") {
        dispatch({ type: "SUBMITTED" });
      }
    }
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Cached photo URLs — uploaded once on confirm, reused in pay step. */
  const uploadedPhotosRef = useRef<string[]>([]);

  const hasDeposit = !!service.depositInCents && service.depositInCents > 0;
  const hasIntakeForms = intakeForms.length > 0;
  const totalSteps = 2 + (hasIntakeForms ? 1 : 0) + 1 + (hasDeposit ? 1 : 0);

  const selectedAddOns = addOns.filter((a) => selectedAddOnIds.has(a.id));
  const addOnTotal = selectedAddOns.reduce((sum, a) => sum + a.priceInCents, 0);
  const addOnMinutes = selectedAddOns.reduce((sum, a) => sum + a.additionalMinutes, 0);
  const adjustedPrice = (service.priceInCents ?? 0) + addOnTotal;
  const adjustedDuration = (service.durationMinutes ?? 0) + addOnMinutes;

  // Fetch availability, auth status, policy, and intake forms on open
  useEffect(() => {
    if (!open) return;
    Promise.all([
      getStudioAvailability(),
      checkIsAuthenticated(),
      getPublicPolicies(),
      getActiveIntakeFormsForBooking(service.id),
    ]).then(async ([avail, authed, policies, intakeDefs]) => {
      dispatch({
        type: "LOADED",
        availability: avail,
        isGuest: !authed,
        policyText: policies.cancellationPolicy,
        tosVersion: policies.tosVersion,
      });

      // Load intake forms + pre-fill for authenticated returning clients
      if (intakeDefs.length > 0) {
        const prefill: Record<number, Record<string, unknown>> = {};
        if (authed) {
          const prefillResults = await Promise.all(
            intakeDefs.map(async (def) => {
              const last = await getLastSubmissionForCurrentUser(def.id);
              return { defId: def.id, data: last };
            }),
          );
          for (const { defId, data } of prefillResults) {
            if (data) prefill[defId] = data;
          }
        }
        dispatch({ type: "SET_INTAKE_FORMS", forms: intakeDefs, prefill });
      } else {
        dispatch({ type: "SET_INTAKE_FORMS", forms: [], prefill: {} });
      }
    });
  }, [open, service.id]);

  // Auto-apply prefill params (from email rebooking link) and skip to confirm step
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (!open || !availability || prefillApplied.current) return;
    if (!prefillDate || !prefillTime) return;

    const parsed = new Date(prefillDate + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) return;

    prefillApplied.current = true;
    dispatch({ type: "PREFILL", date: parsed, time: prefillTime });
  }, [open, availability, prefillDate, prefillTime]);

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

      dispatch({ type: "SUBMITTING" });

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
            ...(isGuest
              ? {
                  name: guestName.trim(),
                  email: guestEmail.trim(),
                  phone: guestPhone.trim(),
                  recaptchaToken: await executeRecaptcha("deposit"),
                }
              : {}),
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Payment failed. Please try again.");
        }

        dispatch({ type: "DEPOSIT_PAID" });
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : "Payment failed. Please try again.",
        });
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
      executeRecaptcha,
      selectedAddOns,
      tosVersion,
    ],
  );

  if (!open) return null;

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    dispatch({ type: "SELECT_DATE", date });
  }

  function handleTimeSelect(time: string) {
    dispatch({ type: "SELECT_TIME", time });

    // Check waivers for authenticated users when entering confirm step
    if (isGuest === false && !waiversChecked) {
      checkClientWaivers(service.category).then((waivers) => {
        dispatch({ type: "SET_WAIVERS", waivers });
      });
    }
  }

  function goBack() {
    dispatch({ type: "GO_BACK" });
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = 5 - photos.length;
    const toAdd = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    dispatch({ type: "ADD_PHOTOS", photos: toAdd });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    const revokedUrl = photos[index].preview;
    URL.revokeObjectURL(revokedUrl);
    dispatch({ type: "REMOVE_PHOTO", index, revokedUrl });
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
      dispatch({ type: "SET_ERROR", error: "Please enter your name and email." });
      return;
    }

    if (!tosAccepted) {
      dispatch({ type: "SET_ERROR", error: "Please accept the cancellation policy to continue." });
      return;
    }

    const addOnPayload = getAddOnPayload();

    if (hasDeposit) {
      dispatch({ type: "SUBMITTING" });
      try {
        uploadedPhotosRef.current = await uploadPhotos();
      } catch {
        dispatch({ type: "SET_ERROR", error: "Photo upload failed. Please try again." });
        return;
      }
      dispatch({ type: "GO_TO_PAY" });
      return;
    }

    dispatch({ type: "SUBMITTING" });

    const preferredDates = `${fmtDateLabel(selectedDate)} at ${fmt12(selectedTime)}`;

    try {
      const referencePhotoUrls = await uploadPhotos();

      if (isGuest) {
        const guestPayload: Record<string, unknown> = {
          name: guestName.trim(),
          email: guestEmail.trim(),
          phone: guestPhone.trim(),
          serviceId: service.id,
          preferredDate: preferredDates,
          notes: notes.trim(),
          referencePhotoUrls,
          preferredCadence: cadence ? rruleToCadenceLabel(cadence) : undefined,
          recaptchaToken: await executeRecaptcha("booking"),
          selectedAddOns: addOnPayload,
          tosAccepted: true,
          tosVersion,
        };

        let fetchFailed = false;
        try {
          const res = await fetch("/api/book/guest-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(guestPayload),
          });
          if (!res.ok) throw new Error("Failed to send request");
        } catch (fetchErr) {
          // Distinguish network failure (TypeError) from server errors
          if (fetchErr instanceof TypeError && !navigator.onLine) {
            await enqueuePendingBooking(guestPayload);
            if ("serviceWorker" in navigator && "SyncManager" in window) {
              const reg = await navigator.serviceWorker.ready;
              await (
                reg as ServiceWorkerRegistration & {
                  sync: { register(tag: string): Promise<void> };
                }
              ).sync.register("guest-booking-sync");
            }
            dispatch({ type: "SAVED_OFFLINE" });
            return;
          }
          fetchFailed = true;
        }
        if (fetchFailed) throw new Error("Failed to send request");
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
      dispatch({ type: "SUBMITTED" });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  function handleClose() {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    prefillApplied.current = false;
    uploadedPhotosRef.current = [];
    dispatch({ type: "RESET", revokedUrls: photos.map((p) => p.preview) });
    onClose();
  }

  const stepNum =
    step === "date"
      ? 1
      : step === "time"
        ? 2
        : step === "intake"
          ? 3
          : step === "confirm"
            ? hasIntakeForms
              ? 4
              : 3
            : hasIntakeForms
              ? 5
              : 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-2 sm:mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
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
              className="p-2.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          {!submitted && !savedOffline && (
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

        {savedOffline ? (
          /* ── Offline queued state ── */
          <div className="px-6 py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 mb-1">Booking saved</h3>
            <p className="text-sm text-stone-500 max-w-xs mx-auto leading-relaxed">
              Looks like you&apos;re offline. Your booking request has been saved and will be sent
              automatically once you&apos;re back online.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 px-5 py-2.5 rounded-xl bg-stone-100 text-sm font-medium text-stone-700 hover:bg-stone-200 transition-colors"
            >
              Close
            </button>
          </div>
        ) : submitted ? (
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
                    className="p-2.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <p className="text-sm font-medium text-stone-700">Pick a time</p>
                    <p className="text-xs text-stone-400">{fmtDateLabel(selectedDate)}</p>
                  </div>
                </div>

                {timeSlots.length > 0 ? (
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                    role="group"
                    aria-label="Available time slots"
                    aria-live="polite"
                  >
                    {timeSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => handleTimeSelect(slot)}
                        className={cn(
                          "py-3 rounded-xl border text-sm font-medium transition-colors",
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

            {/* ── Intake form step (between time and confirm) ── */}
            {availability && step === "intake" && selectedDate && hasIntakeForms && (
              <IntakeFormStep
                definitions={intakeForms.map((def) => ({
                  id: def.id,
                  name: def.name,
                  description: def.description,
                  fields: (def.fields ?? []) as IntakeFormField[],
                  version: def.version,
                }))}
                prefill={intakePrefill}
                onSubmit={(responses) => dispatch({ type: "SET_INTAKE_RESPONSES", responses })}
                onBack={goBack}
              />
            )}

            {/* ── Confirm & send ── */}
            {availability && step === "confirm" && selectedDate && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    aria-label="Go back"
                    className="p-2.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
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
                            onClick={() => dispatch({ type: "TOGGLE_ADDON", id: addon.id })}
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
                    <div className="space-y-1">
                      <label htmlFor="guest-name" className="text-xs font-medium text-stone-600">
                        Full name{" "}
                        <span className="text-red-400" aria-hidden="true">
                          *
                        </span>
                        <span className="sr-only">(required)</span>
                      </label>
                      <input
                        id="guest-name"
                        type="text"
                        placeholder="Your full name"
                        value={guestName}
                        onChange={(e) =>
                          dispatch({ type: "SET_GUEST_NAME", value: e.target.value })
                        }
                        required
                        aria-required="true"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="guest-email" className="text-xs font-medium text-stone-600">
                        Email address{" "}
                        <span className="text-red-400" aria-hidden="true">
                          *
                        </span>
                        <span className="sr-only">(required)</span>
                      </label>
                      <input
                        id="guest-email"
                        type="email"
                        placeholder="you@example.com"
                        value={guestEmail}
                        onChange={(e) =>
                          dispatch({ type: "SET_GUEST_EMAIL", value: e.target.value })
                        }
                        required
                        aria-required="true"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="guest-phone" className="text-xs font-medium text-stone-600">
                        Phone <span className="text-stone-400">(optional)</span>
                      </label>
                      <input
                        id="guest-phone"
                        type="tel"
                        placeholder="(555) 555-0000"
                        value={guestPhone}
                        onChange={(e) =>
                          dispatch({ type: "SET_GUEST_PHONE", value: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition"
                      />
                    </div>
                  </div>
                )}

                {/* Cadence */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">
                    Repeat <span className="text-stone-400">(optional)</span>
                  </label>
                  <select
                    value={cadence}
                    onChange={(e) => dispatch({ type: "SET_CADENCE", value: e.target.value })}
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
                    onChange={(e) => dispatch({ type: "SET_NOTES", value: e.target.value })}
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
                      onChange={(e) =>
                        dispatch({ type: "SET_TOS_ACCEPTED", value: e.target.checked })
                      }
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
                  disabled={submitting || !tosAccepted}
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
                    className="p-2.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
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
