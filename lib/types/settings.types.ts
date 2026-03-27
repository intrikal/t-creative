/**
 * lib/types/settings.types.ts
 * Shared types for business settings, hours, and service categories.
 * Sources: app/dashboard/settings/settings-actions.ts,
 *          app/dashboard/settings/hours-actions.ts,
 *          app/dashboard/settings/service-categories-actions.ts
 */

import type { businessHours, timeOff } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Business profile & policies                                        */
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
  /** Hours before appointment at which client gets a full deposit refund. */
  fullRefundHours: number;
  /** Percent of deposit refunded when cancelled between partialRefundMinHours and fullRefundHours. */
  partialRefundPct: number;
  /** Minimum hours before appointment to qualify for a partial refund. */
  partialRefundMinHours: number;
  /** Cancellations within this many hours of appointment get no refund. */
  noRefundHours: number;
  /** Plain-text cancellation policy shown to clients as a required checkbox. */
  cancellationPolicy: string;
  /** Semver-style version string for the ToS (e.g. "2025-01"). */
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
  /** Cash reward credited to the referrer when a referred booking completes (cents, default 1000 = $10). */
  referralRewardCents: number;
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
  /** How to calculate deposit for multi-service bookings (default: "highest"). */
  comboDepositType: "sum" | "fixed" | "highest";
  /** Fixed deposit amount in cents, used when comboDepositType = "fixed" (default: 5000). */
  fixedComboDepositInCents: number;
  /** Maximum services per booking (default: 4). */
  maxServicesPerBooking: number;
  /** Whether recurring series charge deposit per booking or once for the series (default: "per_booking"). */
  seriesDepositType: "per_booking" | "single";
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

export interface InventoryConfig {
  lowStockThreshold: number;
  giftCardCodePrefix: string;
}

export interface FinancialConfig {
  revenueGoalMonthly: number;
  estimatedTaxRate: number;
}

export interface RevenueGoal {
  id: string;
  month: string; // "YYYY-MM"
  amount: number;
}

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
  statsOverrides: {
    clientsServed?: string;
    averageRating?: string;
    rebookingRate?: string;
    servicesCount?: string;
  };
  /** About page — mission/story paragraphs. */
  aboutMission: string;
  /** About page — credentials stats (e.g. "500+" / "Clients served"). */
  aboutCredentials: { stat: string; label: string }[];
  /** About page — timeline milestones. */
  aboutTimeline: { year: string; title: string; description: string }[];
  /** About page — certifications and training. */
  aboutCertifications: string[];
  /** About page — client testimonials. */
  aboutTestimonials: { quote: string; name: string; service: string }[];
  /** Contact page — interest/service options for the dropdown. */
  contactInterests: string[];
  /** Contact page — FAQ entries (separate from landing page FAQ). */
  contactFaqEntries: { question: string; answer: string }[];
}

export type CcpaDeletionEntry = {
  id: number;
  actorId: string | null;
  email: string;
  mediaItemsDeleted: number;
  ipAddress: string | null;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Business hours & time off                                          */
/* ------------------------------------------------------------------ */

export type BusinessHourRow = typeof businessHours.$inferSelect;
export type TimeOffRow = typeof timeOff.$inferSelect;

/** Shape stored in the `settings` table under key `"lunch_break"`. */
export interface LunchBreak {
  enabled: boolean;
  /** Start of the blocked window in "HH:MM" 24-hour format. */
  start: string;
  /** End of the blocked window in "HH:MM" 24-hour format. */
  end: string;
}

/** Input shape for `saveBusinessHours`. */
export interface HourInput {
  /** ISO day of week: 1 (Monday) through 7 (Sunday). */
  dayOfWeek: number;
  isOpen: boolean;
  /** "HH:MM" 24-hour format, or null when closed. */
  opensAt: string | null;
  /** "HH:MM" 24-hour format, or null when closed. */
  closesAt: string | null;
}

/** Input shape for `addTimeOff`. */
export interface TimeOffInput {
  type: "day_off" | "vacation";
  /** "YYYY-MM-DD" — inclusive start date. */
  startDate: string;
  /** "YYYY-MM-DD" — inclusive end date. Same as startDate for single days. */
  endDate: string;
  /** Optional human-readable label (e.g. "Hawaii trip"). */
  label?: string;
}

/* ------------------------------------------------------------------ */
/*  Service categories                                                 */
/* ------------------------------------------------------------------ */

export type ServiceCategoryRow = {
  id: number;
  name: string;
  slug: string;
  displayOrder: number;
  isActive: boolean;
};
