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
 * getStudioAvailability — Returns the studio's weekly schedule, blocked dates,
 * and lunch break config for the client booking calendar.
 */
export async function getStudioAvailability(): Promise<StudioAvailability> {
  try {
    const [hoursRows, timeOffRows, lunchRow] = await Promise.all([
      db.select().from(businessHours).where(isNull(businessHours.staffId)),
      db.select().from(timeOff).where(isNull(timeOff.staffId)),
      db.select().from(settings).where(eq(settings.key, "lunch_break")),
    ]);

    const hours: AvailabilityDay[] = hoursRows
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        isOpen: r.isOpen,
        opensAt: r.opensAt,
        closesAt: r.closesAt,
      }));

    const timeOffBlocks: TimeOffBlock[] = timeOffRows.map((r) => ({
      startDate: r.startDate,
      endDate: r.endDate,
    }));

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

    const submittedIds = new Set(submissions.map((s) => s.formId));
    return applicableForms
      .filter((f) => !submittedIds.has(f.id))
      .map((f) => ({ formId: f.id, formName: f.name, formType: f.type }));
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}
