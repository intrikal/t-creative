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
 * @module api/webhooks/square
 */
import { createHmac } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { payments, bookings, orders, profiles, webhookEvents, syncLog } from "@/db/schema";
import { PaymentReceipt } from "@/emails/PaymentReceipt";
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

/* eslint-disable @typescript-eslint/no-explicit-any */

async function handlePaymentCompleted(data: any): Promise<string> {
  const squarePayment = data?.object?.payment;
  if (!squarePayment?.id) return "No payment ID in event";

  const squarePaymentId = squarePayment.id as string;
  const squareOrderId = (squarePayment.order_id as string) ?? null;

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
        paidAt: squarePayment.updated_at ? new Date(squarePayment.updated_at) : new Date(),
        squareReceiptUrl: squarePayment.receipt_url ?? null,
        squareOrderId: squareOrderId,
      })
      .where(eq(payments.id, existing.id));

    return `Updated existing payment #${existing.id}`;
  }

  // 2. Try order-based booking lookup
  const booking = await findBookingByOrder(squareOrderId);

  if (booking) {
    const amountCents = Number(squarePayment.amount_money?.amount ?? 0);
    const tenders = squarePayment.tenders as any[] | undefined;
    const method = tenders?.[0]?.type ? mapTenderType(tenders[0].type) : "square_other";
    const tipCents = Number(squarePayment.tip_money?.amount ?? 0);

    // Determine if this is a deposit payment via the payment note
    const note = squarePayment.note as string | undefined;
    const isDeposit = note?.includes("(deposit)") ?? false;

    await db.insert(payments).values({
      bookingId: booking.id,
      clientId: booking.clientId,
      amountInCents: amountCents,
      tipInCents: tipCents,
      method,
      status: "paid",
      paidAt: new Date(),
      squarePaymentId,
      squareOrderId,
      squareReceiptUrl: squarePayment.receipt_url ?? null,
      notes: isDeposit ? "Deposit collected via Square" : "Auto-linked via Square order",
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

    // Send payment receipt email (non-fatal)
    const [bookingClient] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, booking.clientId));

    if (bookingClient?.email) {
      await sendEmail({
        to: bookingClient.email,
        subject: "Payment receipt — T Creative",
        react: PaymentReceipt({
          clientName: bookingClient.firstName,
          amountInCents: amountCents,
          method: method.replace("square_", "").replace("_", " "),
          receiptUrl: (squarePayment.receipt_url as string) ?? undefined,
          description: isDeposit ? "Deposit payment" : "Appointment payment",
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

    return `Auto-linked payment to booking #${booking.id}${isDeposit ? " (deposit)" : ""}`;
  }

  // 3. Try product order lookup
  const productOrder = await findProductOrderBySquareOrder(squareOrderId);
  if (productOrder) {
    await db.update(orders).set({ status: "in_progress" }).where(eq(orders.id, productOrder.id));

    // Send payment receipt email (non-fatal)
    const [orderClient] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, productOrder.clientId));

    if (orderClient?.email) {
      await sendEmail({
        to: orderClient.email,
        subject: "Payment received for your order — T Creative",
        react: PaymentReceipt({
          clientName: orderClient.firstName,
          amountInCents: Number(squarePayment.amount_money?.amount ?? 0),
          method: "card",
          receiptUrl: (squarePayment.receipt_url as string) ?? undefined,
          description: "Order payment",
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
        amountInCents: Number(squarePayment.amount_money?.amount ?? 0),
        squarePaymentId,
        description: "Order payment via Square",
      });
    }

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
    payload: { squarePaymentId, squareOrderId, amount: squarePayment.amount_money },
  });

  return "No matching booking or order — logged for manual linking";
}

/**
 * Finds a booking by its Square order ID. Tries two strategies:
 * 1. Direct DB lookup on bookings.squareOrderId
 * 2. Fetch the Square order and use its referenceId (= booking ID)
 */
async function findBookingByOrder(
  squareOrderId: string | null,
): Promise<{ id: number; clientId: string } | null> {
  if (!squareOrderId) return null;

  // Strategy 1: direct DB lookup
  const [byOrder] = await db
    .select({ id: bookings.id, clientId: bookings.clientId })
    .from(bookings)
    .where(eq(bookings.squareOrderId, squareOrderId));

  if (byOrder) return byOrder;

  // Strategy 2: fetch order from Square API, use referenceId
  if (isSquareConfigured()) {
    try {
      const orderResponse = await squareClient.orders.get({
        orderId: squareOrderId,
      });
      const referenceId = orderResponse.order?.referenceId;
      if (referenceId) {
        const bookingId = parseInt(referenceId, 10);
        if (!isNaN(bookingId)) {
          const [byRef] = await db
            .select({ id: bookings.id, clientId: bookings.clientId })
            .from(bookings)
            .where(eq(bookings.id, bookingId));
          if (byRef) return byRef;
        }
      }
    } catch {
      // Non-fatal — fall through to manual linking
    }
  }

  return null;
}

/**
 * Finds a product order by its Square order ID.
 */
async function findProductOrderBySquareOrder(
  squareOrderId: string | null,
): Promise<{ id: number; clientId: string } | null> {
  if (!squareOrderId) return null;

  const [row] = await db
    .select({ id: orders.id, clientId: orders.clientId })
    .from(orders)
    .where(eq(orders.squareOrderId, squareOrderId));

  return row ?? null;
}

async function handlePaymentUpdated(data: any): Promise<string> {
  const squarePayment = data?.object?.payment;
  if (!squarePayment?.id) return "No payment ID in event";

  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.squarePaymentId, squarePayment.id));

  if (!existing) return "No matching local payment found";

  const tenders = squarePayment.tenders as any[] | undefined;
  const method = tenders?.[0]?.type ? mapTenderType(tenders[0].type) : undefined;

  await db
    .update(payments)
    .set({
      squareReceiptUrl: squarePayment.receipt_url ?? undefined,
      squareOrderId: squarePayment.order_id ?? undefined,
      ...(method ? { method } : {}),
    })
    .where(eq(payments.id, existing.id));

  return `Updated payment #${existing.id}`;
}

async function handleRefundEvent(data: any): Promise<string> {
  const refund = data?.object?.refund;
  if (!refund?.payment_id) return "No payment ID in refund event";

  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.squarePaymentId, refund.payment_id));

  if (!existing) return "No matching local payment for refund";

  const refundAmountCents = Number(refund.amount_money?.amount ?? 0);
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

  return `Refund of $${(refundAmountCents / 100).toFixed(2)} applied to payment #${existing.id}`;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(request: Request): Promise<Response> {
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

  // Process by event type
  let result = "Unhandled event type";
  let syncStatus: "success" | "failed" | "skipped" = "skipped";

  try {
    const data = event.data as Record<string, unknown> | undefined;

    switch (eventType) {
      case "payment.completed":
        result = await handlePaymentCompleted(data);
        syncStatus = "success";
        break;
      case "payment.updated":
        result = await handlePaymentUpdated(data);
        syncStatus = "success";
        break;
      case "refund.created":
      case "refund.updated":
        result = await handleRefundEvent(data);
        syncStatus = "success";
        break;
      default:
        result = `Event type ${eventType} not handled`;
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
