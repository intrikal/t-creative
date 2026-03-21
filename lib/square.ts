/**
 * Square SDK client — singleton for server-side use only.
 *
 * Initialises a single `SquareClient` instance for the Payments, Refunds,
 * and Customers APIs. The instance is module-scoped and reused across
 * requests, mirroring the pattern in `db/index.ts`.
 *
 * Graceful degradation: when Square env vars are missing the app still
 * boots (cash-only mode). Always check `isSquareConfigured()` before
 * calling any Square API.
 *
 * Required env vars:
 * - `SQUARE_ACCESS_TOKEN`  — from Square Developer Dashboard
 * - `SQUARE_LOCATION_ID`   — the location ID for Trini's studio
 * - `SQUARE_ENVIRONMENT`   — "sandbox" or "production"
 * - `SQUARE_WEBHOOK_SIGNATURE_KEY` — for webhook signature verification
 *
 * @module lib/square
 */
import * as Sentry from "@sentry/nextjs";
import { SquareClient, SquareEnvironment } from "square";

// Module-scoped env reads — evaluated once at import time.
// Defaults to Sandbox so a missing env var never accidentally hits production.
const accessToken = process.env.SQUARE_ACCESS_TOKEN;
const locationId = process.env.SQUARE_LOCATION_ID;
const environment =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

/** Square location ID for the studio. */
export const SQUARE_LOCATION_ID = locationId ?? "";

/** Webhook signature key for verifying inbound Square webhooks. */
export const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";

/** Whether Square credentials are configured (access token + location). */
export function isSquareConfigured(): boolean {
  return !!(accessToken && locationId);
}

/**
 * Shared Square SDK client instance.
 *
 * Instantiated eagerly (not lazy) because the SquareClient constructor
 * does not throw when the token is empty — it only fails on actual API
 * calls, which are always guarded by `isSquareConfigured()`.
 */
export const squareClient = new SquareClient({
  token: accessToken ?? "",
  environment,
});

/* ------------------------------------------------------------------ */
/*  Orders API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Creates a Square Order for a booking. The order's `referenceId` is set
 * to the booking ID so webhook payments can be matched back to bookings.
 *
 * Used when a booking is confirmed so the POS tablet can take payment
 * against this order, and the webhook handler can auto-link it.
 */
export async function createSquareOrder(params: {
  bookingId: number;
  serviceName: string;
  amountInCents: number;
  clientName?: string;
}): Promise<string> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  try {
    const response = await squareClient.orders.create({
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.bookingId),
        lineItems: [
          {
            name: params.serviceName,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(params.amountInCents),
              currency: "USD",
            },
          },
        ],
        metadata: {
          bookingId: String(params.bookingId),
          ...(params.clientName ? { clientName: params.clientName } : {}),
        },
      },
      // Random UUID is safe here — orders are not retried, so each call
      // should create a distinct order. For retryable paths see createSquarePayment
      // which accepts an idempotency key from the caller.
      idempotencyKey: crypto.randomUUID(),
    });

    const orderId = response.order?.id;
    if (!orderId) throw new Error("Square order creation failed — no order ID returned");
    return orderId;
  } catch (err) {
    // All Square functions report to Sentry then re-throw so the caller
    // (typically a server action) can surface a user-facing error message.
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Checkout API — Payment Links                                       */
/* ------------------------------------------------------------------ */

/**
 * Creates a Square payment link using Quick Pay. Returns the payment
 * link URL and the auto-created order ID (used for webhook matching).
 *
 * Supports both deposit and full-balance payments. The `paymentNote`
 * includes the booking ID so payments can be traced back.
 */
export async function createSquarePaymentLink(params: {
  bookingId: number;
  serviceName: string;
  amountInCents: number;
  type: "deposit" | "balance";
}): Promise<{ url: string; orderId: string }> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  const label = params.type === "deposit" ? `Deposit — ${params.serviceName}` : params.serviceName;

  try {
    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: crypto.randomUUID(),
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
          paymentType: params.type,
        },
      },
      paymentNote: `Booking #${params.bookingId} (${params.type})`,
    });

    const link = response.paymentLink;
    if (!link?.url || !link?.orderId) {
      throw new Error("Payment link creation failed — no URL returned");
    }

    return { url: link.url, orderId: link.orderId };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Payments API — Inline card payment                                 */
