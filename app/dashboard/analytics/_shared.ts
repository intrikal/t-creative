/**
 * app/dashboard/analytics/_shared.ts — Shared helpers for analytics actions.
 *
 * Auth guard, range selector, and category labels used across all analytics modules.
 */
import { requireAdmin } from "@/lib/auth";

export const getUser = requireAdmin;

import type { Range } from "@/lib/types/analytics.types";

export type { Range };

export function rangeToInterval(range: Range): string {
  switch (range) {
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    case "90d":
      return "90 days";
    case "12m":
      return "12 months";
  }
}

export const CATEGORY_LABELS: Record<string, string> = {
  lash: "Lash Services",
  jewelry: "Jewelry",
  consulting: "Consulting",
  crochet: "Crochet",
};

export function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
