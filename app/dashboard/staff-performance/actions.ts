/**
 * staff-performance/actions — Server actions for the Staff Performance dashboard.
 *
 * Computes 7 KPIs per staff member for a given date range:
 *   1. Bookings completed (week / month / all time)
 *   2. Revenue generated (sum of payments on their completed bookings)
 *   3. Avg actual vs scheduled duration (startsAt→completedAt vs durationMinutes)
 *   4. Client retention rate (% of clients who rebook within 60 days)
 *   5. No-show rate (% of bookings marked no_show)
 *   6. Average review rating (approved reviews on their bookings)
 *   7. Commission earned (this period / this month)
 *
 * Auth: requireAdmin — only admins can view cross-staff metrics.
 * Staff see their OWN stats via /dashboard/earnings.
 *
 * @see {@link ./StaffPerformancePage.tsx} — client component
 * @see {@link ../earnings/actions.ts} — per-staff "My Earnings" (self-service)
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, sql, and, gte, lt, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, payments, profiles, reviews, services, assistantProfiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import type { Range, StaffKpi } from "@/lib/types/analytics.types";

export type { StaffKpi } from "@/lib/types/analytics.types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_COMMISSION = 60;

function rangeToInterval(range: Range): string {
  switch (range) {
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    case "90d":
      return "90 days";
    case "12m":
      return "12 months";
  }
}

function rangeToDays(range: Range): number {
  return range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Mon=0
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/* ------------------------------------------------------------------ */
/*  Main query                                                         */
/* ------------------------------------------------------------------ */

