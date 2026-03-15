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
 *
 * Multi-location support: event_venues stores reusable venue records
 * (studio, pop-up venues, corporate offices, client homes) with address,
 * parking info, setup notes, and a default travel fee. Events reference
 * a saved venue via venueId, or use the free-text location/address fields
 * for one-off locations. Equipment needed for off-site events is tracked
 * in equipmentNotes.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
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

/**
 * Venue type — categorises saved event locations for display and filtering.
 * studio: The primary studio (default home base).
 * client_home: Event at a client's residence.
 * external_venue: General external venue (wedding halls, event spaces, etc.).
 * pop_up_venue: Mall kiosks, market stalls, pop-up locations.
 * corporate_venue: Office buildings, corporate campuses.
 */
export const venueTypeEnum = pgEnum("venue_type", [
  "studio",
  "client_home",
  "external_venue",
  "pop_up_venue",
  "corporate_venue",
]);

/** Event type — shown as a badge on the event card and used for filtering. */
export const eventTypeEnum = pgEnum("event_type", [
  "private_party",
  "pop_up",
  "corporate",
  "bridal",
  "birthday",
  "travel",
  "workshop",
]);

/** Event lifecycle status — separate from booking status. */
export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "upcoming",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);

/* ------------------------------------------------------------------ */
/*  Event venues — reusable saved locations                           */
/* ------------------------------------------------------------------ */

/**
 * Saved venue records that can be reused across multiple events.
 * Stores address, parking info, setup notes, and a default travel fee
 * so they don't need to be re-entered every time.
 */
export const eventVenues = pgTable("event_venues", {
  id: serial("id").primaryKey(),

  /** Display name for the venue (e.g. "Valley Fair Pop-up", "Main Studio"). */
  name: varchar("name", { length: 300 }).notNull(),

  /** Full street address for navigation. */
  address: text("address"),

  venueType: venueTypeEnum("venue_type").notNull().default("external_venue"),

  /** Parking instructions or lot/level info for off-site venues. */
  parkingInfo: text("parking_info"),

  /** Setup requirements, power needs, table layout notes, etc. */
  setupNotes: text("setup_notes"),

  /** Default travel fee in cents pre-filled when this venue is selected on an event. */
  defaultTravelFeeInCents: integer("default_travel_fee_in_cents"),

  /** Soft-delete: inactive venues are hidden from selectors but preserved for history. */
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

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

    /**
     * FK to a saved event_venues record.
     * When set, location/address are denormalized from the venue for display
     * and email templates. Null means a one-off free-text location.
     */
    venueId: integer("venue_id").references(() => eventVenues.id, { onDelete: "set null" }),

    /** Venue name or short label (e.g. "Trini's Studio", "Client's Home"). */
    location: varchar("location", { length: 500 }),

    /** Full street address for navigation and event logistics. */
    address: text("address"),

    /** Portable equipment to bring for off-site events (e.g. "jewelry station, ring display, extension cord"). */
    equipmentNotes: text("equipment_notes"),

    /* ------ Capacity & pricing ------ */

    /** Maximum number of attendees. */
    maxAttendees: integer("max_attendees"),

    /** Travel fee in cents (for off-site events). */
    travelFeeInCents: integer("travel_fee_in_cents"),

    /** Package price in cents for the event. */
    priceInCents: integer("price_in_cents"),

    /** Expected total revenue in cents (price + per-guest fees + add-ons). */
    expectedRevenueInCents: integer("expected_revenue_in_cents"),

    /** Deposit collected in cents. */
    depositInCents: integer("deposit_in_cents"),

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
/*  Event guests                                                       */
/* ------------------------------------------------------------------ */

export const eventGuests = pgTable(
  "event_guests",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    service: varchar("service", { length: 200 }),
    paid: boolean("paid").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("event_guests_event_idx").on(t.eventId)],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const eventsRelations = relations(events, ({ one, many }) => ({
  host: one(profiles, {
    fields: [events.hostId],
    references: [profiles.id],
    relationName: "eventHost",
  }),
  staff: one(profiles, {
    fields: [events.staffId],
    references: [profiles.id],
    relationName: "eventStaff",
  }),
  venue: one(eventVenues, {
    fields: [events.venueId],
    references: [eventVenues.id],
  }),
  guests: many(eventGuests),
}));

export const eventGuestsRelations = relations(eventGuests, ({ one }) => ({
  event: one(events, {
    fields: [eventGuests.eventId],
    references: [events.id],
  }),
}));

export const eventVenuesRelations = relations(eventVenues, ({ many }) => ({
  events: many(events),
}));
