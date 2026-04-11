"use server";

/**
 * app/dashboard/book/actions.ts — Public-facing availability for the client booking page.
 *
 * Fetches the studio's business hours, time-off blocks, and lunch break so the
 * client can see available dates and time slots when requesting a booking.
 *
 * These actions are client-accessible (auth required as client) but read-only.
 */

import * as Sentry from "@sentry/nextjs";
import { isNull, eq, and, inArray, sql, gte, lt } from "drizzle-orm";
import { getPublicBookingRules } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import {
  bookings,
  businessHours,
  clientForms,
  formSubmissions,
  services,
  timeOff,
  settings,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface AvailabilityDay {
  dayOfWeek: number; // ISO: 1=Mon, 7=Sun
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export interface TimeOffBlock {
  startDate: string;
  endDate: string;
}

export interface LunchBreakInfo {
  enabled: boolean;
  start: string;
  end: string;
}

export interface StudioAvailability {
  hours: AvailabilityDay[];
  timeOff: TimeOffBlock[];
  lunchBreak: LunchBreakInfo | null;
}

/* ------------------------------------------------------------------ */
/*  Actions                                                             */
/* ------------------------------------------------------------------ */

/**
 * Returns the studio's weekly schedule, blocked dates, and lunch break config
 * for the client booking calendar. Runs 3 queries in parallel:
 *
 * 1. Business hours —
 *    SELECT * FROM business_hours WHERE staffId IS NULL
 *    → studio-level hours (not staff-specific overrides).
 *      Each row is one day of the week with isOpen, opensAt, closesAt.
 *
 * 2. Time-off blocks —
 *    SELECT * FROM time_off WHERE staffId IS NULL
 *    → studio-wide closure dates (holidays, vacations).
 *      Each row has a startDate and endDate range.
 *
 * 3. Lunch break setting —
 *    SELECT * FROM settings WHERE key = 'lunch_break'
 *    → a JSON value with { enabled, start, end } so the calendar
 *      can grey out the lunch window.
 */
export async function getStudioAvailability(): Promise<StudioAvailability> {
  try {
    // Promise.all runs all three independent DB reads concurrently.
    // Sequential awaits would triple the latency since none depend on each
    // other's results. Destructuring the tuple gives named variables.
    const [hoursRows, timeOffRows, lunchRow] = await Promise.all([
      db.select().from(businessHours).where(isNull(businessHours.staffId)),
      db.select().from(timeOff).where(isNull(timeOff.staffId)),
      db.select().from(settings).where(eq(settings.key, "lunch_break")),
    ]);

    // Sort by day-of-week (Mon=1 through Sun=7) so the calendar renders
    // days in order. .map() then projects each DB row to the slim AvailabilityDay
    // shape — only the 4 fields the client calendar needs, stripping internal columns.
    const hours: AvailabilityDay[] = hoursRows
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        isOpen: r.isOpen,
        opensAt: r.opensAt,
        closesAt: r.closesAt,
      }));

    // Project time-off DB rows to the minimal TimeOffBlock shape (start/end dates only).
    const timeOffBlocks: TimeOffBlock[] = timeOffRows.map((r) => ({
      startDate: r.startDate,
      endDate: r.endDate,
    }));

    // Ternary: the lunch_break setting may not exist (not yet configured).
    // Returns null instead of undefined so the caller can check with === null.
    const lunchBreak = lunchRow.length > 0 ? (lunchRow[0].value as LunchBreakInfo) : null;

    return { hours, timeOff: timeOffBlocks, lunchBreak };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Returns true if the current request has a valid Supabase session. */
export async function checkIsAuthenticated(): Promise<boolean> {
  try {
    const cu = await getCurrentUser();
    return !!cu;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Waiver check for booking flow                                      */
/* ------------------------------------------------------------------ */

export type PendingWaiver = {
  formId: number;
  formName: string;
  formType: string;
};

/**
 * Check whether the current authenticated user has outstanding required
 * waivers for a given service category. Returns an empty array if
 * all waivers are complete or the user is not authenticated.
 *
 * Step 1 — Fetch all required, active forms:
 *   SELECT id, name, type, appliesTo FROM client_forms
 *   WHERE  isActive = true AND required = true
 *   → then filter in JS to keep only forms whose `appliesTo` array includes
 *     "All" or the capitalised service category (e.g. "Lash").
 *
 * Step 2 — Check which of those forms this client has already submitted:
 *   SELECT formId FROM form_submissions
 *   WHERE  clientId = <user>
 *     AND  formId IN (<applicable form IDs>)
 *
 * Step 3 — Return the forms NOT yet submitted (the "pending waivers").
 */
export async function checkClientWaivers(serviceCategory: string): Promise<PendingWaiver[]> {
  try {
    const cu = await getCurrentUser();
    if (!cu) return [];
    const user = cu;

    const allForms = await db
      .select({
        id: clientForms.id,
        name: clientForms.name,
        type: clientForms.type,
        appliesTo: clientForms.appliesTo,
      })
      .from(clientForms)
      .where(and(eq(clientForms.isActive, true), eq(clientForms.required, true)));

    const categoryLabel = serviceCategory.charAt(0).toUpperCase() + serviceCategory.slice(1);
    // Filter forms down to those applicable to this service category.
    // appliesTo is a string array (e.g. ["All"] or ["Lash", "Jewelry"]).
    // .filter() is correct because we need a subset — .find() would only
    // return the first match, but multiple forms may apply.
    const applicableForms = allForms.filter(
      (f) => f.appliesTo.includes("All") || f.appliesTo.includes(categoryLabel),
    );

    if (applicableForms.length === 0) return [];

    const submissions = await db
      .select({ formId: formSubmissions.formId })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.clientId, user.id),
          inArray(
            formSubmissions.formId,
            applicableForms.map((f) => f.id),
          ),
        ),
      );

    // Set gives O(1) lookup for the already-submitted form IDs.
    // Using a Set avoids O(n) .includes() on each filter iteration —
    // important when checking many forms against many submissions.
    const submittedIds = new Set(submissions.map((s) => s.formId));
    // Filter to pending (not yet submitted) forms, then map to the
    // PendingWaiver shape. filter→map is cleaner than reduce for this
    // two-step "narrow then reshape" pattern.
    return applicableForms
      .filter((f) => !submittedIds.has(f.id))
      .map((f) => ({ formId: f.id, formName: f.name, formType: f.type }));
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Booked-slot availability check                                     */
/* ------------------------------------------------------------------ */

/**
 * Returns time slots on a given date that are unavailable due to existing
 * confirmed/pending bookings plus buffer time.
 *
 * Used by the BookingRequestDialog to gray out or hide unavailable slots
 * so clients only see actually bookable times.
 *
 * @param date       ISO date string (YYYY-MM-DD)
 * @param serviceId  The service being booked (for duration lookup)
 * @param staffId    Optional — if provided, checks that staff member's bookings.
 *                   If omitted, checks ALL staff for any conflicts.
 * @param locationId Optional — filter by location
 * @returns Array of unavailable slot start times as "HH:MM" strings
 */
export async function getBookedSlots(
  date: string,
  serviceId: number,
  staffId?: string,
  locationId?: number,
): Promise<string[]> {
  try {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);

    const conditions = [
      inArray(bookings.status, ["pending", "confirmed", "in_progress"]),
      isNull(bookings.deletedAt),
      gte(bookings.startsAt, dayStart),
      lt(bookings.startsAt, dayEnd),
    ];

    if (staffId !== undefined) {
      conditions.push(eq(bookings.staffId, staffId));
    }

    if (locationId !== undefined) {
      conditions.push(eq(bookings.locationId, locationId));
    }

    const [existingBookings, rules, serviceRow] = await Promise.all([
      db
        .select({
          startsAt: bookings.startsAt,
          durationMinutes: bookings.durationMinutes,
        })
        .from(bookings)
        .where(and(...conditions)),
      getPublicBookingRules(),
      db
        .select({ durationMinutes: services.durationMinutes })
        .from(services)
        .where(eq(services.id, serviceId))
        .limit(1),
    ]);

    const requestedDuration = serviceRow[0]?.durationMinutes ?? 60;
    const buffer = rules.bufferMinutes;

    // Build blocked ranges: each existing booking blocks from
    // (startsAt - buffer) to (startsAt + duration + buffer).
    const blockedRanges = existingBookings.map((b) => {
      const start = new Date(b.startsAt).getTime();
      return {
        from: start - buffer * 60_000,
        to: start + b.durationMinutes * 60_000 + buffer * 60_000,
      };
    });

    // Check every 30-minute slot in the day (00:00–23:30).
    // A slot is unavailable if placing a booking of requestedDuration
    // at that time would overlap any blocked range.
    const unavailable: string[] = [];

    for (let mins = 0; mins < 24 * 60; mins += 30) {
      const slotStart = dayStart.getTime() + mins * 60_000;
      const slotEnd = slotStart + requestedDuration * 60_000;

      const overlaps = blockedRanges.some((r) => slotStart < r.to && slotEnd > r.from);

      if (overlaps) {
        const hh = String(Math.floor(mins / 60)).padStart(2, "0");
        const mm = String(mins % 60).padStart(2, "0");
        unavailable.push(`${hh}:${mm}`);
      }
    }

    return unavailable;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
