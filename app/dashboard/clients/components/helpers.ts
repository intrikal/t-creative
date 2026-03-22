/**
 * Shared types, badge config, data mappers, and UI constants for
 * the Clients page and its child components.
 *
 * Used by: ClientsPage, ClientCard, ClientFormDialog, DeleteDialog, LoyaltyTab
 *
 * Key exports:
 *   Client / LoyaltyEntry    — UI-facing shapes (dollars, formatted dates)
 *   sourceBadge()            — badge label + Tailwind classes per acquisition source
 *   SVC_LABEL / SVC_COLOR    — display labels + badge colors per service category
 *   initials()               — extracts up to 2 uppercase initials from a full name
 *                               via split(" ").map(w => w[0]).join("").slice(0,2)
 *   avatarColor()            — deterministic color from charCodeAt(0) % palette length
 *   TIER_CONFIG              — points thresholds + badge colors for loyalty tiers
 *   getTier()                — returns tier name based on points thresholds
 *   mapClientRow()           — transforms a raw ClientRow into the UI Client shape:
 *                               joins first+last name, parses comma-separated tags into
 *                               ServiceCategory[], converts cents to dollars (totalSpent/100),
 *                               formats dates with toLocaleDateString
 *   mapLoyaltyRow()          — transforms a LoyaltyRow + totalSpentMap lookup into
 *                               a LoyaltyEntry with computed tier and pointsToNext
 *   SOURCE_FILTERS           — chip labels for the source filter bar
 *   CLIENTS_TABS             — tab config for Clients / Loyalty tabs
 */
import type { ClientRow, LoyaltyRow, LifecycleStage } from "@/lib/types/client.types";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type ClientSource =
  | "instagram"
  | "tiktok"
  | "pinterest"
  | "word_of_mouth"
  | "google_search"
  | "referral"
  | "website_direct"
  | "event";

export type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

export interface Client {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  source: ClientSource;
  joinedDate: string;
  vip: boolean;
  lifecycleStage: LifecycleStage | null;
  services: ServiceCategory[];
  totalBookings: number;
  totalSpent: number;
  lastVisit: string;
  notes?: string;
  referredBy?: string;
  referralCount: number;
  tags?: string;
}

export interface LoyaltyEntry {
  id: string;
  name: string;
  points: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  totalSpent: number;
  lastActivity: string;
  pointsToNext: number;
}

/* ------------------------------------------------------------------ */
/*  Helper functions                                                    */
/* ------------------------------------------------------------------ */

export function sourceBadge(source: ClientSource) {
  switch (source) {
    case "instagram":
      return { label: "Instagram", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "tiktok":
      return { label: "TikTok", className: "bg-slate-50 text-slate-700 border-slate-100" };
    case "pinterest":
      return { label: "Pinterest", className: "bg-red-50 text-red-700 border-red-100" };
    case "word_of_mouth":
      return { label: "Word of Mouth", className: "bg-teal-50 text-teal-700 border-teal-100" };
    case "google_search":
      return { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-100" };
    case "referral":
      return { label: "Referral", className: "bg-amber-50 text-amber-700 border-amber-100" };
    case "website_direct":
      return { label: "Website", className: "bg-stone-50 text-stone-600 border-stone-100" };
  }
}

export const SVC_LABEL: Record<ServiceCategory, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
};

export const SVC_COLOR: Record<ServiceCategory, string> = {
  lash: "bg-[#c4907a]/10 text-[#96604a] border-[#c4907a]/20",
  jewelry: "bg-[#d4a574]/10 text-[#a07040] border-[#d4a574]/20",
  crochet: "bg-[#7ba3a3]/10 text-[#3a6a6a] border-[#7ba3a3]/20",
  consulting: "bg-[#5b8a8a]/10 text-[#3a6a6a] border-[#5b8a8a]/20",
};

export function initials(name: string) {
  return name
    .trim()
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-[#c4907a]/20 text-[#96604a]",
  "bg-[#d4a574]/20 text-[#a07040]",
  "bg-[#7ba3a3]/20 text-[#3a6a6a]",
  "bg-purple-100 text-purple-700",
  "bg-blue-50 text-blue-700",
  "bg-amber-50 text-amber-700",
];

export function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export const TIER_CONFIG = {
  bronze: {
    label: "Bronze",
    color: "text-[#a07040]",
    bg: "bg-[#a07040]/10",
    border: "border-[#a07040]/20",
    minPoints: 0,
    nextPoints: 300,
  },
  silver: {
    label: "Silver",
    color: "text-muted",
    bg: "bg-foreground/8",
    border: "border-foreground/15",
    minPoints: 300,
    nextPoints: 700,
  },
  gold: {
    label: "Gold",
    color: "text-[#d4a574]",
    bg: "bg-[#d4a574]/10",
    border: "border-[#d4a574]/20",
    minPoints: 700,
    nextPoints: 1500,
  },
  platinum: {
    label: "Platinum",
    color: "text-[#5b8a8a]",
    bg: "bg-[#5b8a8a]/10",
    border: "border-[#5b8a8a]/20",
    minPoints: 1500,
    nextPoints: null,
  },
};

export function getTier(points: number): "bronze" | "silver" | "gold" | "platinum" {
  if (points >= 1500) return "platinum";
  if (points >= 700) return "gold";
  if (points >= 300) return "silver";
  return "bronze";
}

/* ------------------------------------------------------------------ */
/*  Source filter labels                                                */
/* ------------------------------------------------------------------ */

export const SOURCE_FILTERS = [
  "All",
  "Instagram",
  "TikTok",
  "Pinterest",
  "Referral",
  "Word of Mouth",
  "Google",
  "Website",
] as const;

/* ------------------------------------------------------------------ */
/*  Data mappers                                                       */
/* ------------------------------------------------------------------ */

export function mapClientRow(r: ClientRow): Client {
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
  const tagsList = r.tags
    ? (r.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean) as ServiceCategory[])
    : [];

  return {
    id: r.id,
    name,
    initials: initials(name),
    email: r.email,
    phone: r.phone ?? "",
    source: r.source ?? "website_direct",
    joinedDate: new Date(r.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    vip: r.isVip,
    lifecycleStage: r.lifecycleStage,
    services: tagsList,
    totalBookings: r.totalBookings,
    totalSpent: Math.round(r.totalSpent / 100),
    lastVisit: r.lastVisit
      ? new Date(r.lastVisit).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—",
    notes: r.internalNotes ?? undefined,
    referredBy: r.referredByName ?? undefined,
    referralCount: r.referralCount,
    tags: r.tags ?? undefined,
  };
}

export function mapLoyaltyRow(r: LoyaltyRow, totalSpentMap: Map<string, number>): LoyaltyEntry {
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
  const tier = getTier(r.points);
  const nextPoints = TIER_CONFIG[tier].nextPoints;
  return {
    id: r.id,
    name,
    points: r.points,
    tier,
    totalSpent: totalSpentMap.get(r.id) ?? 0,
    lastActivity: r.lastActivity
      ? new Date(r.lastActivity).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—",
    pointsToNext: nextPoints ? Math.max(0, nextPoints - r.points) : 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                                */
/* ------------------------------------------------------------------ */

export const CLIENTS_TABS = [
  { id: "clients", label: "Clients" },
  { id: "loyalty", label: "Loyalty" },
] as const;

export type ClientsTab = (typeof CLIENTS_TABS)[number]["id"];
