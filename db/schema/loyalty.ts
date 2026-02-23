/**
 * loyalty.ts — Points ledger for the T Creative loyalty program.
 *
 * ## Design: append-only transaction log
 * Every points event — earning, redemption, admin adjustment, or expiry — is
 * a separate row. The client's current balance is always derived as:
 *
 *   SELECT SUM(points) FROM loyalty_transactions WHERE profile_id = $id
 *
 * This design makes the history fully auditable, reversals trivial (insert a
 * negative row), and retroactive recalculations possible (replay the log).
 * It intentionally avoids a running-total column that could drift out of sync.
 *
 * ## Point sign convention
 * - Positive `points` — earned (profile_complete, first_booking, referral, etc.)
 * - Negative `points` — redeemed or expired
 * - Zero is never written (no-op rows waste space and break SUM semantics)
 *
 * ## Transaction types
 * `loyaltyTxTypeEnum` maps to the bonus event categories configurable in the
 * admin onboarding rewards step. Default point values (25 for profile_complete,
 * 50 for birthday_added, 100 for referral) are hardcoded in `actions.ts` and
 * displayed in `PanelRewards.tsx`. If admin config is eventually read at
 * runtime, those two files must be updated to match.
 *
 * ## referenceId
 * An optional FK to the entity that triggered the transaction:
 * - Booking UUID for booking-related types (first_booking, rebook, etc.)
 * - Referred client's profile UUID for referral rows
 * - null for standalone events (profile_complete, birthday_added)
 *
 * ## Related files
 * - db/schema/users.ts        — profiles table (profileId FK)
 * - app/onboarding/actions.ts — inserts initial earning rows on client onboarding
 * - app/client/page.tsx       — reads SUM to populate the dashboard points balance
 * - components/onboarding/panels/PanelRewards.tsx — displays the default point values
 */
import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enum                                                               */
/* ------------------------------------------------------------------ */

export const loyaltyTxTypeEnum = pgEnum("loyalty_tx_type", [
  // Earning events
  "profile_complete", // Client finishes onboarding
  "birthday_added", // Client adds birthday during onboarding
  "referral_referrer", // Existing client referred someone who signed up
  "referral_referee", // New client was referred by someone
  "first_booking", // Client completes their first booking
  "rebook", // Client books again within N days
  "review", // Client leaves a review
  "social_share", // Client shares on social
  "product_purchase", // Client buys a product
  "class_attendance", // Client attends a class/event
  "milestone_5th", // 5th booking milestone
  "milestone_10th", // 10th booking milestone
  "anniversary", // Account anniversary bonus
  "new_service", // Client tries a new service category
  // Redemption
  "redeemed", // Points redeemed toward a booking/product
  // Admin adjustments
  "manual_credit", // Admin manually added points
  "manual_debit", // Admin manually removed points
  "expired", // Points expired per program rules
]);

export type LoyaltyTxType = (typeof loyaltyTxTypeEnum.enumValues)[number];

/* ------------------------------------------------------------------ */
/*  Table                                                              */
/* ------------------------------------------------------------------ */

export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** The client whose balance is affected. */
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /**
     * Points delta — positive = earned, negative = redeemed/expired.
     * Never zero (zero-value rows have no effect and shouldn't be written).
     */
    points: integer("points").notNull(),

    /** What triggered this transaction. */
    type: loyaltyTxTypeEnum("type").notNull(),

    /**
     * Human-readable description shown in the client's points history.
     * E.g. "Referred by Alvin Quach" or "Completed onboarding".
     */
    description: text("description"),

    /**
     * Optional FK to the thing that triggered this transaction.
     * For bookings: the booking UUID. For referrals: the referred client's
     * profile UUID. Null for profile_complete / birthday_added.
     */
    referenceId: uuid("reference_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("loyalty_tx_profile_idx").on(t.profileId),
    index("loyalty_tx_type_idx").on(t.type),
    index("loyalty_tx_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  profile: one(profiles, {
    fields: [loyaltyTransactions.profileId],
    references: [profiles.id],
  }),
}));
