"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, and, sql, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { bookings, bookingServices, bookingSubscriptions, profiles, services } from "@/db/schema";
import { RecurringBookingConfirmation } from "@/emails/RecurringBookingConfirmation";
import { logAction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import type { ActionResult } from "@/lib/types/action-result";
import type { BookingInput } from "@/lib/types/booking.types";
import {
  bookingInputSchema,
  hasOverlappingBooking,
  hasApprovedTimeOffConflict,
} from "./booking-crud";

/** Alias for readability — all mutations in this file require admin access. */
const getUser = requireAdmin;

export type RecurringBookingResult =
  | { success: true; created: number; skipped: string[] }
  | { success: false; error: string };

/* ------------------------------------------------------------------ */
/*  RRULE parser                                                       */
/* ------------------------------------------------------------------ */

function parseRRule(rule: string): {
  days?: number;
  months?: number;
  until?: Date;
  count?: number;
} | null {
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=")));
  const freq = parts.FREQ;
  const interval = Number(parts.INTERVAL ?? 1);
  if (!freq || isNaN(interval)) return null;

  let days: number | undefined;
  let months: number | undefined;
  if (freq === "WEEKLY") days = interval * 7;
  else if (freq === "MONTHLY") months = interval;
  else return null;

  let until: Date | undefined;
  if (parts.UNTIL) {
    const u = parts.UNTIL;
    until = new Date(
      Date.UTC(parseInt(u.slice(0, 4)), parseInt(u.slice(4, 6)) - 1, parseInt(u.slice(6, 8))),
    );
  }

  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : undefined;
  return { days, months, until, count };
}

/* ------------------------------------------------------------------ */
/*  Create recurring series                                            */
/* ------------------------------------------------------------------ */

export async function createRecurringBooking(input: BookingInput): Promise<RecurringBookingResult> {
  try {
    bookingInputSchema.parse(input);
    const user = await getUser();

    if (!input.recurrenceRule) {
      return { success: false, error: "Recurrence rule is required" };
    }

    const interval = parseRRule(input.recurrenceRule);
    if (!interval) {
      return { success: false, error: "Invalid recurrence rule" };
    }

    const maxOccurrences = interval.count ?? 12;
    const dates: Date[] = [input.startsAt];

    for (let i = 1; i < maxOccurrences; i++) {
      const prev = dates[dates.length - 1];
      const next = new Date(prev);
      if (interval.days) {
        next.setDate(next.getDate() + interval.days);
      } else if (interval.months) {
        next.setMonth(next.getMonth() + interval.months);
      }
      if (interval.until && next > interval.until) break;
      dates.push(next);
    }

    if (dates.length === 0) {
      return { success: false, error: "No valid dates generated from recurrence rule" };
    }

    const skipped: string[] = [];
    const validDates: Date[] = [];

    if (input.staffId) {
      for (const date of dates) {
        const conflict = await hasOverlappingBooking(
          input.staffId,
          date,
          input.durationMinutes,
          undefined,
          input.locationId,
        );
        const timeOffConflict = await hasApprovedTimeOffConflict(
          input.staffId,
          date,
          input.durationMinutes,
        );
        if (conflict || timeOffConflict) {
          skipped.push(
            date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          );
        } else {
          validDates.push(date);
        }
      }
    } else {
      validDates.push(...dates);
    }

    if (validDates.length === 0) {
      return { success: false, error: "All dates conflict with existing bookings" };
    }

    const groupId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      if (input.staffId) {
        const lockKey = input.locationId ? `${input.staffId}:${input.locationId}` : input.staffId;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
      }

      for (let i = 0; i < validDates.length; i++) {
        const [newBooking] = await tx
          .insert(bookings)
          .values({
            clientId: input.clientId,
            serviceId: input.serviceId,
            staffId: input.staffId ?? undefined,
            startsAt: validDates[i],
            durationMinutes: input.durationMinutes,
            totalInCents: input.totalInCents,
            location: input.location ?? undefined,
            locationId: input.locationId ?? undefined,
            clientNotes: input.clientNotes ?? undefined,
            recurrenceRule: input.recurrenceRule,
            recurrenceGroupId: groupId,
            status: "confirmed",
            confirmedAt: new Date(),
          })
          .returning({ id: bookings.id });

        const serviceItems = input.services ?? [
          {
            serviceId: input.serviceId,
            priceInCents: input.totalInCents,
            durationMinutes: input.durationMinutes,
            depositInCents: 0,
          },
        ];
        await tx.insert(bookingServices).values(
          serviceItems.map((s, idx) => ({
            bookingId: newBooking.id,
            serviceId: s.serviceId,
            orderIndex: idx,
            priceInCents: s.priceInCents,
            durationMinutes: s.durationMinutes,
            depositInCents: s.depositInCents,
          })),
        );
      }
    });

    trackEvent(input.clientId, "recurring_booking_created", {
      groupId,
      count: validDates.length,
      skipped: skipped.length,
      serviceId: input.serviceId,
    });

    await logAction({
      actorId: user.id,
      action: "create",
      entityType: "booking",
      entityId: groupId,
      description: `Recurring series created: ${validDates.length} bookings`,
      metadata: {
        clientId: input.clientId,
        serviceId: input.serviceId,
        count: validDates.length,
        skipped,
      },
    });

    revalidatePath("/dashboard/bookings");
    return { success: true, created: validDates.length, skipped };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to create recurring bookings";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Auto-generate next recurring booking on completion                 */
/* ------------------------------------------------------------------ */

export async function generateNextRecurringBooking(bookingId: number): Promise<void> {
  try {
    const [booking] = await db
      .select({
        clientId: bookings.clientId,
        serviceId: bookings.serviceId,
        staffId: bookings.staffId,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        location: bookings.location,
        recurrenceRule: bookings.recurrenceRule,
        parentBookingId: bookings.parentBookingId,
        recurrenceGroupId: bookings.recurrenceGroupId,
        subscriptionId: bookings.subscriptionId,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!booking) return;

    const nextStart = new Date(booking.startsAt);

    if (booking.subscriptionId) {
      const [sub] = await db
        .select()
        .from(bookingSubscriptions)
        .where(eq(bookingSubscriptions.id, booking.subscriptionId))
        .limit(1);

      if (!sub || sub.status !== "active") return;

      const newSessionsUsed = sub.sessionsUsed + 1;

      if (newSessionsUsed >= sub.totalSessions) {
        await db
          .update(bookingSubscriptions)
          .set({ sessionsUsed: newSessionsUsed, status: "completed" })
          .where(eq(bookingSubscriptions.id, sub.id));
        return;
      }

      nextStart.setDate(nextStart.getDate() + sub.intervalDays);

      const seriesRoot = booking.parentBookingId ?? bookingId;

      const [newBooking] = await db.transaction(async (tx) => {
        await tx
          .update(bookingSubscriptions)
          .set({ sessionsUsed: newSessionsUsed })
          .where(eq(bookingSubscriptions.id, sub.id));

        return tx
          .insert(bookings)
          .values({
            clientId: booking.clientId,
            serviceId: booking.serviceId,
            staffId: booking.staffId ?? undefined,
            startsAt: nextStart,
            durationMinutes: booking.durationMinutes,
            totalInCents: booking.totalInCents,
            location: booking.location ?? undefined,
            recurrenceRule: booking.recurrenceRule ?? undefined,
            parentBookingId: seriesRoot,
            subscriptionId: sub.id,
            status: "confirmed",
            confirmedAt: new Date(),
          })
          .returning({ id: bookings.id });
      });

      try {
        const recurClient = alias(profiles, "recurClient");

        const [row] = await db
          .select({
            clientEmail: recurClient.email,
            clientFirstName: recurClient.firstName,
            notifyEmail: recurClient.notifyEmail,
            serviceName: services.name,
          })
          .from(bookings)
          .innerJoin(recurClient, eq(bookings.clientId, recurClient.id))
          .innerJoin(services, eq(bookings.serviceId, services.id))
          .where(and(eq(bookings.id, newBooking.id), isNull(bookings.deletedAt)));

        if (row?.clientEmail && row.notifyEmail) {
          const dateFormatted = nextStart.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          const bp = await getPublicBusinessProfile();
          await sendEmail({
            to: row.clientEmail,
            subject: `Next appointment scheduled — ${row.serviceName} — ${bp.businessName}`,
            react: RecurringBookingConfirmation({
              clientName: row.clientFirstName,
              serviceName: row.serviceName,
              startsAt: dateFormatted,
              durationMinutes: booking.durationMinutes,
              totalInCents: booking.totalInCents,
              businessName: bp.businessName,
            }),
            entityType: "recurring_booking_confirmation",
            localId: String(newBooking.id),
          });
        }
      } catch {
        // Non-fatal
      }
      return;
    }

    if (!booking.recurrenceRule) return;

    const interval = parseRRule(booking.recurrenceRule);
    if (!interval) return;

    if (interval.days) {
      nextStart.setDate(nextStart.getDate() + interval.days);
    } else if (interval.months) {
      nextStart.setMonth(nextStart.getMonth() + interval.months);
    }

    if (interval.until && nextStart > interval.until) return;

    if (interval.count) {
      const seriesRoot = booking.parentBookingId ?? bookingId;

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.parentBookingId, seriesRoot), isNull(bookings.deletedAt)));
      if (Number(total) + 1 >= interval.count) return;
    }

    const seriesRoot = booking.parentBookingId ?? bookingId;

    const [newBooking] = await db
      .insert(bookings)
      .values({
        clientId: booking.clientId,
        serviceId: booking.serviceId,
        staffId: booking.staffId ?? undefined,
        startsAt: nextStart,
        durationMinutes: booking.durationMinutes,
        totalInCents: booking.totalInCents,
        location: booking.location ?? undefined,
        recurrenceRule: booking.recurrenceRule,
        parentBookingId: seriesRoot,
        status: "confirmed",
        confirmedAt: new Date(),
      })
      .returning({ id: bookings.id });

    try {
      const recurClient = alias(profiles, "recurClient");

      const [row] = await db
        .select({
          clientEmail: recurClient.email,
          clientFirstName: recurClient.firstName,
          notifyEmail: recurClient.notifyEmail,
          serviceName: services.name,
        })
        .from(bookings)
        .innerJoin(recurClient, eq(bookings.clientId, recurClient.id))
        .innerJoin(services, eq(bookings.serviceId, services.id))
        .where(and(eq(bookings.id, newBooking.id), isNull(bookings.deletedAt)));

      if (row?.clientEmail && row.notifyEmail) {
        const dateFormatted = nextStart.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        const bp = await getPublicBusinessProfile();
        await sendEmail({
          to: row.clientEmail,
          subject: `Next appointment scheduled — ${row.serviceName} — ${bp.businessName}`,
          react: RecurringBookingConfirmation({
            clientName: row.clientFirstName,
            serviceName: row.serviceName,
            startsAt: dateFormatted,
            durationMinutes: booking.durationMinutes,
            totalInCents: booking.totalInCents,
            businessName: bp.businessName,
          }),
          entityType: "recurring_booking_confirmation",
          localId: String(newBooking.id),
        });
      }
    } catch {
      // Non-fatal
    }
  } catch {
    // Non-fatal — recurrence generation failure must never block the completion write
  }
}

