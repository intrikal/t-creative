/**
 * Square Invoices API — create and publish fee invoices.
 * @module lib/square/invoices
 */
import * as Sentry from "@sentry/nextjs";
import { squareClient, SQUARE_LOCATION_ID, isSquareConfigured } from "./client";

/**
 * Creates and publishes a Square Invoice for a fee (no-show / late cancel).
 *
 * Flow:
 *   1. Create a Square order for the fee amount
 *   2. Create a draft invoice attached to that order
 *   3. Publish the invoice — Square emails the client a payment link
 *
 * When the client pays, Square fires `invoice.payment_made` which the
 * webhook handler processes to record the payment locally.
 */
export async function createSquareInvoice(params: {
  bookingId: number;
  squareCustomerId: string;
  clientEmail: string;
  amountInCents: number;
  title: string;
  description: string;
  dueDate: string;
}): Promise<{ invoiceId: string; orderId: string } | null> {
  if (!isSquareConfigured()) return null;

  try {
    // 1. Create an order for the fee
    const orderResponse = await squareClient.orders.create({
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.bookingId),
        customerId: params.squareCustomerId,
        lineItems: [
          {
            name: params.title,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(params.amountInCents),
              currency: "USD",
            },
          },
        ],
        metadata: {
          bookingId: String(params.bookingId),
          paymentType: "fee_invoice",
        },
      },
      idempotencyKey: `fee-invoice-order-${params.bookingId}`,
    });

    const orderId = orderResponse.order?.id;
    if (!orderId) throw new Error("Square order creation failed for invoice");

    // 2. Create a draft invoice
    const invoiceResponse = await squareClient.invoices.create({
      invoice: {
        locationId: SQUARE_LOCATION_ID,
        orderId,
        primaryRecipient: {
          customerId: params.squareCustomerId,
        },
        paymentRequests: [
          {
            requestType: "BALANCE",
            dueDate: params.dueDate,
          },
        ],
        deliveryMethod: "EMAIL",
        title: params.title,
        description: params.description,
        acceptedPaymentMethods: {
          card: true,
          squareGiftCard: false,
          bankAccount: false,
          buyNowPayLater: false,
          cashAppPay: true,
        },
      },
      idempotencyKey: `fee-invoice-${params.bookingId}`,
    });

    const invoiceId = invoiceResponse.invoice?.id;
    const invoiceVersion = invoiceResponse.invoice?.version;
    if (!invoiceId || invoiceVersion == null) throw new Error("Square invoice creation failed");

    // 3. Publish the invoice — Square emails the payment link to the client
    await squareClient.invoices.publish({
      invoiceId,
      version: invoiceVersion,
      idempotencyKey: `fee-invoice-publish-${params.bookingId}`,
    });

    return { invoiceId, orderId };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}
