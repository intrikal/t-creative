/**
 * Square webhook handler — receives payment and refund events.
 *
 * Square sends POST requests here when payments are completed, updated,
 * or refunded on the Terminal. This route:
 * 1. Verifies the webhook signature (HMAC-SHA256)
 * 2. Stores the raw event in `webhook_events` for audit/replay
 * 3. Processes supported event types (payment.*, refund.*)
 * 4. Logs results to `sync_log`
 *
 * Always returns 200 to Square — failures are handled internally via
 * the `attempts` and `errorMessage` fields on `webhook_events`.
 *
 * Sales tax calculation is delegated to Square — this handler only
 * captures the tax amount Square reports (`taxMoney`) and stores it
 * in `payments.taxAmountInCents`.
 *
 * @module api/webhooks/square
 */
import { createHmac } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { eq, and, sql } from "drizzle-orm";
import type {
  Payment,
  PaymentRefund,
  Tender,
  PaymentCreatedEventData,
  PaymentUpdatedEventData,
  RefundCreatedEventData,
} from "square";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import {
  payments,
  bookings,
  orders,
  profiles,
  webhookEvents,
  syncLog,
  loyaltyTransactions,
} from "@/db/schema";
import { LoyaltyPointsAwarded } from "@/emails/LoyaltyPointsAwarded";
import { PaymentReceipt } from "@/emails/PaymentReceipt";
import { sendAlert } from "@/lib/alert";
import { logAction } from "@/lib/audit";
import { buyShippingLabel, isEasyPostConfigured } from "@/lib/easypost";
import { redis } from "@/lib/redis";
import { sendEmail } from "@/lib/resend";
import { SQUARE_WEBHOOK_SIGNATURE_KEY, squareClient, isSquareConfigured } from "@/lib/square";
import { recordZohoBooksPayment } from "@/lib/zoho-books";

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
/*  Square tender type → our payment method enum                       */
/* ------------------------------------------------------------------ */

type PaymentMethod =
  | "square_card"
  | "square_cash"
  | "square_wallet"
  | "square_gift_card"
  | "square_other";

function mapTenderType(tenderType?: string): PaymentMethod {
  switch (tenderType) {
    case "CARD":
      return "square_card";
    case "CASH":
      return "square_cash";
    case "WALLET":
      return "square_wallet";
    case "SQUARE_GIFT_CARD":
      return "square_gift_card";
    default:
      return "square_other";
  }
}

/* ------------------------------------------------------------------ */
/*  Event processors                                                   */
/* ------------------------------------------------------------------ */

// Square webhook payments may include fields not present in the SDK's Payment type:
// - `tenders`: Terminal payments still populate it for payment method detection.
// - `taxMoney`: Sales tax collected. Tax calculation is handled by Square, not this app.
interface SquareWebhookPayment extends Payment {
  tenders?: Tender[];
  taxMoney?: { amount?: bigint; currency?: string };
}

