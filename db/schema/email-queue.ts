/**
 * email-queue — Fallback queue for emails that cannot be sent immediately
 * because the Resend daily rate limit has been reached.
 *
 * The queue is drained the following day by the `cron/email-queue-drain`
 * Inngest function. Rows are kept for 30 days for audit purposes.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const emailQueueStatusEnum = pgEnum("email_queue_status", ["pending", "sent", "failed"]);

export const emailQueue = pgTable(
  "email_queue",
  {
    id: serial("id").primaryKey(),

    /** Recipient address. */
    to: varchar("to", { length: 320 }).notNull(),

    subject: varchar("subject", { length: 500 }).notNull(),

    /** Serialised HTML body — stored because React elements can't be persisted. */
    html: text("html").notNull(),

    /** From header — snapshot of the sender at queue time. */
    from: varchar("from", { length: 320 }).notNull(),

    /** Forwarded from sendEmail() params for sync_log tracing. */
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    localId: varchar("local_id", { length: 100 }).notNull(),

    status: emailQueueStatusEnum("status").notNull().default("pending"),

    /** Populated after a successful drain send. */
    resendId: varchar("resend_id", { length: 100 }),

    /** Error detail if the drain attempt failed. */
    errorMessage: text("error_message"),

    /** Number of drain attempts so far. */
    attempts: integer("attempts").notNull().default(0),

    /** ISO timestamp of when the original send was attempted and rate-limited. */
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),

    /** When the drain worker processed this row. */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("email_queue_status_idx").on(t.status),
    index("email_queue_queued_idx").on(t.queuedAt),
  ],
);

/** Companion jsonb for optional extra headers (replyTo, etc). */
export type EmailQueueMeta = {
  replyTo?: string;
};
