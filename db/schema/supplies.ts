/**
 * supplies — Service supplies and consumables tracking.
 *
 * Tracks materials consumed during services — lash glue, chains,
 * trays, cleanser, etc. The Marketplace "Supplies" tab shows stock
 * levels with reorder alerts. Not the same as products sold to clients.
 */
import { integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Supplies                                                           */
/* ------------------------------------------------------------------ */

export const supplies = pgTable("supplies", {
  id: serial("id").primaryKey(),

  /** Supply item name (e.g. "Lash Glue (Sensitive)", "14k Gold-Fill Chain"). */
  name: varchar("name", { length: 300 }).notNull(),

  /** Free-form category for grouping: "Lash", "Jewelry", "Aftercare", "Other". */
  category: varchar("category", { length: 100 }),

  /** Unit of measurement: "bottles", "trays", "rolls", "feet", "packs", etc. */
  unit: varchar("unit", { length: 50 }).notNull(),

  /** Current quantity in stock. */
  stockCount: integer("stock_count").notNull().default(0),

  /** Alert threshold — warn when stock falls to this level or below. */
  reorderPoint: integer("reorder_point").notNull().default(0),

  /** When stock was last replenished. */
  lastRestockedAt: timestamp("last_restocked_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
