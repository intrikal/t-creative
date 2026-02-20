/**
 * integrations — External API sync tracking for Square and Zoho.
 *
 * Square handles: payments, appointment scheduling, SMS/text alerts,
 * rescheduling notifications, customer management, and receipts.
 *
 * Zoho CRM handles: contact management, project tracking, pipeline
 * deals, and activity logging for consulting engagements.
 *
 * This module provides:
 * 1. `sync_log` — An append-only audit trail of every inbound webhook
 *    and outbound sync operation. Critical for debugging integration
 *    failures and replaying missed events.
 * 2. `webhook_events` — Raw webhook payloads stored for reprocessing.
 *    Square and Zoho webhooks hit our API routes, which store the raw
 *    event here before processing.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** External platforms we integrate with. */
export const integrationProviderEnum = pgEnum("integration_provider", ["square", "zoho"]);

/** Direction of the sync operation. */
export const syncDirectionEnum = pgEnum("sync_direction", ["inbound", "outbound"]);

/** Outcome of a sync attempt. */
export const syncStatusEnum = pgEnum("sync_status", ["success", "failed", "skipped"]);

/* ------------------------------------------------------------------ */
/*  Sync Log                                                           */
/* ------------------------------------------------------------------ */

/**
 * Append-only log of every sync operation between our database and
 * external platforms. Used for debugging, audit trails, and retry logic.
 *
 * Examples:
 * - Inbound: Square webhook → update booking status
 * - Outbound: New client signup → create Square customer + Zoho contact
 */
export const syncLog = pgTable(
  "sync_log",
  {
    id: serial("id").primaryKey(),

    provider: integrationProviderEnum("provider").notNull(),
    direction: syncDirectionEnum("direction").notNull(),
    status: syncStatusEnum("status").notNull(),

    /** What entity was synced (e.g. "booking", "customer", "payment"). */
    entityType: varchar("entity_type", { length: 100 }).notNull(),

    /** Local record ID (our DB). */
    localId: varchar("local_id", { length: 100 }),

    /** Remote record ID (Square/Zoho). */
    remoteId: varchar("remote_id", { length: 100 }),

    /** Human-readable summary (e.g. "Updated booking #42 status to confirmed"). */
    message: text("message"),

    /** Error details on failure. */
    errorMessage: text("error_message"),

    /** Full request/response payload for debugging. */
    payload: jsonb("payload").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sync_log_provider_idx").on(t.provider),
    index("sync_log_entity_idx").on(t.entityType, t.localId),
    index("sync_log_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Webhook Events                                                     */
/* ------------------------------------------------------------------ */

/**
 * Raw webhook payloads from Square and Zoho.
 *
 * Stored before processing so we can:
 * 1. Replay failed events without waiting for the provider to resend.
 * 2. Debug payload shape changes after API version upgrades.
 * 3. Verify webhook signatures retroactively.
 *
 * Events are marked `processed` after successful handling. Failed
 * events can be retried via an admin action.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),

    provider: integrationProviderEnum("provider").notNull(),

    /** Provider's unique event ID (for idempotency). */
    externalEventId: varchar("external_event_id", { length: 200 }),

    /** Event type from the provider (e.g. "payment.completed", "booking.updated"). */
    eventType: varchar("event_type", { length: 200 }).notNull(),

    /** Raw JSON payload as received. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

    isProcessed: boolean("is_processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    /** Error message if processing failed. */
    errorMessage: text("error_message"),

    /** Number of processing attempts (for retry backoff). */
    attempts: integer("attempts").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhook_provider_idx").on(t.provider),
    index("webhook_event_type_idx").on(t.eventType),
    index("webhook_external_id_idx").on(t.externalEventId),
    index("webhook_unprocessed_idx").on(t.isProcessed),
  ],
);
