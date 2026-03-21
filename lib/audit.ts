/**
 * lib/audit — Shared audit-log helper.
 *
 * Append-only trail of who did what and when. Called from server actions
 * after mutations. Non-fatal — audit failures never break the main flow.
 *
 * @example
 *   await logAction({
 *     actorId: user.id,
 *     action: "status_change",
 *     entityType: "booking",
 *     entityId: String(bookingId),
 *     description: "Booking status changed to completed",
 *     metadata: { old: "confirmed", new: "completed" },
 *   });
 */
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * Enumerated action verbs stored in the `action` column of `audit_log`.
 * Kept as a union type (not a Drizzle enum) so new actions can be added
 * without a DB migration — the column is a plain varchar.
 */
type AuditAction = "create" | "update" | "delete" | "status_change" | "login" | "export";

interface LogActionInput {
  /** User who performed the action (profiles.id UUID). Omit for system-initiated actions (cron jobs, webhooks). */
  actorId?: string | null;
  /** What kind of mutation occurred. */
  action: AuditAction;
  /** Table or domain the entity belongs to (e.g. "booking", "review", "profile"). */
  entityType: string;
  /** Primary key of the affected row, stringified. */
  entityId: string;
  /** Human-readable summary shown in the admin audit log viewer. */
  description?: string;
  /** Arbitrary JSON blob for before/after diffs, old/new status, etc. */
  metadata?: Record<string, unknown>;
}

/**
 * Write a single row to the `audit_log` table.
 *
 * Automatically captures the client's IP address (from `x-forwarded-for`
 * or `x-real-ip` headers) and user-agent string. When called outside a
 * request context (e.g. from a cron job), those fields are null.
 *
 * INSERTs into `audit_log` with columns: actorId, action, entityType,
 * entityId, description, metadata (JSONB), ipAddress, userAgent.
 *
 * Non-fatal — any error (DB down, missing columns, etc.) is sent to
 * Sentry but never propagated, so audit logging can never break a
 * user-facing mutation.
 *
 * @param input - The audit event details to record.
 */
export async function logAction(input: LogActionInput): Promise<void> {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    try {
      const h = await headers();
      ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
      userAgent = h.get("user-agent");
    } catch {
      // headers() unavailable outside request context (e.g. cron jobs)
    }

    await db.insert(auditLog).values({
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description ?? null,
      metadata: input.metadata ?? null,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    Sentry.captureException(err);
  }
}
