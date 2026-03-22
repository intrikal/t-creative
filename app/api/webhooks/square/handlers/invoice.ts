/**
 * Square invoice payment webhook handler.
 * @module api/webhooks/square/handlers/invoice
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { squareClient } from "@/lib/square";

/**
 * Handles invoice.payment_made events from Square. When a client pays a
 * fee invoice (no-show / late cancel), Square fires this event. We find
 * the pending payment by squareInvoiceId and mark it paid.
 */
export async function handleInvoicePaymentMade(
  data: Record<string, unknown> | undefined,
): Promise<string> {
  const invoiceId = (data as Record<string, unknown>)?.invoice_id as string | undefined;
  if (!invoiceId) return "No invoice_id in event";

  const [pendingPayment] = await db
    .select({
      id: payments.id,
      bookingId: payments.bookingId,
      clientId: payments.clientId,
      amountInCents: payments.amountInCents,
    })
    .from(payments)
    .where(
      and(
        eq(payments.squareInvoiceId, invoiceId),
        eq(payments.status, "pending"),
      ),
    )
    .limit(1);

  if (!pendingPayment) {
    return `No pending payment found for Square invoice ${invoiceId}`;
  }

  let receiptUrl: string | null = null;
  let squarePaymentId: string | null = null;

  try {
    const invoiceResp = await squareClient.invoices.get({ invoiceId });
    const invoice = invoiceResp.invoice;
    receiptUrl = invoice?.publicUrl ?? null;

    if (invoice?.orderId) {
      try {
        const orderResp = await squareClient.orders.get({ orderId: invoice.orderId });
        const tenders = orderResp.order?.tenders;
        if (tenders?.[0]?.id) {
          squarePaymentId = tenders[0].id;
        }
      } catch {
        // Non-fatal
      }
    }
  } catch {
    // Non-fatal
  }

  await db
    .update(payments)
    .set({
      status: "paid",
      paidAt: new Date(),
      squarePaymentId,
      squareReceiptUrl: receiptUrl,
      notes: "Fee paid via Square Invoice",
    })
    .where(eq(payments.id, pendingPayment.id));

  await logAction({
    actorId: null,
    action: "update",
    entityType: "payment",
    entityId: String(pendingPayment.id),
    description: `Fee invoice paid via Square — booking #${pendingPayment.bookingId}`,
    metadata: {
      squareInvoiceId: invoiceId,
      squarePaymentId,
      amountInCents: pendingPayment.amountInCents,
    },
  });

  return `Invoice payment recorded for booking #${pendingPayment.bookingId}`;
}
