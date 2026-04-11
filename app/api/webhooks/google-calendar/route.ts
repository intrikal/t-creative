/**
 * POST /api/webhooks/google-calendar — Google Calendar push notification handler.
 *
 * Google sends a POST when a watched calendar changes. This route:
 * 1. Validates the channel/resource headers to identify which staff member's
 *    calendar changed
 * 2. Fetches updated events from Google Calendar using the sync token pattern
 * 3. Matches changed events to bookings via `googleCalendarEventId`
 * 4. Updates booking times if the event was rescheduled
 * 5. Sends a reschedule notification to the client
 * 6. Logs changes to the audit log
 *
 * @module app/api/webhooks/google-calendar/route
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookings, googleCalendarTokens, profiles, services } from "@/db/schema";
import { logAction } from "@/lib/audit";
import logger from "@/lib/logger";
import { withRequestLogger } from "@/lib/middleware/request-logger";
import { sendEmail } from "@/lib/resend";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Refresh the access token inline for webhook processing (avoids circular
 * import from lib/google-calendar which also imports db).
 */
async function getAccessToken(profileId: string): Promise<string | null> {
  const { refreshAccessToken } = await import("@/lib/google-calendar");

  const [row] = await db
    .select({
      accessToken: googleCalendarTokens.accessToken,
      tokenExpiresAt: googleCalendarTokens.tokenExpiresAt,
    })
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.profileId, profileId))
    .limit(1);

  if (!row) return null;

  const isExpired = row.tokenExpiresAt.getTime() <= Date.now() + 60_000;
  if (!isExpired) return row.accessToken;

  return refreshAccessToken(profileId);
}

export const POST = withRequestLogger(async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceId = request.headers.get("x-goog-resource-id");
  const resourceState = request.headers.get("x-goog-resource-state");

  if (!channelId || !resourceId) {
    return NextResponse.json({ error: "Missing channel headers" }, { status: 400 });
  }

  // Google sends a "sync" notification when a watch is first created — ack it.
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  // channelId format: "gcal-watch-{profileId}"
  const profileId = channelId.replace("gcal-watch-", "");
  if (!profileId || profileId === channelId) {
    return NextResponse.json({ error: "Invalid channel ID format" }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken(profileId);
    if (!accessToken) {
      logger.warn({ profileId }, "no Google Calendar token for webhook");
      return NextResponse.json({ ok: true });
    }

    const [tokenRow] = await db
      .select({ calendarId: googleCalendarTokens.calendarId })
      .from(googleCalendarTokens)
      .where(eq(googleCalendarTokens.profileId, profileId))
      .limit(1);

    const calendarId = encodeURIComponent(tokenRow?.calendarId ?? "primary");

    // Fetch recently updated events (last 5 minutes window).
    const updatedMin = new Date(Date.now() - 5 * 60_000).toISOString();
    const eventsUrl = `${CALENDAR_API_BASE}/calendars/${calendarId}/events?updatedMin=${updatedMin}&singleEvents=true&maxResults=50`;

    const eventsResponse = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!eventsResponse.ok) {
      const body = await eventsResponse.text();
      logger.error({ profileId, status: eventsResponse.status, body }, "failed to fetch events");
      return NextResponse.json({ ok: true });
    }

    const eventsData = (await eventsResponse.json()) as {
      items?: Array<{
        id: string;
        status: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
        summary?: string;
      }>;
    };

    const items = eventsData.items ?? [];
    let updated = 0;

    for (const event of items) {
      if (!event.id) continue;

      // Match to a booking by the Google Calendar event ID.
      const [booking] = await db
        .select({
          id: bookings.id,
          startsAt: bookings.startsAt,
          durationMinutes: bookings.durationMinutes,
          clientId: bookings.clientId,
          serviceId: bookings.serviceId,
        })
        .from(bookings)
        .where(and(eq(bookings.googleCalendarEventId, event.id), isNull(bookings.deletedAt)))
        .limit(1);

      if (!booking) continue;

      // Skip cancelled events — those are handled by the booking cancellation flow.
      if (event.status === "cancelled") continue;

      const newStart = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      const newEnd = event.end?.dateTime ? new Date(event.end.dateTime) : null;

      if (!newStart || !newEnd) continue;

      const newDuration = Math.round((newEnd.getTime() - newStart.getTime()) / 60_000);
      const timeChanged =
        booking.startsAt.getTime() !== newStart.getTime() ||
        booking.durationMinutes !== newDuration;

      if (!timeChanged) continue;

      const oldStartsAt = booking.startsAt;

      await db
        .update(bookings)
        .set({
          startsAt: newStart,
          durationMinutes: newDuration,
        })
        .where(eq(bookings.id, booking.id));

      await logAction({
        actorId: null,
        action: "update",
        entityType: "booking",
        entityId: String(booking.id),
        description: "Booking rescheduled via Google Calendar",
        metadata: {
          source: "google_calendar_webhook",
          old: { startsAt: oldStartsAt.toISOString(), durationMinutes: booking.durationMinutes },
          new: { startsAt: newStart.toISOString(), durationMinutes: newDuration },
        },
      });

      // Send reschedule notification to client.
      trySendRescheduleNotification(
        booking.id,
        booking.clientId,
        booking.serviceId,
        oldStartsAt,
        newStart,
      );

      updated++;
      logger.info(
        {
          bookingId: booking.id,
          oldStart: oldStartsAt.toISOString(),
          newStart: newStart.toISOString(),
        },
        "booking rescheduled via Google Calendar",
      );
    }

    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    Sentry.captureException(err);
    logger.error({ err, profileId }, "Google Calendar webhook processing error");
    return NextResponse.json({ ok: true });
  }
});

/**
 * Fire-and-forget reschedule email to the client.
 */
function trySendRescheduleNotification(
  bookingId: number,
  clientId: string,
  serviceId: number,
  oldStart: Date,
  newStart: Date,
): void {
  (async () => {
    try {
      const [client] = await db
        .select({ email: profiles.email, firstName: profiles.firstName })
        .from(profiles)
        .where(eq(profiles.id, clientId))
        .limit(1);

      const [service] = await db
        .select({ name: services.name })
        .from(services)
        .where(eq(services.id, serviceId))
        .limit(1);

      if (!client?.email) return;

      const { BookingReschedule } = await import("@/emails/BookingReschedule");

      const formatDateTime = (d: Date) =>
        `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

      await sendEmail({
        to: client.email,
        subject: `Your ${service?.name ?? "appointment"} has been rescheduled`,
        react: BookingReschedule({
          clientName: client.firstName,
          serviceName: service?.name ?? "Appointment",
          oldDateTime: formatDateTime(oldStart),
          newDateTime: formatDateTime(newStart),
        }),
        entityType: "booking_reschedule",
        localId: String(bookingId),
        profileId: clientId,
      });
    } catch (err) {
      Sentry.captureException(err);
      logger.error({ err, bookingId }, "failed to send reschedule notification");
    }
  })();
}
