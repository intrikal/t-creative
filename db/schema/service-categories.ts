/**
 * service_categories — Lookup table for service categories.
 *
 * Provides admin-configurable category names, ordering, and active status.
 * The services.category column (pgEnum) maps to the `slug` column here.
 * Validation against this table is done at the application level.
 */
import { boolean, integer, pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const serviceCategories = pgTable("service_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});
