/**
 * Square Payments API — inline card payments and card-on-file charges.
 * @module lib/square/payments
 */
import * as Sentry from "@sentry/nextjs";
import { squareClient, SQUARE_LOCATION_ID, isSquareConfigured } from "./client";

/**
 * Charges a card using a Web Payments SDK token (nonce).
 *
 * Creates an order first (for webhook matching), then creates a payment
 * against that order. Used for inline deposit collection during the
 * public booking flow.
 */
export async function createSquarePayment(params: {
  bookingId: number;
  serviceName: string;
  amountInCents: number;
  sourceId: string;
  idempotencyKey: string;
  note?: string;
}): Promise<{ paymentId: string; orderId: string; receiptUrl: string | null }> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  try {
    const orderResponse = await squareClient.orders.create({
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.bookingId),
        lineItems: [
          {
            name: `Deposit — ${params.serviceName}`,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(params.amountInCents),
              currency: "USD",
            },
          },
        ],
        metadata: {
          bookingId: String(params.bookingId),
          paymentType: "deposit",
        },
      },
      idempotencyKey: `${params.idempotencyKey}-order`,
    });

    const orderId = orderResponse.order?.id;
    if (!orderId) throw new Error("Square order creation failed");

    const paymentResponse = await squareClient.payments.create({
      sourceId: params.sourceId,
      amountMoney: {
        amount: BigInt(params.amountInCents),
        currency: "USD",
      },
      orderId,
      locationId: SQUARE_LOCATION_ID,
      idempotencyKey: params.idempotencyKey,
      note: params.note ?? `Booking #${params.bookingId} (deposit)`,
      autocomplete: true,
    });

    const payment = paymentResponse.payment;
    if (!payment?.id) throw new Error("Square payment creation failed");

    return {
      paymentId: payment.id,
      orderId,
      receiptUrl: payment.receiptUrl ?? null,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Charges a client's card on file for a no-show or late cancellation fee.
 *
 * Creates an order labelled as a fee, then charges the stored card against
 * it. Returns payment details on success, or null if the charge fails.
 */
export async function chargeCardOnFile(params: {
  bookingId: number;
  squareCustomerId: string;
  cardId: string;
  amountInCents: number;
  feeType: "no_show" | "late_cancellation";
  serviceName: string;
}): Promise<{ paymentId: string; orderId: string; receiptUrl: string | null } | null> {
  if (!isSquareConfigured()) return null;

  const label =
    params.feeType === "no_show"
      ? `No-Show Fee — ${params.serviceName}`
      : `Late Cancellation Fee — ${params.serviceName}`;

  const idempotencyKey = crypto.randomUUID();

  try {
    const orderResponse = await squareClient.orders.create({
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.bookingId),
        lineItems: [
          {
            name: label,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(params.amountInCents),
              currency: "USD",
            },
          },
        ],
        metadata: {
          bookingId: String(params.bookingId),
          paymentType: params.feeType,
        },
      },
      idempotencyKey: `${idempotencyKey}-order`,
    });

    const orderId = orderResponse.order?.id;
    if (!orderId) throw new Error("Square order creation failed for fee");

    const paymentResponse = await squareClient.payments.create({
      sourceId: params.cardId,
      amountMoney: {
        amount: BigInt(params.amountInCents),
        currency: "USD",
      },
      customerId: params.squareCustomerId,
      orderId,
      locationId: SQUARE_LOCATION_ID,
      idempotencyKey,
      note: `Booking #${params.bookingId} (${params.feeType.replace("_", " ")})`,
      autocomplete: true,
    });

    const payment = paymentResponse.payment;
    if (!payment?.id) throw new Error("Square fee payment creation failed");

    return {
      paymentId: payment.id,
      orderId,
      receiptUrl: payment.receiptUrl ?? null,
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}
