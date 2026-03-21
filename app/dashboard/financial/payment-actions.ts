/**
 * Payment mutation actions — record payments, process refunds.
 *
 * Separated from the main `actions.ts` (which handles read-heavy financial
 * queries) to keep payment mutation logic self-contained.
 *
 * Supports two payment flows:
 * 1. **Cash** — Trini collects cash in-studio and records it here.
 * 2. **Square** — Payments processed on Square Terminal. Can be recorded
 *    manually here or auto-created by the webhook handler.
 *
 * All monetary values are in cents. Refunds call the Square Refunds API
 * for card payments and update the DB directly for cash.
 *
 * @module financial/payment-actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { payments, bookings, services, profiles, syncLog } from "@/db/schema";
import { PaymentLinkEmail } from "@/emails/PaymentLinkEmail";
import { RefundNotification } from "@/emails/RefundNotification";
import { logAction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { sendEmail, getEmailRecipient } from "@/lib/resend";
import {
  squareClient,
  isSquareConfigured,
  createSquarePaymentLink as squareCreatePaymentLink,
} from "@/lib/square";
import type { ActionResult } from "@/lib/types/action-result";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type RecordPaymentInput = {
  bookingId: number;
  clientId: string;
  amountInCents: number;
  tipInCents?: number;
  /** Sales tax collected in cents. Calculated by Square, not this app. */
  taxAmountInCents?: number;
  method:
    | "cash"
    | "square_card"
    | "square_cash"
    | "square_wallet"
    | "square_gift_card"
    | "square_other";
  squarePaymentId?: string;
  notes?: string;
};

export type RefundInput = {
  paymentId: number;
  amountInCents: number;
  reason?: string;
};

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const RecordPaymentSchema = z.object({
  bookingId: z.number().int().positive(),
  clientId: z.string().min(1),
  amountInCents: z.number().int().positive(),
  tipInCents: z.number().int().nonnegative().optional(),
  taxAmountInCents: z.number().int().nonnegative().optional(),
  method: z.enum([
    "cash",
    "square_card",
    "square_cash",
    "square_wallet",
    "square_gift_card",
    "square_other",
  ]),
  squarePaymentId: z.string().optional(),
  notes: z.string().optional(),
});

const RefundSchema = z.object({
  paymentId: z.number().int().positive(),
  amountInCents: z.number().int().positive(),
  reason: z.string().optional(),
});

const PaymentLinkSchema = z.object({
  bookingId: z.number().int().positive(),
  amountInCents: z.number().int().positive(),
  type: z.enum(["deposit", "balance"]),
});

