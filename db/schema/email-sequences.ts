/**
 * email_sequences — Automated email drip sequences for lifecycle marketing.
 *
 * Three tables:
 * - `email_sequences` — sequence definition with trigger event and active flag
 * - `email_sequence_steps` — ordered steps with delay and email content
 * - `email_sequence_enrollments` — tracks client progress through a sequence
 *
 * Trigger events fire auto-enrollment when the corresponding lifecycle event
 * occurs (e.g. first booking completed, 30-day no-visit). The daily
 * `cron/email-sequences` Inngest function advances enrollments through steps.
 *
 * @see {@link inngest/functions/email-sequences.ts} — cron processor
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** Events that trigger auto-enrollment into a sequence. */
export const sequenceTriggerEnum = pgEnum("sequence_trigger", [
  "first_booking_completed",
  "no_visit_30_days",
  "no_visit_60_days",
  "membership_cancelled",
  "new_client_signup",
]);

/** Enrollment lifecycle status. */
export const seqEnrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "completed",
  "cancelled",
]);

/* ------------------------------------------------------------------ */
/*  Email Sequences                                                    */
/* ------------------------------------------------------------------ */

export const emailSequences = pgTable(
  "email_sequences",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    /** Which lifecycle event triggers auto-enrollment. */
    triggerEvent: sequenceTriggerEnum("trigger_event").notNull(),
    /** Only active sequences accept new enrollments and process steps. */
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("email_sequences_trigger_idx").on(t.triggerEvent),
    index("email_sequences_active_idx").on(t.isActive),
  ],
);

/* ------------------------------------------------------------------ */
/*  Sequence Steps                                                     */
/* ------------------------------------------------------------------ */

export const emailSequenceSteps = pgTable(
  "email_sequence_steps",
  {
    id: serial("id").primaryKey(),
    sequenceId: integer("sequence_id")
      .notNull()
      .references(() => emailSequences.id, { onDelete: "cascade" }),
    /** Order within the sequence (1-based). */
    stepOrder: integer("step_order").notNull(),
    /** Days to wait after the previous step (or after enrollment for step 1). */
    delayDays: integer("delay_days").notNull().default(0),
    /** Email subject line (supports {{firstName}} placeholder). */
    subject: varchar("subject", { length: 500 }).notNull(),
    /** Email body — plain text or HTML. Supports {{firstName}}, {{businessName}}. */
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_seq_steps_sequence_idx").on(t.sequenceId),
    unique("email_seq_steps_order_unq").on(t.sequenceId, t.stepOrder),
  ],
);

/* ------------------------------------------------------------------ */
/*  Enrollments                                                        */
/* ------------------------------------------------------------------ */

export const emailSequenceEnrollments = pgTable(
  "email_sequence_enrollments",
  {
    id: serial("id").primaryKey(),
    sequenceId: integer("sequence_id")
      .notNull()
      .references(() => emailSequences.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Which step was last sent (0 = enrolled but no step sent yet). */
    currentStep: integer("current_step").notNull().default(0),
    status: seqEnrollmentStatusEnum("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    /** When the last step was sent — used to calculate delay for next step. */
    lastStepSentAt: timestamp("last_step_sent_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    index("email_seq_enroll_sequence_idx").on(t.sequenceId),
    index("email_seq_enroll_profile_idx").on(t.profileId),
    index("email_seq_enroll_status_idx").on(t.status),
    // Deduplication constraint defined in migration SQL as partial unique index:
    // CREATE UNIQUE INDEX ... ON (sequence_id, profile_id) WHERE status = 'active'
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const emailSequencesRelations = relations(emailSequences, ({ many }) => ({
  steps: many(emailSequenceSteps),
  enrollments: many(emailSequenceEnrollments),
}));

export const emailSequenceStepsRelations = relations(emailSequenceSteps, ({ one }) => ({
  sequence: one(emailSequences, {
    fields: [emailSequenceSteps.sequenceId],
    references: [emailSequences.id],
  }),
}));

export const emailSequenceEnrollmentsRelations = relations(emailSequenceEnrollments, ({ one }) => ({
  sequence: one(emailSequences, {
    fields: [emailSequenceEnrollments.sequenceId],
    references: [emailSequences.id],
  }),
  profile: one(profiles, {
    fields: [emailSequenceEnrollments.profileId],
    references: [profiles.id],
  }),
}));
