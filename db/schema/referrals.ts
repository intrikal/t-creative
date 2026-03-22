/**
 * referrals.ts — Referral codes and referral tracking.
 *
 * Dedicated tables for the referral program that complement the existing
 * referralCode/referredBy fields on profiles. The `referral_codes` table
 * provides a first-class entity for codes (with creation timestamps and
 * future extensibility for expiry/deactivation). The `referrals` table
 * tracks each successful referral tied to a specific booking, enabling
 * the configurable cash reward flow on booking completion.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

export const referralStatusEnum = pgEnum("referral_status", [
  "pending", // Referred client signed up but hasn't completed a paid booking
  "completed", // Booking completed + paid — referrer credited
  "expired", // Referral window expired without a qualifying booking
]);

/* ------------------------------------------------------------------ */
/*  Referral Codes                                                     */
/* ------------------------------------------------------------------ */

export const referralCodes = pgTable(
  "referral_codes",
  {
    id: serial("id").primaryKey(),

    /** The client who owns this referral code. */
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** Unique 8-char slug (e.g. "SARAH-A1"). Matches profiles.referralCode. */
    code: varchar("code", { length: 50 }).notNull().unique(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("referral_codes_profile_idx").on(t.profileId)],
);

/* ------------------------------------------------------------------ */
/*  Referrals                                                          */
/* ------------------------------------------------------------------ */

export const referrals = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),

    /** The client who shared the referral code. */
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** The new client who used the referral code. */
    referredId: uuid("referred_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** The booking that qualifies this referral for a reward (nullable until booked). */
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),

    status: referralStatusEnum("status").notNull().default("pending"),

    /** Reward amount credited to the referrer (in cents). */
    rewardAmountInCents: integer("reward_amount_in_cents").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("referrals_referrer_idx").on(t.referrerId),
    index("referrals_referred_idx").on(t.referredId),
    index("referrals_booking_idx").on(t.bookingId),
    index("referrals_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const referralCodesRelations = relations(referralCodes, ({ one }) => ({
  profile: one(profiles, {
    fields: [referralCodes.profileId],
    references: [profiles.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(profiles, {
    fields: [referrals.referrerId],
    references: [profiles.id],
    relationName: "referrer",
  }),
  referred: one(profiles, {
    fields: [referrals.referredId],
    references: [profiles.id],
    relationName: "referred",
  }),
  booking: one(bookings, {
    fields: [referrals.bookingId],
    references: [bookings.id],
  }),
}));
