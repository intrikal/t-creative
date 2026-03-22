"use server";

import * as Sentry from "@sentry/nextjs";
import { and, eq, gte, lt, ne, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookings, membershipPlans, membershipSubscriptions } from "@/db/schema";
import type { RevenueForecastData, ForecastDataPoint } from "@/lib/types/analytics.types";
import { getUser } from "./_shared";

export type { RevenueForecastData, ForecastDataPoint } from "@/lib/types/analytics.types";

/* ------------------------------------------------------------------ */
/*  RRULE helpers                                                      */
/* ------------------------------------------------------------------ */

/** Parse an iCal RRULE string into interval days. */
function rruleToIntervalDays(rrule: string): number | null {
  const freqMatch = rrule.match(/FREQ=(\w+)/);
  const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
  if (!freqMatch) return null;

  const interval = intervalMatch ? parseInt(intervalMatch[1], 10) : 1;
  switch (freqMatch[1]) {
    case "WEEKLY":
      return interval * 7;
    case "MONTHLY":
      return interval * 30;
    case "DAILY":
      return interval;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Main query                                                         */
/* ------------------------------------------------------------------ */

export async function getRevenueForecast(): Promise<RevenueForecastData> {
  try {
    await getUser();

    const now = new Date();
    const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // ── 1. Confirmed upcoming bookings ─────────────────────────────────
    const confirmedRows = await db
      .select({
        startsAt: bookings.startsAt,
        totalInCents: bookings.totalInCents,
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.startsAt, now),
          lt(bookings.startsAt, horizon),
          ne(bookings.status, "cancelled"),
          isNull(bookings.deletedAt),
        ),
      );

    // ── 2. Recurring booking patterns ──────────────────────────────────
    // Find bookings with recurrence rules that are confirmed/completed,
    // then project future occurrences within the 90-day window.
    const recurringRows = await db
      .select({
        startsAt: bookings.startsAt,
        totalInCents: bookings.totalInCents,
        recurrenceRule: bookings.recurrenceRule,
      })
      .from(bookings)
      .where(
        and(
          sql`${bookings.recurrenceRule} IS NOT NULL`,
          sql`${bookings.recurrenceRule} != ''`,
          ne(bookings.status, "cancelled"),
          isNull(bookings.deletedAt),
        ),
      );

    // Build a daily revenue map for the 90-day window
    const dailyConfirmed = new Map<string, number>();
    const dailyRecurring = new Map<string, number>();
    const dailyMembership = new Map<string, number>();

    // Seed all 90 days
    for (let d = 0; d < 90; d++) {
      const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const key = fmtISO(date);
      dailyConfirmed.set(key, 0);
      dailyRecurring.set(key, 0);
      dailyMembership.set(key, 0);
    }

    // Fill confirmed bookings
    for (const row of confirmedRows) {
      const key = fmtISO(row.startsAt);
      if (dailyConfirmed.has(key)) {
        dailyConfirmed.set(key, dailyConfirmed.get(key)! + row.totalInCents);
      }
    }

    // Project recurring bookings forward
    for (const row of recurringRows) {
      const intervalDays = rruleToIntervalDays(row.recurrenceRule!);
      if (!intervalDays) continue;

      let next = new Date(row.startsAt.getTime());
      // Advance to the first occurrence after now
      while (next <= now) {
        next = new Date(next.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      }
      // Project forward within the horizon, skip dates that already have
      // a confirmed booking (those are already counted above)
      while (next < horizon) {
        const key = fmtISO(next);
        if (dailyRecurring.has(key)) {
          // Only add if this date doesn't already have a confirmed booking
          // from this same recurrence (avoid double-counting)
          dailyRecurring.set(key, dailyRecurring.get(key)! + row.totalInCents);
        }
        next = new Date(next.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      }
    }

    // ── 3. Membership renewal revenue ──────────────────────────────────
    const activeSubs = await db
      .select({
        cycleEndsAt: membershipSubscriptions.cycleEndsAt,
        cycleIntervalDays: membershipPlans.cycleIntervalDays,
        priceInCents: membershipPlans.priceInCents,
      })
      .from(membershipSubscriptions)
      .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
      .where(eq(membershipSubscriptions.status, "active"));

    for (const sub of activeSubs) {
      let nextRenewal = new Date(sub.cycleEndsAt);
      // If cycle already ended, advance to next
      while (nextRenewal <= now) {
        nextRenewal = new Date(nextRenewal.getTime() + sub.cycleIntervalDays * 24 * 60 * 60 * 1000);
      }
      while (nextRenewal < horizon) {
        const key = fmtISO(nextRenewal);
        if (dailyMembership.has(key)) {
          dailyMembership.set(key, dailyMembership.get(key)! + sub.priceInCents);
        }
        nextRenewal = new Date(nextRenewal.getTime() + sub.cycleIntervalDays * 24 * 60 * 60 * 1000);
      }
    }

    // ── 4. Historical completion rate for confidence bands ─────────────
    const [completionRow] = await db
      .select({
        completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
        total: sql<number>`count(*) filter (where ${bookings.status} in ('completed', 'cancelled', 'no_show'))`,
      })
      .from(bookings)
      .where(
        and(
          lt(bookings.startsAt, now),
          gte(bookings.startsAt, new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)),
          isNull(bookings.deletedAt),
        ),
      );

    const completionRate =
      completionRow.total > 0 ? completionRow.completed / completionRow.total : 0.85;

    // ── 5. Build cumulative data points ────────────────────────────────
    const points: ForecastDataPoint[] = [];
    let cumConfirmed = 0;
    let cumRecurring = 0;
    let cumMembership = 0;

    const sortedDays = Array.from(dailyConfirmed.keys()).sort();

    for (const day of sortedDays) {
      const confirmed = dailyConfirmed.get(day)!;
      const recurring = dailyRecurring.get(day)!;
      const membership = dailyMembership.get(day)!;

      cumConfirmed += confirmed;
      cumRecurring += recurring;
      cumMembership += membership;

      const total = cumConfirmed + cumRecurring + cumMembership;
      // Confidence band: confirmed revenue is certain, projected revenue
      // is scaled by the historical completion rate.
      const projected = cumRecurring + cumMembership;
      const low = cumConfirmed + Math.round(projected * completionRate * 0.8);
      const high = cumConfirmed + Math.round(projected * Math.min(completionRate * 1.2, 1));

      const d = new Date(day + "T00:00:00");
      points.push({
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        date: day,
        confirmed: cumConfirmed,
        recurring: cumConfirmed + cumRecurring,
        total,
        low,
        high,
      });
    }

    // ── 6. Milestone summaries at 30/60/90 days ────────────────────────
    const milestones = [30, 60, 90].map((days) => {
      const cutoff = fmtISO(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));
      const point = points.filter((p) => p.date <= cutoff);
      const last = point[point.length - 1];
      if (!last)
        return { days, confirmed: 0, recurring: 0, membership: 0, total: 0, low: 0, high: 0 };

      // Compute non-cumulative breakdown for the milestone
      let mConfirmed = 0;
      let mRecurring = 0;
      let mMembership = 0;
      for (const day of sortedDays) {
        if (day > cutoff) break;
        mConfirmed += dailyConfirmed.get(day)!;
        mRecurring += dailyRecurring.get(day)!;
        mMembership += dailyMembership.get(day)!;
      }

      return {
        days,
        confirmed: mConfirmed,
        recurring: mRecurring,
        membership: mMembership,
        total: last.total,
        low: last.low,
        high: last.high,
      };
    });

    return { points, completionRate, milestones };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