export type BookingForPayment = {
  id: number;
  clientId: string;
  clientName: string;
  service: string;
  category: string | null;
  date: string;
  totalInCents: number;
  discountInCents: number;
  paidInCents: number;
  remainingInCents: number;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

const bookingClient = alias(profiles, "bookingClient");

/**
 * Returns bookings eligible for payment recording — confirmed, in_progress,
 * or completed bookings that haven't been fully paid yet.
 */
export async function getBookingsForPayment(): Promise<BookingForPayment[]> {
  await getUser();

  const paidSums = db
    .select({
      bookingId: payments.bookingId,
      totalPaid: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`.as("total_paid"),
    })
    .from(payments)
    .where(inArray(payments.status, ["paid", "partially_refunded"]))
    .groupBy(payments.bookingId)
    .as("paid_sums");

  const rows = await db
    .select({
      id: bookings.id,
      clientId: bookings.clientId,
      clientFirstName: bookingClient.firstName,
      clientLastName: bookingClient.lastName,
      serviceName: services.name,
      serviceCategory: services.category,
      startsAt: bookings.startsAt,
      totalInCents: bookings.totalInCents,
      discountInCents: bookings.discountInCents,
      paidSum: sql<number>`coalesce(${paidSums.totalPaid}, 0)`,
    })
    .from(bookings)
    .innerJoin(bookingClient, eq(bookings.clientId, bookingClient.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(paidSums, eq(bookings.id, paidSums.bookingId))
    .where(inArray(bookings.status, ["confirmed", "in_progress", "completed"]))
    .orderBy(bookings.startsAt);

  return rows
    .map((r) => {
      const effectiveTotal = r.totalInCents - r.discountInCents;
      const paid = Number(r.paidSum);
      return {
        id: r.id,
        clientId: r.clientId,
        clientName: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" ") || "Unknown",
        service: r.serviceName,
        category: r.serviceCategory,
        date: r.startsAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        totalInCents: effectiveTotal,
        discountInCents: r.discountInCents,
        paidInCents: paid,
        remainingInCents: Math.max(0, effectiveTotal - paid),
      };
    })
    .filter((b) => b.remainingInCents > 0);
}

/* ------------------------------------------------------------------ */
/*  Record Payment                                                     */
/* ------------------------------------------------------------------ */

/**
 * Records a payment against a booking. Works for both cash and Square
 * payments. For Square payments, optionally enriches from the Square API
 * if a `squarePaymentId` is provided and Square is configured.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<ActionResult<void>> {
  try {
    RecordPaymentSchema.parse(input);

    const user = await getUser();

    // Validate the booking exists
    const [booking] = await db
      .select({ id: bookings.id, clientId: bookings.clientId })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId));

    if (!booking) return { success: false, error: "Booking not found" };
    if (booking.clientId !== input.clientId)
      return { success: false, error: "Client does not match booking" };

    let receiptUrl: string | null = null;
    let squareOrderId: string | null = null;

    // Enrich from Square API if payment ID provided
    if (input.squarePaymentId && isSquareConfigured()) {
      try {
        const response = await squareClient.payments.get({ paymentId: input.squarePaymentId });
        receiptUrl = response.payment?.receiptUrl ?? null;
        squareOrderId = response.payment?.orderId ?? null;
      } catch {
        // Non-fatal — proceed with manual data
      }
    }

    await db.insert(payments).values({
      bookingId: input.bookingId,
      clientId: input.clientId,
      amountInCents: input.amountInCents,
      tipInCents: input.tipInCents ?? 0,
      taxAmountInCents: input.taxAmountInCents ?? 0,
      method: input.method,
      status: "paid",
      paidAt: new Date(),
      squarePaymentId: input.squarePaymentId ?? null,
      squareOrderId: squareOrderId,
      squareReceiptUrl: receiptUrl,
      notes: input.notes ?? null,
    });

    await logAction({
      actorId: user.id,
      action: "create",
      entityType: "payment",
      entityId: String(input.bookingId),
      description: `Payment of $${(input.amountInCents / 100).toFixed(2)} recorded`,
      metadata: {
        method: input.method,
        amountInCents: input.amountInCents,
        bookingId: input.bookingId,
      },
    });

    revalidatePath("/dashboard/financial");
    revalidatePath("/dashboard/bookings");
    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record payment";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Process Refund                                                     */
/* ------------------------------------------------------------------ */

/**
 * Processes a full or partial refund. For card payments with a Square
 * payment ID, calls the Square Refunds API first. For cash payments,
 * updates the DB directly.
 */
export async function processRefund(input: RefundInput): Promise<ActionResult<void>> {
  RefundSchema.parse(input);

  const user = await getUser();

  const [payment] = await db.select().from(payments).where(eq(payments.id, input.paymentId));

  if (!payment) return { success: false, error: "Payment not found" };

  const refundable = payment.amountInCents - payment.refundedInCents;
  if (input.amountInCents <= 0) return { success: false, error: "Refund amount must be positive" };
  if (input.amountInCents > refundable) {
    return {
      success: false,
      error: `Maximum refundable amount is $${(refundable / 100).toFixed(2)}`,
    };
  }

  // Square refund for card payments
  if (payment.squarePaymentId && isSquareConfigured()) {
    try {
      await squareClient.refunds.refundPayment({
        idempotencyKey: crypto.randomUUID(),
        paymentId: payment.squarePaymentId,
        amountMoney: {
          amount: BigInt(input.amountInCents),
          currency: "USD",
        },
        reason: input.reason || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Square refund failed";

      // Log the failure
      await db.insert(syncLog).values({
        provider: "square",
        direction: "outbound",
        status: "failed",
        entityType: "refund",
        localId: String(payment.id),
        remoteId: payment.squarePaymentId,
        message: `Refund of $${(input.amountInCents / 100).toFixed(2)} failed`,
        errorMessage: message,
      });

      return { success: false, error: message };
    }

    // Log successful Square refund
    await db.insert(syncLog).values({
      provider: "square",
      direction: "outbound",
      status: "success",
      entityType: "refund",
      localId: String(payment.id),
      remoteId: payment.squarePaymentId,
      message: `Refunded $${(input.amountInCents / 100).toFixed(2)}`,
    });
  }

  // Update the payment record
  const newRefundedTotal = payment.refundedInCents + input.amountInCents;
  const isFullRefund = newRefundedTotal >= payment.amountInCents;

  const noteParts = [payment.notes, input.reason ? `Refund: ${input.reason}` : null].filter(
    Boolean,
  );

  await db
    .update(payments)
    .set({
      refundedInCents: newRefundedTotal,
      refundedAt: new Date(),
      status: isFullRefund ? "refunded" : "partially_refunded",
      notes: noteParts.join(" | ") || null,
    })
    .where(eq(payments.id, input.paymentId));

  // Send refund notification email (non-fatal)
  try {
    const recipient = await getEmailRecipient(payment.clientId);
    if (recipient) {
      // Get service name from the booking
      let serviceName = "your service";
      if (payment.bookingId) {
        const [booking] = await db
          .select({ serviceName: services.name })
          .from(bookings)
          .innerJoin(services, eq(bookings.serviceId, services.id))
          .where(eq(bookings.id, payment.bookingId));
        if (booking) serviceName = booking.serviceName;
      }

      const methodLabels: Record<string, string> = {
        cash: "Cash",
        square_card: "Card",
        square_cash: "Cash App",
        square_wallet: "Digital Wallet",
        square_gift_card: "Gift Card",
        square_other: "Square",
      };

      const bp = await getPublicBusinessProfile();
      await sendEmail({
        to: recipient.email,
        subject: `Refund processed — $${(input.amountInCents / 100).toFixed(2)} — ${bp.businessName}`,
        react: RefundNotification({
          clientName: recipient.firstName,
          refundAmountInCents: input.amountInCents,
          originalAmountInCents: payment.amountInCents,
          method:
            (payment.method ? methodLabels[payment.method] : null) ?? payment.method ?? "Unknown",
          reason: input.reason,
          serviceName,
          businessName: bp.businessName,
        }),
        entityType: "refund_notification",
        localId: String(payment.id),
      });
    }
  } catch {
    // Non-fatal
  }

  await logAction({
    actorId: user.id,
    action: "update",
    entityType: "payment",
    entityId: String(input.paymentId),
    description: `Refund of $${(input.amountInCents / 100).toFixed(2)} processed`,
    metadata: { amountInCents: input.amountInCents, reason: input.reason ?? null, isFullRefund },
  });

  revalidatePath("/dashboard/financial");
  revalidatePath("/dashboard/bookings");

  return { success: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/*  Payment Link                                                       */
/* ------------------------------------------------------------------ */

/**
 * Creates a Square payment link (checkout URL) for a booking's deposit
 * or remaining balance. The link can be shared with the client via
 * email or SMS. When the client pays, Square's webhook auto-links the
 * payment to the booking via the order ID.
 */
export async function createPaymentLink(input: {
  bookingId: number;
  amountInCents: number;
  type: "deposit" | "balance";
}): Promise<ActionResult<{ url: string }>> {
  PaymentLinkSchema.parse(input);

  await getUser();

  if (!isSquareConfigured()) {
    return { success: false, error: "Square is not configured" };
  }

  const [booking] = await db
    .select({
      id: bookings.id,
      serviceId: bookings.serviceId,
    })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId));

  if (!booking) return { success: false, error: "Booking not found" };

  const [service] = await db
    .select({ name: services.name })
    .from(services)
    .where(eq(services.id, booking.serviceId));

  const serviceName = service?.name ?? "Appointment";

  try {
    const { url, orderId } = await squareCreatePaymentLink({
      bookingId: booking.id,
      serviceName,
      amountInCents: input.amountInCents,
      type: input.type,
    });

    // Store the order ID on the booking for webhook matching
    // (only if the booking doesn't already have one from POS)
    const [current] = await db
      .select({ squareOrderId: bookings.squareOrderId })
      .from(bookings)
      .where(eq(bookings.id, booking.id));

    if (!current?.squareOrderId) {
      await db.update(bookings).set({ squareOrderId: orderId }).where(eq(bookings.id, booking.id));
    }

    await db.insert(syncLog).values({
      provider: "square",
      direction: "outbound",
      status: "success",
      entityType: "payment_link",
      localId: String(booking.id),
      remoteId: orderId,
      message: `Created ${input.type} payment link for booking #${booking.id}`,
      payload: { url, orderId, amountInCents: input.amountInCents },
    });

    // Email payment link to client (respects notifyEmail preference)
    const [linkClient] = await db
      .select({
        email: profiles.email,
        firstName: profiles.firstName,
        notifyEmail: profiles.notifyEmail,
      })
      .from(profiles)
      .innerJoin(bookings, eq(bookings.clientId, profiles.id))
      .where(eq(bookings.id, input.bookingId));

    if (linkClient?.email && linkClient.notifyEmail) {
      const bp = await getPublicBusinessProfile();
      await sendEmail({
        to: linkClient.email,
        subject: `${input.type === "deposit" ? "Deposit" : "Payment"} link — ${serviceName} — ${bp.businessName}`,
        react: PaymentLinkEmail({
          clientName: linkClient.firstName,
          serviceName,
          amountInCents: input.amountInCents,
          type: input.type,
          paymentUrl: url,
          businessName: bp.businessName,
        }),
        entityType: "payment_link_delivery",
        localId: String(booking.id),
      });
    }

    return { success: true, data: { url } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create payment link";

    await db.insert(syncLog).values({
      provider: "square",
      direction: "outbound",
      status: "failed",
      entityType: "payment_link",
      localId: String(booking.id),
      message: "Failed to create payment link",
      errorMessage: message,
    });

    return { success: false, error: message };
  }
}
