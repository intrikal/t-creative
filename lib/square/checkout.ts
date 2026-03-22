/**
 * Square Checkout API — payment links for bookings and product orders.
 * @module lib/square/checkout
 */
import * as Sentry from "@sentry/nextjs";
import { squareClient, SQUARE_LOCATION_ID, isSquareConfigured } from "./client";

/**
 * Creates a Square payment link using Quick Pay. Returns the payment
 * link URL and the auto-created order ID (used for webhook matching).
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

/**
 * Creates a Square payment link for a product order with multiple line items.
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
