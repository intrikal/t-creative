/**
 * EasyPost webhook handler — receives tracking status updates.
 *
 * EasyPost sends POST requests here when tracking events occur
 * (e.g. in_transit, out_for_delivery, delivered). This route:
 * 1. Verifies the webhook signature
 * 2. Stores the raw event in `webhook_events` for audit/replay
 * 3. Updates order tracking status and sends notification emails
 * 4. Logs results to `sync_log`
 *
 * Always returns 200 to EasyPost — failures are handled internally.
 *
 * @module api/webhooks/easypost
 */
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { orders, profiles, webhookEvents, syncLog } from "@/db/schema";
import { OrderShipped } from "@/emails/OrderShipped";
import { logAction } from "@/lib/audit";
import { verifyEasyPostWebhook } from "@/lib/easypost";
import { sendEmail } from "@/lib/resend";

/* ------------------------------------------------------------------ */
/*  EasyPost tracking status → order status mapping                    */
/* ------------------------------------------------------------------ */

type OrderStatus = "in_progress" | "shipped" | "completed";

function mapTrackingStatus(epStatus: string): OrderStatus | null {
  switch (epStatus) {
    case "in_transit":
    case "out_for_delivery":
      return "shipped";
    case "delivered":
      return "completed";
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();

  // EasyPost sends the signature in the x-hmac-signature header
  const signature = request.headers.get("x-hmac-signature") ?? "";

  if (!verifyEasyPostWebhook(body, signature)) {
    return new Response("Invalid signature", { status: 403 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventId = (event.id as string) ?? null;
  const eventDescription = (event.description as string) ?? "unknown";

  // Idempotency check
  if (eventId) {
    const [existing] = await db
      .select({ id: webhookEvents.id, isProcessed: webhookEvents.isProcessed })
      .from(webhookEvents)
      .where(eq(webhookEvents.externalEventId, eventId));

    if (existing?.isProcessed) {
      return new Response("Already processed", { status: 200 });
    }
  }

  // Store raw event
  const [webhookRow] = await db
    .insert(webhookEvents)
    .values({
      provider: "easypost",
      externalEventId: eventId,
      eventType: eventDescription,
      payload: event,
      isProcessed: false,
      attempts: 1,
    })
    .returning({ id: webhookEvents.id });

  let result = "Unhandled event";
  let syncStatus: "success" | "failed" | "skipped" = "skipped";

  try {
    const eventResult = event.result as Record<string, unknown> | undefined;

    if (eventDescription.startsWith("tracker.")) {
      const trackingCode = eventResult?.tracking_code as string | undefined;
      const status = eventResult?.status as string | undefined;
      const publicUrl = eventResult?.public_url as string | undefined;

      if (trackingCode && status) {
        // Find order by tracking number
        const [order] = await db
          .select({
            id: orders.id,
            clientId: orders.clientId,
            orderNumber: orders.orderNumber,
            title: orders.title,
            status: orders.status,
          })
          .from(orders)
          .where(eq(orders.trackingNumber, trackingCode));

        if (order) {
          const newStatus = mapTrackingStatus(status);

          if (newStatus && newStatus !== order.status) {
            await db
              .update(orders)
              .set({
                status: newStatus,
                ...(publicUrl ? { trackingUrl: publicUrl } : {}),
                ...(newStatus === "completed" ? { completedAt: new Date() } : {}),
              })
              .where(eq(orders.id, order.id));

            // Send shipping notification email on first "shipped" status
            if (newStatus === "shipped" && order.status !== "shipped" && order.clientId) {
              try {
                const [client] = await db
                  .select({ email: profiles.email, firstName: profiles.firstName })
                  .from(profiles)
                  .where(eq(profiles.id, order.clientId));

                if (client?.email) {
                  const bp = await getPublicBusinessProfile();
                  await sendEmail({
                    to: client.email,
                    subject: `Your order ${order.orderNumber} has shipped — ${bp.businessName}`,
                    react: OrderShipped({
                      clientName: client.firstName,
                      orderNumber: order.orderNumber,
                      productTitle: order.title,
                      trackingNumber: trackingCode,
                      trackingUrl: publicUrl ?? "",
                      businessName: bp.businessName,
                    }),
                    entityType: "order_shipped",
                    localId: String(order.id),
                  });
                }
              } catch (emailErr) {
                Sentry.captureException(emailErr);
              }
            }

            await logAction({
              actorId: null,
              action: "status_change",
              entityType: "order",
              entityId: String(order.id),
              description: `Order #${order.id} tracking status: ${status} → order status: ${newStatus}`,
              metadata: { trackingCode, easypostStatus: status, newStatus },
            });

            result = `Updated order #${order.id} to ${newStatus} (tracking: ${status})`;
          } else {
            result = `Tracking update for order #${order.id}: ${status} (no status change needed)`;
          }
          syncStatus = "success";
        } else {
          result = `No order found for tracking code: ${trackingCode}`;
          syncStatus = "skipped";
        }
      } else {
        result = "Missing tracking_code or status in event";
        syncStatus = "skipped";
      }
    } else {
      result = `Event type ${eventDescription} not handled`;
      syncStatus = "skipped";
    }

    // Mark processed
    await db
      .update(webhookEvents)
      .set({ isProcessed: true, processedAt: new Date() })
      .where(eq(webhookEvents.id, webhookRow.id));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    syncStatus = "failed";
    result = errorMessage;

    Sentry.captureException(err);
    await db.update(webhookEvents).set({ errorMessage }).where(eq(webhookEvents.id, webhookRow.id));
  }

  // Log to sync_log
  await db.insert(syncLog).values({
    provider: "easypost",
    direction: "inbound",
    status: syncStatus,
    entityType: "tracking",
    remoteId: eventId,
    message: result,
  });

  return new Response("OK", { status: 200 });
}
