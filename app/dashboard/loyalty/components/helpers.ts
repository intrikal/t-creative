/**
 * helpers.ts — Shared constants and utilities for the loyalty page.
 *
 * Contains tier configuration, tier perks, category icon mappings,
 * and earn-opportunity definitions used across loyalty sub-components.
 */

import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Crown,
  Gift,
  Heart,
  Scissors,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Ticket,
  Users,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Tier config                                                        */
/* ------------------------------------------------------------------ */

export const TIERS = [
  {
    name: "Bronze",
    min: 0,
    nextName: "Silver",
    nextAt: 300,
    reward: "birthday discounts & early booking",
    color: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-amber-200",
    accent: "bg-amber-500",
    greeting: "You're off to a great start!",
  },
  {
    name: "Silver",
    min: 300,
    nextName: "Gold",
    nextAt: 700,
    reward: "10% off & free add-ons",
    color: "text-slate-500",
    bg: "bg-slate-100",
    border: "border-slate-200",
    accent: "bg-slate-400",
    greeting: "You're building something special!",
  },
  {
    name: "Gold",
    min: 700,
    nextName: "Platinum",
    nextAt: 1500,
    reward: "15% off & priority booking",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    accent: "bg-yellow-500",
    greeting: "You're one of our favorites!",
  },
  {
    name: "Platinum",
    min: 1500,
    nextName: "Platinum",
    nextAt: 1500,
    reward: "VIP perks",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    accent: "bg-violet-500",
    greeting: "You're a VIP — we appreciate you so much!",
  },
] as const;

export type Tier = (typeof TIERS)[number];

export function getTier(points: number): Tier {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

/* ------------------------------------------------------------------ */
/*  Tier perks                                                         */
/* ------------------------------------------------------------------ */

export const TIER_PERKS: Record<string, { perk: string; Icon: LucideIcon }[]> = {
  Bronze: [
    { perk: "5% off on your birthday", Icon: Gift },
    { perk: "Early booking access", Icon: CalendarDays },
  ],
  Silver: [
    { perk: "10% off 1 service per month", Icon: Tag },
    { perk: "Free lash bath add-on", Icon: Sparkles },
    { perk: "All Bronze perks", Icon: ChevronRight },
  ],
  Gold: [
    { perk: "15% off all services", Icon: Tag },
    { perk: "Free add-on every visit", Icon: Gift },
    { perk: "Priority booking", Icon: Zap },
    { perk: "All Silver perks", Icon: ChevronRight },
  ],
  Platinum: [
    { perk: "20% off all services", Icon: Crown },
    { perk: "1 complimentary service/mo", Icon: Scissors },
    { perk: "VIP event invites", Icon: Ticket },
    { perk: "All Gold perks", Icon: ChevronRight },
  ],
};

/* ------------------------------------------------------------------ */
/*  Category -> icon mapping                                           */
/* ------------------------------------------------------------------ */

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  discount: Tag,
  add_on: Sparkles,
  service: Scissors,
  product: ShoppingBag,
};

/* ------------------------------------------------------------------ */
/*  Earn opportunities                                                 */
/* ------------------------------------------------------------------ */

export const EARN_WAYS = [
  {
    icon: CalendarCheck,
    label: "Book a service",
    points: "1pt / $1",
    hint: "Points on every visit",
  },
  { icon: Star, label: "Leave a review", points: "+25 pts", hint: "After each appointment" },
  { icon: Users, label: "Refer a friend", points: "+100 pts", hint: "They get 50 pts too" },
  { icon: Heart, label: "Add your birthday", points: "+50 pts", hint: "Plus a birthday surprise" },
  { icon: ShoppingBag, label: "Shop products", points: "1pt / $1", hint: "Aftercare & merch" },
  { icon: Sparkles, label: "Try a new service", points: "+25 pts", hint: "Explore something new" },
];
