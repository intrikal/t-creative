/**
 * webhook-actions — Admin actions for viewing and retrying webhook events.
 *
 * Provides read-only listing of webhook events (with status filtering) and
 * a retry action that resets a failed row and re-sends the Inngest event.
 * All functions require admin auth.
 *
 * @module settings/webhook-actions
 * @see {@link ./components/WebhookEventsTab.tsx} — UI consuming these actions
 * @see {@link @/inngest/functions/square-webhook.ts} — Inngest processor
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { and, desc, eq, gt, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { logAction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/types/action-result";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WebhookEventRow {
  id: number;
  provider: string;
  externalEventId: string | null;
  eventType: string;
  isProcessed: boolean;
  attempts: number;
  errorMessage: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

export interface WebhookEventDetail extends WebhookEventRow {
  payload: Record<string, unknown>;
}

type StatusFilter = "all" | "failed" | "pending";

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

const getEventsSchema = z.object({
  status: z.enum(["all", "failed", "pending"]).optional().default("all"),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const idSchema = z.number().int().positive();

/* ------------------------------------------------------------------ */
/*  getWebhookEvents                                                   */
/* ------------------------------------------------------------------ */

export async function getWebhookEvents(opts?: {
  status?: StatusFilter;
  limit?: number;
}): Promise<WebhookEventRow[]> {
  await requireAdmin();
  const { status, limit } = getEventsSchema.parse(opts ?? {});

  const conditions = [];
  if (status === "failed") {
    conditions.push(eq(webhookEvents.isProcessed, false), gt(webhookEvents.attempts, 1));
  } else if (status === "pending") {
    conditions.push(eq(webhookEvents.isProcessed, false), lte(webhookEvents.attempts, 1));
  }

  const rows = await db
    .select({
      id: webhookEvents.id,
      provider: webhookEvents.provider,
      externalEventId: webhookEvents.externalEventId,
      eventType: webhookEvents.eventType,
      isProcessed: webhookEvents.isProcessed,
      attempts: webhookEvents.attempts,
      errorMessage: webhookEvents.errorMessage,
      createdAt: webhookEvents.createdAt,
      processedAt: webhookEvents.processedAt,
    })
    .from(webhookEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(webhookEvents.createdAt))
    .limit(limit);

  return rows;
}

/* ------------------------------------------------------------------ */
/*  getWebhookEventDetail                                              */
/* ------------------------------------------------------------------ */

export async function getWebhookEventDetail(id: number): Promise<WebhookEventDetail | null> {
  await requireAdmin();
  idSchema.parse(id);

  const [row] = await db
    .select({
      id: webhookEvents.id,
      provider: webhookEvents.provider,
      externalEventId: webhookEvents.externalEventId,
      eventType: webhookEvents.eventType,
      isProcessed: webhookEvents.isProcessed,
      attempts: webhookEvents.attempts,
      errorMessage: webhookEvents.errorMessage,
      createdAt: webhookEvents.createdAt,
      processedAt: webhookEvents.processedAt,
      payload: webhookEvents.payload,
    })
    .from(webhookEvents)
    .where(eq(webhookEvents.id, id))
    .limit(1);

  return row ?? null;
}

/* ------------------------------------------------------------------ */
/*  retryWebhookEvent                                                  */
/* ------------------------------------------------------------------ */

export async function retryWebhookEvent(id: number): Promise<ActionResult<void>> {
  try {
    const user = await requireAdmin();
    idSchema.parse(id);

    const [row] = await db
      .select({
        id: webhookEvents.id,
        eventType: webhookEvents.eventType,
        externalEventId: webhookEvents.externalEventId,
        payload: webhookEvents.payload,
      })
      .from(webhookEvents)
      .where(eq(webhookEvents.id, id))
      .limit(1);

    if (!row) {
      return { success: false, error: "Webhook event not found" };
    }

    await db
      .update(webhookEvents)
      .set({ isProcessed: false, attempts: 1, errorMessage: null, processedAt: null })
      .where(eq(webhookEvents.id, id));

    await inngest.send({
      name: "square/webhook.received",
      data: {
        webhookRowId: row.id,
        eventType: row.eventType,
        eventId: row.externalEventId,
        payload: row.payload,
      },
    });

    await logAction({
      actorId: user.id,
      action: "update",
      entityType: "webhook_event",
      entityId: String(id),
      description: `Retried webhook event (type: ${row.eventType})`,
    });

    revalidatePath("/dashboard/settings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to retry webhook event";
    return { success: false, error: message };
  }
}
