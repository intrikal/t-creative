/**
 * @module helpers
 * Shared helper functions and constants for the client detail page.
 */

export const AVATAR_COLORS = [
  "bg-[#c4907a]/20 text-[#96604a]",
  "bg-[#d4a574]/20 text-[#a07040]",
  "bg-[#7ba3a3]/20 text-[#3a6a6a]",
  "bg-purple-100 text-purple-700",
  "bg-blue-50 text-blue-700",
  "bg-amber-50 text-amber-700",
];

export function initials(first: string, last: string) {
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

export function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-50 text-green-700 border-green-100";
    case "confirmed":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "in_progress":
      return "bg-indigo-50 text-indigo-700 border-indigo-100";
    case "cancelled":
      return "bg-red-50 text-red-600 border-red-100";
    case "no_show":
      return "bg-stone-50 text-stone-600 border-stone-100";
    case "paid":
      return "bg-green-50 text-green-700 border-green-100";
    case "refunded":
    case "partially_refunded":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "failed":
      return "bg-red-50 text-red-600 border-red-100";
    default:
      return "bg-stone-50 text-stone-600 border-stone-100";
  }
}

export function lifecycleBadge(stage: string) {
  switch (stage) {
    case "prospect":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "active":
      return "bg-green-50 text-green-700 border-green-100";
    case "at_risk":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "lapsed":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "churned":
      return "bg-red-50 text-red-600 border-red-100";
    default:
      return "bg-stone-50 text-stone-600 border-stone-100";
  }
}

export function formatStage(s: string) {
  return s === "at_risk" ? "At Risk" : s.charAt(0).toUpperCase() + s.slice(1);
}

export function getTier(points: number) {
  if (points >= 1500) return { label: "Platinum", color: "text-[#5b8a8a]", bg: "bg-[#5b8a8a]/10" };
  if (points >= 700) return { label: "Gold", color: "text-[#d4a574]", bg: "bg-[#d4a574]/10" };
  if (points >= 300) return { label: "Silver", color: "text-muted", bg: "bg-foreground/8" };
  return { label: "Bronze", color: "text-[#a07040]", bg: "bg-[#a07040]/10" };
}
