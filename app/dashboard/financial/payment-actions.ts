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
import { db } from "@/db";
import { payments, bookings, services, profiles, syncLog } from "@/db/schema";
import {
  squareClient,
  isSquareConfigured,
  createSquarePaymentLink as squareCreatePaymentLink,
} from "@/lib/square";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type RecordPaymentInput = {
  bookingId: number;
  clientId: string;
  amountInCents: number;
  tipInCents?: number;
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

export type RefundResult = {
  success: boolean;
  error?: string;
};

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
      paidSum: sql<number>`coalesce((
        select sum(p.amount_in_cents)
        from payments p
        where p.booking_id = ${bookings.id}
          and p.status in ('paid', 'partially_refunded')
      ), 0)`,
    })
    .from(bookings)
    .innerJoin(bookingClient, eq(bookings.clientId, bookingClient.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
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
export async function recordPayment(input: RecordPaymentInput): Promise<void> {
  await getUser();

  // Validate the booking exists
  const [booking] = await db
    .select({ id: bookings.id, clientId: bookings.clientId })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId));

  if (!booking) throw new Error("Booking not found");
  if (booking.clientId !== input.clientId) throw new Error("Client does not match booking");

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
    method: input.method,
    status: "paid",
    paidAt: new Date(),
    squarePaymentId: input.squarePaymentId ?? null,
    squareOrderId: squareOrderId,
    squareReceiptUrl: receiptUrl,
    notes: input.notes ?? null,
  });

  revalidatePath("/dashboard/financial");
  revalidatePath("/dashboard/bookings");
}

/* ------------------------------------------------------------------ */
/*  Process Refund                                                     */
/* ------------------------------------------------------------------ */

/**
 * Processes a full or partial refund. For card payments with a Square
 * payment ID, calls the Square Refunds API first. For cash payments,
 * updates the DB directly.
 */
export async function processRefund(input: RefundInput): Promise<RefundResult> {
  await getUser();

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

  revalidatePath("/dashboard/financial");
  revalidatePath("/dashboard/bookings");

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Payment Link                                                       */
/* ------------------------------------------------------------------ */

export type PaymentLinkResult = {
  success: boolean;
  url?: string;
  error?: string;
};

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
}): Promise<PaymentLinkResult> {
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

    return { success: true, url };
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
