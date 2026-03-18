/**
 * helpers.ts
 *
 * Shared constants, types, and utility functions for assistant settings sections.
 */

/** Active settings tab identifier. */
export type Section = "profile" | "availability" | "notifications" | "timeoff";

/** ISO dayOfWeek to label mapping (1=Mon, 7=Sun). */
export const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

/** Display order: Sun-Sat. */
export const DAY_ORDER = [7, 1, 2, 3, 4, 5, 6];

export type RequestStatus = "pending" | "approved" | "denied";

export const STATUS_CFG: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" },
  approved: {
    label: "Approved",
    className: "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20",
  },
  denied: {
    label: "Denied",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

/** Format an ISO date string (YYYY-MM-DD) as "Mon D, YYYY". */
export function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parseInt(m) - 1]} ${parseInt(day)}, ${y}`;
}
