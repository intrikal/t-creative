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

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { isSquareConfigured } from "@/lib/square";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

const getUser = requireAdmin;

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
  /** Hours before appointment at which client gets a full deposit refund. */
  fullRefundHours: number;
  /** Percent of deposit refunded when cancelled between partialRefundMinHours and fullRefundHours. */
  partialRefundPct: number;
  /** Minimum hours before appointment to qualify for a partial refund. */
  partialRefundMinHours: number;
  /** Cancellations within this many hours of appointment get no refund. */
  noRefundHours: number;
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
  /** Percent discount for birthday promo codes (e.g. 5 = 5% off). */
  birthdayDiscountPercent: number;
}

export interface NotificationPrefs {
  items: Array<{
    label: string;
    email: boolean;
    sms: boolean;
  }>;
}

export interface BookingRulesConfig {
  minNoticeHours: number;
  maxAdvanceDays: number;
  bufferMinutes: number;
  maxDailyBookings: number;
  cancelWindowHours: number;
  depositPct: number;
  depositRequired: boolean;
  allowOnlineBooking: boolean;
}

export interface ReminderItem {
  id: number;
  label: string;
  timing: string;
  email: boolean;
  sms: boolean;
  active: boolean;
}

export interface RemindersConfig {
  items: ReminderItem[];
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
  timezone: "America/Los_Angeles",
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
  fullRefundHours: 48,
  partialRefundPct: 50,
  partialRefundMinHours: 24,
  noRefundHours: 24,
};

const DEFAULT_LOYALTY: LoyaltyConfig = {
  pointsProfileComplete: 25,
  pointsBirthdayAdded: 50,
  pointsReferral: 100,
  pointsFirstBooking: 75,
  pointsRebook: 50,
  pointsReview: 30,
  birthdayDiscountPercent: 5,
  tierSilver: 300,
  tierGold: 700,
  tierPlatinum: 1500,
};

const DEFAULT_BOOKING_RULES: BookingRulesConfig = {
  minNoticeHours: 24,
  maxAdvanceDays: 60,
  bufferMinutes: 15,
  maxDailyBookings: 8,
  cancelWindowHours: 48,
  depositPct: 25,
  depositRequired: true,
  allowOnlineBooking: true,
};

