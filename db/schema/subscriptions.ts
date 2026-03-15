/**
 * booking_subscriptions — Pre-paid session packages for recurring clients.
 *
 * A subscription is a contract for N sessions at a fixed interval
 * (e.g. "6 lash fills, every 3 weeks"). The booking system auto-generates
 * the next appointment when one is marked completed, decrementing
 * sessionsUsed until the package is exhausted.
 *
 * Relationship to bookings:
 * - bookings.subscriptionId → booking_subscriptions.id
 * - When a subscription booking completes, generateNextRecurringBooking
 *   checks sessionsUsed against totalSessions and auto-creates the next.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subscriptionStatusEnum } from "./enums";
import { services } from "./services";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Booking Subscriptions                                              */
/* ------------------------------------------------------------------ */

export const bookingSubscriptions = pgTable(
  "booking_subscriptions",
  {
    id: serial("id").primaryKey(),

    /** The client who purchased this package. */
    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    /** The service this package applies to. */
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),

    /** Display name for this package (e.g. "6-fill package", "Monthly lash plan"). */
    name: varchar("name", { length: 200 }).notNull(),

    /** Total sessions included in the package. */
    totalSessions: integer("total_sessions").notNull(),

    /** Sessions completed so far. Incremented on each booking completion. */
    sessionsUsed: integer("sessions_used").notNull().default(0),

    /**
     * Days between appointments (e.g. 14 = every 2 weeks, 21 = every 3 weeks).
     * Used to auto-schedule the next booking after each completion.
     */
    intervalDays: integer("interval_days").notNull(),

    /** Price per session in cents (snapshotted at package creation time). */
    pricePerSessionInCents: integer("price_per_session_in_cents").notNull(),

    /** Total amount the client paid for this package in cents. */
    totalPaidInCents: integer("total_paid_in_cents").notNull(),

    status: subscriptionStatusEnum("status").notNull().default("active"),

    /** Internal notes (e.g. "client prepaid via Venmo, receipt #123"). */
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("subs_client_idx").on(t.clientId),
    index("subs_service_idx").on(t.serviceId),
    index("subs_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const bookingSubscriptionsRelations = relations(bookingSubscriptions, ({ one }) => ({
  client: one(profiles, {
    fields: [bookingSubscriptions.clientId],
    references: [profiles.id],
  }),
  service: one(services, {
    fields: [bookingSubscriptions.serviceId],
    references: [services.id],
  }),
}));
