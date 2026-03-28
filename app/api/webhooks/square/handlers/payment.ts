/**
 * Square payment webhook handlers — payment.completed and payment.updated.
 *
 * Includes helpers for booking/order lookup and loyalty point awards.
 * @module api/webhooks/square/handlers/payment
 */
import * as Sentry from "@sentry/nextjs";
import { eq, and, sql } from "drizzle-orm";
import type { PaymentCreatedEventData, PaymentUpdatedEventData } from "square";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import {
  payments,
  bookings,
  orders,
  products,
  profiles,
  syncLog,
  loyaltyTransactions,
  inventoryAdjustments,
} from "@/db/schema";
import { LoyaltyPointsAwarded } from "@/emails/LoyaltyPointsAwarded";
import { PaymentReceipt } from "@/emails/PaymentReceipt";
import { logAction } from "@/lib/audit";
import { buyShippingLabel, isEasyPostConfigured } from "@/lib/easypost";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import { squareClient, isSquareConfigured } from "@/lib/square";
import { recordZohoBooksPayment } from "@/lib/zoho-books";
import type { SquareWebhookPayment } from "./types";
import { mapTenderType } from "./types";

/* ------------------------------------------------------------------ */
/*  payment.completed                                                  */
/* ------------------------------------------------------------------ */

