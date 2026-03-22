/**
 * locations — Physical studio locations for multi-location support.
 *
 * Each location represents a physical studio (e.g. "San Jose Studio",
 * "Palo Alto Pop-up"). All location-scoped tables (bookings, business_hours,
 * time_off, shifts, booking_rules) reference this table via location_id FK.
 *
 * The first location is seeded from the current BusinessProfile settings
 * on migration so all existing data gets tagged automatically.
 *
 * Square integration: each location maps to a Square location_id so
 * orders, payments, and catalog items route to the correct Square dashboard.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Locations                                                          */
/* ------------------------------------------------------------------ */

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),

    /** Display name (e.g. "San Jose Studio", "Palo Alto Pop-up"). */
    name: varchar("name", { length: 200 }).notNull(),

    /** Full street address. */
    address: text("address"),

    /** City, state, zip for display. */
    city: varchar("city", { length: 200 }),

    /** IANA timezone (e.g. "America/Los_Angeles"). */
    timezone: varchar("timezone", { length: 100 }).notNull().default("America/Los_Angeles"),

    /** Location phone number. */
    phone: varchar("phone", { length: 50 }),

    /** Location email. */
    email: varchar("email", { length: 200 }),

    /** Square Location ID — routes orders/payments to the correct Square dashboard. */
    squareLocationId: varchar("square_location_id", { length: 100 }),

    /** Whether this location accepts new bookings. */
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("locations_active_idx").on(t.isActive),
    index("locations_square_idx").on(t.squareLocationId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const locationsRelations = relations(locations, () => ({
  // Relations defined in referencing tables (bookings, business_hours, etc.)
}));
