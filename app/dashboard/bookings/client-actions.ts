/**
 * app/dashboard/bookings/client-actions.ts — Server actions for the client-facing bookings page.
 *
 * Provides the data loader (getClientBookings) and mutation actions
 * (submitClientReview, rescheduleClientBooking, cancelClientBooking)
 * used by ClientBookingsPage. All actions are scoped to the authenticated
 * client — they verify booking ownership before mutating.
 *
 * Key operations:
 *   getClientBookings()
 *     — Fetches all bookings for the current client with staff + service info.
 *       Uses a Drizzle alias for the staff profile join.
 *     — Batch-fetches add-ons for all booking IDs in a single query using
 *       SQL ANY(), then groups them into a Map keyed by bookingId.
 *     — Batch-checks which bookings already have a client review using a Set.
 *     — rows.map() transforms each DB row into a ClientBookingRow:
 *       date formatting, cents→dollars, status normalization (no_show→cancelled).
 *
 *   cancelClientBooking()
 *     — Enforces 24-hour cancellation window by computing hoursUntilAppointment.
 *     — After cancelling, fires notifyWaitlistForCancelledBooking() in a
 *       fire-and-forget pattern (.catch(() => {})) so the client doesn't wait.
 *     — Marks the Zoho CRM deal as "Closed Lost".
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, and, sql, isNull, isNotNull, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import {
  bookings,
  bookingAddOns,
  bookingServices,
  services,
  profiles,
  reviews,
  payments,
  notifications,
  settings,
  businessHours,
  timeOff,
  syncLog,
} from "@/db/schema";
import { BookingCancellation } from "@/emails/BookingCancellation";
import { BookingReschedule } from "@/emails/BookingReschedule";
import { logAction } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { calendarUrl } from "@/lib/calendar-token";
import { trackEvent } from "@/lib/posthog";
import { sendEmail, getEmailRecipient } from "@/lib/resend";
import { squareClient, isSquareConfigured } from "@/lib/square";
import type { ClientBookingRow, ClientBookingsData } from "@/lib/types/booking.types";
import { notifyWaitlistForCancelledBooking } from "@/lib/waitlist-notify";
import { updateZohoDeal, logZohoNote } from "@/lib/zoho";

const PATH = "/dashboard/bookings";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type { ClientBookingRow, ClientBookingsData } from "@/lib/types/booking.types";

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getClientBookings(): Promise<ClientBookingsData> {
  try {
    const user = await getUser();

    const staffProfile = alias(profiles, "staff");

    // Fetch bookings with service + staff info
    const rows = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        clientNotes: bookings.clientNotes,
        location: bookings.location,
        serviceName: services.name,
        serviceCategory: services.category,
        staffFirstName: staffProfile.firstName,
        depositPaidInCents: bookings.depositPaidInCents,
      })
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
      .where(and(eq(bookings.clientId, user.id), isNull(bookings.deletedAt)))
      .orderBy(desc(bookings.startsAt));

    // Fetch add-ons for all bookings in one query
    const bookingIds = rows.map((r) => r.id);
    const addOnMap = new Map<number, { name: string; priceInCents: number }[]>();

    if (bookingIds.length > 0) {
      const addOnRows = await db
        .select({
          bookingId: bookingAddOns.bookingId,
          name: bookingAddOns.addOnName,
          priceInCents: bookingAddOns.priceInCents,
        })
        .from(bookingAddOns)
        .where(sql`${bookingAddOns.bookingId} = ANY(${bookingIds})`);

      for (const a of addOnRows) {
        if (!addOnMap.has(a.bookingId)) addOnMap.set(a.bookingId, []);
        addOnMap.get(a.bookingId)!.push({ name: a.name, priceInCents: a.priceInCents });
      }
    }

    // Fetch booking_services for all bookings
    const bsMap = new Map<
      number,
      {
        serviceId: number;
        serviceName: string;
        serviceCategory: string;
        priceInCents: number;
        durationMinutes: number;
        depositInCents: number;
        orderIndex: number;
      }[]
    >();
    if (bookingIds.length > 0) {
      const bsRows = await db
        .select({
          bookingId: bookingServices.bookingId,
          serviceId: bookingServices.serviceId,
          orderIndex: bookingServices.orderIndex,
          priceInCents: bookingServices.priceInCents,
          durationMinutes: bookingServices.durationMinutes,
          depositInCents: bookingServices.depositInCents,
          serviceName: services.name,
          serviceCategory: services.category,
        })
        .from(bookingServices)
        .leftJoin(services, eq(bookingServices.serviceId, services.id))
        .where(sql`${bookingServices.bookingId} = ANY(${bookingIds})`)
        .orderBy(bookingServices.orderIndex);

      for (const bs of bsRows) {
        const list = bsMap.get(bs.bookingId) ?? [];
        list.push({
          serviceId: bs.serviceId,
          serviceName: bs.serviceName ?? "",
          serviceCategory: bs.serviceCategory ?? "lash",
          priceInCents: bs.priceInCents,
          durationMinutes: bs.durationMinutes,
          depositInCents: bs.depositInCents,
          orderIndex: bs.orderIndex,
        });
        bsMap.set(bs.bookingId, list);
      }
    }

    // Check which bookings already have a review from this client
    const reviewedBookingIds = new Set<number>();
    if (bookingIds.length > 0) {
      const reviewRows = await db
        .select({ bookingId: reviews.bookingId })
        .from(reviews)
        .where(and(eq(reviews.clientId, user.id), sql`${reviews.bookingId} = ANY(${bookingIds})`));
      for (const r of reviewRows) {
        if (r.bookingId) reviewedBookingIds.add(r.bookingId);
      }
    }

    const DAY_NAMES_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTH_NAMES = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const bookingList: ClientBookingRow[] = rows.map((r) => {
      const d = new Date(r.startsAt);
      const category = (r.serviceCategory as ClientBookingRow["category"]) ?? "lash";

      // Filter to statuses the UI supports
      let status: ClientBookingRow["status"] = "pending";
      if (r.status === "confirmed") status = "confirmed";
      else if (r.status === "completed") status = "completed";
      else if (r.status === "cancelled" || r.status === "no_show") status = "cancelled";
      else status = "pending";

      return {
        id: r.id,
        dateISO: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        startsAtISO: d.toISOString(),
        date: `${DAY_NAMES_FULL[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
        time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        service: r.serviceName ?? "Service",
        category,
        assistant: r.staffFirstName ?? "Staff",
        durationMin: r.durationMinutes,
        price: r.totalInCents / 100,
        status,
        notes: r.clientNotes,
        location: r.location,
        addOns: addOnMap.get(r.id) ?? [],
        services: bsMap.get(r.id) ?? [],
        reviewLeft: reviewedBookingIds.has(r.id),
        depositPaid: (r.depositPaidInCents ?? 0) > 0,
      };
    });

    // Fetch cancellation policy settings (no auth needed — public setting)
    const [policyRow] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "policy_settings"))
      .limit(1);
    const policyData =
      (policyRow?.value as { cancelWindowHours?: number; lateCancelFeePercent?: number } | null) ??
      {};
    const policySettings = {
      cancelWindowHours: policyData.cancelWindowHours ?? 48,
      lateCancelFeePercent: policyData.lateCancelFeePercent ?? 50,
    };

    return {
      bookings: bookingList,
      calendarUrl: calendarUrl(user.id),
      policy: policySettings,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Submit review                                                      */
