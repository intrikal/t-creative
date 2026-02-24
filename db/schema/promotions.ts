/**
 * promotions — Discount codes and promotional offers.
 *
 * Supports percentage-off, fixed-dollar, and buy-one-get-one mechanics.
 * Each promo has an optional usage cap (`maxUses`) and date window.
 * `redemptionCount` is incremented server-side on each use.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { discountTypeEnum, serviceCategoryEnum } from "./enums";

/* ------------------------------------------------------------------ */
/*  Promotions                                                         */
/* ------------------------------------------------------------------ */

export const promotions = pgTable(
  "promotions",
  {
    id: serial("id").primaryKey(),

    /** Unique promo code, e.g. "NEWCLIENT20". */
    code: varchar("code", { length: 50 }).notNull(),

    discountType: discountTypeEnum("discount_type").notNull(),

    /**
     * Discount magnitude:
     * - `percent` → whole number (e.g. 20 = 20%)
     * - `fixed`   → amount in cents (e.g. 1500 = $15.00)
     * - `bogo`    → ignored (buy-one-get-one)
     */
    discountValue: integer("discount_value").notNull(),

    description: text("description"),

    /** Which service category this promo applies to (null = all). */
    appliesTo: serviceCategoryEnum("applies_to"),

    /** Max allowed redemptions (null = unlimited). */
    maxUses: integer("max_uses"),

    /** How many times this code has been redeemed. */
    redemptionCount: integer("redemption_count").notNull().default(0),

    isActive: boolean("is_active").notNull().default(true),

    /** Optional promotion window. */
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("promotions_code_idx").on(t.code),
    index("promotions_active_idx").on(t.isActive),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const promotionsRelations = relations(promotions, ({ many }) => ({
  /** One-to-many: promotions.id → bookings.promotion_id (bookings that used this promo). */
  bookings: many(bookings),
}));
