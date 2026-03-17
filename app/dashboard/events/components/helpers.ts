/**
 * @file helpers.ts
 * @description Pure helper functions, config maps, and form converters for the events dashboard.
 */

import type {
  EventRow,
  EventType,
  EventStatus,
  EventInput,
  VenueRow,
  VenueType,
  VenueInput,
} from "../actions";
import type { EventForm, VenueForm } from "./types";

/* ------------------------------------------------------------------ */
/*  Config maps                                                        */
/* ------------------------------------------------------------------ */

export const TYPE_CONFIG: Record<
  EventType,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  bridal: {
    label: "Bridal Party",
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-100",
    dot: "bg-pink-400",
  },
  pop_up: {
    label: "Pop-Up",
    bg: "bg-[#d4a574]/10",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/25",
    dot: "bg-[#d4a574]",
  },
  travel: {
    label: "Travel",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-100",
    dot: "bg-blue-400",
  },
  private_party: {
    label: "Private Party",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-100",
    dot: "bg-purple-400",
  },
  workshop: {
    label: "Workshop",
    bg: "bg-[#4e6b51]/10",
    text: "text-[#4e6b51]",
    border: "border-[#4e6b51]/20",
    dot: "bg-[#4e6b51]",
  },
  birthday: {
    label: "Birthday",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-100",
    dot: "bg-orange-400",
  },
  corporate: {
    label: "Corporate",
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  studio: "Studio",
  client_home: "Client's Home",
  external_venue: "External Venue",
  pop_up_venue: "Pop-Up Venue",
  corporate_venue: "Corporate Venue",
};

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

export function statusConfig(status: EventStatus) {
  switch (status) {
    case "upcoming":
      return { label: "Upcoming", className: "bg-foreground/8 text-muted border-foreground/12" };
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
    case "completed":
      return { label: "Completed", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    case "draft":
      return { label: "Draft", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
  }
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateRange(startsAt: string, endsAt: string | null) {
  const date = formatDate(startsAt);
  const startTime = formatTime(startsAt);
  if (!endsAt) return `${date} · ${startTime}`;
  const endTime = formatTime(endsAt);
  return `${date} · ${startTime} – ${endTime}`;
}

export function centsToDisplay(cents: number | null): string {
  if (cents == null || cents === 0) return "";
  return `$${(cents / 100).toLocaleString()}`;
}

export function dollarsToCents(dollars: string): number | null {
  const n = Number(dollars);
  return isNaN(n) || n === 0 ? null : Math.round(n * 100);
}

/* ------------------------------------------------------------------ */
/*  Form converters                                                    */
/* ------------------------------------------------------------------ */

export function emptyEventForm(): EventForm {
  return {
    title: "",
    type: "bridal",
    status: "upcoming",
    date: "",
    time: "",
    endTime: "",
    venueId: "",
    location: "",
    capacity: "",
    revenue: "0",
    deposit: "",
    travelFee: "",
    notes: "",
    equipmentNotes: "",
    isCorporate: false,
    companyName: "",
    billingEmail: "",
    poNumber: "",
  };
}

export function eventToForm(e: EventRow): EventForm {
  const start = new Date(e.startsAt);
  const dateStr = start.toISOString().slice(0, 10);
  const timeStr = start.toTimeString().slice(0, 5);
  const endTimeStr = e.endsAt ? new Date(e.endsAt).toTimeString().slice(0, 5) : "";

  return {
    title: e.title,
    type: e.eventType,
    status: e.status,
    date: dateStr,
    time: timeStr,
    endTime: endTimeStr,
    venueId: e.venueId != null ? String(e.venueId) : "",
    location: e.location ?? "",
    capacity: e.maxAttendees != null ? String(e.maxAttendees) : "",
    revenue: e.expectedRevenueInCents != null ? String(e.expectedRevenueInCents / 100) : "0",
    deposit: e.depositInCents != null ? String(e.depositInCents / 100) : "",
    travelFee: e.travelFeeInCents != null ? String(e.travelFeeInCents / 100) : "",
    notes: e.internalNotes ?? "",
    equipmentNotes: e.equipmentNotes ?? "",
    isCorporate: e.companyName != null || e.eventType === "corporate",
    companyName: e.companyName ?? "",
    billingEmail: e.billingEmail ?? "",
    poNumber: e.poNumber ?? "",
  };
}

export function formToInput(form: EventForm): EventInput {
  const startsAt =
    form.date && form.time
      ? new Date(`${form.date}T${form.time}`).toISOString()
      : new Date(form.date).toISOString();

  const endsAt =
    form.date && form.endTime ? new Date(`${form.date}T${form.endTime}`).toISOString() : null;

  const venueId = form.venueId ? Number(form.venueId) : null;

  return {
    title: form.title,
    eventType: form.type,
    status: form.status,
    startsAt,
    endsAt,
    venueId,
    // When a saved venue is selected, location/address are resolved server-side from the venue.
    // For custom locations, pass the free-text value.
    location: venueId ? null : form.location || null,
    maxAttendees: form.capacity ? Number(form.capacity) : null,
    expectedRevenueInCents: dollarsToCents(form.revenue),
    depositInCents: dollarsToCents(form.deposit),
    travelFeeInCents: dollarsToCents(form.travelFee),
    internalNotes: form.notes || null,
    equipmentNotes: form.equipmentNotes || null,
    companyName: form.type === "corporate" || form.isCorporate ? form.companyName || null : null,
    billingEmail: form.type === "corporate" || form.isCorporate ? form.billingEmail || null : null,
    poNumber: form.type === "corporate" || form.isCorporate ? form.poNumber || null : null,
  };
}

export function emptyVenueForm(): VenueForm {
  return {
    name: "",
    venueType: "external_venue",
    address: "",
    parkingInfo: "",
    setupNotes: "",
    travelFee: "",
  };
}

export function venueToForm(v: VenueRow): VenueForm {
  return {
    name: v.name,
    venueType: v.venueType,
    address: v.address ?? "",
    parkingInfo: v.parkingInfo ?? "",
    setupNotes: v.setupNotes ?? "",
    travelFee: v.defaultTravelFeeInCents != null ? String(v.defaultTravelFeeInCents / 100) : "",
  };
}

export function venueFormToInput(form: VenueForm): VenueInput {
  return {
    name: form.name,
    venueType: form.venueType,
    address: form.address || null,
    parkingInfo: form.parkingInfo || null,
    setupNotes: form.setupNotes || null,
    defaultTravelFeeInCents: dollarsToCents(form.travelFee),
  };
}
