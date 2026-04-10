/**
 * booking-calendar-sync — Syncs booking lifecycle events to Google Calendar.
 *
 * Called from booking mutations after the primary DB write succeeds.
 * Failures are logged but never block the booking flow (fire-and-forget).
 *
 * @module lib/booking-calendar-sync
 */
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, googleCalendarTokens, profiles, services, locations } from "@/db/schema";
import logger from "@/lib/logger";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type CalendarEvent,
} from "./google-calendar";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a CalendarEvent payload from a booking row with joined data.
 */
function buildCalendarEvent(booking: {
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  locationName: string | null;
  serviceName: string;
  clientFirstName: string;
  clientLastName: string;
}): CalendarEvent {
  const endTime = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000);

  return {
    summary: `${booking.serviceName} — ${booking.clientFirstName} ${booking.clientLastName}`,
    description: `Service: ${booking.serviceName}\nClient: ${booking.clientFirstName} ${booking.clientLastName}\nDuration: ${booking.durationMinutes} min`,
    start: { dateTime: booking.startsAt.toISOString() },
    end: { dateTime: endTime.toISOString() },
    location: booking.locationName ?? booking.location ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create or update the Google Calendar event for a booking.
 *
 * Looks up the booking's assigned staff member. If that staff member
 * has Google Calendar sync enabled, pushes the event. Stores the
 * resulting event ID on the booking for future updates/deletes.
 */
export async function syncBookingToCalendar(bookingId: number): Promise<void> {
  try {
    const [booking] = await db
      .select({
        id: bookings.id,
        staffId: bookings.staffId,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        location: bookings.location,
        googleCalendarEventId: bookings.googleCalendarEventId,
        serviceName: services.name,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        locationName: locations.name,
      })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .innerJoin(profiles, eq(bookings.clientId, profiles.id))
      .leftJoin(locations, eq(bookings.locationId, locations.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking?.staffId) return;

    const [tokenRow] = await db
      .select({ syncEnabled: googleCalendarTokens.syncEnabled })
      .from(googleCalendarTokens)
      .where(eq(googleCalendarTokens.profileId, booking.staffId))
      .limit(1);

    if (!tokenRow?.syncEnabled) return;

    const event = buildCalendarEvent(booking);

    if (booking.googleCalendarEventId) {
      await updateCalendarEvent(booking.staffId, booking.googleCalendarEventId, event);
    } else {
      const eventId = await createCalendarEvent(booking.staffId, event);
      await db
        .update(bookings)
        .set({ googleCalendarEventId: eventId })
        .where(eq(bookings.id, bookingId));
    }

    logger.info({ bookingId }, "synced booking to Google Calendar");
  } catch (err) {
    Sentry.captureException(err);
    logger.error({ err, bookingId }, "failed to sync booking to Google Calendar");
  }
}

/**
 * Remove a booking's event from Google Calendar.
 * Called when a booking is cancelled or deleted.
 */
export async function removeBookingFromCalendar(bookingId: number): Promise<void> {
  try {
    const [booking] = await db
      .select({
        staffId: bookings.staffId,
        googleCalendarEventId: bookings.googleCalendarEventId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking?.staffId || !booking.googleCalendarEventId) return;

    const [tokenRow] = await db
      .select({ syncEnabled: googleCalendarTokens.syncEnabled })
      .from(googleCalendarTokens)
      .where(eq(googleCalendarTokens.profileId, booking.staffId))
      .limit(1);

    if (!tokenRow) return;

    await deleteCalendarEvent(booking.staffId, booking.googleCalendarEventId);

    await db
      .update(bookings)
      .set({ googleCalendarEventId: null })
      .where(eq(bookings.id, bookingId));

    logger.info({ bookingId }, "removed booking from Google Calendar");
  } catch (err) {
    Sentry.captureException(err);
    logger.error({ err, bookingId }, "failed to remove booking from Google Calendar");
  }
}
