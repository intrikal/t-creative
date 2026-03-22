/**
 * Square refund webhook handler.
 * @module api/webhooks/square/handlers/refund
 */
import type { PaymentRefund, RefundCreatedEventData } from "square";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { logAction } from "@/lib/audit";

export async function handleRefundEvent(data: RefundCreatedEventData | undefined): Promise<string> {
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
