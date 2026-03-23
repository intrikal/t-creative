/**
 * Square webhook route — signature verification, event storage, enqueue to Inngest.
 *
 * Runs as a Node.js serverless function. Heavy processing is delegated to
 * Inngest so this route returns 200 to Square in < 1s regardless of load.
 *
 * Flow:
 * 1. Verify the webhook signature (HMAC-SHA256)
 * 2. Idempotency check via `webhook_events` table
 * 3. Store the raw event in `webhook_events`
 * 4. Enqueue `square/webhook.received` to Inngest for async processing
 * 5. Return 200 immediately — Inngest runs handlers, marks processed, writes sync_log
 *
 * Always returns 200 to Square after storage — failures surface in Inngest.
 *
 * @module api/webhooks/square
 */
export const maxDuration = 10;

import { createHmac } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { withRequestLogger } from "@/lib/middleware/request-logger";
import { SQUARE_WEBHOOK_SIGNATURE_KEY } from "@/lib/square";

/* ------------------------------------------------------------------ */
/*  Signature verification                                             */
/* ------------------------------------------------------------------ */

function verifySignature(body: string, signature: string, url: string): boolean {
  if (!SQUARE_WEBHOOK_SIGNATURE_KEY) return false;

  const hmac = createHmac("sha256", SQUARE_WEBHOOK_SIGNATURE_KEY);
  hmac.update(url + body);
  const expected = hmac.digest("base64");

  return expected === signature;
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export const POST = withRequestLogger(async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  const url = request.url;

  // Verify signature
  if (SQUARE_WEBHOOK_SIGNATURE_KEY && !verifySignature(body, signature, url)) {
    return new Response("Invalid signature", { status: 403 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventId = (event.event_id as string) ?? null;
  const eventType = (event.type as string) ?? "unknown";

  // Idempotency check
  if (eventId) {
    const [existing] = await db
      .select({ id: webhookEvents.id, isProcessed: webhookEvents.isProcessed })
      .from(webhookEvents)
      .where(and(eq(webhookEvents.provider, "square"), eq(webhookEvents.externalEventId, eventId)));

    if (existing?.isProcessed) {
      return new Response("Already processed", { status: 200 });
    }
  }

  // Store raw event
  const [webhookRow] = await db
    .insert(webhookEvents)
    .values({
      provider: "square",
      externalEventId: eventId,
      eventType,
      payload: event as Record<string, unknown>,
      isProcessed: false,
      attempts: 1,
    })
    .returning({ id: webhookEvents.id });

  if (!webhookRow) {
    return new Response("DB error", { status: 500 });
  }

  // Enqueue to Inngest for async processing
  await inngest.send({
    name: "square/webhook.received",
    data: {
      webhookRowId: webhookRow.id,
      eventType,
      eventId,
      payload: event,
    },
  });

  return new Response("OK", { status: 200 });
});
