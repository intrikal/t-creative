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
import { isNull, eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { businessHours, clientForms, formSubmissions, timeOff, settings } from "@/db/schema";
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
export async function checkClientWaivers(
  serviceCategory: string,
): Promise<PendingWaiver[]> {
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

    const categoryLabel =
      serviceCategory.charAt(0).toUpperCase() + serviceCategory.slice(1);
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
