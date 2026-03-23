/**
 * Inngest function — Email queue drain.
 *
 * Runs once per day (triggered by cron/email-queue-drain) and sends any
 * emails that were queued because the Resend daily limit was reached.
 * Processes up to 90 pending rows per run (safe under free-tier 100/day).
 */
import * as Sentry from "@sentry/nextjs";
import { and, eq, lt, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { emailQueue, syncLog } from "@/db/schema";
import { isResendConfigured } from "@/lib/resend";
import { withRetry } from "@/lib/retry";
import { inngest } from "../client";

/** Max emails to drain per run. Keep well under the daily limit. */
const BATCH_SIZE = 90;

export const emailQueueDrain = inngest.createFunction(
  { id: "email-queue-drain", retries: 2, triggers: [{ event: "cron/email-queue-drain" }] },
  async ({ step }) => {
    if (!isResendConfigured()) {
      return { ok: false, reason: "Resend not configured" };
    }

    const pending = await step.run("fetch-pending", async () => {
      return db
        .select()
        .from(emailQueue)
        .where(eq(emailQueue.status, "pending"))
        .orderBy(emailQueue.queuedAt)
        .limit(BATCH_SIZE);
    });

    if (pending.length === 0) {
      return { ok: true, sent: 0, failed: 0 };
    }

    const apiKey = process.env.RESEND_API_KEY!;
    const resend = new Resend(apiKey);
    let sent = 0;
    let failed = 0;

    for (const row of pending) {
      await step.run(`send-queued-${row.id}`, async () => {
        try {
          const { data, error } = await withRetry(
            async () => {
              const result = await resend.emails.send({
                from: row.from,
                to: row.to,
                subject: row.subject,
                html: row.html,
              });
              if (result.error) {
                const err = Object.assign(new Error(result.error.message), {
                  statusCode: (result.error as { statusCode?: number }).statusCode,
                });
                throw err;
              }
              return result;
            },
            { label: `email-queue-drain:${row.id}` },
          );

          await db
            .update(emailQueue)
            .set({
              status: "sent",
              resendId: data?.id ?? null,
              processedAt: new Date(),
              attempts: sql`${emailQueue.attempts} + 1`,
            })
            .where(eq(emailQueue.id, row.id));

          await db.insert(syncLog).values({
            provider: "resend",
            direction: "outbound",
            status: "success",
            entityType: row.entityType,
            localId: row.localId,
            remoteId: data?.id ?? null,
            message: `Queue drain: sent ${row.entityType} to ${row.to}`,
            payload: { queueId: row.id, resendId: data?.id },
          });

          sent++;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          Sentry.captureException(err, { extra: { queueId: row.id, to: row.to } });

          await db
            .update(emailQueue)
            .set({
              status: "failed",
              errorMessage,
              processedAt: new Date(),
              attempts: sql`${emailQueue.attempts} + 1`,
            })
            .where(eq(emailQueue.id, row.id));

          await db.insert(syncLog).values({
            provider: "resend",
            direction: "outbound",
            status: "failed",
            entityType: row.entityType,
            localId: row.localId,
            message: `Queue drain: failed to send ${row.entityType} to ${row.to}`,
            errorMessage,
          });

          failed++;
        }
      });
    }

    return { ok: true, sent, failed, total: pending.length };
  },
);
