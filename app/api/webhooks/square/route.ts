/**
 * Square webhook route — signature verification, event storage, dispatch.
 *
 * Handlers for each event type live in ./handlers/. This file only does:
 * 1. Verify the webhook signature (HMAC-SHA256)
 * 2. Store the raw event in `webhook_events` for audit/replay
 * 3. Dispatch to the appropriate handler
 * 4. Log results to `sync_log`
 *
 * Always returns 200 to Square — failures are handled internally.
 *
 * @module api/webhooks/square
 */
import { createHmac } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { eq, and } from "drizzle-orm";
import type {
  PaymentCreatedEventData,
  PaymentUpdatedEventData,
  RefundCreatedEventData,
} from "square";
import { db } from "@/db";
import { webhookEvents, syncLog } from "@/db/schema";
import { sendAlert } from "@/lib/alert";
import { redis } from "@/lib/redis";
import { SQUARE_WEBHOOK_SIGNATURE_KEY } from "@/lib/square";
import { handlePaymentCompleted, handlePaymentUpdated } from "./handlers/payment";
import { handleRefundEvent } from "./handlers/refund";
import { handleInvoicePaymentMade } from "./handlers/invoice";
import { handleSubscriptionUpdated } from "./handlers/subscription";

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

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  const url = request.url;

  // Verify signature
  if (SQUARE_WEBHOOK_SIGNATURE_KEY && !verifySignature(body, signature, url)) {
    const failures = await redis.incr("webhook:sig_failures");
    if (failures === 1) {
      await redis.expire("webhook:sig_failures", 3600);
    }
    if (failures >= 5) {
      Sentry.captureMessage("Square webhook signature verification failing repeatedly", {
        level: "error",
        extra: { failures },
      });
      await sendAlert(
        `⚠️ Square webhook signature verification failing — ${failures} failures in the last hour. Possible key rotation. Check Square Dashboard → Webhooks → Signature Key.`,
      );
    }
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

  // Dispatch to handler
  let result = "Unhandled event type";
  let syncStatus: "success" | "failed" | "skipped" = "skipped";

  try {
    switch (eventType) {
      case "payment.completed":
        result = await handlePaymentCompleted(event.data as PaymentCreatedEventData | undefined);
        syncStatus = "success";
        break;
      case "payment.updated":
        result = await handlePaymentUpdated(event.data as PaymentUpdatedEventData | undefined);
        syncStatus = "success";
        break;
      case "refund.created":
      case "refund.updated":
        result = await handleRefundEvent(event.data as RefundCreatedEventData | undefined);
        syncStatus = "success";
        break;
      case "subscription.updated":
        result = await handleSubscriptionUpdated(event.data as Record<string, unknown> | undefined);
        syncStatus = "success";
        break;
      case "invoice.payment_made":
        result = await handleInvoicePaymentMade(event.data as Record<string, unknown> | undefined);
        syncStatus = "success";
        break;
      default:
        result = `Event type ${eventType} not handled`;
        syncStatus = "skipped";
    }

    await Promise.all([
      db
        .update(webhookEvents)
        .set({ isProcessed: true, processedAt: new Date() })
        .where(eq(webhookEvents.id, webhookRow.id)),
      redis.set("webhook:last_success", new Date().toISOString()),
    ]);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    syncStatus = "failed";
    result = errorMessage;

    Sentry.captureException(err);
    await db.update(webhookEvents).set({ errorMessage }).where(eq(webhookEvents.id, webhookRow.id));
  }

  // Log to sync_log
  await db.insert(syncLog).values({
    provider: "square",
    direction: "inbound",
    status: syncStatus,
    entityType: eventType.startsWith("refund")
      ? "refund"
      : eventType.startsWith("subscription")
        ? "subscription"
        : eventType.startsWith("invoice")
          ? "invoice"
          : "payment",
    remoteId: eventId,
    message: result,
  });

  return new Response("OK", { status: 200 });
}
