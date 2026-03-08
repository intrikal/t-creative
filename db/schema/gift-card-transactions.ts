/**
 * gift_card_transactions — Redemption and balance history for gift cards.
 *
 * Append-only ledger that tracks every balance change on a gift card:
 * initial purchase, each partial redemption, refunds, and manual adjustments.
 * Without this, there's no way to see which bookings drew down a card's balance.
 */
import { relations } from "drizzle-orm";
import { index, integer, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { giftCardTxTypeEnum } from "./enums";
import { giftCards } from "./gift-cards";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Gift Card Transactions                                             */
/* ------------------------------------------------------------------ */

export const giftCardTransactions = pgTable(
  "gift_card_transactions",
  {
    id: serial("id").primaryKey(),

    /** The gift card this transaction applies to. */
    giftCardId: integer("gift_card_id")
      .notNull()
      .references(() => giftCards.id, { onDelete: "cascade" }),

    /** Transaction type. */
    type: giftCardTxTypeEnum("type").notNull(),

    /**
     * Amount in cents. Positive for credits (purchase, refund),
     * negative for debits (redemption).
     */
    amountInCents: integer("amount_in_cents").notNull(),

    /** Running balance after this transaction, in cents. */
    balanceAfterInCents: integer("balance_after_in_cents").notNull(),

    /** The booking this redemption was applied to (nullable). */
    bookingId: integer("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),

    /** Who initiated this transaction (staff for adjustments, null for system). */
    performedBy: uuid("performed_by").references(() => profiles.id, {
      onDelete: "set null",
    }),

    /** Notes (e.g. reason for adjustment). */
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("gift_card_tx_card_idx").on(t.giftCardId),
    index("gift_card_tx_type_idx").on(t.type),
    index("gift_card_tx_booking_idx").on(t.bookingId),
    index("gift_card_tx_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const giftCardTransactionsRelations = relations(giftCardTransactions, ({ one }) => ({
  /** Many-to-one: gift_card_transactions.gift_card_id → gift_cards.id. */
  giftCard: one(giftCards, {
    fields: [giftCardTransactions.giftCardId],
    references: [giftCards.id],
  }),
  /** Many-to-one: gift_card_transactions.booking_id → bookings.id (nullable). */
  booking: one(bookings, {
    fields: [giftCardTransactions.bookingId],
    references: [bookings.id],
  }),
  /** Many-to-one: gift_card_transactions.performed_by → profiles.id (nullable). */
  performer: one(profiles, {
    fields: [giftCardTransactions.performedBy],
    references: [profiles.id],
  }),
}));
