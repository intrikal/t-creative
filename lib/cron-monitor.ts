/**
 * lib/cron-monitor.ts — Wrapper for all Vercel cron route handlers.
 *
 * Usage:
 *   export async function GET(request: Request) {
 *     // ... auth check ...
 *     return withCronMonitoring("booking-reminders", async () => {
 *       const ids = await inngest.send({ name: "cron/booking-reminders", data: {} });
 *       return { recordsProcessed: ids.length };
 *     });
 *   }
 *
 * The wrapper:
 *  1. Adds a Sentry breadcrumb at start.
 *  2. Calls fn() and measures wall-clock duration.
 *  3. On success — writes an audit_log row (action: "export", entityType: "cron_success").
 *  4. On failure — captures the exception to Sentry with tag { cron: cronName },
 *     fires a Discord/Slack webhook if CRON_ALERT_WEBHOOK_URL is configured,
 *     writes an audit_log row (entityType: "cron_failure").
 *  5. Always returns NextResponse 200 so Vercel does not retry the trigger.
 *
 * @module lib/cron-monitor
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

// ─── Discord / Slack webhook ──────────────────────────────────────────────────

async function sendAlertWebhook(cronName: string, error: unknown): Promise<void> {
  const url = process.env.CRON_ALERT_WEBHOOK_URL;
  if (!url) return;

  const message = error instanceof Error ? error.message : String(error);
  const timestamp = new Date().toISOString();

  // Compatible with both Discord and Slack incoming webhooks.
  // Discord uses { content }, Slack uses { text }.
  const body = {
    content: `🚨 **Cron failure: \`${cronName}\`**\n\`\`\`${message}\`\`\`\n*${timestamp}*`,
    text: `🚨 Cron failure: \`${cronName}\`\n${message}\n${timestamp}`,
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Non-fatal — webhook delivery failure is not worth throwing over.
  }
}

// ─── Audit log helper (non-fatal) ────────────────────────────────────────────

async function writeCronAuditLog(
  cronName: string,
  outcome: "cron_success" | "cron_failure",
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: null,
      action: "export",
      entityType: outcome,
      entityId: cronName,
      description:
        outcome === "cron_success"
          ? `Cron job "${cronName}" completed successfully`
          : `Cron job "${cronName}" failed`,
      metadata,
    });
  } catch {
    // Never let audit logging break the response.
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Result returned by the cron function.
 * `recordsProcessed` is optional — pass it when the job processes a countable
 * number of rows (e.g. reminders sent, bookings created) so it's visible in
 * the audit log and the cron health dashboard.
 */
export type CronResult = { recordsProcessed?: number; [key: string]: unknown };

/**
 * Wrap a cron handler with monitoring, alerting, and audit logging.
 * Always returns HTTP 200 so Vercel's cron scheduler does not retry.
 */
export async function withCronMonitoring(
  cronName: string,
  fn: () => Promise<CronResult | void>,
): Promise<NextResponse> {
  const startedAt = Date.now();

  // 1. Sentry breadcrumb at start
  Sentry.addBreadcrumb({
    category: "cron",
    message: `Starting cron: ${cronName}`,
    level: "info",
    data: { cronName, startedAt: new Date(startedAt).toISOString() },
  });

  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;
    const recordsProcessed = (result as CronResult)?.recordsProcessed ?? 0;

    // 3. Success audit log
    await writeCronAuditLog(cronName, "cron_success", {
      durationMs,
      recordsProcessed,
      ...(result && typeof result === "object" ? result : {}),
    });

    return NextResponse.json({ ok: true, cronName, durationMs, recordsProcessed });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);

    // 4a. Sentry exception with cron tag
    Sentry.captureException(err, {
      tags: { cron: cronName },
      extra: { durationMs },
    });

    // 4b. Discord / Slack alert
    await sendAlertWebhook(cronName, err);

    // 4c. Failure audit log
    await writeCronAuditLog(cronName, "cron_failure", {
      durationMs,
      error: message,
    });

    // 5. Always return 200 to prevent Vercel retry storms
    return NextResponse.json({ ok: false, cronName, durationMs, error: message }, { status: 200 });
  }
}
