/**
 * Date helpers and status/category configuration for the client bookings page.
 *
 * Used by:
 * - ClientBookingsPage (app/dashboard/bookings/ClientBookingsPage.tsx)
 * - BookingsMiniCal (./BookingsMiniCal.tsx)
 * - BookingCard (./BookingCard.tsx)
 */

import type { ClientBookingRow } from "../client-actions";

/* ------------------------------------------------------------------ */
/*  Date helpers                                                        */
/* ------------------------------------------------------------------ */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_NAMES_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO(): string {
  return fmtISO(new Date());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
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

export function fmtDateLabel(ds: string): string {
  const [y, m, d] = ds.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES_FULL[date.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}`;
}

/* ------------------------------------------------------------------ */
/*  Status / category helpers                                           */
/* ------------------------------------------------------------------ */

export type BookingStatus = ClientBookingRow["status"];
export type BookingCategory = ClientBookingRow["category"];

export function statusConfig(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "completed":
      return { label: "Completed", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
  }
}

export const CAT_DOT: Record<BookingCategory, string> = {
  lash: "bg-[#c4907a]",
  jewelry: "bg-[#d4a574]",
  crochet: "bg-[#7ba3a3]",
  consulting: "bg-[#8b7bb5]",
};

export const CAT_COLOR: Record<BookingCategory, string> = {
  lash: "#c4907a",
  jewelry: "#d4a574",
  crochet: "#7ba3a3",
  consulting: "#8b7bb5",
};
