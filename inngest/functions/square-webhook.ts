/**
 * square-webhook — Inngest function that processes Square webhook events.
 *
 * Triggered by `square/webhook.received` events sent from the Edge webhook
 * route. Runs in Node.js runtime so all existing handlers, Drizzle, Sentry,
 * and other Node.js-only dependencies work unchanged.
 *
 * Steps:
 * 1. dispatch-handler  — call the appropriate domain handler
 * 2. mark-processed    — update webhook_events.is_processed
 * 3. write-sync-log    — append to sync_log for audit trail
 */
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import type {
  PaymentCreatedEventData,
  PaymentUpdatedEventData,
  RefundCreatedEventData,
} from "square";
import { db } from "@/db";
import { webhookEvents, syncLog } from "@/db/schema";
import { inngest } from "../client";
import { handlePaymentCompleted, handlePaymentUpdated } from "@/app/api/webhooks/square/handlers/payment";
import { handleRefundEvent } from "@/app/api/webhooks/square/handlers/refund";
import { handleInvoicePaymentMade } from "@/app/api/webhooks/square/handlers/invoice";
import { handleSubscriptionUpdated } from "@/app/api/webhooks/square/handlers/subscription";
import { handleGiftCardActivity } from "@/app/api/webhooks/square/handlers/gift-card";

export const squareWebhook = inngest.createFunction(
  {
    id: "square-webhook-processor",
    retries: 3,
    triggers: [{ event: "square/webhook.received" }],
  },
  async ({ event, step }) => {
    const { webhookRowId, eventType, eventId, payload } = event.data as {
      webhookRowId: number;
      eventType: string;
      eventId: string | null;
      payload: Record<string, unknown>;
    };

    let result = "Unhandled event type";
    let syncStatus: "success" | "failed" | "skipped" = "skipped";

    try {
      const dispatched = await step.run("dispatch-handler", async () => {
        switch (eventType) {
          case "payment.completed":
            return {
              result: await handlePaymentCompleted(payload.data as PaymentCreatedEventData | undefined),
              status: "success" as const,
            };
          case "payment.updated":
            return {
              result: await handlePaymentUpdated(payload.data as PaymentUpdatedEventData | undefined),
              status: "success" as const,
            };
          case "refund.created":
          case "refund.updated":
            return {
              result: await handleRefundEvent(payload.data as RefundCreatedEventData | undefined),
              status: "success" as const,
            };
          case "subscription.updated":
            return {
              result: await handleSubscriptionUpdated(payload.data as Record<string, unknown> | undefined),
              status: "success" as const,
            };
          case "invoice.payment_made":
            return {
              result: await handleInvoicePaymentMade(payload.data as Record<string, unknown> | undefined),
              status: "success" as const,
            };
          case "gift_card.activity.created":
            return {
              result: await handleGiftCardActivity(payload.data as Record<string, unknown> | undefined),
              status: "success" as const,
            };
          default:
            return {
              result: `Event type ${eventType} not handled`,
              status: "skipped" as const,
            };
        }
      });

      result = dispatched.result;
      syncStatus = dispatched.status;

      await step.run("mark-processed", () =>
        db
          .update(webhookEvents)
          .set({ isProcessed: true, processedAt: new Date() })
          .where(eq(webhookEvents.id, webhookRowId)),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      syncStatus = "failed";
      result = errorMessage;

      Sentry.captureException(err);
      await db
        .update(webhookEvents)
        .set({ errorMessage })
        .where(eq(webhookEvents.id, webhookRowId));
    }

    await step.run("write-sync-log", () =>
      db.insert(syncLog).values({
        provider: "square",
        direction: "inbound",
        status: syncStatus,
        entityType: eventType.startsWith("refund")
          ? "refund"
          : eventType.startsWith("subscription")
            ? "subscription"
            : eventType.startsWith("invoice")
              ? "invoice"
              : eventType.startsWith("gift_card")
                ? "gift_card"
                : "payment",
        remoteId: eventId,
        message: result,
      }),
    );

    return { result, syncStatus };
  },
);
