import type { AppointmentRow, BookingStatus, ServiceCategory } from "../actions";

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
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

export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDate(s: string): Date {
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(y, mo - 1, d);
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

export function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
}

export function hourLabel(h: number): string {
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/* ------------------------------------------------------------------ */
/*  Week grid constants                                                */
/* ------------------------------------------------------------------ */

export const DAY_START = 8;
export const DAY_END = 20;
export const TOTAL_HOURS = DAY_END - DAY_START;
export const HOUR_H = 60;
export const GRID_H = TOTAL_HOURS * HOUR_H + 12;
export const GRID_TOP_PAD = 12;
export const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START + i);

/* ------------------------------------------------------------------ */
/*  Style helpers                                                      */
/* ------------------------------------------------------------------ */

export type ApptStyle = { bg: string; border: string; text: string; dot: string };

export const CATEGORY_COLORS: Record<ServiceCategory, ApptStyle> = {
  lash: { bg: "#c4907a1a", border: "#c4907a", text: "#96604a", dot: "#c4907a" },
  jewelry: { bg: "#d4a5741a", border: "#d4a574", text: "#a07040", dot: "#d4a574" },
  crochet: { bg: "#7ba3a31a", border: "#7ba3a3", text: "#4a7a7a", dot: "#7ba3a3" },
  consulting: { bg: "#5b8a8a1a", border: "#5b8a8a", text: "#3a6a6a", dot: "#5b8a8a" },
};

export function statusConfig(status: BookingStatus) {
  switch (status) {
    case "completed":
      return { label: "Done", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
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

export function categoryDot(cat: ServiceCategory) {
  return {
    lash: "bg-[#c4907a]",
    jewelry: "bg-[#d4a574]",
    crochet: "bg-[#7ba3a3]",
    consulting: "bg-[#5b8a8a]",
  }[cat];
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */

export type View = "list" | "month" | "week" | "agenda";

export function navigate(view: View, cursor: Date, dir: 1 | -1): Date {
  const d = new Date(cursor);
  if (view === "week") {
    d.setDate(d.getDate() + dir * 7);
  } else {
    d.setMonth(d.getMonth() + dir);
  }
  return d;
}

export function periodLabel(view: View, cursor: Date): string {
  if (view === "month" || view === "agenda")
    return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  if (view === "week") {
    const days = getWeekDays(cursor);
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth())
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  return "";
}
