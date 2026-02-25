/**
 * app/client/settings/types.ts — Shared types and constants for the client settings page.
 *
 * Contains navigation config and payment method types.
 * Notification preferences and profile data are now managed via server actions
 * in `client-settings-actions.ts`.
 */

import { Bell, CreditCard, Shield, User } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Nav                                                                */
/* ------------------------------------------------------------------ */

/** Union of all navigable settings sections. */
export type Section = "profile" | "notifications" | "payments" | "account";

/** Sidebar navigation config — drives both the desktop nav and mobile tabs. */
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
