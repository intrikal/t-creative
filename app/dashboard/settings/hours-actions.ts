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
 * All exports call `getUser()` first. Unauthenticated callers receive a thrown error
 * (Next.js converts this to a 401 on the RSC boundary).
 */

import { revalidatePath } from "next/cache";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businessHours, timeOff, settings } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Exported types                                                     */
/* ------------------------------------------------------------------ */

export type BusinessHourRow = typeof businessHours.$inferSelect;
export type TimeOffRow = typeof timeOff.$inferSelect;

/** Shape stored in the `settings` table under key `"lunch_break"`. */
export interface LunchBreak {
  /** Whether the lunch break window is active. */
  enabled: boolean;
  /** Start of the blocked window in "HH:MM" 24-hour format. */
  start: string;
  /** End of the blocked window in "HH:MM" 24-hour format. */
  end: string;
}

/**
 * Input shape for `saveBusinessHours`.
 * Mirrors `businessHours.$inferInsert` without `staffId` (always null for studio-wide).
 */
export interface HourInput {
  /** ISO day of week: 1 (Monday) through 7 (Sunday). */
  dayOfWeek: number;
  isOpen: boolean;
  /** "HH:MM" 24-hour format, or null when closed. */
  opensAt: string | null;
  /** "HH:MM" 24-hour format, or null when closed. */
  closesAt: string | null;
}

/** Input shape for `addTimeOff`. */
export interface TimeOffInput {
  type: "day_off" | "vacation";
  /** "YYYY-MM-DD" — inclusive start date. */
  startDate: string;
  /** "YYYY-MM-DD" — inclusive end date. Same as startDate for single days. */
  endDate: string;
  /** Optional human-readable label (e.g. "Hawaii trip"). */
  label?: string;
}

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

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
}

/**
 * saveBusinessHours — Replaces the studio-wide schedule with the provided 7 rows.
 *
 * Runs inside a transaction: deletes existing studio-wide rows then inserts fresh ones.
 * Caller is responsible for sending all 7 days — partial updates are not supported.
 */
export async function saveBusinessHours(days: HourInput[]): Promise<void> {
  await getUser();

  await db.transaction(async (tx) => {
    await tx.delete(businessHours).where(isNull(businessHours.staffId));
    await tx.insert(businessHours).values(days.map((d) => ({ ...d, staffId: null })));
  });

  revalidatePath("/dashboard/settings");
}

/* ------------------------------------------------------------------ */
/*  Time Off / Blocked Dates                                          */
/* ------------------------------------------------------------------ */

/**
 * getTimeOff — Returns all studio-wide blocked dates and vacation ranges.
 * Results are ordered by start date ascending.
 */
export async function getTimeOff(): Promise<TimeOffRow[]> {
  await getUser();

  return db.select().from(timeOff).where(isNull(timeOff.staffId));
}

/**
 * addTimeOff — Creates a new studio-wide blocked date or vacation range.
 * Returns the inserted row (including the auto-generated id).
 */
export async function addTimeOff(input: TimeOffInput): Promise<TimeOffRow> {
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
}

/**
 * deleteTimeOff — Removes a blocked date entry by id.
 * No-op if the row does not exist (idempotent).
 */
export async function deleteTimeOff(id: number): Promise<void> {
  await getUser();

  await db.delete(timeOff).where(eq(timeOff.id, id));

  revalidatePath("/dashboard/settings");
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
  await getUser();

  const [row] = await db.select().from(settings).where(eq(settings.key, LUNCH_KEY));

  if (!row) return null;
  return row.value as LunchBreak;
}

/**
 * saveLunchBreak — Upserts the lunch break setting.
 * Creates the settings row on first call, updates it on subsequent calls.
 */
export async function saveLunchBreak(data: LunchBreak): Promise<void> {
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
}