/* ------------------------------------------------------------------ */

const submitClientReviewSchema = z.object({
  bookingId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
});

export async function submitClientReview(data: {
  bookingId: number;
  rating: number;
  comment: string;
}) {
  try {
    submitClientReviewSchema.parse(data);
    const user = await getUser();

    // Verify the booking belongs to this client
    const [booking] = await db
      .select({
        clientId: bookings.clientId,
        serviceId: bookings.serviceId,
      })
      .from(bookings)
      .where(and(eq(bookings.id, data.bookingId), isNull(bookings.deletedAt)))
      .limit(1);

    if (!booking || booking.clientId !== user.id) {
      throw new Error("Booking not found");
    }

    // Get service name for the review
    const [service] = await db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.id, booking.serviceId))
      .limit(1);

    // Check if review already exists for this booking
    const [existing] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.clientId, user.id), eq(reviews.bookingId, data.bookingId)))
      .limit(1);

    if (existing) throw new Error("Review already submitted");

    await db.insert(reviews).values({
      bookingId: data.bookingId,
      clientId: user.id,
      source: "website",
      rating: data.rating,
      body: data.comment || null,
      serviceName: service?.name ?? "Service",
      status: "pending",
    });

    trackEvent(user.id, "review_submitted", {
      bookingId: data.bookingId,
      rating: data.rating,
      serviceName: service?.name ?? "Service",
      hasComment: !!data.comment,
    });

    // Zoho CRM: add review as note on contact
    logZohoNote(
      user.id,
      `Review: ${service?.name ?? "Service"} (${data.rating}/5)`,
      data.comment || "(No comment)",
    );

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Available reschedule slots                                        */
/* ------------------------------------------------------------------ */

