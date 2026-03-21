/**
 * GET /api/cron/recurring-bookings — Generate missing next bookings for
 * completed recurring series.
 *
 * Runs hourly via pg_cron as a safety net. The primary path creates the next
 * occurrence inline when a booking is marked completed (updateBookingStatus →
 * generateNextRecurringBooking). This cron catches cases where that inline
 * call silently failed (DB timeout, transient error, etc.).
 *
 * Logic:
 *  1. Find completed bookings that have a recurrenceRule OR subscriptionId.
 *  2. Exclude bookings that already spawned a successor (a non-cancelled
 *     booking with the same parentBookingId and a later startsAt).
 *  3. Exclude bookings already processed by this cron (sync_log dedup).
 *  4. For each orphan, call the same generation logic used inline.
 *
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */
import { NextResponse } from "next/server";
import { and, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { bookings, bookingSubscriptions, profiles, services, syncLog } from "@/db/schema";
import { RecurringBookingConfirmation } from "@/emails/RecurringBookingConfirmation";
import { sendEmail } from "@/lib/resend";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find completed bookings that are recurring (have rrule or subscription)
  // and were completed in the last 48h (limits blast radius on first deploy).
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const candidates = await db
    .select({
      id: bookings.id,
      clientId: bookings.clientId,
      serviceId: bookings.serviceId,
      staffId: bookings.staffId,
      startsAt: bookings.startsAt,
      durationMinutes: bookings.durationMinutes,
      totalInCents: bookings.totalInCents,
      location: bookings.location,
      recurrenceRule: bookings.recurrenceRule,
      parentBookingId: bookings.parentBookingId,
      subscriptionId: bookings.subscriptionId,
      completedAt: bookings.completedAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "completed"),
        isNull(bookings.deletedAt),
        gt(bookings.completedAt, cutoff),
        or(isNotNull(bookings.recurrenceRule), isNotNull(bookings.subscriptionId)),
      ),
    );

  if (candidates.length === 0) {
    return NextResponse.json({ checked: 0, created: 0, skipped: 0 });
  }

  // For each candidate, check if a successor already exists.
  // A successor is a non-cancelled booking in the same series with a later startsAt.
  const candidateIds = candidates.map((c) => c.id);
  const seriesRoots = candidates.map((c) => c.parentBookingId ?? c.id);

  // Find all existing successors in one query
  const existingSuccessors = await db
    .select({
      parentBookingId: bookings.parentBookingId,
      startsAt: bookings.startsAt,
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.parentBookingId, seriesRoots),
        ne(bookings.status, "cancelled"),
        isNull(bookings.deletedAt),
      ),
    );

  // Check sync_log for already-processed bookings
  const alreadyProcessed = await db
    .select({ localId: syncLog.localId })
    .from(syncLog)
    .where(
      and(
        eq(syncLog.entityType, "recurring_booking_cron"),
        inArray(syncLog.localId, candidateIds.map(String)),
        eq(syncLog.status, "success"),
      ),
    );

  const processedSet = new Set(alreadyProcessed.map((r) => r.localId));

  let created = 0;
  let skipped = 0;

  for (const booking of candidates) {
    const localId = String(booking.id);

    // Already handled by this cron
    if (processedSet.has(localId)) {
      skipped++;
      continue;
    }

    const seriesRoot = booking.parentBookingId ?? booking.id;

    // Check if a successor already exists (created by inline trigger or manually)
    const hasSuccessor = existingSuccessors.some(
      (s) => s.parentBookingId === seriesRoot && s.startsAt > booking.startsAt,
    );

    if (hasSuccessor) {
      // Mark as processed so we don't re-check next hour
      await db.insert(syncLog).values({
        provider: "resend",
        direction: "outbound",
        status: "skipped",
        entityType: "recurring_booking_cron",
        localId,
        message: "Successor already exists",
      });
      skipped++;
      continue;
    }

    // ── Generate next booking ──────────────────────────────────────────
    try {
      const nextStart = new Date(booking.startsAt);

      // Subscription path
      if (booking.subscriptionId) {
        const [sub] = await db
          .select()
          .from(bookingSubscriptions)
          .where(eq(bookingSubscriptions.id, booking.subscriptionId))
          .limit(1);

        if (!sub || sub.status !== "active") {
          await db.insert(syncLog).values({
            provider: "resend",
            direction: "outbound",
            status: "skipped",
            entityType: "recurring_booking_cron",
            localId,
            message: `Subscription ${booking.subscriptionId} not active`,
          });
          skipped++;
          continue;
        }

        const newSessionsUsed = sub.sessionsUsed + 1;

        if (newSessionsUsed >= sub.totalSessions) {
          await db
            .update(bookingSubscriptions)
            .set({ sessionsUsed: newSessionsUsed, status: "completed" })
            .where(eq(bookingSubscriptions.id, sub.id));
          await db.insert(syncLog).values({
            provider: "resend",
            direction: "outbound",
            status: "skipped",
            entityType: "recurring_booking_cron",
            localId,
            message: "Subscription exhausted",
          });
          skipped++;
          continue;
        }

        await db
          .update(bookingSubscriptions)
          .set({ sessionsUsed: newSessionsUsed })
          .where(eq(bookingSubscriptions.id, sub.id));

        nextStart.setDate(nextStart.getDate() + sub.intervalDays);

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
            recurrenceRule: booking.recurrenceRule ?? undefined,
            parentBookingId: seriesRoot,
            subscriptionId: sub.id,
            status: "confirmed",
            confirmedAt: new Date(),
          })
          .returning({ id: bookings.id });

        await trySendRecurringConfirmation(
          newBooking.id,
          nextStart,
          booking.durationMinutes,
          booking.totalInCents,
        );

        await db.insert(syncLog).values({
          provider: "resend",
          direction: "outbound",
          status: "success",
          entityType: "recurring_booking_cron",
          localId,
          message: `Created booking #${newBooking.id} (subscription)`,
        });
        created++;
        continue;
      }

      // RRULE path
      if (!booking.recurrenceRule) {
        skipped++;
        continue;
      }

      const interval = parseRRule(booking.recurrenceRule);
      if (!interval) {
        skipped++;
        continue;
      }

      if (interval.days) {
        nextStart.setDate(nextStart.getDate() + interval.days);
      } else if (interval.months) {
        nextStart.setMonth(nextStart.getMonth() + interval.months);
      }

      // Respect UNTIL
      if (interval.until && nextStart > interval.until) {
        await db.insert(syncLog).values({
          provider: "resend",
          direction: "outbound",
          status: "skipped",
          entityType: "recurring_booking_cron",
          localId,
          message: "Past series UNTIL date",
        });
        skipped++;
        continue;
      }

      // Respect COUNT
      if (interval.count) {
        const [{ total }] = await db
          .select({ total: sql<number>`count(*)` })
          .from(bookings)
          .where(and(eq(bookings.parentBookingId, seriesRoot), isNull(bookings.deletedAt)));
        if (Number(total) + 1 >= interval.count) {
          await db.insert(syncLog).values({
            provider: "resend",
            direction: "outbound",
            status: "skipped",
            entityType: "recurring_booking_cron",
            localId,
            message: "Series COUNT limit reached",
          });
          skipped++;
          continue;
        }
      }

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

      await trySendRecurringConfirmation(
        newBooking.id,
        nextStart,
        booking.durationMinutes,
        booking.totalInCents,
      );

      await db.insert(syncLog).values({
        provider: "resend",
        direction: "outbound",
        status: "success",
        entityType: "recurring_booking_cron",
        localId,
        message: `Created booking #${newBooking.id} (rrule)`,
      });
      created++;
    } catch (err) {
      await db.insert(syncLog).values({
        provider: "resend",
        direction: "outbound",
        status: "failed",
        entityType: "recurring_booking_cron",
        localId,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    checked: candidates.length,
    created,
    skipped,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

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

async function trySendRecurringConfirmation(
  newBookingId: number,
  nextStart: Date,
  durationMinutes: number,
  totalInCents: number,
): Promise<void> {
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
      .where(and(eq(bookings.id, newBookingId), isNull(bookings.deletedAt)));

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
          durationMinutes,
          totalInCents,
          businessName: bp.businessName,
        }),
        entityType: "recurring_booking_confirmation",
        localId: String(newBookingId),
      });
    }
  } catch {
    // Non-fatal
  }
}