const DEFAULT_REMINDERS: RemindersConfig = {
  items: [
    {
      id: 1,
      label: "Booking confirmation",
      timing: "Immediately after booking",
      email: true,
      sms: true,
      active: true,
    },
    {
      id: 2,
      label: "48-hour reminder",
      timing: "2 days before appointment",
      email: true,
      sms: true,
      active: true,
    },
    {
      id: 3,
      label: "24-hour reminder",
      timing: "1 day before appointment",
      email: false,
      sms: true,
      active: true,
    },
    {
      id: 4,
      label: "Day-of reminder",
      timing: "Morning of appointment",
      email: false,
      sms: true,
      active: false,
    },
    {
      id: 5,
      label: "4-week follow-up",
      timing: "28 days after appointment",
      email: true,
      sms: false,
      active: true,
    },
    {
      id: 6,
      label: "Review request",
      timing: "2 days after appointment",
      email: true,
      sms: false,
      active: true,
    },
  ],
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
const KEY_BOOKING_RULES = "booking_rules";
const KEY_REMINDERS = "reminder_config";

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
  try {
    await getUser();
    return getSetting(KEY_BUSINESS, DEFAULT_BUSINESS);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const businessProfileSchema = z.object({
  businessName: z.string().min(1),
  owner: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().min(1),
  location: z.string().min(1),
  timezone: z.string().min(1),
  currency: z.string().min(1),
  bookingLink: z.string(),
  bio: z.string(),
});

export async function saveBusinessProfile(data: BusinessProfile): Promise<void> {
  try {
    businessProfileSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_BUSINESS, "Business Profile", data);
    trackEvent(user.id, "business_profile_updated");
    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Policies                                                           */
/* ------------------------------------------------------------------ */

export async function getPolicies(): Promise<PolicySettings> {
  try {
    await getUser();
    return getSetting(KEY_POLICIES, DEFAULT_POLICIES);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const policySettingsSchema = z.object({
  cancelWindowHours: z.number().int().nonnegative(),
  lateCancelFeePercent: z.number().int().nonnegative(),
  noShowFeePercent: z.number().int().nonnegative(),
  depositRequired: z.boolean(),
  depositPercent: z.number().int().nonnegative(),
  fullRefundHours: z.number().int().nonnegative(),
  partialRefundPct: z.number().int().min(0).max(100),
  partialRefundMinHours: z.number().int().nonnegative(),
  noRefundHours: z.number().int().nonnegative(),
});

export async function savePolicies(data: PolicySettings): Promise<void> {
  try {
    policySettingsSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_POLICIES, "Policy Settings", data);
    trackEvent(user.id, "policies_updated");
    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Loyalty Config                                                     */
/* ------------------------------------------------------------------ */

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  try {
    await getUser();
    return getSetting(KEY_LOYALTY, DEFAULT_LOYALTY);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const loyaltyConfigSchema = z.object({
  pointsProfileComplete: z.number().int().nonnegative(),
  pointsBirthdayAdded: z.number().int().nonnegative(),
  pointsReferral: z.number().int().nonnegative(),
  pointsFirstBooking: z.number().int().nonnegative(),
  pointsRebook: z.number().int().nonnegative(),
  pointsReview: z.number().int().nonnegative(),
  tierSilver: z.number().int().nonnegative(),
  tierGold: z.number().int().nonnegative(),
  tierPlatinum: z.number().int().nonnegative(),
  birthdayDiscountPercent: z.number().int().min(1).max(100),
});

export async function saveLoyaltyConfig(data: LoyaltyConfig): Promise<void> {
  try {
    loyaltyConfigSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_LOYALTY, "Loyalty Config", data);
    trackEvent(user.id, "loyalty_config_updated");
    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    await getUser();
    return getSetting(KEY_NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const notificationPrefsSchema = z.object({
  items: z.array(
    z.object({
      label: z.string().min(1),
      email: z.boolean(),
      sms: z.boolean(),
    }),
  ),
});

export async function saveNotificationPrefs(data: NotificationPrefs): Promise<void> {
  try {
    notificationPrefsSchema.parse(data);
    await getUser();
    await upsertSetting(KEY_NOTIFICATIONS, "Notification Preferences", data);
    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Booking Rules                                                      */
/* ------------------------------------------------------------------ */

export async function getBookingRules(): Promise<BookingRulesConfig> {
  try {
    await getUser();
    return getSetting(KEY_BOOKING_RULES, DEFAULT_BOOKING_RULES);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const bookingRulesSchema = z.object({
  minNoticeHours: z.number().int().nonnegative(),
  maxAdvanceDays: z.number().int().positive(),
  bufferMinutes: z.number().int().nonnegative(),
  maxDailyBookings: z.number().int().positive(),
  cancelWindowHours: z.number().int().nonnegative(),
  depositPct: z.number().int().nonnegative(),
  depositRequired: z.boolean(),
  allowOnlineBooking: z.boolean(),
});

export async function saveBookingRules(data: BookingRulesConfig): Promise<void> {
  try {
    bookingRulesSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_BOOKING_RULES, "Booking Rules", data);
    trackEvent(user.id, "booking_rules_updated");
    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Reminders                                                          */
/* ------------------------------------------------------------------ */

export async function getReminders(): Promise<RemindersConfig> {
  try {
    await getUser();
    return getSetting(KEY_REMINDERS, DEFAULT_REMINDERS);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const remindersSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      label: z.string().min(1),
      timing: z.string().min(1),
      email: z.boolean(),
      sms: z.boolean(),
      active: z.boolean(),
    }),
  ),
});

export async function saveReminders(data: RemindersConfig): Promise<void> {
  try {
    remindersSchema.parse(data);
    await getUser();
    await upsertSetting(KEY_REMINDERS, "Reminder Config", data);
    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
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
  try {
    await getUser();
    return getSetting(KEY_FINANCIAL, DEFAULT_FINANCIAL);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const financialConfigSchema = z.object({
  revenueGoalMonthly: z.number().nonnegative(),
  estimatedTaxRate: z.number().nonnegative(),
});

export async function saveFinancialConfig(data: FinancialConfig): Promise<void> {
  try {
    financialConfigSchema.parse(data);
    await getUser();
    await upsertSetting(KEY_FINANCIAL, "Financial Config", data);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/analytics");
    revalidatePath("/dashboard/financial");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Revenue Goals                                                      */
/* ------------------------------------------------------------------ */

export interface RevenueGoal {
  id: string;
  month: string; // "YYYY-MM"
  amount: number;
}

const KEY_REVENUE_GOALS = "revenue_goals";

export async function getRevenueGoals(): Promise<RevenueGoal[]> {
  try {
    await getUser();
    return getSetting<RevenueGoal[]>(KEY_REVENUE_GOALS, []);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const revenueGoalItemSchema = z.object({
  id: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().nonnegative(),
});

export async function saveRevenueGoals(data: RevenueGoal[]): Promise<void> {
  try {
    z.array(revenueGoalItemSchema).parse(data);
    await getUser();
    await upsertSetting(KEY_REVENUE_GOALS, "Revenue Goals", data);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/analytics");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Square Integration Status                                          */
/* ------------------------------------------------------------------ */

export interface SquareConnectionStatus {
  connected: boolean;
  environment: string;
  locationId: string;
}

export async function getSquareConnectionStatus(): Promise<SquareConnectionStatus> {
  try {
    await getUser();
    const connected = isSquareConfigured();
    return {
      connected,
      environment: process.env.SQUARE_ENVIRONMENT ?? "sandbox",
      locationId: connected ? `...${(process.env.SQUARE_LOCATION_ID ?? "").slice(-6)}` : "",
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