/** Returns available 30-minute time slots for a given booking and date. */
export async function getAvailableRescheduleSlots(
  bookingId: number,
  dateISO: string,
): Promise<{ time: string; label: string }[]> {
  try {
    await getUser();
    z.number().int().positive().parse(bookingId);
    z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(dateISO);

    // Get booking details to know service duration and assigned staff
    const [booking] = await db
      .select({
        staffId: bookings.staffId,
        durationMinutes: bookings.durationMinutes,
        clientId: bookings.clientId,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)))
      .limit(1);

    if (!booking) return [];

    // Parse the requested date
    const [yr, mo, dy] = dateISO.split("-").map(Number);
    const localDate = new Date(yr, mo - 1, dy);
    // JS getDay(): 0=Sun,1=Mon,...,6=Sat → ISO: 1=Mon,...,7=Sun
    const jsDay = localDate.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    // Check time-off: studio-wide OR staff-specific
    const timeOffConditions = [isNull(timeOff.staffId)];
    if (booking.staffId) timeOffConditions.push(eq(timeOff.staffId, booking.staffId));
    const timeOffBlocks = await db
      .select({ startDate: timeOff.startDate, endDate: timeOff.endDate })
      .from(timeOff)
      .where(
        inArray(
          timeOff.staffId,
          booking.staffId
            ? [null as unknown as string, booking.staffId]
            : [null as unknown as string],
        ),
      );

    const isBlocked = timeOffBlocks.some((b) => dateISO >= b.startDate && dateISO <= b.endDate);
    if (isBlocked) return [];

    // Get business hours: prefer staff-specific, fall back to studio
    let hoursRow: { isOpen: boolean; opensAt: string | null; closesAt: string | null } | null =
      null;
    if (booking.staffId) {
      const [staffHours] = await db
        .select({
          isOpen: businessHours.isOpen,
          opensAt: businessHours.opensAt,
          closesAt: businessHours.closesAt,
        })
        .from(businessHours)
        .where(and(eq(businessHours.staffId, booking.staffId), eq(businessHours.dayOfWeek, isoDay)))
        .limit(1);
      if (staffHours) hoursRow = staffHours;
    }
    if (!hoursRow) {
      const [studioHours] = await db
        .select({
          isOpen: businessHours.isOpen,
          opensAt: businessHours.opensAt,
          closesAt: businessHours.closesAt,
        })
        .from(businessHours)
        .where(and(isNull(businessHours.staffId), eq(businessHours.dayOfWeek, isoDay)))
        .limit(1);
      if (studioHours) hoursRow = studioHours;
    }
    if (!hoursRow?.isOpen || !hoursRow.opensAt || !hoursRow.closesAt) return [];

    // Get lunch break setting
    const [lunchRow] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "lunch_break"))
      .limit(1);
    const lunch = lunchRow?.value as { enabled: boolean; start: string; end: string } | null;

    // Get min notice hours from booking rules
    const [rulesRow] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "booking_rules"))
      .limit(1);
    const minNoticeHours =
      (rulesRow?.value as { minNoticeHours?: number } | null)?.minNoticeHours ?? 24;

    // Generate 30-min slots between open and close, skipping lunch
    const [oh, om] = hoursRow.opensAt.split(":").map(Number);
    const [ch, cm] = hoursRow.closesAt.split(":").map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;

    let lunchStart = -1;
    let lunchEnd = -1;
    if (lunch?.enabled) {
      const [lh, lm] = lunch.start.split(":").map(Number);
      const [leh, lem] = lunch.end.split(":").map(Number);
      lunchStart = lh * 60 + lm;
      lunchEnd = leh * 60 + lem;
    }

    const rawSlots: string[] = [];
    for (let min = openMin; min + booking.durationMinutes <= closeMin; min += 30) {
      if (lunchStart >= 0 && min >= lunchStart && min < lunchEnd) continue;
      const hh = String(Math.floor(min / 60)).padStart(2, "0");
      const mm = String(min % 60).padStart(2, "0");
      rawSlots.push(`${hh}:${mm}`);
    }

    // Filter: slots must be at least minNoticeHours in the future
    const minStartMs = Date.now() + minNoticeHours * 60 * 60 * 1000;

    // Fetch existing confirmed/in_progress bookings for this staff on ±1 day range
    const dayStart = new Date(yr, mo - 1, dy, 0, 0, 0);
    const dayEnd = new Date(yr, mo - 1, dy + 1, 0, 0, 0);
    const existingBookings = booking.staffId
      ? await db
          .select({ startsAt: bookings.startsAt, durationMinutes: bookings.durationMinutes })
          .from(bookings)
          .where(
            and(
              eq(bookings.staffId, booking.staffId),
              inArray(bookings.status, ["confirmed", "in_progress"]),
              ne(bookings.id, bookingId),
              sql`${bookings.startsAt} >= ${dayStart} AND ${bookings.startsAt} < ${dayEnd}`,
              isNull(bookings.deletedAt),
            ),
          )
      : [];

    // Filter slots by min notice and no overlap with existing bookings
    const available = rawSlots.filter((slot) => {
      const [sh, sm] = slot.split(":").map(Number);
      const slotMs = new Date(yr, mo - 1, dy, sh, sm).getTime();
      if (slotMs < minStartMs) return false;

      const slotEnd = slotMs + booking.durationMinutes * 60_000;
      for (const b of existingBookings) {
        const bStart = b.startsAt.getTime();
        const bEnd = bStart + b.durationMinutes * 60_000;
        if (slotMs < bEnd && slotEnd > bStart) return false;
      }
      return true;
    });

    // Format as 12-hour label
    return available.map((slot) => {
      const [sh, sm] = slot.split(":").map(Number);
      const h12 = sh % 12 || 12;
      const ap = sh < 12 ? "AM" : "PM";
      return { time: slot, label: `${h12}:${String(sm).padStart(2, "0")} ${ap}` };
    });
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Reschedule booking                                                 */
/* ------------------------------------------------------------------ */

