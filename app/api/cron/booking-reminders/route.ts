/**
 * GET /api/cron/booking-reminders — Send 24h and 48h booking reminders.
 *
 * Runs hourly via pg_cron. Finds confirmed bookings starting in 23–25h
 * and 47–49h windows, deduplicates against sync_log, and sends reminder
 * emails via Resend.
 *
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, profiles, services, syncLog } from "@/db/schema";
import { BookingReminder } from "@/emails/BookingReminder";
import { sendEmail } from "@/lib/resend";

type ReminderWindow = { label: string; hoursUntil: number; minHours: number; maxHours: number };

const REMINDER_WINDOWS: ReminderWindow[] = [
  { label: "24h", hoursUntil: 24, minHours: 23, maxHours: 25 },
  { label: "48h", hoursUntil: 48, minHours: 47, maxHours: 49 },
];

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let totalSent = 0;
  let totalFailed = 0;

  for (const window of REMINDER_WINDOWS) {
    const windowStart = new Date(now.getTime() + window.minHours * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + window.maxHours * 60 * 60 * 1000);

    // Find confirmed bookings in this reminder window
    const upcomingBookings = await db
      .select({
        bookingId: bookings.id,
        clientId: bookings.clientId,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        location: bookings.location,
        clientEmail: profiles.email,
        clientFirstName: profiles.firstName,
        notifyEmail: profiles.notifyEmail,
        serviceName: services.name,
      })
      .from(bookings)
      .innerJoin(profiles, eq(bookings.clientId, profiles.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(
        and(
          eq(bookings.status, "confirmed"),
          gte(bookings.startsAt, windowStart),
          lte(bookings.startsAt, windowEnd),
        ),
      );

    for (const booking of upcomingBookings) {
      if (!booking.clientEmail || !booking.notifyEmail) continue;

      const entityType = `booking_reminder_${window.label}`;
      const localId = booking.bookingId.toString();

      // Check if reminder already sent for this booking + window
      const [existing] = await db
        .select({ id: syncLog.id })
        .from(syncLog)
        .where(
          and(
            eq(syncLog.entityType, entityType),
            eq(syncLog.localId, localId),
            eq(syncLog.status, "success"),
          ),
        )
        .limit(1);

      if (existing) continue;

      const success = await sendEmail({
        to: booking.clientEmail,
        subject: `Reminder: ${booking.serviceName} appointment coming up`,
        react: BookingReminder({
          clientName: booking.clientFirstName,
          serviceName: booking.serviceName,
          startsAt: format(booking.startsAt, "EEEE, MMMM d 'at' h:mm a"),
          durationMinutes: booking.durationMinutes,
          totalInCents: booking.totalInCents,
          location: booking.location ?? "T Creative Studio",
          hoursUntil: window.hoursUntil,
        }),
        entityType,
        localId,
      });

      if (success) totalSent++;
      else totalFailed++;
    }
  }

  return NextResponse.json({ sent: totalSent, failed: totalFailed });
}
