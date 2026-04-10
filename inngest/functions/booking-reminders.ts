/**
 * inngest/functions/booking-reminders.ts
 *
 * Sends 24h / 48h booking reminders via email, SMS, and push.
 * Inngest fan-out: one step per booking × channel for granular retries.
 */
import { format } from "date-fns";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  getPublicBusinessProfile,
  getPublicRemindersConfig,
} from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { bookings, profiles, services, syncLog } from "@/db/schema";
import { BookingReminder } from "@/emails/BookingReminder";
import { isNotificationEnabled } from "@/lib/notification-preferences";
import { sendEmail } from "@/lib/resend";
import { renderSmsTemplate } from "@/lib/sms-templates";
import { sendSms } from "@/lib/twilio";
import { sendPushNotification, isPushConfigured } from "@/lib/web-push";
import { inngest } from "../client";

export const bookingReminders = inngest.createFunction(
  {
    id: "booking-reminders",
    retries: 3,
    triggers: [{ event: "cron/booking-reminders" }],
  },
  async ({ step }) => {
    const { windows, businessName } = await step.run("load-config", async () => {
      const [remindersConfig, businessProfile] = await Promise.all([
        getPublicRemindersConfig(),
        getPublicBusinessProfile(),
      ]);
      return {
        windows: remindersConfig.bookingReminderHours.map((h: number) => ({
          label: `${h}h`,
          hoursUntil: h,
          minHours: h - 1,
          maxHours: h + 1,
        })),
        businessName: businessProfile.businessName,
      };
    });

    let totalSent = 0;
    let totalFailed = 0;

    for (const window of windows) {
      const windowBookings = await step.run(`query-${window.label}`, async () => {
        const now = new Date();
        const windowStart = new Date(now.getTime() + window.minHours * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + window.maxHours * 60 * 60 * 1000);

        return db
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
      });

      // Fan-out: one step per booking for granular retries
      for (const booking of windowBookings) {
        const result = await step.run(`remind-${window.label}-${booking.bookingId}`, async () => {
          let sent = 0;
          let failed = 0;
          const localId = booking.bookingId.toString();
          const startsAtFormatted = format(new Date(booking.startsAt), "EEEE, MMMM d 'at' h:mm a");

          // --- Email ---
          const emailEntityType = `booking_reminder_${window.label}`;
          const emailEnabled = await isNotificationEnabled(
            booking.clientId,
            "email",
            "booking_reminder",
          );
          if (booking.clientEmail && booking.notifyEmail && emailEnabled) {
            const [existing] = await db
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

            if (!existing) {
              const ok = await sendEmail({
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
              if (ok) sent++;
              else failed++;
            }
          }

          // --- SMS ---
          const smsEntityType = `booking_reminder_${window.label}_sms`;
          const smsEnabled = await isNotificationEnabled(
            booking.clientId,
            "sms",
            "booking_reminder",
          );
          if (booking.clientPhone && booking.notifySms && smsEnabled) {
            const [existing] = await db
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

            if (!existing) {
              const smsBody =
                (await renderSmsTemplate("booking-reminder", {
                  clientFirstName: booking.clientFirstName,
                  serviceName: booking.serviceName,
                  businessName,
                  startsAtFormatted,
                })) ??
                `Hi ${booking.clientFirstName}! Reminder: your ${booking.serviceName} appt at ${businessName} is ${startsAtFormatted}. Reply C to confirm or X to cancel. Reply STOP to opt out.`;

              const ok = await sendSms({
                to: booking.clientPhone,
                body: smsBody,
                entityType: smsEntityType,
                localId,
              });
              if (ok) sent++;
              else failed++;
            }
          }

          // --- Push ---
          const pushEnabled = await isNotificationEnabled(
            booking.clientId,
            "push",
            "booking_reminder",
          );
          if (isPushConfigured() && pushEnabled) {
            const pushEntityType = `booking_reminder_${window.label}_push`;
            const [existing] = await db
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

            if (!existing) {
              try {
                const count = await sendPushNotification(booking.clientId, {
                  title: `Appointment reminder`,
                  body: `Your ${booking.serviceName} is ${startsAtFormatted}`,
                  url: "/dashboard/bookings",
                });
                if (count > 0) {
                  await db.insert(syncLog).values({
                    provider: "web_push",
                    direction: "outbound",
                    status: "success",
                    entityType: pushEntityType,
                    localId,
                    message: `Push reminder sent (${count} device${count > 1 ? "s" : ""})`,
                  });
                  sent++;
                }
              } catch {
                failed++;
              }
            }
          }

          return { sent, failed };
        });

        totalSent += result.sent;
        totalFailed += result.failed;
      }
    }

    return { sent: totalSent, failed: totalFailed };
  },
);
