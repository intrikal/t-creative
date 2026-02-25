"use server";

/**
 * app/dashboard/book/actions.ts — Public-facing availability for the client booking page.
 *
 * Fetches the studio's business hours, time-off blocks, and lunch break so the
 * client can see available dates and time slots when requesting a booking.
 *
 * These actions are client-accessible (auth required as client) but read-only.
 */

import { isNull, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessHours, timeOff, settings } from "@/db/schema";

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
}
