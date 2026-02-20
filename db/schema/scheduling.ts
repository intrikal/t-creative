/**
 * scheduling — Business hours, time-off, and booking rules.
 *
 * Controls when clients can book appointments. The booking flow checks
 * these tables to determine available slots:
 *
 * 1. `business_hours` — Weekly recurring schedule (Mon–Sun open/close times).
 * 2. `time_off` — One-off blocked dates (day off) and date ranges (vacation).
 * 3. `booking_rules` — Buffer times, cancellation policy, and scheduling
 *    constraints. Singleton row — only one active rule set at a time.
 *
 * These are local to our app. When Square Bookings is integrated, these
 * records sync to Square's availability API so both systems agree on
 * when Trini is available.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** Type of time-off entry. */
export const timeOffTypeEnum = pgEnum("time_off_type", ["day_off", "vacation"]);

/* ------------------------------------------------------------------ */
/*  Business Hours                                                     */
/* ------------------------------------------------------------------ */

/**
 * Weekly recurring availability per staff member.
 *
 * One row per day-of-week per staff member. `dayOfWeek` uses ISO 8601:
 * 1 = Monday, 7 = Sunday.
 *
 * When `isOpen` is false, the day is closed regardless of start/end times.
 * This matches the "Open / Closed" toggle per day in the settings UI.
 */
export const businessHours = pgTable(
  "business_hours",
  {
    id: serial("id").primaryKey(),

    /** Staff member this schedule belongs to. Null = studio-wide default. */
    staffId: uuid("staff_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),

    /** ISO day of week: 1 (Monday) through 7 (Sunday). */
    dayOfWeek: smallint("day_of_week").notNull(),

    isOpen: boolean("is_open").notNull().default(true),

    /** Opening time (e.g. "09:00"). Null if closed. */
    opensAt: time("opens_at"),

    /** Closing time (e.g. "17:00"). Null if closed. */
    closesAt: time("closes_at"),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("business_hours_staff_day_idx").on(t.staffId, t.dayOfWeek)],
);

/* ------------------------------------------------------------------ */
/*  Time Off                                                           */
/* ------------------------------------------------------------------ */

/**
 * Blocked dates and vacation ranges.
 *
 * Single days have `startDate === endDate`. Multi-day vacations span
 * the full range. The calendar UI renders these as orange (day off)
 * or blue (vacation) blocks.
 *
 * Bookings cannot be created for dates that overlap any time-off entry
 * for the assigned staff member (or the studio default).
 */
export const timeOff = pgTable(
  "time_off",
  {
    id: serial("id").primaryKey(),

    /** Staff member. Null = studio-wide closure. */
    staffId: uuid("staff_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),

    type: timeOffTypeEnum("type").notNull(),

    /** First blocked date (inclusive). */
    startDate: date("start_date").notNull(),

    /** Last blocked date (inclusive). Same as startDate for single days. */
    endDate: date("end_date").notNull(),

    /** Optional label (e.g. "Hawaii trip", "Dentist appointment"). */
    label: varchar("label", { length: 200 }),

    /** Internal notes. */
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("time_off_staff_idx").on(t.staffId),
    index("time_off_dates_idx").on(t.startDate, t.endDate),
  ],
);

/* ------------------------------------------------------------------ */
/*  Booking Rules                                                      */
/* ------------------------------------------------------------------ */

/**
 * Scheduling constraints and cancellation policy.
 *
 * Singleton table — only one active row. Controls:
 * - Buffer times between appointments
 * - Lead time before first / after last appointment
 * - Cancellation notice requirements and fees
 *
 * These values are enforced both in the booking flow UI and in the
 * API layer when creating/modifying bookings.
 */
export const bookingRules = pgTable("booking_rules", {
  id: serial("id").primaryKey(),

  /* ------ Time buffers ------ */

  /** Minutes required between consecutive bookings (e.g. 15). */
  bufferBetweenMinutes: integer("buffer_between_minutes").notNull().default(15),

  /** Minutes before opening to block (prep time). */
  bufferBeforeFirstMinutes: integer("buffer_before_first_minutes").notNull().default(0),

  /** Minutes after closing to block (cleanup time). */
  bufferAfterLastMinutes: integer("buffer_after_last_minutes").notNull().default(0),

  /* ------ Cancellation policy ------ */

  /** Whether clients must cancel at least N hours in advance. */
  requireAdvanceNotice: boolean("require_advance_notice").notNull().default(true),

  /** Minimum hours of notice required for cancellation (e.g. 24). */
  advanceNoticeHours: integer("advance_notice_hours").notNull().default(24),

  /** Whether same-day cancellations are permitted. */
  allowSameDayCancellation: boolean("allow_same_day_cancellation").notNull().default(false),

  /** Late cancellation fee as a percentage of service cost (e.g. 50 = 50%). */
  lateCancelFeePercent: integer("late_cancel_fee_percent").notNull().default(50),

  /** No-show fee as a percentage of service cost (e.g. 100 = 100%). */
  noShowFeePercent: integer("no_show_fee_percent").notNull().default(100),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const businessHoursRelations = relations(businessHours, ({ one }) => ({
  /** Many-to-one: many hour entries belong to one staff member (business_hours.staff_id → profiles.id, nullable for studio default). */
  staff: one(profiles, {
    fields: [businessHours.staffId],
    references: [profiles.id],
  }),
}));

export const timeOffRelations = relations(timeOff, ({ one }) => ({
  /** Many-to-one: many time-off entries belong to one staff member (time_off.staff_id → profiles.id, nullable for studio-wide). */
  staff: one(profiles, {
    fields: [timeOff.staffId],
    references: [profiles.id],
  }),
}));
