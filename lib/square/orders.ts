/**
 * Square Orders API — create orders for bookings and POS payment matching.
 * @module lib/square/orders
 */
import * as Sentry from "@sentry/nextjs";
import { squareClient, SQUARE_LOCATION_ID, isSquareConfigured } from "./client";

/**
 * Creates a Square Order for a booking. The order's `referenceId` is set
 * to the booking ID so webhook payments can be matched back to bookings.
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
      idempotencyKey: crypto.randomUUID(),
    });

    const orderId = response.order?.id;
    if (!orderId) throw new Error("Square order creation failed — no order ID returned");
    return orderId;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
