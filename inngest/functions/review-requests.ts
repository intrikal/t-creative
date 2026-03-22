/**
 * Inngest function — Send post-booking review request emails.
 *
 * Replaces GET /api/cron/review-requests. Finds bookings completed ~24h ago
 * and sends a follow-up email asking for a review. Deduplicates against sync_log.
 */
import { and, eq, gte, lte } from "drizzle-orm";
import {
  getPublicBusinessProfile,
  getPublicRemindersConfig,
} from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { bookings, profiles, services, syncLog } from "@/db/schema";
import { ReviewRequest } from "@/emails/ReviewRequest";
import { isNotificationEnabled } from "@/lib/notification-preferences";
import { sendEmail } from "@/lib/resend";
import { SITE_URL } from "@/lib/site-config";
import { inngest } from "../client";

export const reviewRequests = inngest.createFunction(
  { id: "review-requests", retries: 3, triggers: [{ event: "cron/review-requests" }] },
  async ({ step }) => {
    const { completedBookings, delayHours, businessName } = await step.run(
      "query-records",
      async () => {
        const [remindersConfig, bp] = await Promise.all([
          getPublicRemindersConfig(),
          getPublicBusinessProfile(),
        ]);
        const delayH = remindersConfig.reviewRequestDelayHours;

        const now = new Date();
        // Look for bookings completed in a 2-hour window around the configured delay
        const windowStart = new Date(now.getTime() - (delayH + 1) * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() - (delayH - 1) * 60 * 60 * 1000);

        const rows = await db
          .select({
            bookingId: bookings.id,
            clientId: bookings.clientId,
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
              eq(bookings.status, "completed"),
              gte(bookings.completedAt, windowStart),
              lte(bookings.completedAt, windowEnd),
            ),
          );

        return { completedBookings: rows, delayHours: delayH, businessName: bp.businessName };
      },
    );

    let sent = 0;
    let failed = 0;

    for (const booking of completedBookings) {
      const result = await step.run(`process-${booking.bookingId}`, async () => {
        if (!booking.clientEmail || !booking.notifyEmail) return { sent: 0, failed: 0 };
        const reviewEnabled = await isNotificationEnabled(booking.clientId, "email", "review_request");
        if (!reviewEnabled) return { sent: 0, failed: 0 };

        const localId = booking.bookingId.toString();

        // Check if review request already sent
        const [existing] = await db
          .select({ id: syncLog.id })
          .from(syncLog)
          .where(
            and(
              eq(syncLog.entityType, "review_request"),
              eq(syncLog.localId, localId),
              eq(syncLog.status, "success"),
            ),
          )
          .limit(1);

        if (existing) return { sent: 0, failed: 0 };

        const reviewUrl = `${SITE_URL}/review/${booking.bookingId}`;

        const success = await sendEmail({
          to: booking.clientEmail,
          subject: `How was your ${booking.serviceName}?`,
          react: ReviewRequest({
            clientName: booking.clientFirstName,
            serviceName: booking.serviceName,
            businessName,
            reviewUrl,
          }),
          entityType: "review_request",
          localId,
        });

        return success ? { sent: 1, failed: 0 } : { sent: 0, failed: 1 };
      });

      sent += result.sent;
      failed += result.failed;
    }

    return { matched: completedBookings.length, sent, failed };
  },
);
