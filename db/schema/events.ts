/**
 * events — Private events, pop-ups, and party packages.
 *
 * Covers lash parties, permanent jewelry pop-ups, corporate events,
 * bridal parties, birthdays, and other group events that Trini offers.
 *
 * The "Events" tab in the admin dashboard shows all events with filters
 * by type (Private Party, Pop-up, Corporate, Bridal, Birthday) and
 * status (Upcoming, Completed, Cancelled). Each event card displays
 * the title, type badge, date/time, location, guest count, and revenue.
 *
 * Admin actions: Create Event, Edit, Cancel, Mark Complete.
 */
import { relations } from "drizzle-orm";
import {
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
import { pgEnum } from "drizzle-orm/pg-core";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** Event type — shown as a badge on the event card and used for filtering. */
export const eventTypeEnum = pgEnum("event_type", [
  "private_party",
  "pop_up",
  "corporate",
  "bridal",
  "birthday",
]);

/** Event lifecycle status — separate from booking status. */
export const eventStatusEnum = pgEnum("event_status", [
  "upcoming",
  "in_progress",
  "completed",
  "cancelled",
]);

/* ------------------------------------------------------------------ */
/*  Events                                                             */
/* ------------------------------------------------------------------ */

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),

    /** The client hosting / requesting the event. */
    hostId: uuid("host_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    /** Staff member assigned to run this event (nullable). */
    staffId: uuid("staff_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    eventType: eventTypeEnum("event_type").notNull(),
    status: eventStatusEnum("status").notNull().default("upcoming"),

    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),

    /* ------ Date & time ------ */

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /* ------ Location ------ */

    /** Venue name or short label (e.g. "Trini's Studio", "Client's Home"). */
    location: varchar("location", { length: 500 }),

    /** Full street address for navigation and event logistics. */
    address: text("address"),

    /* ------ Capacity & pricing ------ */

    /** Maximum number of attendees. */
    maxAttendees: integer("max_attendees"),

    /** Travel fee in cents (for off-site events). */
    travelFeeInCents: integer("travel_fee_in_cents"),

    /** Package price in cents for the event. */
    priceInCents: integer("price_in_cents"),

    /** Expected total revenue in cents (price + per-guest fees + add-ons). */
    expectedRevenueInCents: integer("expected_revenue_in_cents"),

    /* ------ Contact info (may differ from host profile) ------ */

    /** Point of contact name for the event. */
    contactName: varchar("contact_name", { length: 200 }),

    /** Point of contact email. */
    contactEmail: varchar("contact_email", { length: 320 }),

    /** Point of contact phone number. */
    contactPhone: varchar("contact_phone", { length: 30 }),

    /* ------ Services & details ------ */

    /**
     * Comma-separated service tags offered at this event.
     * E.g. "Permanent Jewelry, Lash Extensions"
     * Displayed as pills on the event card.
     */
    services: text("services"),

    /**
     * Flexible metadata for event-specific details.
     * E.g. `{ "theme": "bachelorette", "addOns": ["champagne", "custom charms"] }`
     */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    /** Internal notes from staff. */
    internalNotes: text("internal_notes"),

    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("events_host_idx").on(t.hostId),
    index("events_staff_idx").on(t.staffId),
    index("events_type_idx").on(t.eventType),
    index("events_status_idx").on(t.status),
    index("events_starts_at_idx").on(t.startsAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const eventsRelations = relations(events, ({ one }) => ({
  /** Many-to-one: many events belong to one host (events.host_id → profiles.id). */
  host: one(profiles, {
    fields: [events.hostId],
    references: [profiles.id],
    relationName: "eventHost",
  }),
  /** Many-to-one: many events can be assigned to one staff member (events.staff_id → profiles.id, nullable). */
  staff: one(profiles, {
    fields: [events.staffId],
    references: [profiles.id],
    relationName: "eventStaff",
  }),
}));
