/**
 * memberships.ts — Lash Club membership plans and client subscriptions.
 *
 * ## Design
 * Two tables:
 *
 * 1. `membershipPlans` — The available membership tiers (admin-configured).
 *    Plans are soft-deleted via `isActive = false` so existing subscriptions
 *    keep their plan reference intact.
 *
 * 2. `membershipSubscriptions` — A client's active membership.
 *    Each client may have at most one non-cancelled subscription at a time.
 *    A new cycle is triggered manually (or via cron) by renewing the subscription:
 *    fills are reset to `plan.fillsPerCycle` and cycle dates are advanced.
 *
 * ## Billing
 * Billing is handled externally (Square charge or manual collection). This
 * table tracks entitlements (fills remaining, discount %) not payment state.
 * Link a payment to a subscription via notes or a separate payment record.
 *
 * ## Fill usage
 * When a lash fill booking is marked completed for a member, call
 * `useMembershipFill(subscriptionId)` to decrement `fillsRemainingThisCycle`.
 * The booking discount should be applied at booking creation time based on
 * membership status.
 *
 * ## Related files
 * - db/schema/enums.ts       — membershipStatusEnum
 * - db/schema/users.ts       — profiles (clientId FK)
 * - app/dashboard/memberships/actions.ts — CRUD server actions
 * - app/dashboard/loyalty/actions.ts     — getClientMembership for client view
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { membershipStatusEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Membership Plans                                                   */
/* ------------------------------------------------------------------ */

export const membershipPlans = pgTable("membership_plans", {
  id: serial("id").primaryKey(),

  /** Display name shown to clients and in the admin UI. E.g. "Lash Club". */
  name: varchar("name", { length: 200 }).notNull(),

  /**
   * URL-safe identifier used in code to reference specific plans without
   * relying on numeric IDs. E.g. "lash-club", "lash-club-vip".
   */
  slug: varchar("slug", { length: 100 }).notNull().unique(),

  /** Short marketing description shown on the membership card. */
  description: text("description"),

  /** Monthly price in cents. E.g. 8900 = $89/month. */
  priceInCents: integer("price_in_cents").notNull(),

  /**
   * Number of lash fill appointments included per billing cycle.
   * E.g. 1 fill/month for Basic, 2 fills/month for VIP.
   */
  fillsPerCycle: integer("fills_per_cycle").notNull().default(1),

  /**
   * Percentage discount on retail products for active members.
   * E.g. 10 = 10% off all products. 0 = no product discount.
   */
  productDiscountPercent: integer("product_discount_percent").notNull().default(0),

  /**
   * Length of each billing cycle in days. Default 30 (monthly).
   * Cycle end date = cycleStartAt + cycleIntervalDays.
   */
  cycleIntervalDays: integer("cycle_interval_days").notNull().default(30),

  /**
   * Whether this plan is offered to new subscribers. Set to false to
   * retire a plan without breaking existing subscriptions.
   */
  isActive: boolean("is_active").notNull().default(true),

  /** Square Catalog subscription plan variation ID for auto-billing. */
  squareSubscriptionPlanId: varchar("square_subscription_plan_id", { length: 100 }),

  /** Order in which plans appear in the UI (ascending). */
  displayOrder: integer("display_order").notNull().default(0),

  /**
   * JSONB list of perk strings for the plan's feature list.
   * E.g. ["1 lash fill/month", "10% off all products", "Priority booking"]
   */
  perks: jsonb("perks").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* ------------------------------------------------------------------ */
/*  Membership Subscriptions                                           */
/* ------------------------------------------------------------------ */

export const membershipSubscriptions = pgTable(
  "membership_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** The client who holds this membership. */
    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    /** The plan this subscription is on. */
    planId: integer("plan_id")
      .notNull()
      .references(() => membershipPlans.id, { onDelete: "restrict" }),

    status: membershipStatusEnum("status").notNull().default("active"),

    /**
     * Fills remaining in the current billing cycle. Starts at
     * `plan.fillsPerCycle` when activated or renewed. Decremented by
     * `useMembershipFill()` when a qualifying appointment completes.
     * Never goes below zero.
     */
    fillsRemainingThisCycle: integer("fills_remaining_this_cycle").notNull(),

    /** Start of the current billing cycle. */
    cycleStartAt: timestamp("cycle_start_at", { withTimezone: true }).notNull(),

    /** End of the current billing cycle (cycleStartAt + plan.cycleIntervalDays). */
    cycleEndsAt: timestamp("cycle_ends_at", { withTimezone: true }).notNull(),

    /** Square Subscription ID for auto-billing. */
    squareSubscriptionId: varchar("square_subscription_id", { length: 100 }),

    /** When the subscription was cancelled (null if not cancelled). */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    /** When the subscription was paused (null if not paused). */
    pausedAt: timestamp("paused_at", { withTimezone: true }),

    /**
     * Internal notes — e.g. "Client paid via Venmo on 3/15",
     * "Paused at client request while travelling".
     */
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("mem_subs_client_idx").on(t.clientId),
    index("mem_subs_plan_idx").on(t.planId),
    index("mem_subs_status_idx").on(t.status),
    index("mem_subs_cycle_ends_idx").on(t.cycleEndsAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const membershipPlansRelations = relations(membershipPlans, ({ many }) => ({
  subscriptions: many(membershipSubscriptions),
}));

export const membershipSubscriptionsRelations = relations(membershipSubscriptions, ({ one }) => ({
  client: one(profiles, {
    fields: [membershipSubscriptions.clientId],
    references: [profiles.id],
  }),
  plan: one(membershipPlans, {
    fields: [membershipSubscriptions.planId],
    references: [membershipPlans.id],
  }),
}));
