/**
 * @file types.ts
 * @description Shared type and interface definitions for the Calendar feature.
 */

import type { BookingRow } from "../../bookings/actions";
import type { EventRow } from "../../events/actions";
import type { BusinessHourRow, LunchBreak, TimeOffRow } from "../../settings/hours-actions";

/* ------------------------------------------------------------------ */
/*  Core calendar types                                                */
/* ------------------------------------------------------------------ */

export type EventType = "lash" | "jewelry" | "crochet" | "training" | "event" | "blocked";
export type View = "month" | "week" | "day" | "staff" | "agenda";

export interface CalEvent {
  id: number;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (24-hour)
  durationMin: number;
  staff?: string;
  client?: string;
  location?: string;
  notes?: string;
  // DB tracking — present for events loaded from bookings table
  bookingId?: number;
  clientId?: string;
  serviceId?: number;
  staffId?: string | null;
  status?: string;
}

/** Resolved availability for a single calendar day. */
export interface DayAvailability {
  isOpen: boolean;
  opensAt: string | null; // "HH:MM"
  closesAt: string | null; // "HH:MM"
  isBlocked: boolean;
  blockLabel?: string;
  lunchStart: string | null;
  lunchEnd: string | null;
}

/** CalEvent with layout positioning for overlap columns. */
export interface Placed extends CalEvent {
  colIndex: number;
  totalCols: number;
}

/** Form state for creating/editing a booking. */
export interface FormState {
  title: string;
  type: EventType;
  date: string;
  startTime: string;
  durationMin: number;
  staff: string;
  client: string;
  location: string;
  notes: string;
  // DB IDs for server actions
  serviceId: number | "";
  clientId: string;
  staffId: string;
}

/* ------------------------------------------------------------------ */
/*  Re-exports for convenience                                         */
/* ------------------------------------------------------------------ */

export type { BookingRow, EventRow, BusinessHourRow, LunchBreak, TimeOffRow };
