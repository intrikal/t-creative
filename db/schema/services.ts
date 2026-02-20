/**
 * services — Service catalog and add-ons.
 *
 * Each service belongs to one of the four business zones (lash, jewelry,
 * crochet, consulting). Pricing is stored in cents to avoid floating-point
 * issues. Services can be soft-deleted via `isActive` for historical
 * booking integrity.
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
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { serviceCategoryEnum } from "./enums";

/* ------------------------------------------------------------------ */
/*  Services                                                           */
/* ------------------------------------------------------------------ */

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    category: serviceCategoryEnum("category").notNull(),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    /** Price in cents (e.g. 15000 = $150.00). Null = "Contact for quote". */
    priceInCents: integer("price_in_cents"),

    /** Estimated duration in minutes. Null = variable/TBD. */
    durationMinutes: integer("duration_minutes"),

    /** Display order within a category (lower = first). */
    sortOrder: integer("sort_order").notNull().default(0),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("services_category_idx").on(t.category),
    index("services_active_sort_idx").on(t.isActive, t.sortOrder),
  ],
);

/* ------------------------------------------------------------------ */
/*  Service Add-ons                                                    */
/* ------------------------------------------------------------------ */

/**
 * Optional add-ons that can be attached to a service at booking time
 * (e.g. "Lash removal" on a Classic Lash Set, "charm" on a bracelet).
 */
export const serviceAddOns = pgTable(
  "service_add_ons",
  {
    id: serial("id").primaryKey(),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    /** Price in cents. */
    priceInCents: integer("price_in_cents").notNull().default(0),

    /** Additional minutes added to the appointment. */
    additionalMinutes: integer("additional_minutes").notNull().default(0),

    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("add_ons_service_idx").on(t.serviceId)],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const servicesRelations = relations(services, ({ many }) => ({
  /** One-to-many: services.id → service_add_ons.service_id (optional extras for this service). */
  addOns: many(serviceAddOns),
  /** One-to-many: services.id → bookings.service_id (appointments booked for this service). */
  bookings: many(bookings),
}));

export const serviceAddOnsRelations = relations(serviceAddOns, ({ one }) => ({
  /** Many-to-one: service_add_ons.service_id → services.id (parent service). */
  service: one(services, {
    fields: [serviceAddOns.serviceId],
    references: [services.id],
  }),
}));
