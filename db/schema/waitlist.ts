/**
 * waitlist — Appointment waitlist for fully-booked timeslots.
 *
 * When a popular service or timeslot is full, clients can join the waitlist
 * and get notified when a spot opens. Essential for a solo/small-team studio
 * where high-demand slots (weekends, evenings) fill up fast.
 */
import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { waitlistStatusEnum } from "./enums";
import { services } from "./services";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Waitlist                                                           */
/* ------------------------------------------------------------------ */

export const waitlist = pgTable(
  "waitlist",
  {
    id: serial("id").primaryKey(),

    /** The client waiting for a spot. */
    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** The service they want to book. */
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),

    status: waitlistStatusEnum("status").notNull().default("waiting"),

    /** Earliest acceptable date. */
    preferredDateStart: date("preferred_date_start"),

    /** Latest acceptable date. */
    preferredDateEnd: date("preferred_date_end"),

    /** Free-text time preferences (e.g. "weekends only", "after 3pm"). */
    timePreference: text("time_preference"),

    /** Additional notes from the client. */
    notes: text("notes"),

    /** When the client was notified of an opening. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),

    /** The booking ID if they successfully booked from the waitlist. */
    bookedBookingId: integer("booked_booking_id"),

    /**
     * One-time claim token (UUID) included in the notification email link.
     * Allows the waitlisted client to self-book the specific opened slot
     * without logging in. Cleared after the slot is claimed or expires.
     */
    claimToken: varchar("claim_token", { length: 100 }).unique(),

    /** When the claim token expires (default: 24 hours after notification). */
    claimTokenExpiresAt: timestamp("claim_token_expires_at", { withTimezone: true }),

    /** The specific appointment slot offered to this waitlist entry. */
    offeredSlotStartsAt: timestamp("offered_slot_starts_at", { withTimezone: true }),

    /** Staff assigned to the offered slot (nullable — some services have no assigned staff). */
    offeredStaffId: uuid("offered_staff_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("waitlist_client_idx").on(t.clientId),
    index("waitlist_service_idx").on(t.serviceId),
    index("waitlist_status_idx").on(t.status),
    index("waitlist_dates_idx").on(t.preferredDateStart, t.preferredDateEnd),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const waitlistRelations = relations(waitlist, ({ one }) => ({
  /** Many-to-one: waitlist.client_id → profiles.id. */
  client: one(profiles, {
    fields: [waitlist.clientId],
    references: [profiles.id],
  }),
  /** Many-to-one: waitlist.service_id → services.id. */
  service: one(services, {
    fields: [waitlist.serviceId],
    references: [services.id],
  }),
}));
