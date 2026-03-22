/**
 * app/dashboard/analytics/revenue-actions.ts — Revenue-focused analytics.
 *
 * KPI stats, revenue trends, revenue by service, revenue per available hour,
 * and revenue goal from settings.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, sql, and, gte, lt, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  payments,
  services,
  profiles,
  settings,
  businessHours,
  timeOff,
} from "@/db/schema";
import type {
  Range,
  KpiStats,
  WeeklyRevenue,
  ServiceRevenueItem,
  RevenuePerHourDay,
} from "@/lib/types/analytics.types";
import { getUser, rangeToInterval, weekLabel, CATEGORY_LABELS } from "./_shared";

export type {
  Range,
  KpiStats,
  WeeklyRevenue,
  ServiceRevenueItem,
  RevenuePerHourDay,
} from "@/lib/types/analytics.types";

async function computeKpiForPeriod(periodStart: Date, periodEnd: Date) {
  const [revRow, bookRow, clientRow, statusRow] = await Promise.all([
    db
      .select({
        total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, "paid"),
          gte(payments.paidAt, periodStart),
          lt(payments.paidAt, periodEnd),
        ),
      )
      .then((r) => r[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(gte(bookings.startsAt, periodStart), lt(bookings.startsAt, periodEnd)))
      .then((r) => r[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(profiles)
      .where(
        and(
          eq(profiles.role, "client"),
          gte(profiles.createdAt, periodStart),
          lt(profiles.createdAt, periodEnd),
        ),
      )
      .then((r) => r[0]),
    db
      .select({
        noShows: sql<number>`count(*) filter (where ${bookings.status} = 'no_show')`,
        completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
        total: sql<number>`count(*) filter (where ${bookings.status} in ('completed', 'no_show', 'cancelled'))`,
      })
      .from(bookings)
      .where(and(gte(bookings.startsAt, periodStart), lt(bookings.startsAt, periodEnd)))
      .then((r) => r[0]),
  ]);

  const revenue = Math.round(Number(revRow.total) / 100);
  const paidCount = Number(revRow.count);
  const avgTicket = paidCount > 0 ? Math.round(revenue / paidCount) : 0;
  const bookingCount = Number(bookRow.count);
  const newClients = Number(clientRow.count);
  const totalFinal = Number(statusRow.total);
  const noShowRate =
    totalFinal > 0 ? Math.round((Number(statusRow.noShows) / totalFinal) * 100) : 0;
  const fillRate =
    totalFinal > 0 ? Math.round((Number(statusRow.completed) / totalFinal) * 100) : 0;

  return { revenue, bookingCount, newClients, noShowRate, fillRate, avgTicket };
}

function pctDelta(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

export async function getKpiStats(range: Range = "30d"): Promise<KpiStats> {
  try {
    await getUser();

    const now = new Date();
    const daysBack = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const periodStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const priorStart = new Date(now.getTime() - 2 * daysBack * 24 * 60 * 60 * 1000);

    const [current, prior] = await Promise.all([
      computeKpiForPeriod(periodStart, now),
      computeKpiForPeriod(priorStart, periodStart),
    ]);

    return {
      revenueMtd: current.revenue,
      bookingCount: current.bookingCount,
      newClients: current.newClients,
      noShowRate: current.noShowRate,
      fillRate: current.fillRate,
      avgTicket: current.avgTicket,
      revenueMtdDelta: pctDelta(current.revenue, prior.revenue),
      bookingCountDelta: pctDelta(current.bookingCount, prior.bookingCount),
      newClientsDelta: pctDelta(current.newClients, prior.newClients),
      noShowRateDelta: pctDelta(current.noShowRate, prior.noShowRate),
      fillRateDelta: pctDelta(current.fillRate, prior.fillRate),
      avgTicketDelta: pctDelta(current.avgTicket, prior.avgTicket),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getRevenueTrend(range: Range = "30d"): Promise<WeeklyRevenue[]> {
  try {
    await getUser();

    // Reads from revenue_by_service_daily materialized view (refreshed every 4h)
    // instead of the raw payments table — avoids the bookings + services join.
    const rows = await db.execute<{ week_start: Date; total: string }>(sql`
      SELECT
        date_trunc('week', day)   AS week_start,
        sum(revenue_cents)        AS total
      FROM revenue_by_service_daily
      WHERE day >= now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}
      GROUP BY date_trunc('week', day)
      ORDER BY date_trunc('week', day)
    `);

    return rows.map((r) => ({
      week: weekLabel(new Date(r.week_start)),
      revenue: Math.round(Number(r.total) / 100),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getRevenueByService(range: Range = "30d"): Promise<ServiceRevenueItem[]> {
  try {
    await getUser();

    // Reads from revenue_by_service_daily materialized view (refreshed every 4h).
    const rows = await db.execute<{
      service_name: string;
      service_category: string;
      revenue: string;
      booking_count: string;
    }>(sql`
      SELECT
        service_name,
        service_category,
        sum(revenue_cents)  AS revenue,
        sum(booking_count)  AS booking_count
      FROM revenue_by_service_daily
      WHERE day >= now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}
      GROUP BY service_name, service_category
      ORDER BY sum(revenue_cents) DESC
    `);

    const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);

    return rows.map((r) => {
      const rev = Math.round(Number(r.revenue) / 100);
      return {
        service: r.service_name,
        category: CATEGORY_LABELS[r.service_category] ?? r.service_category,
        revenue: rev,
        bookings: Number(r.booking_count),
        pct: totalRevenue > 0 ? Math.round((Number(r.revenue) / totalRevenue) * 100) : 0,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const DAY_LABELS_ISO: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/** Parse "HH:MM" to fractional hours. */
