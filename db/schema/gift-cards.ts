/**
 * gift_cards — Prepaid gift cards sold by the studio.
 *
 * Each card has a unique code (TC-GC-001, …) and a balance that decrements
 * as it's redeemed against bookings. Cards can optionally expire.
 *
 * All monetary values are stored in cents to avoid floating-point errors.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { giftCardStatusEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Gift Cards                                                         */
/* ------------------------------------------------------------------ */

export const giftCards = pgTable(
  "gift_cards",
  {
    id: serial("id").primaryKey(),

    /** Unique card code, e.g. "TC-GC-001". */
    code: varchar("code", { length: 30 }).notNull(),

    /** Client who purchased the card (nullable for walk-in purchases). */
    purchasedByClientId: uuid("purchased_by_client_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    /** Name of the intended recipient. */
    recipientName: varchar("recipient_name", { length: 150 }),

    /** Original loaded value in cents. */
    originalAmountInCents: integer("original_amount_in_cents").notNull(),

    /** Remaining balance in cents (decremented on redemption). */
    balanceInCents: integer("balance_in_cents").notNull(),

    status: giftCardStatusEnum("status").notNull().default("active"),

    /** When the card was purchased. */
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),

    /** Optional expiration date. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("gift_cards_code_idx").on(t.code),
    index("gift_cards_purchased_by_idx").on(t.purchasedByClientId),
    index("gift_cards_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const giftCardsRelations = relations(giftCards, ({ one, many }) => ({
  /** Many-to-one: gift card purchased by one client (nullable for walk-ins). */
  purchasedBy: one(profiles, {
    fields: [giftCards.purchasedByClientId],
    references: [profiles.id],
  }),
  /** One-to-many: gift_cards.id → bookings.gift_card_id (bookings that redeemed this card). */
  bookings: many(bookings),
}));
