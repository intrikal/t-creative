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
import { headers } from "next/headers";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

type AuditAction = "create" | "update" | "delete" | "status_change" | "login" | "export";

interface LogActionInput {
  /** User who performed the action. Omit for system-initiated actions. */
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit log entry. Captures IP and user-agent from request headers
 * automatically. Non-fatal — catches and logs errors.
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
    console.error("[audit] Failed to log action:", err);
  }
}
