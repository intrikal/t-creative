/**
 * audit_log — System-wide audit trail.
 *
 * Records who did what and when across the system. With admin, assistant,
 * and client roles all touching data, this is essential for troubleshooting
 * disputes ("I never cancelled that booking") and accountability.
 *
 * Append-only — rows are never updated or deleted.
 */
import { index, jsonb, pgTable, serial, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { auditActionEnum } from "./enums";

/* ------------------------------------------------------------------ */
/*  Audit Log                                                          */
/* ------------------------------------------------------------------ */

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),

    /**
     * The user who performed the action.
     * Nullable for system-initiated actions (webhooks, cron jobs).
     * Not a FK — we want to keep audit rows even if the user is deleted.
     */
    actorId: uuid("actor_id"),

    /** High-level action category. */
    action: auditActionEnum("action").notNull(),

    /** The entity type that was acted on (e.g. "booking", "payment", "profile"). */
    entityType: varchar("entity_type", { length: 50 }).notNull(),

    /** The entity ID that was acted on (string to support both int and UUID PKs). */
    entityId: varchar("entity_id", { length: 100 }).notNull(),

    /** Human-readable description of what happened. */
    description: text("description"),

    /**
     * Snapshot of changed fields.
     * Shape: `{ field: { old: value, new: value } }` for updates,
     * or full entity snapshot for creates/deletes.
     */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    /** IP address of the request (for security auditing). */
    ipAddress: varchar("ip_address", { length: 45 }),

    /** User-agent string (for identifying device/browser). */
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_actor_idx").on(t.actorId),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_action_idx").on(t.action),
    index("audit_log_created_idx").on(t.createdAt),
  ],
);