async function handlePaymentCompleted(data: PaymentCreatedEventData | undefined): Promise<string> {
  const squarePayment = data?.object?.payment as SquareWebhookPayment | undefined;
  if (!squarePayment?.id) return "No payment ID in event";

  const squarePaymentId = squarePayment.id as string;
  const squareOrderId = squarePayment.orderId ?? null;

  // 1. Check if we already have this payment by squarePaymentId
  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.squarePaymentId, squarePaymentId));

  if (existing) {
    await db
      .update(payments)
      .set({
        status: "paid",
        paidAt: squarePayment.updatedAt ? new Date(squarePayment.updatedAt) : new Date(),
        squareReceiptUrl: squarePayment.receiptUrl ?? null,
        squareOrderId: squareOrderId,
        taxAmountInCents: Number(squarePayment.taxMoney?.amount ?? 0),
      })
      .where(eq(payments.id, existing.id));

    await logAction({
      actorId: null,
      action: "update",
      entityType: "payment",
      entityId: String(existing.id),
      description: "Payment updated via Square webhook",
      metadata: { squarePaymentId, squareOrderId },
    });

    return `Updated existing payment #${existing.id}`;
  }

  // 2. Try order-based booking lookup
  const booking = await findBookingByOrder(squareOrderId);

  if (booking) {
    const amountCents = Number(squarePayment.amountMoney?.amount ?? 0);
    const tenders = squarePayment.tenders;
    const method = tenders?.[0]?.type ? mapTenderType(tenders[0].type) : "square_other";
    const tipCents = Number(squarePayment.tipMoney?.amount ?? 0);
    /** Sales tax collected by Square for this transaction (cents). */
    const taxCents = Number(squarePayment.taxMoney?.amount ?? 0);

    // Determine if this is a deposit payment.
    // Primary: Square order metadata.paymentType (set when payment link is created).
    // Fallback: payment note string for payments created before metadata was added.
    const note = squarePayment.note;
    const isDeposit = booking.squareOrderType
      ? booking.squareOrderType === "deposit"
      : (note?.includes("(deposit)") ?? false);

    await db.insert(payments).values({
      bookingId: booking.id,
      clientId: booking.clientId,
      amountInCents: amountCents,
      tipInCents: tipCents,
      taxAmountInCents: taxCents,
      method,
      status: "paid",
      paidAt: new Date(),
      squarePaymentId,
      squareOrderId,
      squareReceiptUrl: squarePayment.receiptUrl ?? null,
      notes: isDeposit ? "Deposit collected via Square" : "Auto-linked via Square order",
      needsManualReview: booking.needsManualReview ?? false,
    });

    // Update deposit tracking on the booking if this is a deposit payment
    if (isDeposit) {
      await db
        .update(bookings)
        .set({
          depositPaidInCents: amountCents,
          depositPaidAt: new Date(),
        })
        .where(eq(bookings.id, booking.id));
    }

    // Award first_booking loyalty points (non-fatal, idempotent).
    try {
      await awardFirstBookingPoints(booking.clientId, booking.id);
    } catch (err) {
      Sentry.captureException(err);
    }

    // Send payment receipt email (non-fatal)
    const [bookingClient] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, booking.clientId));

    if (bookingClient?.email) {
      const bp = await getPublicBusinessProfile();
      await sendEmail({
        to: bookingClient.email,
        subject: `Payment receipt — ${bp.businessName}`,
        react: PaymentReceipt({
          clientName: bookingClient.firstName,
          amountInCents: amountCents,
          method: method.replace("square_", "").replace("_", " "),
          receiptUrl: squarePayment.receiptUrl ?? undefined,
          description: isDeposit ? "Deposit payment" : "Appointment payment",
          businessName: bp.businessName,
        }),
        entityType: "payment_receipt",
        localId: String(booking.id),
      });
    }

    // Zoho Books: record payment against invoice
    const [bookingForInvoice] = await db
      .select({ zohoInvoiceId: bookings.zohoInvoiceId })
      .from(bookings)
      .where(eq(bookings.id, booking.id));

    if (bookingForInvoice?.zohoInvoiceId) {
      recordZohoBooksPayment({
        zohoInvoiceId: bookingForInvoice.zohoInvoiceId,
        amountInCents: amountCents,
        squarePaymentId,
        description: isDeposit ? "Deposit via Square" : "Payment via Square",
      });
    }

    await logAction({
      actorId: null,
      action: "create",
      entityType: "payment",
      entityId: String(booking.id),
      description: `Payment auto-linked to booking #${booking.id}${isDeposit ? " (deposit)" : ""} via Square webhook`,
      metadata: { squarePaymentId, squareOrderId, amountCents, method, bookingId: booking.id },
    });

    return `Auto-linked payment to booking #${booking.id}${isDeposit ? " (deposit)" : ""}`;
  }

  // 3. Try product order lookup
  const productOrder = await findProductOrderBySquareOrder(squareOrderId);
  if (productOrder) {
    await db.update(orders).set({ status: "in_progress" }).where(eq(orders.id, productOrder.id));

    // Buy shipping label for shipping orders
    const isShippingOrder =
      productOrder.fulfillmentMethod === "ship_standard" ||
      productOrder.fulfillmentMethod === "ship_express";

    if (isShippingOrder && productOrder.easypostShipmentId && isEasyPostConfigured()) {
      try {
        // Fetch the shipment to get the cheapest or selected rate
        const { easypostClient } = await import("@/lib/easypost");
        const shipment = await easypostClient!.Shipment.retrieve(productOrder.easypostShipmentId);
        const rates = shipment.rates ?? [];

        // Pick the rate — for express use the fastest, for standard use the cheapest
        const sorted =
          productOrder.fulfillmentMethod === "ship_express"
            ? [...rates].sort((a, b) => (a.delivery_days ?? 99) - (b.delivery_days ?? 99))
            : [...rates].sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));

        const bestRate = sorted[0];
        if (bestRate) {
          const label = await buyShippingLabel(productOrder.easypostShipmentId, bestRate.id);

          await db
            .update(orders)
            .set({
              trackingNumber: label.trackingNumber,
              trackingUrl: label.trackingUrl,
              shippingLabelUrl: label.labelUrl,
            })
            .where(eq(orders.id, productOrder.id));

          await db.insert(syncLog).values({
            provider: "easypost",
            direction: "outbound",
            status: "success",
            entityType: "shipping_label",
            localId: String(productOrder.id),
            remoteId: productOrder.easypostShipmentId,
            message: `Purchased ${label.carrier} ${label.service} label for order #${productOrder.id}`,
            payload: { trackingNumber: label.trackingNumber, carrier: label.carrier },
          });
        }
      } catch (labelErr) {
        Sentry.captureException(labelErr);
        const msg = labelErr instanceof Error ? labelErr.message : "Failed to buy shipping label";
        await db.insert(syncLog).values({
          provider: "easypost",
          direction: "outbound",
          status: "failed",
          entityType: "shipping_label",
          localId: String(productOrder.id),
          message: "Failed to purchase shipping label after payment",
          errorMessage: msg,
        });
      }
    }

    // Send payment receipt email (non-fatal)
    const [orderClient] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, productOrder.clientId));

    if (orderClient?.email) {
      const bp = await getPublicBusinessProfile();
      await sendEmail({
        to: orderClient.email,
        subject: `Payment received for your order — ${bp.businessName}`,
        react: PaymentReceipt({
          clientName: orderClient.firstName,
          amountInCents: Number(squarePayment.amountMoney?.amount ?? 0),
          method: "card",
          receiptUrl: squarePayment.receiptUrl ?? undefined,
          description: "Order payment",
          businessName: bp.businessName,
        }),
        entityType: "payment_receipt",
        localId: String(productOrder.id),
      });
    }

    // Zoho Books: record payment against order invoice
    const [orderForInvoice] = await db
      .select({ zohoInvoiceId: orders.zohoInvoiceId })
      .from(orders)
      .where(eq(orders.id, productOrder.id));

    if (orderForInvoice?.zohoInvoiceId) {
      recordZohoBooksPayment({
        zohoInvoiceId: orderForInvoice.zohoInvoiceId,
        amountInCents: Number(squarePayment.amountMoney?.amount ?? 0),
        squarePaymentId,
        description: "Order payment via Square",
      });
    }

    await logAction({
      actorId: null,
      action: "create",
      entityType: "payment",
      entityId: String(productOrder.id),
      description: `Payment auto-linked to product order #${productOrder.id} via Square webhook`,
      metadata: { squarePaymentId, squareOrderId, orderId: productOrder.id },
    });

    return `Auto-linked payment to product order #${productOrder.id}`;
  }

  // 4. No match — log for manual linking
  await db.insert(syncLog).values({
    provider: "square",
    direction: "inbound",
    status: "skipped",
    entityType: "payment",
    remoteId: squarePaymentId,
    message: "Payment received but no matching booking or order found — needs manual linking",
    payload: { squarePaymentId, squareOrderId, amount: squarePayment.amountMoney },
  });

  return "No matching booking or order — logged for manual linking";
}

