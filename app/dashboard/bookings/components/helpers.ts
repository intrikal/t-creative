/**
 * Shared types, status/category config, date formatters, and data mappers
 * for the admin Bookings page and its child components.
 *
 * Used by: BookingsPage, BookingRow, BookingDialog, CancelDialog, DeleteDialog,
 *          WaitlistTab, WaiverGateDialog, ServiceRecordDialog
 *
 * Key exports:
 *   Booking          — UI-facing booking shape (dollars, formatted dates)
 *   BookingStatus    — union of all booking statuses
 *   ServiceCategory  — union of service category slugs
 *   statusConfig()   — returns { label, className } badge styling per status
 *   categoryDot()    — returns a Tailwind bg-color class per category
 *   formatBookingDate() — "Today" / "Tomorrow" / "Mon, Jan 1" + time string
 *   mapBookingRow()  — transforms a raw BookingRow (DB shape, cents) into the
 *                       UI-facing Booking (dollars, initials, formatted dates).
 *                       Joins first+last name via filter(Boolean).join(" "),
 *                       computes initials from first chars, converts cents to
 *                       dollars with totalInCents / 100.
 *   STATUS_FILTERS   — chip labels for the status filter bar
 *   PAGE_TABS        — tab labels for Bookings / Waitlist / Memberships
 */
import type { BookingRow } from "@/lib/types/booking.types";

/* ------------------------------------------------------------------ */
/*  Exported types & helpers (used by child components)                */
/* ------------------------------------------------------------------ */

export type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";
export type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | "training";

export interface Booking {
  id: number;
  date: string;
  time: string;
  startsAtIso: string;
  service: string;
  category: ServiceCategory;
  client: string;
  clientInitials: string;
  clientPhone: string;
  staff: string;
  status: BookingStatus;
  durationMin: number;
  price: number;
  location?: string;
  notes?: string;
  clientId: string;
  serviceId: number;
  staffId: string | null;
  recurrenceRule?: string;
  /** Groups all bookings in a recurring series. */
  recurrenceGroupId?: string | null;
  tosAcceptedAt?: Date | null;
  tosVersion?: string | null;
  /** All service IDs in a multi-service booking (ordered). */
  serviceIds?: number[];
}

export function statusConfig(status: BookingStatus) {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
    case "in_progress":
      return { label: "In Progress", className: "bg-blush/12 text-[#96604a] border-blush/20" };
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-foreground/8 text-foreground border-foreground/15",
      };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    case "no_show":
      return {
        label: "No Show",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
  }
}

export function categoryDot(category: ServiceCategory) {
  switch (category) {
    case "lash":
      return "bg-[#c4907a]";
    case "jewelry":
      return "bg-[#d4a574]";
    case "crochet":
      return "bg-[#7ba3a3]";
    case "consulting":
      return "bg-[#5b8a8a]";
    case "training":
      return "bg-[#9b7ec8]";
  }
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

export function formatBookingDate(startsAt: Date): { date: string; time: string } {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowMidnight = new Date(todayMidnight.getTime() + 86_400_000);
  const bookingMidnight = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());

  let date: string;
  if (bookingMidnight.getTime() === todayMidnight.getTime()) {
    date = "Today";
  } else if (bookingMidnight.getTime() === tomorrowMidnight.getTime()) {
    date = "Tomorrow";
  } else {
    date = startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const time = startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { date, time };
}

export function mapBookingRow(row: BookingRow): Booking {
  const startsAt = new Date(row.startsAt);
  const { date, time } = formatBookingDate(startsAt);
  const clientName = [row.clientFirstName, row.clientLastName].filter(Boolean).join(" ");
  const initials = ((row.clientFirstName[0] ?? "") + (row.clientLastName?.[0] ?? "")).toUpperCase();

  return {
    id: row.id,
    date,
    time,
    startsAtIso: startsAt.toISOString(),
    service: row.serviceName,
    category: row.serviceCategory as ServiceCategory,
    client: clientName,
    clientInitials: initials || "?",
    clientPhone: row.clientPhone ?? "",
    staff: row.staffFirstName ?? "",
    status: row.status as BookingStatus,
    durationMin: row.durationMinutes,
    price: row.totalInCents / 100,
    location: row.location ?? undefined,
    notes: row.clientNotes ?? undefined,
    clientId: row.clientId,
    serviceId: row.serviceId,
    staffId: row.staffId,
    recurrenceRule: row.recurrenceRule ?? undefined,
    recurrenceGroupId: row.recurrenceGroupId ?? null,
    tosAcceptedAt: row.tosAcceptedAt ?? null,
    tosVersion: row.tosVersion ?? null,
    serviceIds:
      row.services && row.services.length > 0
        ? row.services.map((s) => s.serviceId)
        : [row.serviceId],
  };
}

export const STATUS_FILTERS = [
  "All",
  "Confirmed",
  "Completed",
  "Pending",
  "Cancelled",
  "No Show",
] as const;

export const PAGE_TABS = ["Bookings", "Waitlist", "Memberships"] as const;
export type PageTab = (typeof PAGE_TABS)[number];
