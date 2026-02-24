/**
 * Server actions for the Settings dashboard (`/dashboard/settings`).
 *
 * Uses the `settings` table — a key-value store with a `key` (varchar PK),
 * `label`, `description`, and `value` (jsonb). Each feature stores its full
 * config as a single JSON blob under a well-known key.
 *
 * **Features & keys:**
 * | Feature        | Key                  | Type               |
 * |----------------|----------------------|--------------------|
 * | Studio Profile | `business_profile`   | `BusinessProfile`  |
 * | Policies       | `policy_settings`    | `PolicySettings`   |
 * | Loyalty Config | `loyalty_config`     | `LoyaltyConfig`    |
 * | Notifications  | `notification_prefs` | `NotificationPrefs`|
 *
 * **Design decisions:**
 * - Generic `getSetting<T>()` / `upsertSetting()` helpers eliminate boilerplate.
 * - `getSetting` returns a typed default when no DB row exists, so the UI
 *   always renders valid data without requiring a migration or seed step.
 * - First save creates the row via `INSERT … ON CONFLICT DO UPDATE`.
 * - Every mutation is auth-gated and calls `revalidatePath("/dashboard/settings")`.
 *
 * @module settings/settings-actions
 * @see {@link ./SettingsPage.tsx} — tab shell consuming these actions
 * @see {@link ./components/BusinessTab.tsx} — studio profile form
 * @see {@link ./components/PoliciesTab.tsx} — cancellation / deposit settings
 * @see {@link ./components/LoyaltyTab.tsx} — point values + tier thresholds
 * @see {@link ./components/NotificationsTab.tsx} — email/SMS preferences
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BusinessProfile {
  businessName: string;
  owner: string;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  currency: string;
  bookingLink: string;
  bio: string;
}

export interface PolicySettings {
  cancelWindowHours: number;
  lateCancelFeePercent: number;
  noShowFeePercent: number;
  depositRequired: boolean;
  depositPercent: number;
}

export interface LoyaltyConfig {
  pointsProfileComplete: number;
  pointsBirthdayAdded: number;
  pointsReferral: number;
  pointsFirstBooking: number;
  pointsRebook: number;
  pointsReview: number;
  tierSilver: number;
  tierGold: number;
  tierPlatinum: number;
}

export interface NotificationPrefs {
  items: Array<{
    label: string;
    email: boolean;
    sms: boolean;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_BUSINESS: BusinessProfile = {
  businessName: "T Creative Studio",
  owner: "Trini",
  email: "hello@tcreativestudio.com",
  phone: "(408) 555-0001",
  location: "San Jose, CA",
  timezone: "Pacific Time (ET)",
  currency: "USD ($)",
  bookingLink: "tcreative.studio/book",
  bio: "T Creative Studio is a San Francisco Bay Area based beauty studio specializing in lash extensions, permanent jewelry, crochet braids, and business consulting for beauty entrepreneurs.",
};

const DEFAULT_POLICIES: PolicySettings = {
  cancelWindowHours: 48,
  lateCancelFeePercent: 50,
  noShowFeePercent: 100,
  depositRequired: true,
  depositPercent: 25,
};

const DEFAULT_LOYALTY: LoyaltyConfig = {
  pointsProfileComplete: 25,
  pointsBirthdayAdded: 50,
  pointsReferral: 100,
  pointsFirstBooking: 75,
  pointsRebook: 50,
  pointsReview: 30,
  tierSilver: 300,
  tierGold: 700,
  tierPlatinum: 1500,
};

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  items: [
    { label: "New booking confirmation", email: true, sms: true },
    { label: "Booking reminder (24h)", email: true, sms: true },
    { label: "New inquiry received", email: true, sms: false },
    { label: "Cancellation alert", email: true, sms: true },
    { label: "Payment received", email: false, sms: false },
    { label: "Review posted", email: true, sms: false },
    { label: "No-show flagged", email: true, sms: true },
  ],
};

/* ------------------------------------------------------------------ */
/*  Keys                                                               */
/* ------------------------------------------------------------------ */

const KEY_BUSINESS = "business_profile";
const KEY_POLICIES = "policy_settings";
const KEY_LOYALTY = "loyalty_config";
const KEY_NOTIFICATIONS = "notification_prefs";

/* ------------------------------------------------------------------ */
/*  Generic helpers                                                    */
/* ------------------------------------------------------------------ */

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  if (!row) return fallback;
  return row.value as T;
}

async function upsertSetting(key: string, label: string, value: unknown): Promise<void> {
  await db.insert(settings).values({ key, label, value }).onConflictDoUpdate({
    target: settings.key,
    set: { value },
  });
}

/* ------------------------------------------------------------------ */
/*  Business Profile                                                   */
/* ------------------------------------------------------------------ */

export async function getBusinessProfile(): Promise<BusinessProfile> {
  await getUser();
  return getSetting(KEY_BUSINESS, DEFAULT_BUSINESS);
}

export async function saveBusinessProfile(data: BusinessProfile): Promise<void> {
  await getUser();
  await upsertSetting(KEY_BUSINESS, "Business Profile", data);
  revalidatePath("/dashboard/settings");
}

/* ------------------------------------------------------------------ */
/*  Policies                                                           */
/* ------------------------------------------------------------------ */

export async function getPolicies(): Promise<PolicySettings> {
  await getUser();
  return getSetting(KEY_POLICIES, DEFAULT_POLICIES);
}

export async function savePolicies(data: PolicySettings): Promise<void> {
  await getUser();
  await upsertSetting(KEY_POLICIES, "Policy Settings", data);
  revalidatePath("/dashboard/settings");
}

/* ------------------------------------------------------------------ */
/*  Loyalty Config                                                     */
/* ------------------------------------------------------------------ */

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  await getUser();
  return getSetting(KEY_LOYALTY, DEFAULT_LOYALTY);
}

export async function saveLoyaltyConfig(data: LoyaltyConfig): Promise<void> {
  await getUser();
  await upsertSetting(KEY_LOYALTY, "Loyalty Config", data);
  revalidatePath("/dashboard/settings");
}

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  await getUser();
  return getSetting(KEY_NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
}

export async function saveNotificationPrefs(data: NotificationPrefs): Promise<void> {
  await getUser();
  await upsertSetting(KEY_NOTIFICATIONS, "Notification Preferences", data);
  revalidatePath("/dashboard/settings");
}

/* ------------------------------------------------------------------ */
/*  Financial Config                                                   */
/* ------------------------------------------------------------------ */

export interface FinancialConfig {
  revenueGoalMonthly: number;
  estimatedTaxRate: number;
}

const DEFAULT_FINANCIAL: FinancialConfig = {
  revenueGoalMonthly: 12000,
  estimatedTaxRate: 25,
};

const KEY_FINANCIAL = "financial_config";

export async function getFinancialConfig(): Promise<FinancialConfig> {
  await getUser();
  return getSetting(KEY_FINANCIAL, DEFAULT_FINANCIAL);
}

export async function saveFinancialConfig(data: FinancialConfig): Promise<void> {
  await getUser();
  await upsertSetting(KEY_FINANCIAL, "Financial Config", data);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/financial");
}
