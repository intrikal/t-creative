/**
 * GET /api/cron/booking-reminders — Send 24h and 48h booking reminders.
 *
 * Runs hourly via pg_cron. Finds confirmed bookings starting in 23–25h
 * and 47–49h windows, deduplicates against sync_log, and sends reminder
 * emails via Resend and/or SMS via Twilio.
 *
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  getPublicBusinessProfile,
  getPublicRemindersConfig,
} from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { bookings, profiles, services, syncLog } from "@/db/schema";
import { BookingReminder } from "@/emails/BookingReminder";
import { isNotificationEnabled } from "@/lib/notification-preferences";
import { sendEmail } from "@/lib/resend";
import { sendSms } from "@/lib/twilio";
import { sendPushNotification, isPushConfigured } from "@/lib/web-push";

type ReminderWindow = { label: string; hoursUntil: number; minHours: number; maxHours: number };

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [remindersConfig, businessProfile] = await Promise.all([
    getPublicRemindersConfig(),
    getPublicBusinessProfile(),
  ]);
  const businessName = businessProfile.businessName;
  const REMINDER_WINDOWS: ReminderWindow[] = remindersConfig.bookingReminderHours.map((h) => ({
    label: `${h}h`,
    hoursUntil: h,
    minHours: h - 1,
    maxHours: h + 1,
  }));

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
        clientPhone: profiles.phone,
        clientFirstName: profiles.firstName,
        notifyEmail: profiles.notifyEmail,
        notifySms: profiles.notifySms,
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
      const emailEntityType = `booking_reminder_${window.label}`;
      const smsEntityType = `booking_reminder_${window.label}_sms`;
      const localId = booking.bookingId.toString();
      const startsAtFormatted = format(booking.startsAt, "EEEE, MMMM d 'at' h:mm a");

      // --- Email ---
      const emailEnabled = await isNotificationEnabled(
        booking.clientId,
        "email",
        "booking_reminder",
      );
      if (booking.clientEmail && booking.notifyEmail && emailEnabled) {
        const [existingEmail] = await db
          .select({ id: syncLog.id })
          .from(syncLog)
          .where(
            and(
              eq(syncLog.entityType, emailEntityType),
              eq(syncLog.localId, localId),
              eq(syncLog.status, "success"),
            ),
          )
          .limit(1);

        if (!existingEmail) {
          const success = await sendEmail({
            to: booking.clientEmail,
            subject: `Reminder: ${booking.serviceName} appointment coming up`,
            react: BookingReminder({
              clientName: booking.clientFirstName,
              serviceName: booking.serviceName,
              startsAt: startsAtFormatted,
              durationMinutes: booking.durationMinutes,
              totalInCents: booking.totalInCents,
              location: booking.location ?? businessName,
              hoursUntil: window.hoursUntil,
            }),
            entityType: emailEntityType,
            localId,
          });

          if (success) totalSent++;
          else totalFailed++;
        }
      }

      // --- SMS ---
      const smsEnabled = await isNotificationEnabled(booking.clientId, "sms", "booking_reminder");
      if (booking.clientPhone && booking.notifySms && smsEnabled) {
        const [existingSms] = await db
          .select({ id: syncLog.id })
          .from(syncLog)
          .where(
            and(
              eq(syncLog.entityType, smsEntityType),
              eq(syncLog.localId, localId),
              eq(syncLog.status, "success"),
            ),
          )
          .limit(1);

        if (!existingSms) {
          const success = await sendSms({
            to: booking.clientPhone,
            body: `Hi ${booking.clientFirstName}! Reminder: your ${booking.serviceName} appt at ${businessName} is ${startsAtFormatted}. Reply C to confirm or X to cancel. Reply STOP to opt out.`,
            entityType: smsEntityType,
            localId,
          });

          if (success) totalSent++;
          else totalFailed++;
        }
      }

      // --- Push notification ---
      const pushEnabled = await isNotificationEnabled(booking.clientId, "push", "booking_reminder");
      if (isPushConfigured() && pushEnabled) {
        const pushEntityType = `booking_reminder_${window.label}_push`;

        const [existingPush] = await db
          .select({ id: syncLog.id })
          .from(syncLog)
          .where(
            and(
              eq(syncLog.entityType, pushEntityType),
              eq(syncLog.localId, localId),
              eq(syncLog.status, "success"),
            ),
          )
          .limit(1);

        if (!existingPush) {
          try {
            const sent = await sendPushNotification(booking.clientId, {
              title: `Appointment reminder`,
              body: `Your ${booking.serviceName} is ${startsAtFormatted}`,
              url: "/dashboard/bookings",
            });

            if (sent > 0) {
              await db.insert(syncLog).values({
                provider: "web_push",
                direction: "outbound",
                status: "success",
                entityType: pushEntityType,
                localId,
                message: `Push reminder sent (${sent} device${sent > 1 ? "s" : ""})`,
              });
              totalSent++;
            }
          } catch {
            totalFailed++;
          }
        }
      }
    }
  }

  return NextResponse.json({ sent: totalSent, failed: totalFailed });
}