/* ------------------------------------------------------------------ */

/**
 * Charges a card using a Web Payments SDK token (nonce).
 *
 * Creates an order first (for webhook matching), then creates a payment
 * against that order. Returns the Square payment ID, order ID, and
 * receipt URL.
 *
 * Used for inline deposit collection during the public booking flow.
 */
export async function createSquarePayment(params: {
  bookingId: number;
  serviceName: string;
  amountInCents: number;
  sourceId: string; // Web Payments SDK nonce
  idempotencyKey: string;
  note?: string;
}): Promise<{ paymentId: string; orderId: string; receiptUrl: string | null }> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  try {
    // Two-step flow: order first, then payment against the order.
    // This ensures the payment shows up on the POS linked to the order,
    // and the webhook handler can match payments to bookings via referenceId.
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
      // Suffix the caller's key with "-order" so the order and payment
      // get distinct idempotency keys from a single caller-provided value.
      idempotencyKey: `${params.idempotencyKey}-order`,
    });

    const orderId = orderResponse.order?.id;
    if (!orderId) throw new Error("Square order creation failed");

    // 2. Charge the card against the order
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
      // autocomplete: true captures the payment immediately instead of
      // creating a hold that requires a separate capture step.
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

/* ------------------------------------------------------------------ */
/*  Checkout API — Product Order Payment Links                         */
/* ------------------------------------------------------------------ */

/**
 * Creates a Square payment link for a product order with multiple line items.
 * Unlike `createSquarePaymentLink` (which uses quickPay for single items),
 * this creates an order-based checkout link with inline line items.
 *
 * The `referenceId` is set to the local order ID for webhook matching.
 */
export async function createSquareOrderPaymentLink(params: {
  orderId: number;
  orderNumber: string;
  lineItems: Array<{ name: string; quantity: number; amountInCents: number }>;
}): Promise<{ url: string; orderId: string }> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  try {
    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.orderId),
        // Square expects per-unit price, but callers pass total per line item.
        // Divide by quantity to get the unit price Square expects.
        lineItems: params.lineItems.map((item) => ({
          name: item.name,
          quantity: String(item.quantity),
          basePriceMoney: {
            amount: BigInt(item.amountInCents / item.quantity),
            currency: "USD",
          },
        })),
        metadata: {
          orderNumber: params.orderNumber,
          source: "shop",
        },
      },
      paymentNote: `Order ${params.orderNumber}`,
    });

    const link = response.paymentLink;
    if (!link?.url || !link?.orderId) {
      throw new Error("Payment link creation failed — no URL returned");
    }

    return { url: link.url, orderId: link.orderId };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Customers API — Card on file                                       */
/* ------------------------------------------------------------------ */

/**
 * Retrieves the first stored card ID for a Square customer. Returns null
 * if no cards are on file or Square is not configured.
 *
 * Returns null (rather than throwing) on failure so callers can fall back
 * to invoice-based collection for no-show / cancellation fees.
 */
export async function getSquareCardOnFile(squareCustomerId: string): Promise<string | null> {
  if (!isSquareConfigured()) return null;

  try {
    const response = await squareClient.cards.list({ customerId: squareCustomerId });
    const cards = response.data ?? [];
    // Only return cards that are still active — Square keeps disabled/expired
    // cards in the list.
    const enabledCard = cards.find((c) => c.enabled);
    return enabledCard?.id ?? null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Charges a client's card on file for a no-show or late cancellation fee.
 *
 * Creates an order labelled as a fee, then charges the stored card against
 * it. Returns payment details on success, or null if the charge fails
 * (caller should fall back to creating an invoice).
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
    // 1. Create an order for the fee
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

    // 2. Charge the stored card
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
