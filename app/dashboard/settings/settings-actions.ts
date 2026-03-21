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

import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLog, settings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { isSquareConfigured } from "@/lib/square";
import type { ActionResult } from "@/lib/types/action-result";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Public-safe helpers (no auth — used by public pages)               */
/* ------------------------------------------------------------------ */

/**
 * Read a setting without an auth guard. Used by public pages that need
 * site content / policies but have no logged-in user.
 */
async function getPublicSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  if (!row) return fallback;
  return row.value as T;
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
  emailSenderName: string;
  emailFromAddress: string;
}

export interface PolicySettings {
  cancelWindowHours: number;
  lateCancelFeePercent: number;
  noShowFeePercent: number;
  depositRequired: boolean;
  depositPercent: number;
  /** Plain-text cancellation policy shown to clients as a required TOS checkbox during booking. */
  cancellationPolicy: string;
  /** Version identifier for the current policy (e.g. '2025-01'). Stored on each booking for legal record. */
  tosVersion: string;
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
  /** Days until birthday promo code expires (default: 7). */
  birthdayPromoExpiryDays: number;
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
  /** Hours a waitlist member has to claim an offered slot (default: 24). */
  waitlistClaimWindowHours: number;
  /** Days a waiver completion token stays valid (default: 7). */
  waiverTokenExpiryDays: number;
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
  /** Days after last lash visit to send fill reminder (default: 18). */
  fillReminderDays: number;
  /** Hours after booking completion to send review request (default: 24). */
  reviewRequestDelayHours: number;
  /** Hours-before-appointment windows for booking reminders (default: [24, 48]). */
  bookingReminderHours: number[];
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
  emailSenderName: "T Creative",
  emailFromAddress: "noreply@tcreativestudio.com",
};

const DEFAULT_POLICIES: PolicySettings = {
  cancelWindowHours: 48,
  lateCancelFeePercent: 50,
  noShowFeePercent: 100,
  depositRequired: true,
  depositPercent: 25,
  cancellationPolicy:
    "Cancellations made less than 48 hours before your appointment are subject to a 50% late-cancel fee. No-shows are charged 100% of the service price. By booking you agree to these terms.",
  tosVersion: "2025-01",
};

const DEFAULT_LOYALTY: LoyaltyConfig = {
  pointsProfileComplete: 25,
  pointsBirthdayAdded: 50,
  pointsReferral: 100,
  pointsFirstBooking: 75,
  pointsRebook: 50,
  pointsReview: 30,
  birthdayDiscountPercent: 5,
  birthdayPromoExpiryDays: 7,
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
  waitlistClaimWindowHours: 24,
  waiverTokenExpiryDays: 7,
};

const DEFAULT_REMINDERS: RemindersConfig = {
  fillReminderDays: 18,
  reviewRequestDelayHours: 24,
  bookingReminderHours: [24, 48],
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

/**
 * Fetch multiple settings in a single query. Returns a Map keyed by
 * setting key so callers can look up each value with its own fallback.
 */
async function getMultipleSettings(keys: string[]): Promise<Map<string, unknown>> {
  if (keys.length === 0) return new Map();
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  return new Map(rows.map((r) => [r.key, r.value]));
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
  emailSenderName: z.string().min(1),
  emailFromAddress: z.string().min(1),
});

export async function saveBusinessProfile(data: BusinessProfile): Promise<ActionResult<void>> {
  try {
    businessProfileSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_BUSINESS, "Business Profile", data);
    trackEvent(user.id, "business_profile_updated");
    revalidatePath("/dashboard/settings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
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
  cancellationPolicy: z.string(),
  tosVersion: z.string().min(1),
});

export async function savePolicies(data: PolicySettings): Promise<ActionResult<void>> {
  try {
    policySettingsSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_POLICIES, "Policy Settings", data);
    trackEvent(user.id, "policies_updated");
    revalidatePath("/dashboard/settings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
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
  birthdayPromoExpiryDays: z.number().int().min(1).max(365),
});

