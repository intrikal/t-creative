/** Shared helpers and configuration for the memberships UI. */

import type { MembershipStatus } from "../actions";

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const STATUS_CONFIG: Record<MembershipStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" },
  paused: { label: "Paused", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  expired: {
    label: "Expired",
    className: "bg-foreground/8 text-foreground border-foreground/15",
  },
};

export const STATUS_FILTERS = ["All", "Active", "Paused", "Cancelled", "Expired"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
