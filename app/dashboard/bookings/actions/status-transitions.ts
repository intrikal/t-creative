"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, and, sql, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getPolicies, getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { bookings, invoices, payments, profiles, services, syncLog } from "@/db/schema";
import { NoShowFeeCharged } from "@/emails/NoShowFeeCharged";
import { NoShowFeeInvoice } from "@/emails/NoShowFeeInvoice";
import { logAction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { removeBookingFromCalendar } from "@/lib/booking-calendar-sync";
import logger from "@/lib/logger";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import {
  squareClient,
  isSquareConfigured,
  createSquareInvoice,
  getSquareCardOnFile,
  chargeCardOnFile,
} from "@/lib/square";
import type { ActionResult } from "@/lib/types/action-result";
import type { BookingStatus, CancellationRefundResult } from "@/lib/types/booking.types";
import { notifyWaitlistForCancelledBooking } from "@/lib/waitlist-notify";
import { updateZohoDeal } from "@/lib/zoho";
import { checkBookingWaivers } from "../waiver-actions";
import {
  tryCreateSquareOrder,
  trySendBookingConfirmation,
  tryAutoSendDepositLink,
  trySendBookingStatusEmail,
  tryFireInternalNotification,
  tryCreditReferrer,
} from "./booking-crud";
import { generateNextRecurringBooking } from "./recurring";

/** Alias for readability — all mutations in this file require admin access. */
const getUser = requireAdmin;

export async function updateBookingStatus(
  id: number,
  status: BookingStatus,
  cancellationReason?: string,
  skipWaiverCheck?: boolean,
): Promise<ActionResult<void>> {
  try {
    z.number().int().positive().parse(id);
    z.enum(["completed", "in_progress", "confirmed", "pending", "cancelled", "no_show"]).parse(
      status,
    );
    const user = await getUser();

    if (status === "confirmed" && !skipWaiverCheck) {
      const waiverResult = await checkBookingWaivers(id);
      if (!waiverResult.passed) {
        const names = waiverResult.missing.map((w) => w.formName).join(", ");
        throw new Error(
          `WAIVER_REQUIRED:${JSON.stringify(waiverResult.missing)}:Client must complete required waivers before confirmation: ${names}`,
        );
      }
    }

    const updates: Record<string, unknown> = { status };

    if (status === "confirmed") updates.confirmedAt = new Date();
    if (status === "completed") updates.completedAt = new Date();
    if (status === "cancelled") {
      updates.cancelledAt = new Date();
      if (cancellationReason) updates.cancellationReason = cancellationReason;
    }

    await db.update(bookings).set(updates).where(eq(bookings.id, id));

    if (status === "confirmed") {
      const [booking] = await db
        .select({
          squareOrderId: bookings.squareOrderId,
          serviceId: bookings.serviceId,
          totalInCents: bookings.totalInCents,
          createdAt: bookings.createdAt,
          clientId: bookings.clientId,
        })
        .from(bookings)
        .where(and(eq(bookings.id, id), isNull(bookings.deletedAt)));

      if (booking && !booking.squareOrderId) {
        await tryCreateSquareOrder(id, booking.serviceId, booking.totalInCents);
      }

      await trySendBookingConfirmation(id);
      await tryAutoSendDepositLink(id);

      if (booking?.clientId) {
        trackEvent(booking.clientId, "booking_confirmed", {
          bookingId: id,
          minutesSinceRequest: booking.createdAt
            ? Math.round((Date.now() - booking.createdAt.getTime()) / 60_000)
            : null,
        });
      }
    }

    if (status === "cancelled") {
      const refundResult = await tryRefundCancellationDeposit(id);
      await tryEnforceLateCancelFee(id);
      await trySendBookingStatusEmail(id, "cancelled", cancellationReason, refundResult);
      await tryNotifyWaitlist(id);
      removeBookingFromCalendar(id);

      logger.info(
        { action: "cancelBooking", bookingId: id, reason: cancellationReason ?? null },
        "booking cancelled",
      );

      trackEvent(id.toString(), "booking_cancelled", {
        bookingId: id,
        reason: cancellationReason ?? null,
        hoursBeforeAppointment: refundResult
          ? Math.round(refundResult.hoursUntilAppointment)
          : null,
        refundAmountInCents: refundResult?.refundAmountInCents ?? 0,
      });
    }

    if (status === "completed") {
      await trySendBookingStatusEmail(id, "completed");
      await generateNextRecurringBooking(id);
      await tryCreditReferrer(id);

      try {
        const [completedRow] = await db
          .select({
            durationMinutes: bookings.durationMinutes,
            totalInCents: bookings.totalInCents,
            clientId: bookings.clientId,
          })
          .from(bookings)
          .where(eq(bookings.id, id))
          .limit(1);
        if (completedRow) {
          logger.info(
            {
              action: "completeBooking",
              bookingId: id,
              clientId: completedRow.clientId,
              durationMinutes: completedRow.durationMinutes,
              totalInCents: completedRow.totalInCents,
            },
            "booking completed",
          );
          trackEvent(completedRow.clientId, "booking_completed", {
            bookingId: id,
            durationMinutes: completedRow.durationMinutes,
            totalInCents: completedRow.totalInCents,
          });
        }
      } catch {
        // Non-fatal
      }

      try {
        const { autoEnrollClient } = await import("@/app/dashboard/sequences/actions");
        const [completedBooking] = await db
          .select({ clientId: bookings.clientId })
          .from(bookings)
          .where(eq(bookings.id, id))
          .limit(1);
        if (completedBooking) {
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(bookings)
            .where(
              and(
                eq(bookings.clientId, completedBooking.clientId),
                eq(bookings.status, "completed"),
              ),
            );
          if (Number(count) === 1) {
            await autoEnrollClient(completedBooking.clientId, "first_booking_completed");
          }
        }
      } catch {
        // Non-fatal
      }
    }

    if (status === "no_show") {
      const noShowFeeInCents = await tryEnforceNoShowFee(id);
      await trySendBookingStatusEmail(id, "no_show");

      logger.info({ action: "markNoShow", bookingId: id }, "booking marked no-show");

      try {
        const [noShowRow] = await db
          .select({ clientId: bookings.clientId })
          .from(bookings)
          .where(eq(bookings.id, id))
          .limit(1);
        if (noShowRow) {
          trackEvent(noShowRow.clientId, "no_show_marked", {
            bookingId: id,
            feeInCents: noShowFeeInCents,
          });
        }
      } catch {
        // Non-fatal
      }
    }

    trackEvent(id.toString(), "booking_status_changed", {
      bookingId: id,
      newStatus: status,
      ...(cancellationReason ? { cancellationReason } : {}),
    });

    await logAction({
      actorId: user.id,
      action: "status_change",
      entityType: "booking",
      entityId: String(id),
      description: `Booking status changed to ${status}`,
      metadata: { newStatus: status, ...(cancellationReason ? { cancellationReason } : {}) },
    });

    if (status === "completed") {
      updateZohoDeal(id, "Closed Won");
    } else if (status === "cancelled") {
      updateZohoDeal(id, "Closed Lost");
    } else if (status === "confirmed") {
      updateZohoDeal(id, "Confirmed");
      tryCreateZohoBooksInvoice(id);
    }

    revalidatePath("/dashboard/bookings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to update booking status";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Fee enforcement                                                    */
/* ------------------------------------------------------------------ */

async function tryEnforceFee(
  bookingId: number,
  feeType: "no_show" | "late_cancellation",
): Promise<number | null> {
  try {
    const policies = await getPolicies();
    const feePercent =
      feeType === "no_show" ? policies.noShowFeePercent : policies.lateCancelFeePercent;

    if (feePercent <= 0) return null;

    const feeClient = alias(profiles, "feeClient");

    const [row] = await db
      .select({
        clientId: bookings.clientId,
        clientEmail: feeClient.email,
        clientFirstName: feeClient.firstName,
        notifyEmail: feeClient.notifyEmail,
        squareCustomerId: feeClient.squareCustomerId,
        serviceName: services.name,
        totalInCents: bookings.totalInCents,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .innerJoin(feeClient, eq(bookings.clientId, feeClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!row) return null;

    const feeAmountInCents = Math.round((row.totalInCents * feePercent) / 100);
    if (feeAmountInCents <= 0) return null;

    const dateFormatted = row.startsAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const feeLabel = feeType === "no_show" ? "no-show" : "late cancellation";

    let charged = false;
    if (isSquareConfigured() && row.squareCustomerId) {
      const cardId = await getSquareCardOnFile(row.squareCustomerId);
      if (cardId) {
        const result = await chargeCardOnFile({
          bookingId,
          squareCustomerId: row.squareCustomerId,
          cardId,
          amountInCents: feeAmountInCents,
          feeType,
          serviceName: row.serviceName,
        });

        if (result) {
          charged = true;

          await db.insert(payments).values({
            bookingId,
            clientId: row.clientId,
            status: "paid",
            method: "square_card",
            amountInCents: feeAmountInCents,
            squarePaymentId: result.paymentId,
            squareOrderId: result.orderId,
            squareReceiptUrl: result.receiptUrl,
            notes: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee (${feePercent}% of ${row.totalInCents}¢)`,
            paidAt: new Date(),
          });

          if (row.clientEmail && row.notifyEmail) {
            const bp = await getPublicBusinessProfile();
            await sendEmail({
              to: row.clientEmail,
              subject: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee charged — ${row.serviceName} — ${bp.businessName}`,
              react: NoShowFeeCharged({
                clientName: row.clientFirstName,
                serviceName: row.serviceName,
                bookingDate: dateFormatted,
                feeAmountInCents,
                feeType,
                receiptUrl: result.receiptUrl ?? undefined,
                businessName: bp.businessName,
              }),
              entityType: `${feeType}_fee_charged`,
              localId: String(bookingId),
            });
          }

          await logAction({
            actorId: "system",
            action: "create",
            entityType: "payment",
            entityId: String(bookingId),
            description: `Charged ${feeLabel} fee of ${feeAmountInCents}¢ to card on file`,
            metadata: {
              feeType,
              feePercent,
              feeAmountInCents,
              squarePaymentId: result.paymentId,
            },
          });
        }
      }
    }

    if (!charged) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const dueDateStr = dueDate.toISOString().split("T")[0];

      const feeTitle = `${feeType === "no_show" ? "No-Show" : "Late Cancellation"} Fee — ${row.serviceName}`;
      const feeDescription = `${feeLabel} fee (${feePercent}% of booking total) for appointment on ${dateFormatted}`;

      let invoiceSentViaSquare = false;

      if (isSquareConfigured() && row.squareCustomerId && row.clientEmail) {
        const squareResult = await createSquareInvoice({
          bookingId,
          squareCustomerId: row.squareCustomerId,
          clientEmail: row.clientEmail,
          amountInCents: feeAmountInCents,
          title: feeTitle,
          description: feeDescription,
          dueDate: dueDateStr,
        });

        if (squareResult) {
          invoiceSentViaSquare = true;

          await db.insert(payments).values({
            bookingId,
            clientId: row.clientId,
            status: "pending" as "paid",
            method: "square_other",
            amountInCents: feeAmountInCents,
            squareOrderId: squareResult.orderId,
            squareInvoiceId: squareResult.invoiceId,
            notes: `${feeTitle} — Square Invoice sent, awaiting payment`,
            paidAt: null as unknown as Date,
          });

          await logAction({
            actorId: "system",
            action: "create",
            entityType: "invoice",
            entityId: String(bookingId),
            description: `Square Invoice created for ${feeLabel} fee of ${feeAmountInCents}¢ — payment link emailed to client`,
            metadata: {
              feeType,
              feePercent,
              feeAmountInCents,
              squareInvoiceId: squareResult.invoiceId,
              squareOrderId: squareResult.orderId,
            },
          });
        }
      }

      if (!invoiceSentViaSquare) {
        const [lastInvoice] = await db
          .select({ number: invoices.number })
          .from(invoices)
          .orderBy(desc(invoices.id))
          .limit(1);

        const nextNum = lastInvoice
          ? String(parseInt(lastInvoice.number.replace("INV-", ""), 10) + 1).padStart(3, "0")
          : "001";

        await db.insert(invoices).values({
          clientId: row.clientId,
          number: `INV-${nextNum}`,
          description: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee — ${row.serviceName} (${dateFormatted})`,
          amountInCents: feeAmountInCents,
          status: "sent",
          issuedAt: new Date(),
          dueAt: dueDate,
          notes: `Auto-generated: ${feeLabel} fee (${feePercent}% of booking total) for booking #${bookingId}`,
        });

        if (row.clientEmail && row.notifyEmail) {
          const bp = await getPublicBusinessProfile();
          await sendEmail({
            to: row.clientEmail,
            subject: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee invoice — ${row.serviceName} — ${bp.businessName}`,
            react: NoShowFeeInvoice({
              clientName: row.clientFirstName,
              serviceName: row.serviceName,
              bookingDate: dateFormatted,
              feeAmountInCents,
              feeType,
              businessName: bp.businessName,
            }),
            entityType: `${feeType}_fee_invoice`,
            localId: String(bookingId),
          });
        }

        await logAction({
          actorId: "system",
          action: "create",
          entityType: "invoice",
          entityId: String(bookingId),
          description: `Created local ${feeLabel} fee invoice for ${feeAmountInCents}¢ (Square invoice unavailable)`,
          metadata: { feeType, feePercent, feeAmountInCents },
        });
      }
    }

    trackEvent(bookingId.toString(), `${feeType}_fee_enforced`, {
      bookingId,
      feeAmountInCents,
      feePercent,
      charged,
    });
    return feeAmountInCents;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

async function tryEnforceNoShowFee(bookingId: number): Promise<number | null> {
  return tryEnforceFee(bookingId, "no_show");
}

async function tryEnforceLateCancelFee(bookingId: number): Promise<void> {
  try {
    const policies = await getPolicies();
    if (policies.lateCancelFeePercent <= 0 || policies.cancelWindowHours <= 0) return;

    const [booking] = await db
      .select({ startsAt: bookings.startsAt })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!booking) return;

    const hoursUntilStart = (booking.startsAt.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilStart > policies.cancelWindowHours) return;

    await tryEnforceFee(bookingId, "late_cancellation");
  } catch (err) {
    Sentry.captureException(err);
  }
}

async function tryRefundCancellationDeposit(
  bookingId: number,
): Promise<CancellationRefundResult | null> {
  try {
    const policies = await getPolicies();

    const [booking] = await db
      .select({
        startsAt: bookings.startsAt,
        depositPaidInCents: bookings.depositPaidInCents,
        clientId: bookings.clientId,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!booking) return null;

    const depositInCents = booking.depositPaidInCents ?? 0;
    const hoursUntilAppointment = (booking.startsAt.getTime() - Date.now()) / (1000 * 60 * 60);

    if (depositInCents <= 0) {
      const result: CancellationRefundResult = {
        decision: "no_deposit",
        refundAmountInCents: 0,
        depositAmountInCents: 0,
        hoursUntilAppointment,
      };
      await logAction({
        actorId: null,
        action: "update",
        entityType: "booking",
        entityId: String(bookingId),
        description: "Cancellation refund skipped — no deposit on file",
        metadata: { decision: result.decision, hoursUntilAppointment },
      });
      return result;
    }

    let decision: CancellationRefundResult["decision"];
    let refundAmountInCents: number;

    if (hoursUntilAppointment >= policies.fullRefundHours) {
      decision = "full_refund";
      refundAmountInCents = depositInCents;
    } else if (hoursUntilAppointment >= policies.partialRefundMinHours) {
      decision = "partial_refund";
      refundAmountInCents = Math.round((depositInCents * policies.partialRefundPct) / 100);
    } else {
      decision = "no_refund";
      refundAmountInCents = 0;
    }

    const result: CancellationRefundResult = {
      decision,
      refundAmountInCents,
      depositAmountInCents: depositInCents,
      hoursUntilAppointment,
    };

    if (refundAmountInCents > 0) {
      const [depositPayment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.bookingId, bookingId),
            eq(payments.clientId, booking.clientId),
            inArray(payments.status, ["paid", "partially_refunded"]),
          ),
        );

      if (depositPayment?.squarePaymentId && isSquareConfigured()) {
        const idempotencyKey = `refund-${bookingId}`;

        try {
          const refundResponse = await squareClient.refunds.refundPayment({
            idempotencyKey,
            paymentId: depositPayment.squarePaymentId,
            amountMoney: {
              amount: BigInt(refundAmountInCents),
              currency: "USD",
            },
            reason: `Cancellation ${decision.replace("_", " ")} — booking #${bookingId}`,
          });

          const squareRefundId = refundResponse.refund?.id ?? null;

          const newRefundedTotal = depositPayment.refundedInCents + refundAmountInCents;
          const isFullRefund = newRefundedTotal >= depositPayment.amountInCents;

          await db.transaction(async (tx) => {
            await tx
              .update(payments)
              .set({
                refundedInCents: newRefundedTotal,
                refundedAt: new Date(),
                status: isFullRefund ? "refunded" : "partially_refunded",
                squareRefundId,
              })
              .where(eq(payments.id, depositPayment.id));

            await tx.insert(syncLog).values({
              provider: "square",
              direction: "outbound",
              status: "success",
              entityType: "cancellation_refund",
              localId: String(depositPayment.id),
              remoteId: squareRefundId ?? depositPayment.squarePaymentId,
              message: `Cancellation ${decision.replace("_", " ")}: $${(refundAmountInCents / 100).toFixed(2)} refunded for booking #${bookingId}`,
            });
          });
        } catch (err) {
          Sentry.captureException(err);
          const message = err instanceof Error ? err.message : "Square refund failed";

          await db.insert(syncLog).values({
            provider: "square",
            direction: "outbound",
            status: "failed",
            entityType: "cancellation_refund",
            localId: String(depositPayment.id),
            remoteId: depositPayment.squarePaymentId,
            message: `Cancellation refund of $${(refundAmountInCents / 100).toFixed(2)} failed for booking #${bookingId}`,
            errorMessage: message,
          });
        }
      } else if (depositPayment && !depositPayment.squarePaymentId) {
        const newRefundedTotal = depositPayment.refundedInCents + refundAmountInCents;
        const isFullRefund = newRefundedTotal >= depositPayment.amountInCents;

        await db
          .update(payments)
          .set({
            refundedInCents: newRefundedTotal,
            refundedAt: new Date(),
            status: isFullRefund ? "refunded" : "partially_refunded",
          })
          .where(eq(payments.id, depositPayment.id));
      }
    }

    await logAction({
      actorId: null,
      action: "update",
      entityType: "booking",
      entityId: String(bookingId),
      description: `Cancellation refund: ${decision.replace("_", " ")} — $${(refundAmountInCents / 100).toFixed(2)} of $${(depositInCents / 100).toFixed(2)} deposit`,
      metadata: {
        decision,
        refundAmountInCents,
        depositAmountInCents: depositInCents,
        hoursUntilAppointment: Math.round(hoursUntilAppointment * 100) / 100,
        policySnapshot: {
          fullRefundHours: policies.fullRefundHours,
          partialRefundPct: policies.partialRefundPct,
          partialRefundMinHours: policies.partialRefundMinHours,
          noRefundHours: policies.noRefundHours,
        },
      },
    });

    return result;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

async function tryNotifyWaitlist(cancelledBookingId: number): Promise<void> {
  await notifyWaitlistForCancelledBooking(cancelledBookingId);
}

/* ------------------------------------------------------------------ */
/*  Zoho Books invoice (non-fatal)                                     */
/* ------------------------------------------------------------------ */

async function tryCreateZohoBooksInvoice(bookingId: number): Promise<void> {
  try {
    const { createZohoBooksInvoice } = await import("@/lib/zoho-books");
    const invoiceClient = alias(profiles, "invoiceClient");

    const [row] = await db
      .select({
        clientId: bookings.clientId,
        clientEmail: invoiceClient.email,
        clientFirstName: invoiceClient.firstName,
        clientLastName: invoiceClient.lastName,
        clientPhone: invoiceClient.phone,
        serviceName: services.name,
        totalInCents: bookings.totalInCents,
        depositPaidInCents: bookings.depositPaidInCents,
        zohoInvoiceId: bookings.zohoInvoiceId,
      })
      .from(bookings)
      .innerJoin(invoiceClient, eq(bookings.clientId, invoiceClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!row || row.zohoInvoiceId) return;

    createZohoBooksInvoice({
      entityType: "booking",
      entityId: bookingId,
      profileId: row.clientId,
      email: row.clientEmail,
      firstName: row.clientFirstName,
      lastName: row.clientLastName ?? undefined,
      phone: row.clientPhone,
      lineItems: [{ name: row.serviceName, rate: row.totalInCents, quantity: 1 }],
      depositInCents: row.depositPaidInCents ?? undefined,
    });
  } catch {
    // Non-fatal
  }
}
