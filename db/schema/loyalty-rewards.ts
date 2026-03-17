/**
 * loyalty-rewards.ts — Admin-configurable reward catalog and client redemption tracking.
 *
 * ## loyaltyRewards
 * The reward catalog that admins configure. Each row defines a reward clients
 * can redeem (e.g. "$10 Off Any Service" for 200 points). Controls what shows
 * up in the client loyalty page's "Redeem Points" section.
 *
 * ## loyaltyRedemptions
 * Tracks the lifecycle of each client redemption. When a client redeems a
 * reward, a row is created with status "pending". When the discount is applied
 * to a booking, it transitions to "applied" with a bookingId link. This lets
 * staff see outstanding rewards at checkout.
 *
 * ## Related files
 * - db/schema/loyalty.ts           — loyaltyTransactions (points ledger)
 * - app/dashboard/loyalty/actions.ts — client-facing redemption action
 * - app/dashboard/clients/actions.ts — admin reward management
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { loyaltyTransactions } from "./loyalty";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

export const loyaltyRewardCategoryEnum = pgEnum("loyalty_reward_category", [
  "discount",
  "add_on",
  "service",
  "product",
]);

export const loyaltyRedemptionStatusEnum = pgEnum("loyalty_redemption_status", [
  "pending", // Redeemed but not yet applied to a booking
  "applied", // Applied to a booking
  "cancelled", // Cancelled / refunded (points returned)
]);

/* ------------------------------------------------------------------ */
/*  Loyalty Rewards (admin catalog)                                    */
/* ------------------------------------------------------------------ */

export const loyaltyRewards = pgTable(
  "loyalty_rewards",
  {
    id: serial("id").primaryKey(),

    /** Display name shown to clients (e.g. "$10 Off Any Service"). */
    label: varchar("label", { length: 200 }).notNull(),

    /** Points cost to redeem this reward. */
    pointsCost: integer("points_cost").notNull(),

    /** Discount value in cents. For "discount" category only (e.g. 1000 = $10). */
    discountInCents: integer("discount_in_cents"),

    /** Reward category — determines how the reward is fulfilled. */
    category: loyaltyRewardCategoryEnum("category").notNull(),

    /** Optional description shown to clients. */
    description: text("description"),

    /** Whether this reward is available for redemption. */
    active: boolean("active").notNull().default(true),

    /** Display order in the catalog (lower = first). */
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("loyalty_rewards_active_idx").on(t.active, t.sortOrder)],
);

/* ------------------------------------------------------------------ */
/*  Loyalty Redemptions (client redemption tracking)                   */
/* ------------------------------------------------------------------ */

export const loyaltyRedemptions = pgTable(
  "loyalty_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** The client who redeemed. */
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** The reward that was redeemed. */
    rewardId: integer("reward_id")
      .notNull()
      .references(() => loyaltyRewards.id, { onDelete: "restrict" }),

    /** The loyalty transaction that deducted the points. */
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => loyaltyTransactions.id, { onDelete: "restrict" }),

    /** Lifecycle status. */
    status: loyaltyRedemptionStatusEnum("status").notNull().default("pending"),

    /** Booking this redemption was applied to (set when status = "applied"). */
    bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),

    /** When the redemption was applied to a booking. */
    appliedAt: timestamp("applied_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("loyalty_redemptions_profile_idx").on(t.profileId),
    index("loyalty_redemptions_status_idx").on(t.profileId, t.status),
    index("loyalty_redemptions_reward_idx").on(t.rewardId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ many }) => ({
  redemptions: many(loyaltyRedemptions),
}));

export const loyaltyRedemptionsRelations = relations(loyaltyRedemptions, ({ one }) => ({
  profile: one(profiles, {
    fields: [loyaltyRedemptions.profileId],
    references: [profiles.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyRedemptions.rewardId],
    references: [loyaltyRewards.id],
  }),
  transaction: one(loyaltyTransactions, {
    fields: [loyaltyRedemptions.transactionId],
    references: [loyaltyTransactions.id],
  }),
  booking: one(bookings, {
    fields: [loyaltyRedemptions.bookingId],
    references: [bookings.id],
  }),
}));
