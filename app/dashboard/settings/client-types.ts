/**
 * app/client/settings/types.ts — Shared types and constants for the client settings page.
 *
 * Extracted so sub-components (`ProfileSection`, `NotificationsSection`, etc.) can
 * import only what they need without pulling in the full `SettingsPage` module tree.
 * All data here is currently mock — Phase 2 will replace with real profile + Supabase
 * auth queries.
 */

import { Bell, CreditCard, Shield, User } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Nav                                                                */
/* ------------------------------------------------------------------ */

/** Union of all navigable settings sections. */
export type Section = "profile" | "notifications" | "payments" | "account";

/** Sidebar navigation config — drives both the desktop nav and mobile header. */
export const SECTIONS: {
  id: Section;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "account", label: "Account", icon: Shield },
];

/* ------------------------------------------------------------------ */
/*  Payment Methods                                                    */
/* ------------------------------------------------------------------ */

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
}

/** Seed data — replaced with real Stripe / Square data in Phase 2. */
export const INITIAL_CARDS: PaymentMethod[] = [
  { id: "1", brand: "Visa", last4: "4830", expiry: "09/27", isDefault: true },
];

/* ------------------------------------------------------------------ */
/*  Notification Preferences                                           */
/* ------------------------------------------------------------------ */

export interface NotifPref {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

/** Seed data — replaced with real profile notification flags in Phase 2. */
export const INITIAL_NOTIFS: NotifPref[] = [
  {
    id: "booking_confirm",
    label: "Booking Confirmations",
    description: "Get notified when your appointment is confirmed",
    enabled: true,
  },
  {
    id: "booking_reminder",
    label: "Appointment Reminders",
    description: "Reminder 24 hours before your appointment",
    enabled: true,
  },
  {
    id: "studio_messages",
    label: "Studio Messages",
    description: "Messages from T Creative Studio",
    enabled: true,
  },
  {
    id: "loyalty",
    label: "Loyalty Rewards",
    description: "Notify me when I earn a reward",
    enabled: true,
  },
  {
    id: "promotions",
    label: "Promotions & Offers",
    description: "Special deals and seasonal offers",
    enabled: false,
  },
];