export async function handlePaymentCompleted(
  data: PaymentCreatedEventData | undefined,
): Promise<string> {
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
    const taxCents = Number(squarePayment.taxMoney?.amount ?? 0);

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

    if (isDeposit) {
      await db
        .update(bookings)
        .set({
          depositPaidInCents: amountCents,
          depositPaidAt: new Date(),
        })
        .where(eq(bookings.id, booking.id));
    }

    try {
      await awardFirstBookingPoints(booking.clientId, booking.id);
    } catch (err) {
      Sentry.captureException(err);
    }

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

    trackEvent(booking.clientId, "payment_completed", {
      bookingId: booking.id,
      amountInCents: amountCents,
      method,
    });

    return `Auto-linked payment to booking #${booking.id}${isDeposit ? " (deposit)" : ""}`;
  }

  // 3. Try product order lookup
  const productOrder = await findProductOrderBySquareOrder(squareOrderId);
  if (productOrder) {
    await db.update(orders).set({ status: "in_progress" }).where(eq(orders.id, productOrder.id));

    const isShippingOrder =
      productOrder.fulfillmentMethod === "ship_standard" ||
      productOrder.fulfillmentMethod === "ship_express";

    if (isShippingOrder && productOrder.easypostShipmentId && isEasyPostConfigured()) {
      try {
        const { easypostClient } = await import("@/lib/easypost");
        const shipment = await easypostClient!.Shipment.retrieve(productOrder.easypostShipmentId);
        const rates = shipment.rates ?? [];

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

    if (productOrder.clientId) {
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
    }

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

    // Decrement inventory for product sale (SELECT FOR UPDATE prevents overselling)
    if (productOrder.productId) {
      try {
        const quantity = productOrder.quantity ?? 1;
        await db.transaction(async (tx) => {
          const [row] = await tx
            .select({ stockCount: products.stockCount })
            .from(products)
            .where(eq(products.id, productOrder.productId!))
            .for("update");

          if (row) {
            const newStock = Math.max(0, row.stockCount - quantity);
            await tx
              .update(products)
              .set({
                stockCount: newStock,
                availability: newStock === 0 ? "out_of_stock" : "in_stock",
              })
              .where(eq(products.id, productOrder.productId!));

            await tx.insert(inventoryAdjustments).values({
              productId: productOrder.productId!,
              quantityDelta: -quantity,
              quantityAfter: newStock,
              reason: "sale",
              notes: `Square order ${squareOrderId}`,
              actorId: null,
            });
          }
        });
      } catch (invErr) {
        // Non-fatal — don't block payment processing
        Sentry.captureException(invErr);
      }
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

  // 4. Try customer-based client lookup
  const squareCustomerId = (squarePayment as Record<string, unknown>).customerId as
    | string
    | undefined;

  if (squareCustomerId) {
    const [clientProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.squareCustomerId, squareCustomerId))
      .limit(1);

    if (clientProfile) {
      const amountCents = Number(squarePayment.amountMoney?.amount ?? 0);

      await db.insert(syncLog).values({
        provider: "square",
        direction: "inbound",
        status: "skipped",
        entityType: "payment",
        remoteId: squarePaymentId,
        message: `Payment matched to client ${clientProfile.id} via Square customer ID — needs booking link`,
        payload: {
          squarePaymentId,
          squareOrderId,
          squareCustomerId,
          clientId: clientProfile.id,
          amountCents,
          receiptUrl: squarePayment.receiptUrl ?? null,
        },
      });

      await logAction({
        actorId: null,
        action: "create",
        entityType: "payment",
        entityId: squarePaymentId,
        description: `Payment matched to client via Square customer ID — needs booking link`,
        metadata: {
          squarePaymentId,
          squareOrderId,
          squareCustomerId,
          clientId: clientProfile.id,
          amountCents,
        },
      });

      return `Matched payment to client ${clientProfile.id} via Square customer ID — needs booking link`;
    }
  }

  // 5. No match — log for manual linking
  await db.insert(syncLog).values({
    provider: "square",
    direction: "inbound",
    status: "skipped",
    entityType: "payment",
    remoteId: squarePaymentId,
    message:
      "Payment received but no matching booking, order, or customer found — needs manual linking",
    payload: {
      squarePaymentId,
      squareOrderId,
      squareCustomerId: squareCustomerId ?? null,
      amount: squarePayment.amountMoney,
    },
  });

  return "No matching booking, order, or customer — logged for manual linking";
}

/* ------------------------------------------------------------------ */
/*  payment.updated                                                    */
/* ------------------------------------------------------------------ */

export async function handlePaymentUpdated(
  data: PaymentUpdatedEventData | undefined,
): Promise<string> {
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

      if (order?.metadata || order?.referenceId) {
        return {
          paymentType: order.metadata?.paymentType as string | undefined,
          referenceId: order.referenceId ?? undefined,
          metadataMissing: false,
        };
      }
    } catch {
      // API call failed — will retry
    }
  }

  Sentry.captureMessage(
    `Square order metadata not resolved after ${MAX_RETRIES} retries — flagging for manual review`,
    { level: "warning", extra: { squareOrderId } },
  );

  return { metadataMissing: true };
}

async function findBookingByOrder(squareOrderId: string | null): Promise<{
  id: number;
  clientId: string;
  squareOrderType?: string;
  needsManualReview?: boolean;
} | null> {
  if (!squareOrderId) return null;

  const [byOrder] = await db
    .select({ id: bookings.id, clientId: bookings.clientId })
    .from(bookings)
    .where(eq(bookings.squareOrderId, squareOrderId));

  if (byOrder) {
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

async function findProductOrderBySquareOrder(squareOrderId: string | null): Promise<{
  id: number;
  clientId: string | null;
  productId: number | null;
  quantity: number;
  fulfillmentMethod: string | null;
  easypostShipmentId: string | null;
} | null> {
  if (!squareOrderId) return null;

  const [row] = await db
    .select({
      id: orders.id,
      clientId: orders.clientId,
      productId: orders.productId,
      quantity: orders.quantity,
      fulfillmentMethod: orders.fulfillmentMethod,
      easypostShipmentId: orders.easypostShipmentId,
    })
    .from(orders)
    .where(eq(orders.squareOrderId, squareOrderId));

  return row ?? null;
}

async function awardFirstBookingPoints(clientId: string, bookingId: number): Promise<void> {
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
    // Non-fatal
  }
}
