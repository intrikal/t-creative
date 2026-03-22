"use server";

/**
 * app/dashboard/settings/hours-actions.ts — Server actions for working-hours management.
 *
 * ## Tables touched
 * - `business_hours` — Weekly recurring schedule (7 rows per studio/staff, keyed by
 *   `day_of_week` 1–7). Studio-wide rows have `staff_id = NULL`.
 * - `time_off` — Blocked dates and vacation ranges. Studio-wide rows have `staff_id = NULL`.
 * - `settings` — Key-value store. Lunch break config lives at key `"lunch_break"`.
 *
 * ## Save strategy for business hours
 * Rather than per-row upserts (which require tracking which days already have rows),
 * `saveBusinessHours` deletes all studio-wide rows and re-inserts 7 fresh rows inside
 * a transaction. This is safe because:
 *  1. The set is always exactly 7 rows (one per ISO day).
 *  2. No foreign keys reference `business_hours.id`.
 *  3. The operation is admin-only and not on the hot path.
 *
 * ## Auth guard
 * All exports call `requireAdmin()` first. Unauthenticated callers receive "Not authenticated"
 * and non-admin callers receive "Forbidden" (Next.js converts these to errors on the RSC boundary).
 */

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { businessHours, timeOff, settings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import type { BusinessHourRow, TimeOffRow, LunchBreak, HourInput, TimeOffInput } from "@/lib/types/settings.types";

/* ------------------------------------------------------------------ */
/*  Exported types                                                     */
/* ------------------------------------------------------------------ */

export type { BusinessHourRow, TimeOffRow, LunchBreak, HourInput, TimeOffInput } from "@/lib/types/settings.types";

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Default schedule used when no rows exist yet                      */
/* ------------------------------------------------------------------ */

const DEFAULT_HOURS: HourInput[] = [
  { dayOfWeek: 1, isOpen: true, opensAt: "09:00", closesAt: "18:00" },
  { dayOfWeek: 2, isOpen: true, opensAt: "09:00", closesAt: "18:00" },
  { dayOfWeek: 3, isOpen: true, opensAt: "09:00", closesAt: "18:00" },
  { dayOfWeek: 4, isOpen: true, opensAt: "09:00", closesAt: "18:00" },
  { dayOfWeek: 5, isOpen: true, opensAt: "09:00", closesAt: "18:00" },
  { dayOfWeek: 6, isOpen: true, opensAt: "09:00", closesAt: "16:00" },
  { dayOfWeek: 7, isOpen: false, opensAt: null, closesAt: null },
];

/* ------------------------------------------------------------------ */
/*  Business Hours                                                     */
/* ------------------------------------------------------------------ */

/**
 * getBusinessHours — Returns the studio-wide weekly schedule (7 rows, sorted Mon→Sun).
 *
 * Seeds `DEFAULT_HOURS` on first call if the studio has no rows yet.
 * This eliminates a separate "seed" step during onboarding.
 */
export async function getBusinessHours(): Promise<BusinessHourRow[]> {
  try {
    await getUser();

    const rows = await db.select().from(businessHours).where(isNull(businessHours.staffId));

    if (rows.length === 0) {
      const inserted = await db
        .insert(businessHours)
        .values(DEFAULT_HOURS.map((h) => ({ ...h, staffId: null })))
        .returning();
      return inserted.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    }

    return rows.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * saveBusinessHours — Replaces the studio-wide schedule with the provided 7 rows.
 *
 * Runs inside a transaction: deletes existing studio-wide rows then inserts fresh ones.
 * Caller is responsible for sending all 7 days — partial updates are not supported.
 */
const hourInputSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  isOpen: z.boolean(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
});

const timeOffInputSchema = z.object({
  type: z.enum(["day_off", "vacation"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  label: z.string().optional(),
});

const lunchBreakSchema = z.object({
  enabled: z.boolean(),
  start: z.string().min(1),
  end: z.string().min(1),
});

export async function saveBusinessHours(days: HourInput[]): Promise<void> {
  try {
    z.array(hourInputSchema).parse(days);
    await getUser();

    await db.transaction(async (tx) => {
      await tx.delete(businessHours).where(isNull(businessHours.staffId));
      await tx.insert(businessHours).values(days.map((d) => ({ ...d, staffId: null })));
    });

    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Time Off / Blocked Dates                                          */
/* ------------------------------------------------------------------ */

/**
 * getTimeOff — Returns all studio-wide blocked dates and vacation ranges.
 * Results are ordered by start date ascending.
 */
export async function getTimeOff(): Promise<TimeOffRow[]> {
  try {
    await getUser();
    return db.select().from(timeOff).where(isNull(timeOff.staffId));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * addTimeOff — Creates a new studio-wide blocked date or vacation range.
 * Returns the inserted row (including the auto-generated id).
 */
export async function addTimeOff(input: TimeOffInput): Promise<TimeOffRow> {
  try {
    timeOffInputSchema.parse(input);
    await getUser();

    const [row] = await db
      .insert(timeOff)
      .values({
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        label: input.label ?? null,
        staffId: null,
      })
      .returning();

    revalidatePath("/dashboard/settings");
    return row;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * deleteTimeOff — Removes a blocked date entry by id.
 * No-op if the row does not exist (idempotent).
 */
export async function deleteTimeOff(id: number): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    await getUser();

    await db.delete(timeOff).where(eq(timeOff.id, id));

    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Lunch Break                                                        */
/* ------------------------------------------------------------------ */

const LUNCH_KEY = "lunch_break";

/**
 * getLunchBreak — Returns the studio's lunch break configuration.
 * Returns null if it has never been saved (first-time setup).
 */
export async function getLunchBreak(): Promise<LunchBreak | null> {
  try {
    await getUser();

    const [row] = await db.select().from(settings).where(eq(settings.key, LUNCH_KEY));

    if (!row) return null;
    return row.value as LunchBreak;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * saveLunchBreak — Upserts the lunch break setting.
 * Creates the settings row on first call, updates it on subsequent calls.
 */
export async function saveLunchBreak(data: LunchBreak): Promise<void> {
  try {
    lunchBreakSchema.parse(data);
    await getUser();

    await db
      .insert(settings)
      .values({
        key: LUNCH_KEY,
        label: "Lunch Break",
        description: "Daily lunch break window during which no new bookings are accepted.",
        value: data,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: data },
      });

    revalidatePath("/dashboard/settings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
