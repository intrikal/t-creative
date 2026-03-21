/**
 * @file helpers.ts
 * @description Pure utility functions for date formatting, grid layout,
 *              navigation, and booking-to-event mapping.
 */

import { DAY_NAMES_SHORT, DAY_START, MONTH_NAMES } from "./constants";
import type {
  BookingRow,
  BusinessHourRow,
  CalEvent,
  DayAvailability,
  EventType,
  LunchBreak,
  Placed,
  TimeOffRow,
  View,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Time / date helpers                                                */
/* ------------------------------------------------------------------ */

export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
}

export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDate(s: string): Date {
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

/** Format a Date as "YYYY-MM-DD" for DB storage. */
export function fmtDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

export function getWeekDays(anchor: Date): Date[] {
  const s = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = addDays(first, -first.getDay());
  const end = addDays(last, 6 - last.getDay());
  const days: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

const TODAY = fmtDate(new Date());

export function isToday(dateStr: string): boolean {
  return dateStr === TODAY;
}

export function hourLabel(h: number): string {
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/* ------------------------------------------------------------------ */
/*  Availability                                                       */
/* ------------------------------------------------------------------ */

/**
 * Given a JS Date, business hours (ISO weekday 1-7), time-off rows, and lunch
 * config, return the resolved availability for that day.
 */
export function getDayAvailability(
  day: Date,
  businessHours: BusinessHourRow[],
  timeOffRows: TimeOffRow[],
  lunchBreak: LunchBreak | null,
): DayAvailability {
  const ds = fmtDate(day);
  // JS getDay() returns 0=Sun…6=Sat → convert to ISO 1=Mon…7=Sun
  const jsDay = day.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  const bh = businessHours.find((h) => h.dayOfWeek === isoDay);
  const isOpen = bh?.isOpen ?? false;

  // Check if date falls within any time-off range
  const blocked = timeOffRows.find((t) => ds >= t.startDate && ds <= t.endDate);

  return {
    isOpen: blocked ? false : isOpen,
    opensAt: isOpen ? (bh?.opensAt ?? null) : null,
    closesAt: isOpen ? (bh?.closesAt ?? null) : null,
    isBlocked: !!blocked,
    blockLabel:
      blocked?.label ??
      (blocked ? (blocked.type === "vacation" ? "Vacation" : "Day Off") : undefined),
    lunchStart: lunchBreak?.enabled ? lunchBreak.start : null,
    lunchEnd: lunchBreak?.enabled ? lunchBreak.end : null,
  };
}

/* ------------------------------------------------------------------ */
/*  Overlap layout for time-grid views                                 */
/* ------------------------------------------------------------------ */

/**
 * layoutDay — computes overlap columns for same-day events in a time grid.
 *
 * Uses a greedy column-packing algorithm:
 * 1. Sort events by start time.
 * 2. For each event, find the first column whose last event has ended.
 * 3. If no column fits, allocate a new one.
 * 4. After packing, stamp every event with totalCols so each knows its width fraction.
 *
 * This produces Google Calendar-style side-by-side overlapping blocks.
 */
export function layoutDay(events: CalEvent[]): Placed[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
  // Track the end-minute of the last event in each column
  const colEnds: number[] = [];
  const placed: (CalEvent & { colIndex: number })[] = [];
  for (const ev of sorted) {
    const start = timeToMin(ev.startTime);
    const end = start + ev.durationMin;
    // Find first column where the previous event has ended before this one starts
    let col = colEnds.findIndex((e) => e <= start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(end);
    } else colEnds[col] = end;
    placed.push({ ...ev, colIndex: col });
  }
  const totalCols = Math.max(colEnds.length, 1);
  return placed.map((p) => ({ ...p, totalCols }));
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */

export function periodLabel(view: View, cursor: Date): string {
  if (view === "month") {
    return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }
  if (view === "week") {
    const days = getWeekDays(cursor);
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth()) {
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${DAY_NAMES_SHORT[cursor.getDay()]}, ${MONTH_NAMES[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
}

export function navigate(view: View, cursor: Date, dir: 1 | -1): Date {
  const d = new Date(cursor);
  if (view === "month") {
    d.setMonth(d.getMonth() + dir);
    return d;
  }
  if (view === "week") {
    d.setDate(d.getDate() + dir * 7);
    return d;
  }
  d.setDate(d.getDate() + dir);
  return d;
}

/* ------------------------------------------------------------------ */
/*  ID generation                                                      */
/* ------------------------------------------------------------------ */

let _nextId = 100;
export function nextId() {
  return ++_nextId;
}

/* ------------------------------------------------------------------ */
/*  Booking → CalEvent mapping                                         */
/* ------------------------------------------------------------------ */

export function categoryToEventType(category: string): EventType {
  if (category === "lash" || category === "jewelry" || category === "crochet") return category;
  if (category === "training") return "training";
  return "event";
}

export function mapBookingToCalEvent(row: BookingRow): CalEvent {
  const d = new Date(row.startsAt);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const startTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const clientName = [row.clientFirstName, row.clientLastName].filter(Boolean).join(" ");

  return {
    id: row.id,
    title: row.serviceName,
    type: categoryToEventType(row.serviceCategory),
    date,
    startTime,
    durationMin: row.durationMinutes,
    staff: row.staffFirstName ?? undefined,
    client: clientName || undefined,
    location: row.location ?? undefined,
    notes: row.clientNotes ?? undefined,
    bookingId: row.id,
    clientId: row.clientId,
    serviceId: row.serviceId,
    staffId: row.staffId,
    status: row.status,
  };
}

/* ------------------------------------------------------------------ */
/*  Events-tab date formatters                                         */
/* ------------------------------------------------------------------ */

export function fmtEventDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function fmtEventRange(startsAt: string, endsAt: string | null) {
  const date = fmtEventDate(startsAt);
  const start = fmtEventTime(startsAt);
  if (!endsAt) return `${date} · ${start}`;
  return `${date} · ${start} – ${fmtEventTime(endsAt)}`;
}