export async function saveLoyaltyConfig(data: LoyaltyConfig): Promise<ActionResult<void>> {
  try {
    loyaltyConfigSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_LOYALTY, "Loyalty Config", data);
    trackEvent(user.id, "loyalty_config_updated");
    revalidatePath("/dashboard/settings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
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

export async function saveNotificationPrefs(data: NotificationPrefs): Promise<ActionResult<void>> {
  try {
    notificationPrefsSchema.parse(data);
    await getUser();
    await upsertSetting(KEY_NOTIFICATIONS, "Notification Preferences", data);
    revalidatePath("/dashboard/settings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
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
  waitlistClaimWindowHours: z.number().int().min(1).max(168),
  waiverTokenExpiryDays: z.number().int().min(1).max(30),
});

export async function saveBookingRules(data: BookingRulesConfig): Promise<ActionResult<void>> {
  try {
    bookingRulesSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_BOOKING_RULES, "Booking Rules", data);
    trackEvent(user.id, "booking_rules_updated");
    revalidatePath("/dashboard/settings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
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
  fillReminderDays: z.number().int().min(1).max(60),
  reviewRequestDelayHours: z.number().int().min(1).max(168),
  bookingReminderHours: z.array(z.number().int().min(1).max(168)),
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

export async function saveReminders(data: RemindersConfig): Promise<ActionResult<void>> {
  try {
    remindersSchema.parse(data);
    await getUser();
    await upsertSetting(KEY_REMINDERS, "Reminder Config", data);
    revalidatePath("/dashboard/settings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Inventory Config                                                   */
/* ------------------------------------------------------------------ */

export interface InventoryConfig {
  lowStockThreshold: number;
  giftCardCodePrefix: string;
}

const DEFAULT_INVENTORY: InventoryConfig = {
  lowStockThreshold: 5,
  giftCardCodePrefix: "TC-GC",
};

const KEY_INVENTORY = "inventory_config";

export async function getInventoryConfig(): Promise<InventoryConfig> {
  try {
    await getUser();
    return getSetting(KEY_INVENTORY, DEFAULT_INVENTORY);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const inventoryConfigSchema = z.object({
  lowStockThreshold: z.number().int().min(1).max(100),
  giftCardCodePrefix: z.string().min(1).max(20),
});

export async function saveInventoryConfig(data: InventoryConfig): Promise<ActionResult<void>> {
  try {
    inventoryConfigSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_INVENTORY, "Inventory Config", data);
    trackEvent(user.id, "inventory_config_updated");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/marketplace");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
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

export async function saveFinancialConfig(data: FinancialConfig): Promise<ActionResult<void>> {
  try {
    financialConfigSchema.parse(data);
    await getUser();
    await upsertSetting(KEY_FINANCIAL, "Financial Config", data);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/analytics");
    revalidatePath("/dashboard/financial");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
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

export async function saveRevenueGoals(data: RevenueGoal[]): Promise<ActionResult<void>> {
  try {
    z.array(revenueGoalItemSchema).parse(data);
    await getUser();
    await upsertSetting(KEY_REVENUE_GOALS, "Revenue Goals", data);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/analytics");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Site Content                                                       */
/* ------------------------------------------------------------------ */

export interface SiteContent {
  heroHeadline: string;
  heroSubheadline: string;
  heroCtaText: string;
  aboutBio: string;
  footerTagline: string;
  seoTitle: string;
  seoDescription: string;
  socialLinks: { platform: string; handle: string; url: string }[];
  faqEntries: { question: string; answer: string }[];
  consultingServices: {
    title: string;
    tag: string;
    description: string;
    outcomes: string[];
    idealClient: string;
  }[];
  consultingBenefits: string[];
  eventDescriptions: {
    title: string;
    description: string;
  }[];
  showConsultingPage: boolean;
}

const DEFAULT_SITE_CONTENT: SiteContent = {
  heroHeadline: "Where Artistry Meets Transformation",
  heroSubheadline:
    "Premium lash extensions, permanent jewelry, custom crochet commissions, and business consulting. Every creation crafted with intention and care, serving San Jose and the Bay Area.",
  heroCtaText: "Book Appointment",
  aboutBio:
    "A creative entrepreneur passionate about helping others feel confident and beautiful. With expertise spanning lash artistry, permanent jewelry design, handcrafted crochet, and business consulting, I bring intention and care to every creation.\n\nBased in the San Francisco Bay Area, I combine artistic vision with business acumen to transform both looks and businesses. I also work as an HR professional, bringing strategic expertise to help companies build better teams and processes.",
  footerTagline:
    "Lash extensions, crochet hair, permanent jewelry, custom craft, 3D printing, and business consulting. Structure makes beautiful things.",
  seoTitle: "T Creative Studio — Lash Extensions, Permanent Jewelry & More in San Jose",
  seoDescription:
    "Premium lash extensions, permanent jewelry, custom crochet commissions, and business consulting. Crafted with intention and care, serving San Jose and the Bay Area.",
  socialLinks: [
    { platform: "Instagram", handle: "@trinitlam", url: "https://www.instagram.com/trinitlam/" },
    {
      platform: "Instagram",
      handle: "@lashedbytrini_",
      url: "https://www.instagram.com/lashedbytrini_/",
    },
    {
      platform: "Instagram",
      handle: "@linkedbytrini",
      url: "https://www.instagram.com/linkedbytrini/",
    },
    {
      platform: "Instagram",
      handle: "@knotsnstuff",
      url: "https://www.instagram.com/knotsnstuff/",
    },
    {
      platform: "LinkedIn",
      handle: "Trini Lam",
      url: "https://www.linkedin.com/in/trini-lam-01b729146/",
    },
  ],
  faqEntries: [
    {
      question: "Where are you located?",
      answer:
        "T Creative Studio is based in San Jose, California, serving the greater Bay Area. For events and pop-ups, we travel to your location.",
    },
    {
      question: "Do I need to pay a deposit?",
      answer:
        "Yes — a {depositPercent}% deposit is required to confirm your appointment. The remaining balance is due at the time of service. Deposits are processed securely through Square.",
    },
    {
      question: "What's the cancellation policy?",
      answer:
        "We require at least {cancelWindowHours} hours notice for cancellations. Late cancellations are subject to a {lateCancelFeePercent}% fee, and no-shows are charged the full service amount.",
    },
    {
      question: "Can I book for a group or event?",
      answer:
        "Absolutely. We offer private lash parties (up to 6 guests), permanent jewelry pop-ups at your venue, bridal packages, and corporate team events. Reach out through the contact form to get started.",
    },
    {
      question: "Do you offer training and certifications?",
      answer:
        "Yes — we run certification programs for lash extensions, permanent jewelry welding, and beauty business consulting. Each program includes hands-on training, materials, and a certificate of completion.",
    },
    {
      question: "How do I prepare for my appointment?",
      answer:
        "Come with a clean face (no eye makeup for lash services). We'll send you a confirmation email with specific prep instructions for your service. If you have allergies or sensitivities, let us know when booking.",
    },
  ],
  consultingServices: [
    {
      title: "HR Strategy & Consulting",
      tag: "Remote · All Industries",
      description:
        "Strategic HR consulting grounded in real corporate experience. Whether you're a startup building your first team or an established company refining your people processes, this engagement covers what actually moves the needle.",
      outcomes: [
        "Hiring process design and job description development",
        "Onboarding workflows and 90-day frameworks",
        "Performance review systems and feedback structures",
        "Team structure and reporting line clarity",
        "HR compliance fundamentals for small businesses",
        "Manager coaching and team communication systems",
      ],
      idealClient:
        "Founders, operations leads, and small business owners who are scaling their team and need real HR infrastructure — not generic advice.",
    },
    {
      title: "Beauty Business Consulting",
      tag: "Remote · Beauty & Wellness",
      description:
        "Built specifically for beauty professionals ready to run their business with intention. This isn't theory — it's the exact systems, pricing strategies, and client frameworks used to build T Creative Studio from the ground up.",
      outcomes: [
        "Service menu design and pricing strategy",
        "Client retention and rebooking systems",
        "Deposit and cancellation policy setup",
        "Social media and content strategy for beauty pros",
        "Transitioning from booth rental to studio ownership",
        "Building a referral-based clientele from scratch",
      ],
      idealClient:
        "Lash techs, permanent jewelry artists, estheticians, and salon owners who are ready to grow sustainably — not just hustle harder.",
    },
  ],
  consultingBenefits: [
    "Flexible scheduling around your business hours — no commute",
    "Recorded sessions your team can reference and revisit",
    "Deliverables in writing after every session",
    "Access to templates, frameworks, and tools used in-practice",
  ],
  eventDescriptions: [
    {
      title: "Private Lash Parties",
      description:
        "Book the studio for you and your group. Everyone gets lashed while you celebrate — birthdays, bachelorettes, girls' night.",
    },
    {
      title: "Pop-Up Events",
      description:
        "Permanent jewelry welding at your venue, market, or storefront. Full setup provided — we bring the studio to you.",
    },
    {
      title: "Bridal & Wedding",
      description:
        "Day-of lash services and permanent jewelry for the bridal party. Coordinated scheduling so everyone is ready on time.",
    },
    {
      title: "Corporate & Team Events",
      description:
        "Team bonding with permanent jewelry or beauty services. Great for offsites, retreats, and company milestones.",
    },
  ],
  showConsultingPage: true,
};

const KEY_SITE_CONTENT = "site_content";

/**
 * Get site content — public-safe (no auth required).
 * Used by public pages to render configurable content.
 */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    return getPublicSetting(KEY_SITE_CONTENT, DEFAULT_SITE_CONTENT);
  } catch (err) {
    Sentry.captureException(err);
    return DEFAULT_SITE_CONTENT;
  }
}

const siteContentSchema = z.object({
  heroHeadline: z.string().min(1),
  heroSubheadline: z.string().min(1),
  heroCtaText: z.string().min(1),
  aboutBio: z.string().min(1),
  footerTagline: z.string().min(1),
  seoTitle: z.string().min(1),
  seoDescription: z.string().min(1),
  socialLinks: z.array(
    z.object({
      platform: z.string().min(1),
      handle: z.string().min(1),
      url: z.string().url(),
    }),
  ),
  faqEntries: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
    }),
  ),
  consultingServices: z.array(
    z.object({
      title: z.string().min(1),
      tag: z.string().min(1),
      description: z.string().min(1),
      outcomes: z.array(z.string().min(1)),
      idealClient: z.string().min(1),
    }),
  ),
  consultingBenefits: z.array(z.string().min(1)),
  eventDescriptions: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    }),
  ),
  showConsultingPage: z.boolean(),
});

export async function saveSiteContent(data: SiteContent): Promise<ActionResult<void>> {
  try {
    siteContentSchema.parse(data);
    const user = await getUser();
    await upsertSetting(KEY_SITE_CONTENT, "Site Content", data);
    trackEvent(user.id, "site_content_updated");
    updateTag("site-content");
    revalidatePath("/dashboard/settings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to save";
    return { success: false, error: message };
  }
}

/**
 * Get reminders config — public-safe (no auth required).
 * Used by cron jobs for fill-reminders, review-requests, booking-reminders.
 */
export async function getPublicRemindersConfig(): Promise<RemindersConfig> {
  try {
    return getPublicSetting(KEY_REMINDERS, DEFAULT_REMINDERS);
  } catch (err) {
    Sentry.captureException(err);
    return DEFAULT_REMINDERS;
  }
}

/**
 * Get loyalty config — public-safe (no auth required).
 * Used by birthday cron for discount percent and promo expiry.
 */
export async function getPublicLoyaltyConfig(): Promise<LoyaltyConfig> {
  try {
    return getPublicSetting(KEY_LOYALTY, DEFAULT_LOYALTY);
  } catch (err) {
    Sentry.captureException(err);
    return DEFAULT_LOYALTY;
  }
}

/**
 * Get booking rules — public-safe (no auth required).
 * Used by waitlist-notify for claim window hours, waiver-token for expiry.
 */
export async function getPublicBookingRules(): Promise<BookingRulesConfig> {
  try {
    return getPublicSetting(KEY_BOOKING_RULES, DEFAULT_BOOKING_RULES);
  } catch (err) {
    Sentry.captureException(err);
    return DEFAULT_BOOKING_RULES;
  }
}

/**
 * Get inventory config — public-safe (no auth required).
 * Used by gift-card actions for code prefix and marketplace for stock threshold.
 */
export async function getPublicInventoryConfig(): Promise<InventoryConfig> {
  try {
    return getPublicSetting(KEY_INVENTORY, DEFAULT_INVENTORY);
  } catch (err) {
    Sentry.captureException(err);
    return DEFAULT_INVENTORY;
  }
}

/**
 * Get policies — public-safe (no auth required).
 * Used by public FAQ to interpolate policy values.
 */
export async function getPublicPolicies(): Promise<PolicySettings> {
  try {
    return getPublicSetting(KEY_POLICIES, DEFAULT_POLICIES);
  } catch (err) {
    Sentry.captureException(err);
    return DEFAULT_POLICIES;
  }
}

/**
 * Get business profile — public-safe (no auth required).
 * Used by public pages for studio name, location, email.
 */
export async function getPublicBusinessProfile(): Promise<BusinessProfile> {
  try {
    return getPublicSetting(KEY_BUSINESS, DEFAULT_BUSINESS);
  } catch (err) {
    Sentry.captureException(err);
    return DEFAULT_BUSINESS;
  }
}

/* ------------------------------------------------------------------ */
/*  Admin Settings Bundle                                              */
/* ------------------------------------------------------------------ */

export interface AdminSettingsBundle {
  businessProfile: BusinessProfile;
  policies: PolicySettings;
  loyalty: LoyaltyConfig;
  notifications: NotificationPrefs;
  bookingRules: BookingRulesConfig;
  reminders: RemindersConfig;
  siteContent: SiteContent;
  inventory: InventoryConfig;
  financial: FinancialConfig;
  revenueGoals: RevenueGoal[];
}

/**
 * Fetch all admin settings in a single query instead of 10 separate ones.
 * Each setting falls back to its default if missing from the database.
 */
export async function getAdminSettingsBundle(): Promise<AdminSettingsBundle> {
  try {
    await getUser();

    const keys = [
      KEY_BUSINESS,
      KEY_POLICIES,
      KEY_LOYALTY,
      KEY_NOTIFICATIONS,
      KEY_BOOKING_RULES,
      KEY_REMINDERS,
      KEY_SITE_CONTENT,
      KEY_INVENTORY,
      KEY_FINANCIAL,
      KEY_REVENUE_GOALS,
    ];

    const map = await getMultipleSettings(keys);

    return {
      businessProfile: (map.get(KEY_BUSINESS) as BusinessProfile) ?? DEFAULT_BUSINESS,
      policies: (map.get(KEY_POLICIES) as PolicySettings) ?? DEFAULT_POLICIES,
      loyalty: (map.get(KEY_LOYALTY) as LoyaltyConfig) ?? DEFAULT_LOYALTY,
      notifications: (map.get(KEY_NOTIFICATIONS) as NotificationPrefs) ?? DEFAULT_NOTIFICATIONS,
      bookingRules: (map.get(KEY_BOOKING_RULES) as BookingRulesConfig) ?? DEFAULT_BOOKING_RULES,
      reminders: (map.get(KEY_REMINDERS) as RemindersConfig) ?? DEFAULT_REMINDERS,
      siteContent: (map.get(KEY_SITE_CONTENT) as SiteContent) ?? DEFAULT_SITE_CONTENT,
      inventory: (map.get(KEY_INVENTORY) as InventoryConfig) ?? DEFAULT_INVENTORY,
      financial: (map.get(KEY_FINANCIAL) as FinancialConfig) ?? DEFAULT_FINANCIAL,
      revenueGoals: (map.get(KEY_REVENUE_GOALS) as RevenueGoal[]) ?? [],
    };
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

/* ------------------------------------------------------------------ */
/*  CCPA Data Deletion Log (admin view)                                */
/* ------------------------------------------------------------------ */

export type CcpaDeletionEntry = {
  id: number;
  actorId: string | null;
  email: string;
  mediaItemsDeleted: number;
  ipAddress: string | null;
  createdAt: string;
};

/**
 * Fetch all CCPA data deletion requests from the audit log.
 * Admin-only — used by the Data Requests tab in admin settings.
 */
export async function getCcpaDeletionLog(): Promise<CcpaDeletionEntry[]> {
  try {
    await getUser(); // requireAdmin

    const rows = await db
      .select({
        id: auditLog.id,
        actorId: auditLog.actorId,
        metadata: auditLog.metadata,
        ipAddress: auditLog.ipAddress,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(eq(auditLog.entityType, "ccpa_deletion_request"))
      .orderBy(desc(auditLog.createdAt));

    return rows.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        actorId: row.actorId,
        email: (meta.email as string) ?? "unknown",
        mediaItemsDeleted: (meta.mediaItemsDeleted as number) ?? 0,
        ipAddress: row.ipAddress,
        createdAt: row.createdAt.toISOString(),
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