/**
 * Fetches a Square order with retries for the known race condition where
 * terminal webhook events fire before order metadata has fully propagated.
 *
 * Retries up to 3 times with 2-second exponential backoff (2 s → 4 s → 8 s).
 * Returns whatever data was resolved; `metadataMissing` is true when neither
 * `metadata` nor `referenceId` could be read after all attempts.
 */
async function fetchSquareOrderWithRetry(squareOrderId: string): Promise<{
  paymentType?: string;
  referenceId?: string;
  metadataMissing: boolean;
}> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt - 1)));
    }

    try {
      const resp = await squareClient.orders.get({ orderId: squareOrderId });
      const order = resp.order;

      // If the order carries any identifying data, consider metadata resolved.
      if (order?.metadata || order?.referenceId) {
        return {
          paymentType: order.metadata?.paymentType as string | undefined,
          referenceId: order.referenceId ?? undefined,
          metadataMissing: false,
        };
      }
    } catch {
      // API call failed — will retry on next iteration
    }
  }

  // All retries exhausted without resolving metadata
  Sentry.captureMessage(
    `Square order metadata not resolved after ${MAX_RETRIES} retries — flagging for manual review`,
    { level: "warning", extra: { squareOrderId } },
  );

  return { metadataMissing: true };
}

/**
 * Finds a booking by its Square order ID. Tries two strategies:
 * 1. Direct DB lookup on bookings.squareOrderId
 * 2. Fetch the Square order and use its referenceId (= booking ID)
 *
 * Uses {@link fetchSquareOrderWithRetry} to handle the ~8 % race condition
 * where Square's terminal webhook fires before order metadata propagates.
 */