function timeToHours(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

export async function getRevenuePerHour(range: Range = "30d"): Promise<RevenuePerHourDay[]> {
  try {
    await getUser();

    const daysBack = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - daysBack);

    // 1–3 + 5. Business hours, lunch break, time-off, and revenue all in parallel
    const [hours, [lunchRow], timeOffRows, revenueRows] = await Promise.all([
      db
        .select({
          dayOfWeek: businessHours.dayOfWeek,
          isOpen: businessHours.isOpen,
          opensAt: businessHours.opensAt,
          closesAt: businessHours.closesAt,
        })
        .from(businessHours)
        .where(sql`${businessHours.staffId} is null`),
      db.select({ value: settings.value }).from(settings).where(eq(settings.key, "lunch_break")),
      db
        .select({ startDate: timeOff.startDate, endDate: timeOff.endDate })
        .from(timeOff)
        .where(
          and(
            sql`${timeOff.staffId} is null`,
            sql`${timeOff.endDate} >= ${thirtyDaysAgo.toISOString().slice(0, 10)}`,
          ),
        ),
      db
        .select({
          isoDay: sql<number>`extract(isodow from ${payments.paidAt})`,
          total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.status, "paid"),
            gte(payments.paidAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
          ),
        )
        .groupBy(sql`extract(isodow from ${payments.paidAt})`),
    ]);

    const lunch = lunchRow?.value as { enabled?: boolean; start?: string; end?: string } | null;
    const lunchHours =
      lunch?.enabled && lunch.start && lunch.end
        ? timeToHours(lunch.end) - timeToHours(lunch.start)
        : 0;

    // Build set of closed dates
    const closedDates = new Set<string>();
    for (const row of timeOffRows) {
      const start = new Date(row.startDate);
      const end = new Date(row.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        closedDates.add(d.toISOString().slice(0, 10));
      }
    }

    // 4. Build available hours per ISO day-of-week
    const hoursPerDay = new Map<number, number>();
    for (const h of hours) {
      if (h.isOpen && h.opensAt && h.closesAt) {
        const open = timeToHours(h.opensAt);
        const close = timeToHours(h.closesAt);
        hoursPerDay.set(h.dayOfWeek, Math.max(close - open - lunchHours, 0));
      } else {
        hoursPerDay.set(h.dayOfWeek, 0);
      }
    }

    // Count actual open days per day-of-week in the last 30 days
    const openDayCount = new Map<number, number>();
    const now = new Date();
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const jsDay = d.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;

      if ((hoursPerDay.get(isoDay) ?? 0) === 0) continue;
      if (closedDates.has(dateStr)) continue;

      openDayCount.set(isoDay, (openDayCount.get(isoDay) ?? 0) + 1);
    }

    // 5. Assemble revenue map (fetched in parallel above)
    const revenueByDay = new Map(
      revenueRows.map((r) => [Number(r.isoDay), Math.round(Number(r.total) / 100)]),
    );

    // 6. Assemble results
    const results: RevenuePerHourDay[] = [];
    for (let isoDay = 1; isoDay <= 7; isoDay++) {
      const hpd = hoursPerDay.get(isoDay) ?? 0;
      const days = openDayCount.get(isoDay) ?? 0;
      const availableHours = Math.round(hpd * days * 10) / 10;
      const revenue = revenueByDay.get(isoDay) ?? 0;
      const revenuePerHour = availableHours > 0 ? Math.round(revenue / availableHours) : 0;

      results.push({
        day: DAY_LABELS_ISO[isoDay],
        isoDay,
        revenue,
        availableHours,
        revenuePerHour,
      });
    }

    return results;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getRevenueGoal(): Promise<number> {
  try {
    await getUser();

    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, ["revenue_goals", "financial_config"]));

    const goalsRow = rows.find((r) => r.key === "revenue_goals");
    if (goalsRow) {
      const goals = goalsRow.value as Array<{ month: string; amount: number }>;
      const match = goals.find((g) => g.month === currentMonth);
      if (match) return match.amount;
    }

    const financialRow = rows.find((r) => r.key === "financial_config");
    if (financialRow) {
      const config = financialRow.value as { revenueGoalMonthly?: number };
      return config.revenueGoalMonthly ?? 12000;
    }

    return 12000;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
