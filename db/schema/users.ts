/**
 * users — Profile and RBAC tables.
 *
 * Auth is handled by Supabase Auth (`auth.users`). This table extends it
 * with application-level profile data and role assignments. The `id` column
 * is a foreign key to `auth.users.id` so Supabase RLS policies can
 * reference it directly.
 *
 * External system IDs (Square, Zoho) are stored here so sync operations
 * can reconcile records across platforms without redundant API lookups.
 *
 * Supabase will auto-populate a row here via a database trigger on signup
 * (configured in the seed migration).
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { assistantProfiles, shifts } from "./assistants";
import { bookings } from "./bookings";
import { userRoleEnum } from "./enums";
import { events } from "./events";
import { threads, messages } from "./messages";
import { orders } from "./orders";
import { payments } from "./payments";
import { reviews } from "./reviews";
import { enrollments } from "./training";
import { wishlistItems } from "./wishlists";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/**
 * How a client discovered T Creative — powers the "All Sources" filter
 * on the Clients view and acquisition analytics.
 */
export const clientSourceEnum = pgEnum("client_source", [
  "instagram",
  "word_of_mouth",
  "google_search",
  "referral",
  "website_direct",
]);

/* ------------------------------------------------------------------ */
/*  Profiles                                                           */
/* ------------------------------------------------------------------ */

export const profiles = pgTable(
  "profiles",
  {
    /** Maps 1:1 to `auth.users.id`. Set as default on Supabase trigger. */
    id: uuid("id").primaryKey(),
    role: userRoleEnum("role").notNull().default("client"),

    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    phone: varchar("phone", { length: 30 }),

    /** Public display name — defaults to "firstName L." in the app layer. */
    displayName: varchar("display_name", { length: 200 }),

    /** Supabase Storage path or external URL. */
    avatarUrl: text("avatar_url"),

    /** Free-form notes visible only to admin/assistant (e.g. "prefers volume lashes"). */
    internalNotes: text("internal_notes"),

    /* ------ Client CRM fields ------ */

    /**
     * Whether this client has VIP status. VIP clients get a gold badge
     * on their card and appear under the "VIP" status filter.
     * Active/Inactive is driven by `isActive`; VIP is an overlay.
     */
    isVip: boolean("is_vip").notNull().default(false),

    /**
     * Comma-separated tags for client categorization and filtering.
     * E.g. "VIP, Lashes, Regular" or "Crochet, Custom"
     * Displayed as pills on the client card. Filterable via "All Tags".
     */
    tags: text("tags"),

    /**
     * How this client discovered T Creative — shown as a colored pill
     * on the client card and filterable via the "All Sources" dropdown.
     */
    source: clientSourceEnum("source"),

    /* ------ Notification preferences ------ */

    /** Opt-in for SMS appointment reminders (sent via Square). */
    notifySms: boolean("notify_sms").notNull().default(true),

    /** Opt-in for email booking confirmations and updates. */
    notifyEmail: boolean("notify_email").notNull().default(true),

    /** Opt-in for marketing emails (promotions, new products, events). */
    notifyMarketing: boolean("notify_marketing").notNull().default(false),

    /* ------ Referrals ------ */

    /**
     * Unique referral code for this client (e.g. "SARAH-TC").
     * Generated when the client first shares their link. Used to
     * track who referred whom via the `referredBy` field.
     */
    referralCode: varchar("referral_code", { length: 50 }).unique(),

    /**
     * The profile ID of the client who referred this person.
     * Set when a new client signs up using someone's referral code.
     * Nullable — most clients won't have a referrer.
     */
    referredBy: uuid("referred_by"),

    /* ------ External integrations ------ */

    /** Square customer ID — set when synced to Square for payments/SMS. */
    squareCustomerId: varchar("square_customer_id", { length: 100 }),

    /** Zoho CRM contact ID — set when synced to Zoho for CRM tracking. */
    zohoContactId: varchar("zoho_contact_id", { length: 100 }),

    /**
     * JSONB bucket for onboarding fields that don't have dedicated columns
     * (allergies, availability, interests, waiver, photo consent, birthday, etc.).
     */
    onboardingData: jsonb("onboarding_data"),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("profiles_role_idx").on(t.role),
    index("profiles_email_idx").on(t.email),
    index("profiles_vip_idx").on(t.isVip),
    index("profiles_source_idx").on(t.source),
    index("profiles_referral_code_idx").on(t.referralCode),
    index("profiles_referred_by_idx").on(t.referredBy),
    index("profiles_square_id_idx").on(t.squareCustomerId),
    index("profiles_zoho_id_idx").on(t.zohoContactId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const profilesRelations = relations(profiles, ({ many }) => ({
  /** One-to-many: profiles.id → bookings.client_id (client's appointments). */
  bookings: many(bookings),
  /** One-to-many: profiles.id → bookings.staff_id (staff's assigned appointments). */
  assignedBookings: many(bookings, { relationName: "assignedStaff" }),
  /** One-to-many: profiles.id → threads.client_id (client's conversation threads). */
  clientThreads: many(threads),
  /** One-to-many: profiles.id → threads.assigned_staff_id (staff's assigned threads). */
  assignedThreads: many(threads, { relationName: "assignedThreadStaff" }),
  /** One-to-many: profiles.id → messages.sender_id (messages sent by this user). */
  sentMessages: many(messages, { relationName: "sender" }),
  /** One-to-many: profiles.id → messages.recipient_id (messages received by this user). */
  receivedMessages: many(messages, { relationName: "recipient" }),
  /** One-to-many: profiles.id → reviews.client_id (reviews written by this client). */
  reviews: many(reviews),
  /** One-to-many: profiles.id → orders.client_id (marketplace/custom orders). */
  orders: many(orders),
  /** One-to-many: profiles.id → payments.client_id (payment records). */
  payments: many(payments),
  /** One-to-many: profiles.id → enrollments.client_id (training enrollments). */
  enrollments: many(enrollments),
  /** One-to-many: profiles.id → enrollments.enrolled_by (students enrolled by this staff). */
  enrolledStudents: many(enrollments, { relationName: "enrolledByStaff" }),
  /** One-to-many: profiles.id → events.host_id (events hosted by this client). */
  hostedEvents: many(events, { relationName: "eventHost" }),
  /** One-to-many: profiles.id → events.staff_id (events staffed by this user). */
  staffedEvents: many(events, { relationName: "eventStaff" }),
  /** One-to-one: profiles.id → assistant_profiles.profile_id (staff extension, role="assistant" only). */
  assistantProfile: many(assistantProfiles),
  /** One-to-many: profiles.id → shifts.assistant_id (scheduled work blocks for assistants). */
  shifts: many(shifts),
  /** One-to-many: profiles.id → wishlist_items.client_id (saved marketplace products). */
  wishlistItems: many(wishlistItems),
}));
