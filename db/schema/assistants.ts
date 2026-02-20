/**
 * assistants — Staff profile extensions and shift tracking.
 *
 * Extends the base `profiles` table with assistant-specific data that
 * powers the Assistants management view in the admin dashboard. Rather
 * than bloating the profiles table with nullable columns that only apply
 * to staff, this is a separate 1:1 extension table.
 *
 * The Assistants view shows cards with: name, title (e.g. "Senior
 * Assistant"), specialties (service tags), clients assigned count,
 * bookings this month, next shift, average rating, and quick actions
 * (Message, Schedule, View Details).
 *
 * Shifts are tracked separately so Trini can schedule assistants
 * across different days/times and the system can display "Next Shift"
 * on the assistant card.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
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

/** Shift status for assistant scheduling. */
export const shiftStatusEnum = pgEnum("shift_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

/* ------------------------------------------------------------------ */
/*  Assistant Profiles                                                 */
/* ------------------------------------------------------------------ */

/**
 * 1:1 extension of `profiles` for users with role = "assistant".
 *
 * Created when Trini promotes a user to assistant or adds a new
 * staff member. The `profileId` is both the PK and FK to profiles.
 */
export const assistantProfiles = pgTable("assistant_profiles", {
  /** Maps 1:1 to `profiles.id`. */
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),

  /** Job title displayed on the assistant card (e.g. "Senior Assistant", "Lash Tech"). */
  title: varchar("title", { length: 200 }),

  /**
   * Comma-separated specialty tags matching service categories.
   * E.g. "Lash Extensions, Permanent Jewelry"
   * Displayed as pills on the assistant card.
   */
  specialties: text("specialties"),

  /** Short bio or description shown on the assistant detail view. */
  bio: text("bio"),

  /** Hourly rate in cents (for payroll tracking if needed). */
  hourlyRateInCents: integer("hourly_rate_in_cents"),

  /**
   * Cached average rating (0.00–5.00) from client reviews where this
   * assistant was the assigned staff. Recomputed in the app layer
   * whenever a new review is approved for one of their bookings.
   * Displayed as "4.9" on the assistant card.
   */
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }),

  /**
   * Whether this assistant is currently accepting new bookings.
   * When false, they won't appear in the staff assignment dropdown.
   * Shown as an "active"/"inactive" badge on the assistant card.
   */
  isAvailable: boolean("is_available").notNull().default(true),

  /**
   * When this assistant joined T Creative — used for tenure display
   * on the assistant detail view (e.g. "Member since Jan 2025").
   */
  startDate: timestamp("start_date", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* ------------------------------------------------------------------ */
/*  Shifts                                                             */
/* ------------------------------------------------------------------ */

/**
 * Scheduled shifts for assistants.
 *
 * Feeds the "Next Shift" display on the assistant card and the
 * Schedule action in the Assistants view. Shifts are distinct from
 * bookings — a shift is a work block, bookings happen within shifts.
 */
export const shifts = pgTable(
  "shifts",
  {
    id: serial("id").primaryKey(),

    /** The assistant working this shift — FK to profiles (not assistant_profiles). */
    assistantId: uuid("assistant_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** Shift lifecycle: scheduled → in_progress → completed / cancelled. */
    status: shiftStatusEnum("status").notNull().default("scheduled"),

    /** Shift start time — used to compute "Next Shift" on the assistant card. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Shift end time — determines the available work window for bookings. */
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** Location for this shift (e.g. "Main Studio", "Pop-up at Valley Fair"). */
    location: varchar("location", { length: 500 }),

    /** Notes for the shift (e.g. "Cover for Trini", "Event setup"). */
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("shifts_assistant_idx").on(t.assistantId),
    index("shifts_starts_at_idx").on(t.startsAt),
    index("shifts_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const assistantProfilesRelations = relations(assistantProfiles, ({ one, many }) => ({
  /** One-to-one: one assistant profile maps to one base profile (assistant_profiles.profile_id → profiles.id). */
  profile: one(profiles, {
    fields: [assistantProfiles.profileId],
    references: [profiles.id],
  }),
  /** One-to-many: one assistant has many shifts (shifts.assistant_id → assistant_profiles.profile_id). */
  shifts: many(shifts),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  /** Many-to-one: many shifts belong to one assistant (shifts.assistant_id → assistant_profiles.profile_id). */
  assistant: one(assistantProfiles, {
    fields: [shifts.assistantId],
    references: [assistantProfiles.profileId],
  }),
}));
