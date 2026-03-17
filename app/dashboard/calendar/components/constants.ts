/**
 * @file constants.ts
 * @description Shared constants for the Calendar feature — grid dimensions,
 *              color palettes, labels, and configuration arrays.
 */

import type { EventType, View } from "./types";

/* ------------------------------------------------------------------ */
/*  Time-grid dimensions                                               */
/* ------------------------------------------------------------------ */

export const HOUR_H = 64; // px per hour in the time grid
export const DAY_START = 8; // 8 am
export const DAY_END = 20; // 8 pm
export const TOTAL_HOURS = DAY_END - DAY_START; // 12
export const GRID_H = TOTAL_HOURS * HOUR_H + 12; // +12px top padding so first label isn't clipped
export const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START + i);
export const GRID_TOP_PAD = 12; // px — matches the +12 above

/* ------------------------------------------------------------------ */
/*  Day / month name arrays                                            */
/* ------------------------------------------------------------------ */

export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

/* ------------------------------------------------------------------ */
/*  Event type colors & labels                                         */
/* ------------------------------------------------------------------ */

export const TYPE_C: Record<EventType, { bg: string; border: string; text: string; dot: string }> =
  {
    lash: { bg: "#c4907a1a", border: "#c4907a", text: "#96604a", dot: "#c4907a" },
    jewelry: { bg: "#d4a5741a", border: "#d4a574", text: "#a07040", dot: "#d4a574" },
    crochet: { bg: "#7ba3a31a", border: "#7ba3a3", text: "#3a6a6a", dot: "#7ba3a3" },
    training: { bg: "#22c55e1a", border: "#22c55e", text: "#15803d", dot: "#22c55e" },
    event: { bg: "#8b5cf61a", border: "#8b5cf6", text: "#6d28d9", dot: "#8b5cf6" },
    blocked: { bg: "#e5e7eb", border: "#d1d5db", text: "#6b7280", dot: "#9ca3af" },
  };

export const TYPE_LABELS: Record<EventType, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  training: "Training",
  event: "Event",
  blocked: "Blocked",
};

/* ------------------------------------------------------------------ */
/*  View selector config                                               */
/* ------------------------------------------------------------------ */

export const VIEWS: { key: View; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
  { key: "staff", label: "Staff" },
  { key: "agenda", label: "Agenda" },
];

/* ------------------------------------------------------------------ */
/*  Page-level tabs                                                    */
/* ------------------------------------------------------------------ */

export const CAL_PAGE_TABS = [
  { id: "calendar", label: "Calendar" },
  { id: "availability", label: "Availability" },
  { id: "events", label: "Events" },
] as const;
export type CalPageTab = (typeof CAL_PAGE_TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  Availability editor constants                                      */
/* ------------------------------------------------------------------ */

export const AVAIL_DAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Time options in 15-min increments from 06:00 to 22:00. */
export const TIME_OPTIONS = (() => {
  const opts: { value: string; label: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 22 && m > 0) break;
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
      opts.push({ value: val, label });
    }
  }
  return opts;
})();

/* ------------------------------------------------------------------ */
/*  Events-tab type/status config                                      */
/* ------------------------------------------------------------------ */

export const EVENT_TYPE_CFG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  bridal: {
    label: "Bridal Party",
    color: "text-pink-700",
    bg: "bg-pink-50",
    border: "border-pink-100",
  },
  pop_up: {
    label: "Pop-Up",
    color: "text-[#a07040]",
    bg: "bg-[#d4a574]/10",
    border: "border-[#d4a574]/25",
  },
  travel: {
    label: "Travel",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  private_party: {
    label: "Private Party",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-100",
  },
  workshop: {
    label: "Workshop",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
  },
  birthday: {
    label: "Birthday",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-100",
  },
  corporate: {
    label: "Corporate",
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
};

export const EVENT_STATUS_CFG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  upcoming: {
    label: "Upcoming",
    color: "text-[#5b8a8a]",
    bg: "bg-[#5b8a8a]/10",
    border: "border-[#5b8a8a]/20",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
  },
  completed: {
    label: "Completed",
    color: "text-muted",
    bg: "bg-foreground/8",
    border: "border-foreground/15",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  },
  draft: {
    label: "Draft",
    color: "text-muted",
    bg: "bg-foreground/5",
    border: "border-foreground/10",
  },
};

/* ------------------------------------------------------------------ */
/*  Blank form default                                                 */
/* ------------------------------------------------------------------ */

export const BLANK_FORM = {
  title: "",
  type: "lash" as const,
  date: "",
  startTime: "09:00",
  durationMin: 60,
  staff: "",
  client: "",
  location: "",
  notes: "",
  serviceId: "" as number | "",
  clientId: "",
  staffId: "",
};
