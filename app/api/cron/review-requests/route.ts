/**
 * GET /api/cron/review-requests — Send post-booking review request emails.
 *
 * Runs daily via pg_cron. Finds bookings completed ~24h ago and sends a
 * follow-up email asking for a review. Deduplicates against sync_log.
 *
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */
import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [remindersConfig, bp] = await Promise.all([
    getPublicRemindersConfig(),
    getPublicBusinessProfile(),
  ]);
  const delayHours = remindersConfig.reviewRequestDelayHours;

  const now = new Date();
  // Look for bookings completed in a 2-hour window around the configured delay
  const windowStart = new Date(now.getTime() - (delayHours + 1) * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - (delayHours - 1) * 60 * 60 * 1000);

  const completedBookings = await db
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

  let sent = 0;
  let failed = 0;

  for (const booking of completedBookings) {
    if (!booking.clientEmail || !booking.notifyEmail) continue;
    const reviewEnabled = await isNotificationEnabled(booking.clientId, "email", "review_request");
    if (!reviewEnabled) continue;

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

    if (existing) continue;

    const success = await sendEmail({
      to: booking.clientEmail,
      subject: `How was your ${booking.serviceName}?`,
      react: ReviewRequest({
        clientName: booking.clientFirstName,
        serviceName: booking.serviceName,
        businessName: bp.businessName,
      }),
      entityType: "review_request",
      localId,
    });

    if (success) sent++;
    else failed++;
  }

  return NextResponse.json({
    matched: completedBookings.length,
    sent,
    failed,
  });
}