export async function getStaffPerformanceData(range: Range = "30d"): Promise<StaffKpi[]> {
  try {
    await requireAdmin();

    const now = new Date();
    const daysBack = rangeToDays(range);
    const periodStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const interval = sql.raw(`'${rangeToInterval(range)}'`);

    // ── 1. Get all staff members ──────────────────────────────────────
    const staffRows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        role: profiles.role,
        commissionType: assistantProfiles.commissionType,
        commissionRatePercent: assistantProfiles.commissionRatePercent,
        commissionFlatFeeInCents: assistantProfiles.commissionFlatFeeInCents,
        tipSplitPercent: assistantProfiles.tipSplitPercent,
      })
      .from(profiles)
      .leftJoin(assistantProfiles, eq(assistantProfiles.profileId, profiles.id))
      .where(inArray(profiles.role, ["admin", "assistant"]));

    if (staffRows.length === 0) return [];

    const staffIds = staffRows.map((s) => s.id);

    // ── 2. Parallel queries for all KPIs ──────────────────────────────
    const [
      periodBookings,
      weekBookings,
      monthBookings,
      allTimeBookings,
      revenueRows,
      durationRows,
      retentionRows,
      noShowRows,
      reviewRows,
      periodCommissionRows,
      monthCommissionRows,
    ] = await Promise.all([
      // 2a. Bookings completed in range (for KPI cards)
      db
        .select({
          staffId: bookings.staffId,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            eq(bookings.status, "completed"),
            gte(bookings.startsAt, sql`now() - interval ${interval}`),
          ),
        )
        .groupBy(bookings.staffId),

      // 2b. Bookings completed this week
      db
        .select({
          staffId: bookings.staffId,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            eq(bookings.status, "completed"),
            gte(bookings.startsAt, weekStart),
          ),
        )
        .groupBy(bookings.staffId),

      // 2c. Bookings completed this month
      db
        .select({
          staffId: bookings.staffId,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            eq(bookings.status, "completed"),
            gte(bookings.startsAt, monthStart),
          ),
        )
        .groupBy(bookings.staffId),

      // 2d. All-time completed bookings
      db
        .select({
          staffId: bookings.staffId,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(and(inArray(bookings.staffId, staffIds), eq(bookings.status, "completed")))
        .groupBy(bookings.staffId),

      // 2e. Revenue (sum of paid payments on their bookings in range)
      db
        .select({
          staffId: bookings.staffId,
          total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
        })
        .from(bookings)
        .innerJoin(payments, and(eq(payments.bookingId, bookings.id), eq(payments.status, "paid")))
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            gte(bookings.startsAt, sql`now() - interval ${interval}`),
          ),
        )
        .groupBy(bookings.staffId),

      // 2f. Avg actual vs scheduled duration (completed bookings with completedAt)
      db
        .select({
          staffId: bookings.staffId,
          avgScheduled: sql<number>`round(avg(${bookings.durationMinutes})::numeric, 1)`,
          avgActual: sql<number>`round(avg(extract(epoch from ${bookings.completedAt} - ${bookings.startsAt}) / 60)::numeric, 1)`,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            eq(bookings.status, "completed"),
            sql`${bookings.completedAt} is not null`,
            gte(bookings.startsAt, sql`now() - interval ${interval}`),
          ),
        )
        .groupBy(bookings.staffId),

      // 2g. Client retention: % of unique clients who rebook within 60 days
      // Subquery: for each client's completed booking with this staff, check if
      // there's another booking with the same client within 60 days.
      db.execute<{ staff_id: string; retention_rate: string }>(sql`
        WITH staff_bookings AS (
          SELECT
            b.staff_id,
            b.client_id,
            b.starts_at,
            lead(b.starts_at) OVER (
              PARTITION BY b.staff_id, b.client_id
              ORDER BY b.starts_at
            ) AS next_visit
          FROM bookings b
          WHERE b.staff_id = ANY(${staffIds})
            AND b.status = 'completed'
            AND b.starts_at >= now() - interval ${interval}
        )
        SELECT
          staff_id,
          round(
            count(*) filter (
              where next_visit is not null
                and next_visit - starts_at <= interval '60 days'
            )::numeric
            / nullif(count(*), 0) * 100,
            1
          ) AS retention_rate
        FROM staff_bookings
        GROUP BY staff_id
      `),

      // 2h. No-show rate (% of finalized bookings marked no_show)
      db
        .select({
          staffId: bookings.staffId,
          noShows: sql<number>`count(*) filter (where ${bookings.status} = 'no_show')`,
          total: sql<number>`count(*) filter (where ${bookings.status} in ('completed', 'no_show', 'cancelled'))`,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            gte(bookings.startsAt, sql`now() - interval ${interval}`),
          ),
        )
        .groupBy(bookings.staffId),

      // 2i. Average review rating (approved reviews on their bookings)
      db
        .select({
          staffId: bookings.staffId,
          avgRating: sql<number>`round(avg(${reviews.rating})::numeric, 2)`,
          reviewCount: sql<number>`count(*)`,
        })
        .from(reviews)
        .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            eq(reviews.status, "approved"),
            gte(bookings.startsAt, sql`now() - interval ${interval}`),
          ),
        )
        .groupBy(bookings.staffId),

      // 2j. Commission earned this period
      db
        .select({
          staffId: bookings.staffId,
          totalInCents: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`,
          tipInCents: sql<number>`coalesce(sum(${payments.tipInCents}), 0)`,
        })
        .from(bookings)
        .leftJoin(payments, eq(payments.bookingId, bookings.id))
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            eq(bookings.status, "completed"),
            gte(bookings.startsAt, sql`now() - interval ${interval}`),
          ),
        )
        .groupBy(bookings.staffId),

      // 2k. Commission earned this month
      db
        .select({
          staffId: bookings.staffId,
          totalInCents: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`,
          tipInCents: sql<number>`coalesce(sum(${payments.tipInCents}), 0)`,
        })
        .from(bookings)
        .leftJoin(payments, eq(payments.bookingId, bookings.id))
        .where(
          and(
            inArray(bookings.staffId, staffIds),
            eq(bookings.status, "completed"),
            gte(bookings.startsAt, monthStart),
          ),
        )
        .groupBy(bookings.staffId),
    ]);

    // ── 3. Build lookup maps ──────────────────────────────────────────
    const toMap = <T extends { staffId: string | null }>(rows: T[]): Map<string, T> =>
      new Map(rows.filter((r) => r.staffId).map((r) => [r.staffId!, r]));

    const periodBkMap = toMap(periodBookings);
    const weekBkMap = toMap(weekBookings);
    const monthBkMap = toMap(monthBookings);
    const allTimeBkMap = toMap(allTimeBookings);
    const revenueMap = toMap(revenueRows);
    const durationMap = toMap(durationRows);
    const noShowMap = toMap(noShowRows);
    const reviewMap = toMap(reviewRows);
    const periodCommMap = toMap(periodCommissionRows);
    const monthCommMap = toMap(monthCommissionRows);

    const retentionMap = new Map<string, number>();
    for (const r of retentionRows) {
      retentionMap.set(r.staff_id, Number(r.retention_rate));
    }

    // ── 4. Compute commission helper ──────────────────────────────────
    function computeCommission(
      staffRow: (typeof staffRows)[0],
      totalInCents: number,
      tipInCents: number,
    ): number {
      const commType = (staffRow.commissionType as "percentage" | "flat_fee") ?? "percentage";
      const rate = staffRow.commissionRatePercent ?? DEFAULT_COMMISSION;
      const flatFee = staffRow.commissionFlatFeeInCents ?? 0;
      const tipSplit = staffRow.tipSplitPercent ?? 100;

      let serviceCut: number;
      if (commType === "flat_fee") {
        // For flat_fee, we'd need count of sessions — approximate from period bookings
        const count = Number(periodBkMap.get(staffRow.id)?.count ?? 0);
        serviceCut = count * flatFee;
      } else {
        serviceCut = Math.round(totalInCents * (rate / 100));
      }

      const tipCut = Math.round(Number(tipInCents) * (tipSplit / 100));
      return serviceCut + tipCut;
    }

    // ── 5. Assemble results ───────────────────────────────────────────
    return staffRows
      .map((s) => {
        const dur = durationMap.get(s.id);
        const ns = noShowMap.get(s.id);
        const rv = reviewMap.get(s.id);
        const periodComm = periodCommMap.get(s.id);
        const monthComm = monthCommMap.get(s.id);

        const noShowTotal = Number(ns?.total ?? 0);
        const avgActual = dur ? Number(dur.avgActual) : null;
        const avgScheduled = dur ? Number(dur.avgScheduled) : null;

        // Compute commission for both period and month
        const commissionThisPeriod = periodComm
          ? Math.round(
              computeCommission(s, Number(periodComm.totalInCents), Number(periodComm.tipInCents)) /
                100,
            )
          : 0;

        // For month commission, need the month booking count for flat_fee
        const monthBkCount = Number(monthBkMap.get(s.id)?.count ?? 0);
        let commissionThisMonth = 0;
        if (monthComm) {
          const commType = (s.commissionType as "percentage" | "flat_fee") ?? "percentage";
          const rate = s.commissionRatePercent ?? DEFAULT_COMMISSION;
          const flatFee = s.commissionFlatFeeInCents ?? 0;
          const tipSplit = s.tipSplitPercent ?? 100;

          let serviceCut: number;
          if (commType === "flat_fee") {
            serviceCut = monthBkCount * flatFee;
          } else {
            serviceCut = Math.round(Number(monthComm.totalInCents) * (rate / 100));
          }
          const tipCut = Math.round(Number(monthComm.tipInCents) * (tipSplit / 100));
          commissionThisMonth = Math.round((serviceCut + tipCut) / 100);
        }

        return {
          staffId: s.id,
          name: [s.firstName, s.lastName].filter(Boolean).join(" ") || "Unknown",
          avatar: (s.firstName ?? "?")[0].toUpperCase(),
          role: s.role === "admin" ? "Owner" : "Staff",
          bookingsWeek: Number(weekBkMap.get(s.id)?.count ?? 0),
          bookingsMonth: Number(monthBkMap.get(s.id)?.count ?? 0),
          bookingsAllTime: Number(allTimeBkMap.get(s.id)?.count ?? 0),
          revenue: Math.round(Number(revenueMap.get(s.id)?.total ?? 0) / 100),
          avgActualMinutes: avgActual,
          avgScheduledMinutes: avgScheduled,
          durationDelta:
            avgActual != null && avgScheduled != null
              ? Math.round((avgActual - avgScheduled) * 10) / 10
              : null,
          retentionRate: retentionMap.get(s.id) ?? null,
          noShowRate: noShowTotal > 0 ? Math.round((Number(ns!.noShows) / noShowTotal) * 100) : 0,
          avgRating: rv ? Number(rv.avgRating) : null,
          reviewCount: Number(rv?.reviewCount ?? 0),
          commissionThisPeriod,
          commissionThisMonth,
          commissionType: (s.commissionType as "percentage" | "flat_fee") ?? "percentage",
          commissionRate: s.commissionRatePercent ?? DEFAULT_COMMISSION,
          flatFeeInCents: s.commissionFlatFeeInCents ?? 0,
          tipSplitPercent: s.tipSplitPercent ?? 100,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
