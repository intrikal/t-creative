/**
 * admin-dashboard-helpers.ts — Display config functions for the admin dashboard.
 *
 * Maps booking statuses, inquiry statuses, service categories, and client
 * acquisition sources to their visual treatment (label, colours, badge styles).
 * Used by the dashboard cards to keep styling logic out of JSX.
 */

import type { BookingStatus, InquiryStatus } from "./admin-dashboard-types";

export function bookingStatusConfig(status: BookingStatus) {
  switch (status) {
    case "completed":
      return { label: "Completed", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "in_progress":
      return { label: "In Progress", className: "bg-blush/12 text-[#96604a] border-blush/20" };
    case "confirmed":
      return { label: "Confirmed", className: "bg-foreground/8 text-foreground border-foreground/15" };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "cancelled":
      return { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" };
    case "no_show":
      return { label: "No Show", className: "bg-destructive/10 text-destructive border-destructive/20" };
  }
}

export function categoryDot(category: string) {
  switch (category) {
    case "lash": return "bg-[#c4907a]";
    case "jewelry": return "bg-[#d4a574]";
    case "crochet": return "bg-[#7ba3a3]";
    case "consulting": return "bg-[#5b8a8a]";
    default: return "bg-muted";
  }
}

export function sourceBadge(source: string | null) {
  switch (source) {
    case "instagram": return { label: "Instagram", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "tiktok": return { label: "TikTok", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "pinterest": return { label: "Pinterest", className: "bg-rose-50 text-rose-700 border-rose-100" };
    case "word_of_mouth": return { label: "Word of Mouth", className: "bg-teal-50 text-teal-700 border-teal-100" };
    case "google_search": return { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-100" };
    case "referral": return { label: "Referral", className: "bg-amber-50 text-amber-700 border-amber-100" };
    case "website_direct": return { label: "Website", className: "bg-stone-50 text-stone-600 border-stone-100" };
    case "event": return { label: "Event", className: "bg-purple-50 text-purple-700 border-purple-100" };
    default: return { label: source ?? "Unknown", className: "bg-stone-50 text-stone-600 border-stone-100" };
  }
}

export function inquiryStatusConfig(status: InquiryStatus) {
  switch (status) {
    case "new": return { label: "New", className: "bg-blush/12 text-[#96604a] border-blush/20" };
    case "read": return { label: "Read", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "replied": return { label: "Replied", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "archived": return { label: "Archived", className: "bg-foreground/5 text-muted/60 border-foreground/8" };
  }
}

export function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    lash: "Lash", jewelry: "Jewelry", crochet: "Crochet",
    consulting: "Consulting", "3d_printing": "3D Printing", aesthetics: "Aesthetics",
  };
  return labels[category] ?? category;
}

export function formatDollars(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}