export async function rescheduleClientBooking(bookingId: number, newStartsAt: string) {
  try {
    z.number().int().positive().parse(bookingId);
    z.string().min(1).parse(newStartsAt);
    const user = await getUser();

    const [booking] = await db
      .select({
        clientId: bookings.clientId,
        status: bookings.status,
        startsAt: bookings.startsAt,
        staffId: bookings.staffId,
        durationMinutes: bookings.durationMinutes,
        depositPaidInCents: bookings.depositPaidInCents,
        serviceName: services.name,
      })
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)))
      .limit(1);

    if (!booking || booking.clientId !== user.id) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "pending" && booking.status !== "confirmed") {
      throw new Error("This booking cannot be rescheduled");
    }

    // Read cancel window from policy settings (defaults to 48h)
    const [policyRow] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "policy_settings"))
      .limit(1);
    const cancelWindowHours =
      (policyRow?.value as { cancelWindowHours?: number } | null)?.cancelWindowHours ?? 48;

    const hoursUntilCurrent = (booking.startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilCurrent < cancelWindowHours) {
      throw new Error(
        `Bookings cannot be rescheduled within ${cancelWindowHours} hours of the scheduled time. Please contact us directly.`,
      );
    }

    const newDate = new Date(newStartsAt);
    if (isNaN(newDate.getTime())) throw new Error("Invalid date");
    if (newDate <= new Date()) throw new Error("New appointment time must be in the future");

    const oldStartsAt = booking.startsAt.toISOString();

    // Use advisory lock + overlap check in a transaction to prevent concurrent
    // reschedule operations from booking the same slot (advisory lock pattern).
    await db.transaction(async (tx) => {
      // Lock this booking for the duration of the transaction
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${bookingId})`);

      // Re-read to confirm state hasn't changed under the lock
      const [fresh] = await tx
        .select({ status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);
      if (!fresh || (fresh.status !== "pending" && fresh.status !== "confirmed")) {
        throw new Error("Booking state changed — please refresh and try again");
      }

      // Check for overlapping bookings for the same staff at the new time
      if (booking.staffId) {
        const newEndsAt = new Date(newDate.getTime() + booking.durationMinutes * 60_000);
        const [conflict] = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(
            and(
              eq(bookings.staffId, booking.staffId),
              inArray(bookings.status, ["confirmed", "in_progress"]),
              ne(bookings.id, bookingId),
              sql`${bookings.startsAt} < ${newEndsAt}`,
              sql`${bookings.startsAt} + (${bookings.durationMinutes} || ' minutes')::interval > ${newDate}`,
              isNull(bookings.deletedAt),
            ),
          )
          .limit(1);
        if (conflict) {
          throw new Error("That time slot is no longer available. Please pick another time.");
        }
      }

      await tx
        .update(bookings)
        .set({
          startsAt: newDate,
          status: "pending",
          staffNotes: `Rescheduled by client from ${oldStartsAt}`,
        })
        .where(eq(bookings.id, bookingId));
    });

    trackEvent(user.id, "booking_rescheduled_by_client", {
      bookingId,
      oldStartsAt,
      newStartsAt,
    });

    await logAction({
      actorId: user.id,
      action: "update",
      entityType: "booking",
      entityId: String(bookingId),
      description: "Booking rescheduled by client",
      metadata: { oldStartsAt, newStartsAt },
    });

    // Send reschedule confirmation email (non-fatal)
    try {
      const recipient = await getEmailRecipient(user.id);
      if (recipient) {
        const fmt = (d: Date) =>
          d.toLocaleString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
        await sendEmail({
          to: recipient.email,
          subject: `Booking rescheduled — ${booking.serviceName ?? "your service"} — T Creative`,
          react: BookingReschedule({
            clientName: recipient.firstName,
            serviceName: booking.serviceName ?? "Your service",
            oldDateTime: fmt(booking.startsAt),
            newDateTime: fmt(new Date(newStartsAt)),
          }),
          entityType: "booking_rescheduled",
          localId: String(bookingId),
        });
      }
    } catch {
      // Non-fatal
    }

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Cancel booking                                                     */
/* ------------------------------------------------------------------ */

export async function cancelClientBooking(bookingId: number) {
  try {
    z.number().int().positive().parse(bookingId);
    const user = await getUser();

    // Verify the booking belongs to this client and is cancellable
    const [booking] = await db
      .select({
        clientId: bookings.clientId,
        status: bookings.status,
        startsAt: bookings.startsAt,
        staffId: bookings.staffId,
        depositPaidInCents: bookings.depositPaidInCents,
        serviceName: services.name,
      })
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)))
      .limit(1);

    if (!booking || booking.clientId !== user.id) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "pending" && booking.status !== "confirmed") {
      throw new Error("This booking cannot be cancelled");
    }

    // Read cancel window from policy settings (defaults to 48h)
    const [policyRow] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "policy_settings"))
      .limit(1);
    const cancelWindowHours =
      (policyRow?.value as { cancelWindowHours?: number } | null)?.cancelWindowHours ?? 48;

    // Enforce cancellation window from settings
    const hoursUntilAppointment = (booking.startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilAppointment < cancelWindowHours) {
      throw new Error(
        `Appointments cannot be cancelled within ${cancelWindowHours} hours of the scheduled time. Please contact us directly.`,
      );
    }

    const depositPaidInCents = booking.depositPaidInCents ?? 0;
    const cancellationReason = "Cancelled by client";

    // Transaction: update booking status + notify staff atomically.
    // External calls (Square refund, email, Zoho, waitlist) run after commit.
    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason,
        })
        .where(eq(bookings.id, bookingId));

      if (booking.staffId) {
        const dateFormatted = booking.startsAt.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        await tx.insert(notifications).values({
          profileId: booking.staffId,
          type: "booking_cancellation",
          channel: "internal",
          status: "delivered",
          title: `Client cancelled: ${booking.serviceName ?? "Appointment"}`,
          body: `Booking on ${dateFormatted} has been cancelled by the client.`,
          relatedEntityType: "booking",
          relatedEntityId: bookingId,
        });
      }
    });

    // --- After commit: audit log, external calls, dependent DB writes ---

    trackEvent(user.id, "booking_cancelled_by_client", {
      bookingId,
      previousStatus: booking.status,
      depositPaidInCents,
    });

    await logAction({
      actorId: user.id,
      action: "status_change",
      entityType: "booking",
      entityId: String(bookingId),
      description: "Booking cancelled by client",
      metadata: { previousStatus: booking.status, depositPaidInCents },
    });

    // Trigger Square refund for any paid deposit payments (non-fatal)
    if (depositPaidInCents > 0 && isSquareConfigured()) {
      try {
        const depositPayments = await db
          .select({
            id: payments.id,
            squarePaymentId: payments.squarePaymentId,
            amountInCents: payments.amountInCents,
            refundedInCents: payments.refundedInCents,
          })
          .from(payments)
          .where(
            and(
              eq(payments.bookingId, bookingId),
              isNotNull(payments.squarePaymentId),
              inArray(payments.status, ["paid", "partially_refunded"]),
            ),
          );

        for (const pmt of depositPayments) {
          const refundable = pmt.amountInCents - pmt.refundedInCents;
          if (refundable <= 0 || !pmt.squarePaymentId) continue;
          try {
            // External: Square refund API call
            await squareClient.refunds.refundPayment({
              idempotencyKey: crypto.randomUUID(),
              paymentId: pmt.squarePaymentId,
              amountMoney: { amount: BigInt(refundable), currency: "USD" },
              reason: "Booking cancelled by client",
            });
            // Transaction: update payment + log sync atomically
            const newRefundedTotal = pmt.refundedInCents + refundable;
            await db.transaction(async (tx) => {
              await tx
                .update(payments)
                .set({
                  refundedInCents: newRefundedTotal,
                  refundedAt: new Date(),
                  status: newRefundedTotal >= pmt.amountInCents ? "refunded" : "partially_refunded",
                })
                .where(eq(payments.id, pmt.id));
              await tx.insert(syncLog).values({
                provider: "square",
                direction: "outbound",
                status: "success",
                entityType: "refund",
                localId: String(pmt.id),
                remoteId: pmt.squarePaymentId,
                message: `Deposit refunded $${(refundable / 100).toFixed(2)} — client self-cancel`,
              });
            });
          } catch (refundErr) {
            await db.insert(syncLog).values({
              provider: "square",
              direction: "outbound",
              status: "failed",
              entityType: "refund",
              localId: String(pmt.id),
              remoteId: pmt.squarePaymentId,
              message: `Deposit refund failed — client self-cancel booking #${bookingId}`,
              errorMessage: refundErr instanceof Error ? refundErr.message : "Square refund failed",
            });
          }
        }
      } catch {
        // Non-fatal — refund failure shouldn't block the cancellation
      }
    }

    // Send cancellation confirmation email to client (non-fatal)
    try {
      const recipient = await getEmailRecipient(user.id);
      if (recipient) {
        const dateFormatted = booking.startsAt.toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        await sendEmail({
          to: recipient.email,
          subject: `Booking cancelled — ${booking.serviceName ?? "your service"} — T Creative`,
          react: BookingCancellation({
            clientName: recipient.firstName,
            serviceName: booking.serviceName ?? "your service",
            bookingDate: dateFormatted,
            cancellationReason,
          }),
          entityType: "booking_cancellation",
          localId: String(bookingId),
        });
      }
    } catch {
      // Non-fatal
    }

    // Zoho CRM: mark deal as lost
    updateZohoDeal(bookingId, "Closed Lost");

    // Notify the next waitlisted client that this slot opened up
    notifyWaitlistForCancelledBooking(bookingId).catch(() => {});

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
