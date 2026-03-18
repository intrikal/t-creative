/**
 * helpers.ts
 * Shared utility functions and configuration constants for the Messages feature.
 */

/** Returns uppercase initials from first/last name, defaulting to "G" for missing first name. */
export function initials(first: string | null, last: string | null) {
  return `${(first ?? "G").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase();
}

/** Returns a human-readable relative time string (e.g. "5m ago", "Yesterday"). */
export function timeAgo(date: Date) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Formats a Date as a short time string (e.g. "2:30 PM"). */
export function fmtTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Status configuration: label and dot color class. */
export const STATUS_CFG: Record<string, { label: string; dot: string }> = {
  new: { label: "New", dot: "bg-blush" },
  pending: { label: "Pending", dot: "bg-amber-500" },
  contacted: { label: "Contacted", dot: "bg-foreground/20" },
  approved: { label: "Approved", dot: "bg-[#4e6b51]" },
  rejected: { label: "Rejected", dot: "bg-destructive" },
  resolved: { label: "Resolved", dot: "bg-foreground/20" },
};

/** Thread type badge configuration: label and Tailwind classes. */
export const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  request: { label: "Request", className: "bg-blush/12 text-[#96604a] border-blush/20" },
  inquiry: { label: "Inquiry", className: "bg-amber-50 text-amber-700 border-amber-100" },
  booking: { label: "Booking", className: "bg-blue-50 text-blue-700 border-blue-100" },
  confirmation: {
    label: "Confirmed",
    className: "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20",
  },
  reminder: { label: "Reminder", className: "bg-purple-50 text-purple-700 border-purple-100" },
  general: { label: "General", className: "bg-foreground/8 text-muted border-foreground/12" },
};