async function findBookingByOrder(
  squareOrderId: string | null,
): Promise<{
  id: number;
  clientId: string;
  squareOrderType?: string;
  needsManualReview?: boolean;
} | null> {
  if (!squareOrderId) return null;

  // Strategy 1: direct DB lookup
  const [byOrder] = await db
    .select({ id: bookings.id, clientId: bookings.clientId })
    .from(bookings)
    .where(eq(bookings.squareOrderId, squareOrderId));

  if (byOrder) {
    // Fetch order metadata to reliably determine payment type (deposit vs balance)
    if (isSquareConfigured()) {
      const orderData = await fetchSquareOrderWithRetry(squareOrderId);
      return {
        ...byOrder,
        squareOrderType: orderData.paymentType,
        needsManualReview: orderData.metadataMissing,
      };
    }
    return byOrder;
  }

  // Strategy 2: fetch order from Square API, use referenceId
  if (isSquareConfigured()) {
    const orderData = await fetchSquareOrderWithRetry(squareOrderId);
    if (orderData.referenceId) {
      const bookingId = parseInt(orderData.referenceId, 10);
      if (!isNaN(bookingId)) {
        const [byRef] = await db
          .select({ id: bookings.id, clientId: bookings.clientId })
          .from(bookings)
          .where(eq(bookings.id, bookingId));
        if (byRef) {
          return {
            ...byRef,
            squareOrderType: orderData.paymentType,
            needsManualReview: orderData.metadataMissing,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Finds a product order by its Square order ID.
 */
async function findProductOrderBySquareOrder(squareOrderId: string | null): Promise<{
  id: number;
  clientId: string;
  fulfillmentMethod: string | null;
  easypostShipmentId: string | null;
} | null> {
  if (!squareOrderId) return null;

  const [row] = await db
    .select({
      id: orders.id,
      clientId: orders.clientId,
      fulfillmentMethod: orders.fulfillmentMethod,
      easypostShipmentId: orders.easypostShipmentId,
    })
    .from(orders)
    .where(eq(orders.squareOrderId, squareOrderId));

  return row ?? null;
}

async function handlePaymentUpdated(data: PaymentUpdatedEventData | undefined): Promise<string> {
  const squarePayment = data?.object?.payment as SquareWebhookPayment | undefined;
  if (!squarePayment?.id) return "No payment ID in event";

  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.squarePaymentId, squarePayment.id));

  if (!existing) return "No matching local payment found";

  const tenders = squarePayment.tenders;
  const method = tenders?.[0]?.type ? mapTenderType(tenders[0].type) : undefined;

  const taxCents =
    squarePayment.taxMoney?.amount != null ? Number(squarePayment.taxMoney.amount) : undefined;

  await db
    .update(payments)
    .set({
      squareReceiptUrl: squarePayment.receiptUrl ?? undefined,
      squareOrderId: squarePayment.orderId ?? undefined,
      ...(method ? { method } : {}),
      ...(taxCents != null ? { taxAmountInCents: taxCents } : {}),
    })
    .where(eq(payments.id, existing.id));

  await logAction({
    actorId: null,
    action: "update",
    entityType: "payment",
    entityId: String(existing.id),
    description: `Payment #${existing.id} updated via Square webhook`,
    metadata: { squarePaymentId: squarePayment.id },
  });

  return `Updated payment #${existing.id}`;
}

async function handleRefundEvent(data: RefundCreatedEventData | undefined): Promise<string> {
  const refund = data?.object?.refund as PaymentRefund | undefined;
  if (!refund?.paymentId) return "No payment ID in refund event";

  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.squarePaymentId, refund.paymentId as string));

  if (!existing) return "No matching local payment for refund";

  const refundAmountCents = Number(refund.amountMoney?.amount ?? 0);
  const newRefundedTotal = existing.refundedInCents + refundAmountCents;
  const isFullRefund = newRefundedTotal >= existing.amountInCents;

  await db
    .update(payments)
    .set({
      refundedInCents: newRefundedTotal,
      refundedAt: new Date(),
      status: isFullRefund ? "refunded" : "partially_refunded",
    })
    .where(eq(payments.id, existing.id));

  await logAction({
    actorId: null,
    action: "update",
    entityType: "payment",
    entityId: String(existing.id),
    description: `Refund of $${(refundAmountCents / 100).toFixed(2)} applied via Square webhook`,
    metadata: { refundAmountCents, isFullRefund, squarePaymentId: refund.paymentId },
  });

  return `Refund of $${(refundAmountCents / 100).toFixed(2)} applied to payment #${existing.id}`;
}

/* ------------------------------------------------------------------ */
/*  Loyalty helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Awards first_booking loyalty points to a client on their first paid booking.
 * Idempotent — skips silently if points have already been awarded.
 * Reads the configured bonus from the admin's onboardingData so the studio can
 * control the value without a code deploy.
 */
async function awardFirstBookingPoints(clientId: string, bookingId: number): Promise<void> {
  // Only ever award once per client lifetime.
  const [alreadyAwarded] = await db
    .select({ id: loyaltyTransactions.id })
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.profileId, clientId),
        eq(loyaltyTransactions.type, "first_booking"),
      ),
    )
    .limit(1);

  if (alreadyAwarded) return;

  // Read the studio's configured bonus value from the admin profile.
  const [adminProfile] = await db
    .select({ onboardingData: profiles.onboardingData })
    .from(profiles)
    .where(eq(profiles.role, "admin"))
    .limit(1);

  const rewardsConfig = (adminProfile?.onboardingData as Record<string, unknown> | null)
    ?.rewards as Record<string, unknown> | undefined;

  if (!rewardsConfig?.enabled) return;

  const bonuses = rewardsConfig.bonuses as Record<string, unknown> | undefined;
  const pts = typeof bonuses?.firstBooking === "number" ? bonuses.firstBooking : null;
  if (!pts) return;

  await db.insert(loyaltyTransactions).values({
    profileId: clientId,
    points: pts,
    type: "first_booking",
    description: "First booking",
  });

  // Notify the client (non-fatal — email failure must not fail the webhook).
  try {
    const [client] = await db
      .select({
        firstName: profiles.firstName,
        email: profiles.email,
        notifyEmail: profiles.notifyEmail,
      })
      .from(profiles)
      .where(eq(profiles.id, clientId));

    if (client?.email && client.notifyEmail) {
      const [balanceRow] = await db
        .select({ total: sql<number>`SUM(${loyaltyTransactions.points})` })
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.profileId, clientId));

      const bp = await getPublicBusinessProfile();
      await sendEmail({
        to: client.email,
        subject: `You earned loyalty points! — ${bp.businessName}`,
        react: LoyaltyPointsAwarded({
          clientName: client.firstName,
          pointsEarned: pts,
          reason: "First booking",
          totalBalance: Number(balanceRow?.total ?? pts),
          businessName: bp.businessName,
        }),
        entityType: "loyalty_points_awarded",
        localId: String(bookingId),
      });
    }
  } catch {
    // Non-fatal — points were already written; only the notification failed.
  }
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
    // Increment hourly failure counter and alert if threshold exceeded.
    const failures = await redis.incr("webhook:sig_failures");
    if (failures === 1) {
      // Set TTL on the first increment so the window resets after 1 hour.
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

  // Process by event type
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
      default:
        result = `Event type ${eventType} not handled`;
        syncStatus = "skipped";
    }

    // Mark processed and record last-success timestamp for health endpoint.
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
    entityType: eventType.startsWith("refund") ? "refund" : "payment",
    remoteId: eventId,
    message: result,
  });

  return new Response("OK", { status: 200 });
}
