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
import { SquareClient, SquareEnvironment } from "square";

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

/** Shared Square SDK client instance. */
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
    idempotencyKey: crypto.randomUUID(),
  });

  const orderId = response.order?.id;
  if (!orderId) throw new Error("Square order creation failed — no order ID returned");
  return orderId;
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

  const response = await squareClient.checkout.paymentLinks.create({
    idempotencyKey: crypto.randomUUID(),
    quickPay: {
      name: label,
      priceMoney: {
        amount: BigInt(params.amountInCents),
        currency: "USD",
      },
      locationId: SQUARE_LOCATION_ID,
    },
    paymentNote: `Booking #${params.bookingId} (${params.type})`,
  });

  const link = response.paymentLink;
  if (!link?.url || !link?.orderId) {
    throw new Error("Payment link creation failed — no URL returned");
  }

  return { url: link.url, orderId: link.orderId };
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

  const response = await squareClient.checkout.paymentLinks.create({
    idempotencyKey: crypto.randomUUID(),
    order: {
      locationId: SQUARE_LOCATION_ID,
      referenceId: String(params.orderId),
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
}
