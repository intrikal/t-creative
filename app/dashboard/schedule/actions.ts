/**
 * Server actions for the Assistant Schedule page (`/assistant/schedule`).
 *
 * Fetches bookings assigned to the logged-in assistant for the current
 * month (plus overflow for the calendar grid), with summary stats.
 *
 * @module assistant/schedule/actions
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, and, gte, lte, asc, count, not, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, services, profiles, events, eventGuests } from "@/db/schema";
import { getUser } from "@/lib/auth";
import type {
  BookingStatus,
  ServiceCategory,
  AppointmentRow,
  ScheduleStats,
} from "@/lib/types/booking.types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type {
  BookingStatus,
  ServiceCategory,
  AppointmentRow,
  ScheduleStats,
} from "@/lib/types/booking.types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTime24(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Avatar fallback — "SL" for "Sarah Lee", "?" if both names are empty. */
function getInitials(first: string, last: string): string {
  // Build a 2-element array of first chars, filter(Boolean) removes undefined
  // entries (e.g. empty strings produce undefined at [0]), then join into "SL".
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

function getWeekBounds(referenceDate: Date): { weekStart: Date; weekEnd: Date } {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getScheduleData(locationId?: number): Promise<{
  appointments: AppointmentRow[];
  stats: ScheduleStats;
  todayKey: string;
}> {
  try {
    const user = await getUser();

    const now = new Date();
    const todayKey = formatDateKey(now);

    // Fetch a wide window: current month ± 1 week for calendar grid overflow
    const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    rangeStart.setDate(rangeStart.getDate() - 7);
    rangeStart.setHours(0, 0, 0, 0);

    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
    rangeEnd.setHours(23, 59, 59, 999);

    // Join bookings → services (for name/category) → profiles (for client name).
    // INNER JOINs are safe here — every booking must have a service and client.
    // Filter: only bookings assigned to this assistant within the date window.
    const rows = await db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        status: bookings.status,
        location: bookings.location,
        clientNotes: bookings.clientNotes,
        staffNotes: bookings.staffNotes,
        serviceName: services.name,
        serviceCategory: services.category,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
      })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .innerJoin(profiles, eq(bookings.clientId, profiles.id))
      .where(
        and(
          eq(bookings.staffId, user.id),
          gte(bookings.startsAt, rangeStart),
          lte(bookings.startsAt, rangeEnd),
          ...(locationId ? [eq(bookings.locationId, locationId)] : []),
        ),
      )
      .orderBy(asc(bookings.startsAt));

    // Transform raw DB rows into the presentation-ready AppointmentRow shape.
    // .map() gives a 1:1 conversion — every booking becomes one appointment.
    // Computing derived fields (end time, initials, formatted dates) here keeps
    // the React component free of date math.
    const bookingAppointments: AppointmentRow[] = rows.map((r) => {
      const start = new Date(r.startsAt);
      const end = new Date(start.getTime() + r.durationMinutes * 60 * 1000);
      const firstName = r.clientFirstName ?? "";
      const lastName = r.clientLastName ?? "";

      return {
        id: r.id,
        date: formatDateKey(start),
        dayLabel: formatDayLabel(start),
        time: formatTime(start),
        startTime24: formatTime24(start),
        endTime: formatTime(end),
        service: r.serviceName,
        category: (r.serviceCategory ?? "lash") as ServiceCategory,
        client: `${firstName} ${lastName.charAt(0)}.`.trim(),
        clientInitials: getInitials(firstName, lastName),
        status: r.status as BookingStatus,
        durationMin: r.durationMinutes,
        price: r.totalInCents / 100,
        location: r.location ?? undefined,
        notes: r.staffNotes ?? r.clientNotes ?? undefined,
        kind: "booking" as const,
      };
    });

    // Also fetch events assigned to this assistant in the same date range.
    // LEFT JOIN to event_guests + GROUP BY events.id + count(eventGuests.id)
    // produces a single row per event with the guest count as an aggregate column.
    // LEFT JOIN (not INNER) because events with zero guests should still appear.
    // Negative IDs (id: -r.id) prevent React key collisions with booking rows.
    const assignedEvents = await db
      .select({
        id: events.id,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        title: events.title,
        status: events.status,
        location: events.location,
        address: events.address,
        companyName: events.companyName,
        maxAttendees: events.maxAttendees,
        contactName: events.contactName,
        guestCount: count(eventGuests.id),
      })
      .from(events)
      .leftJoin(eventGuests, eq(eventGuests.eventId, events.id))
      .where(
        and(
          eq(events.staffId, user.id),
          gte(events.startsAt, rangeStart),
          lte(events.startsAt, rangeEnd),
          not(inArray(events.status, ["cancelled", "draft"])),
        ),
      )
      .groupBy(events.id)
      .orderBy(asc(events.startsAt));

    // Map event statuses → booking statuses so the calendar can use one
    // unified status enum for color-coding dots/badges.
    const eventStatusMap: Record<string, BookingStatus> = {
      upcoming: "pending",
      confirmed: "confirmed",
      in_progress: "in_progress",
      completed: "completed",
    };

    // Map event rows into the same AppointmentRow shape as bookings so the
    // calendar can render both uniformly. .map() is correct because every
    // assigned event produces exactly one calendar entry.
    const eventAppointments: AppointmentRow[] = assignedEvents.map((r) => {
      const start = new Date(r.startsAt);
      // Ternary: use the event's explicit end time if available, otherwise
      // default to 1 hour — events without an end time still need a duration
      // for the calendar block height calculation.
      const end = r.endsAt ? new Date(r.endsAt) : new Date(start.getTime() + 60 * 60 * 1000); // default 1h if no end time
      const contactName = r.contactName ?? "Group Event";
      const parts = contactName.trim().split(" ");
      // Extract first-letter initials from the contact name parts, filtering
      // out undefined entries (e.g. single-word names). filter(Boolean) removes
      // falsy values (undefined/null/"") cleanly without explicit null checks.
      const initials =
        [parts[0]?.[0], parts[1]?.[0]].filter(Boolean).join("").toUpperCase() || "GE";

      return {
        id: -r.id, // Negative to avoid collision with booking IDs
        date: formatDateKey(start),
        dayLabel: formatDayLabel(start),
        time: formatTime(start),
        startTime24: formatTime24(start),
        endTime: formatTime(end),
        service: r.title,
        category: "consulting" as ServiceCategory,
        client: contactName,
        clientInitials: initials,
        status: eventStatusMap[r.status] ?? "pending",
        durationMin: Math.round((end.getTime() - start.getTime()) / 60000),
        price: 0, // Financial details are admin-only
        location: r.location ?? r.address ?? undefined,
        companyName: r.companyName ?? undefined,
        guestCount: r.guestCount > 0 ? r.guestCount : (r.maxAttendees ?? undefined),
        kind: "event" as const,
      };
    });

    // Merge bookings + events into one list, sorted chronologically.
    // Spread operator merges both arrays into a new combined array — simpler
    // and more readable than .concat(), and avoids mutating either source array.
    // String concatenation of date + 24h time ("2026-03-20" + "09:00") gives
    // correct lexicographic ordering without parsing back to Date objects.
    const appointments: AppointmentRow[] = [...bookingAppointments, ...eventAppointments].sort(
      (a, b) => (a.date + a.startTime24).localeCompare(b.date + b.startTime24),
    );

    // Stats: today + current week
    const { weekStart, weekEnd } = getWeekBounds(now);
    const weekStartKey = formatDateKey(weekStart);
    const weekEndKey = formatDateKey(weekEnd);

    // Filter appointments into today/week subsets for stat computation.
    // Two separate .filter() calls are clearer than a single pass with
    // conditional accumulators, and the array is small enough (~30-50 items)
    // that two passes have negligible cost.
    const todayAppts = appointments.filter((a) => a.date === todayKey);
    const weekAppts = appointments.filter((a) => a.date >= weekStartKey && a.date <= weekEndKey);

    // Aggregate revenue using .reduce() — sums a single numeric field across
    // an array. reduce is the idiomatic choice for accumulating a scalar from
    // an array; a for-loop would work but adds mutable state.
    const stats: ScheduleStats = {
      todayCount: todayAppts.length,
      todayRevenue: todayAppts.reduce((s, a) => s + a.price, 0),
      weekCount: weekAppts.length,
      weekRevenue: weekAppts.reduce((s, a) => s + a.price, 0),
    };

    return { appointments, stats, todayKey };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