/* ------------------------------------------------------------------ */
/*  Cancel recurring series                                            */
/* ------------------------------------------------------------------ */

export async function cancelBookingSeries(bookingId: number): Promise<ActionResult<void>> {
  try {
    z.number().int().positive().parse(bookingId);
    const user = await getUser();

    const [booking] = await db
      .select({
        parentBookingId: bookings.parentBookingId,
        recurrenceGroupId: bookings.recurrenceGroupId,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!booking) throw new Error("Booking not found");

    const now = new Date();

    let seriesCondition;
    if (booking.recurrenceGroupId) {
      seriesCondition = eq(bookings.recurrenceGroupId, booking.recurrenceGroupId);
    } else {
      const seriesRoot = booking.parentBookingId ?? bookingId;
      seriesCondition = sql`(${bookings.id} = ${seriesRoot} OR ${bookings.parentBookingId} = ${seriesRoot})`;
    }

    const seriesBookings = await db
      .select({ id: bookings.id, status: bookings.status })
      .from(bookings)
      .where(
        and(
          seriesCondition,
          sql`${bookings.startsAt} >= ${now.toISOString()}`,
          sql`${bookings.status} NOT IN ('cancelled', 'completed', 'no_show')`,
          isNull(bookings.deletedAt),
        ),
      );

    if (seriesBookings.length === 0) return { success: true as const, data: undefined };

    await db
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(
        sql`${bookings.id} IN (${sql.join(
          seriesBookings.map((b) => sql`${b.id}`),
          sql`, `,
        )})`,
      );

    await logAction({
      actorId: user.id,
      action: "status_change",
      entityType: "booking",
      entityId: String(bookingId),
      description: `Recurring series cancelled — ${seriesBookings.length} future booking(s) cancelled`,
      metadata: {
        recurrenceGroupId: booking.recurrenceGroupId ?? undefined,
        parentBookingId: booking.parentBookingId ?? bookingId,
        cancelledCount: seriesBookings.length,
      },
    });

    revalidatePath("/dashboard/bookings");
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to cancel series";
    return { success: false, error: message };
  }
}
