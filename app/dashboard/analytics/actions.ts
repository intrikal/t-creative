/**
 * Server actions for the Analytics dashboard (`/dashboard/analytics`).
 *
 * Aggregates data from `bookings`, `payments`, `services`, and `profiles`
 * to produce:
 * - KPI stats (revenue MTD, booking count, new clients, no-show rate, avg ticket)
 * - Weekly booking trends by service category (stacked bars)
 * - Weekly revenue trend
 * - Service mix (% by category)
 * - Staff performance (bookings, revenue, avg ticket per staff member)
 * - Attendance breakdown (completed / cancelled / no-show)
 * - Client retention (new vs returning per week)
 * - At-risk clients (last visit > 30 days ago)
 * - Top services by bookings + revenue
 * - Rebooking rates per service
 * - Peak times (bookings by hour-of-day and day-of-week)
 *
 * Client sources are grouped from `profiles.source`, revenue goal is read
 * from the `settings` table, and KPI deltas compare current vs prior month.
 *
 * @module analytics/actions
 * @see {@link ./AnalyticsPage.tsx} — client component consuming this data
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, desc, sql, and, gte, lt, isNotNull, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  bookings,
  payments,
  services,
  profiles,
  settings,
  businessHours,
  timeOff,
  promotions,
  membershipSubscriptions,
  membershipPlans,
  giftCards,
  waitlist,
} from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
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
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type KpiStats = {
  revenueMtd: number;
  bookingCount: number;
  newClients: number;
  noShowRate: number;
  fillRate: number;
  avgTicket: number;
  revenueMtdDelta: number | null;
  bookingCountDelta: number | null;
  newClientsDelta: number | null;
  noShowRateDelta: number | null;
  fillRateDelta: number | null;
  avgTicketDelta: number | null;
};

export type ClientSourceItem = {
  source: string;
  count: number;
  pct: number;
};

export type ClientLifetimeValue = {
  clientId: string;
  name: string;
  totalSpend: number;
  transactionCount: number;
};

export type CancellationReasonItem = {
  reason: string;
  count: number;
  pct: number;
};

export type AppointmentGapStats = {
  overall: number | null;
  byCategory: { category: string; avgDays: number }[];
};

export type WeeklyBookings = {
  week: string;
  lash: number;
  jewelry: number;
  crochet: number;
  consulting: number;
};

export type WeeklyRevenue = {
  week: string;
  revenue: number;
};

export type ServiceMixItem = {
  label: string;
  pct: number;
  count: number;
};

export type StaffPerformanceItem = {
  name: string;
  role: string;
  avatar: string;
  bookings: number;
  revenue: number;
  avgTicket: number;
  utilization: number;
};

export type AttendanceStats = {
  completed: number;
  noShow: number;
  cancelled: number;
  total: number;
  revenueLost: number;
};

export type RetentionWeek = {
  week: string;
  newClients: number;
  returning: number;
};

export type AtRiskClient = {
  name: string;
  lastVisit: string;
  daysSince: number;
  service: string;
  urgency: "high" | "medium" | "low";
};

export type TopService = {
  service: string;
  bookings: number;
  revenue: number;
};

export type ServiceRevenueItem = {
  service: string;
  category: string;
  revenue: number;
  bookings: number;
  pct: number;
};

export type RebookRate = {
  service: string;
  rate: number;
};

export type VisitFrequencyBucket = {
  label: string;
  clients: number;
  pct: number;
};

export type CheckoutRebookStats = {
  overallRate: number;
  totalCompleted: number;
  totalRebooked: number;
  byStaff: {
    name: string;
    completed: number;
    rebooked: number;
    rate: number;
  }[];
  byCategory: {
    category: string;
    completed: number;
    rebooked: number;
    rate: number;
  }[];
};

export type PromotionRoiItem = {
  code: string;
  description: string | null;
  discountType: string;
  bookings: number;
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  roi: number;
};

export type MembershipValueStats = {
  memberAvgSpend: number;
  nonMemberAvgSpend: number;
  spendLift: number;
  avgLifetimeDays: number | null;
  monthlyChurnRate: number;
  activeCount: number;
  cancelledCount: number;
  byPlan: {
    plan: string;
    active: number;
    cancelled: number;
    avgSpend: number;
    avgLifetimeDays: number | null;
    churnRate: number;
  }[];
};

export type RevenuePerHourDay = {
  day: string;
  isoDay: number;
  revenue: number;
  availableHours: number;
  revenuePerHour: number;
};

export type GiftCardBreakageStats = {
  totalSold: number;
  totalOriginalValue: number;
  totalRedeemed: number;
  totalRemaining: number;
  breakageRate: number;
  byStatus: {
    status: string;
    count: number;
    originalValue: number;
    remaining: number;
  }[];
  aging: {
    label: string;
    count: number;
    remaining: number;
  }[];
};

export type PeakTimeSlot = {
  label: string;
  load: number;
};

export type WaitlistConversionStats = {
  totalEntries: number;
  totalNotified: number;
  totalBooked: number;
  totalExpired: number;
  totalCancelled: number;
  totalWaiting: number;
  conversionRate: number;
  expiryRate: number;
  avgWaitDays: number | null;
  avgClaimHours: number | null;
  byService: {
    service: string;
    entries: number;
    booked: number;
    expired: number;
    conversionRate: number;
    avgWaitDays: number | null;
  }[];
  weeklyTrend: {
    week: string;
    joined: number;
    booked: number;
    expired: number;
  }[];
};

/* ------------------------------------------------------------------ */
/*  Range selector                                                     */
/* ------------------------------------------------------------------ */

export type Range = "7d" | "30d" | "90d" | "12m";

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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  lash: "Lash Services",
  jewelry: "Jewelry",
  consulting: "Consulting",
  crochet: "Crochet",
};

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  KPI Stats                                                          */
/* ------------------------------------------------------------------ */

async function computeKpiForPeriod(periodStart: Date, periodEnd: Date) {
  // Run all 4 queries in parallel within a single period
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

export async function getKpiStats(): Promise<KpiStats> {
  try {
    await getUser();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [current, prior] = await Promise.all([
      computeKpiForPeriod(monthStart, now),
      computeKpiForPeriod(priorMonthStart, monthStart),
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

/* ------------------------------------------------------------------ */
/*  Weekly Bookings by Category                                        */
/* ------------------------------------------------------------------ */

export async function getBookingsTrend(range: Range = "30d"): Promise<WeeklyBookings[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        weekStart: sql<Date>`date_trunc('week', ${bookings.startsAt})`,
        category: services.category,
        count: sql<number>`count(*)`,
      })
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .where(gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`))
      .groupBy(sql`date_trunc('week', ${bookings.startsAt})`, services.category)
      .orderBy(sql`date_trunc('week', ${bookings.startsAt})`);

    // Pivot into { week, lash, jewelry, crochet, consulting }
    const weekMap = new Map<string, WeeklyBookings>();
    for (const r of rows) {
      const label = weekLabel(new Date(r.weekStart));
      if (!weekMap.has(label)) {
        weekMap.set(label, { week: label, lash: 0, jewelry: 0, crochet: 0, consulting: 0 });
      }
      const entry = weekMap.get(label)!;
      const cat = r.category as keyof Omit<WeeklyBookings, "week"> | null;
      if (cat && cat in entry) {
        entry[cat] = Number(r.count);
      }
    }

    return Array.from(weekMap.values());
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Weekly Revenue                                                     */
/* ------------------------------------------------------------------ */

export async function getRevenueTrend(range: Range = "30d"): Promise<WeeklyRevenue[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        weekStart: sql<Date>`date_trunc('week', coalesce(${payments.paidAt}, ${payments.createdAt}))`,
        total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
      })
      .from(payments)
      .where(
        and(eq(payments.status, "paid"), gte(payments.paidAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`)),
      )
      .groupBy(sql`date_trunc('week', coalesce(${payments.paidAt}, ${payments.createdAt}))`)
      .orderBy(sql`date_trunc('week', coalesce(${payments.paidAt}, ${payments.createdAt}))`);

    return rows.map((r) => ({
      week: weekLabel(new Date(r.weekStart)),
      revenue: Math.round(Number(r.total) / 100),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Service Mix                                                        */
/* ------------------------------------------------------------------ */

export async function getServiceMix(range: Range = "30d"): Promise<ServiceMixItem[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        category: services.category,
        count: sql<number>`count(*)`,
      })
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .where(gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`))
      .groupBy(services.category)
      .orderBy(sql`count(*) desc`);

    const total = rows.reduce((s, r) => s + Number(r.count), 0);

    return rows
      .filter((r) => r.category)
      .map((r) => ({
        label: CATEGORY_LABELS[r.category!] ?? r.category!,
        pct: total > 0 ? Math.round((Number(r.count) / total) * 100) : 0,
        count: Number(r.count),
      }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Staff Performance                                                  */
/* ------------------------------------------------------------------ */

export async function getStaffPerformance(range: Range = "30d"): Promise<StaffPerformanceItem[]> {
  try {
    await getUser();

    const staffProfile = alias(profiles, "staff");

    const rows = await db
      .select({
        staffId: bookings.staffId,
        firstName: staffProfile.firstName,
        lastName: staffProfile.lastName,
        role: staffProfile.role,
        bookingCount: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`,
        completedCount: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
        totalSlots: sql<number>`count(*) filter (where ${bookings.status} in ('completed', 'no_show', 'cancelled'))`,
      })
      .from(bookings)
      .leftJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
      .where(gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`))
      .groupBy(bookings.staffId, staffProfile.firstName, staffProfile.lastName, staffProfile.role)
      .orderBy(sql`sum(${bookings.totalInCents}) desc`);

    return rows
      .filter((r) => r.staffId)
      .map((r) => {
        const name = [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown";
        const bk = Number(r.bookingCount);
        const rev = Math.round(Number(r.revenue) / 100);
        const totalSlots = Number(r.totalSlots);
        const completed = Number(r.completedCount);
        return {
          name,
          role: r.role === "admin" ? "Owner" : "Staff",
          avatar: (r.firstName ?? "?")[0].toUpperCase(),
          bookings: bk,
          revenue: rev,
          avgTicket: bk > 0 ? Math.round(rev / bk) : 0,
          utilization: totalSlots > 0 ? Math.round((completed / totalSlots) * 100) : 0,
        };
      });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Attendance & Cancellations                                         */
/* ------------------------------------------------------------------ */

export async function getAttendanceStats(range: Range = "30d"): Promise<AttendanceStats> {
  try {
    await getUser();

    const [row] = await db
      .select({
        completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
        noShow: sql<number>`count(*) filter (where ${bookings.status} = 'no_show')`,
        cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')`,
        lostCents: sql<number>`coalesce(sum(${bookings.totalInCents}) filter (where ${bookings.status} = 'no_show'), 0)`,
      })
      .from(bookings)
      .where(gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`));

    const completed = Number(row.completed);
    const noShow = Number(row.noShow);
    const cancelled = Number(row.cancelled);
    return {
      completed,
      noShow,
      cancelled,
      total: completed + noShow + cancelled,
      revenueLost: Math.round(Number(row.lostCents) / 100),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Client Retention (new vs returning per week)                       */
/* ------------------------------------------------------------------ */

export async function getRetentionTrend(range: Range = "30d"): Promise<RetentionWeek[]> {
  try {
    await getUser();

    // A client is "new" if their first-ever booking falls in that week
    const rows = await db
      .select({
        weekStart: sql<Date>`date_trunc('week', ${bookings.startsAt})`,
        uniqueClients: sql<number>`count(distinct ${bookings.clientId})`,
        newClients: sql<number>`count(distinct ${bookings.clientId}) filter (
          where ${bookings.clientId} not in (
            select distinct b2.client_id from bookings b2
            where b2.starts_at < date_trunc('week', ${bookings.startsAt})
          )
        )`,
      })
      .from(bookings)
      .where(gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`))
      .groupBy(sql`date_trunc('week', ${bookings.startsAt})`)
      .orderBy(sql`date_trunc('week', ${bookings.startsAt})`);

    return rows.map((r) => {
      const unique = Number(r.uniqueClients);
      const newC = Number(r.newClients);
      return {
        week: weekLabel(new Date(r.weekStart)),
        newClients: newC,
        returning: unique - newC,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  At-Risk Clients                                                    */
/* ------------------------------------------------------------------ */

export async function getAtRiskClients(): Promise<AtRiskClient[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        clientId: bookings.clientId,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        lastVisit: sql<Date>`max(${bookings.startsAt})`,
        lastService: sql<string>`(
          select s.name from bookings b2
          join services s on s.id = b2.service_id
          where b2.client_id = ${bookings.clientId}
          order by b2.starts_at desc limit 1
        )`,
      })
      .from(bookings)
      .leftJoin(profiles, eq(bookings.clientId, profiles.id))
      .where(eq(bookings.status, "completed"))
      .groupBy(bookings.clientId, profiles.firstName, profiles.lastName)
      .having(sql`max(${bookings.startsAt}) < now() - interval '30 days'`)
      .orderBy(sql`max(${bookings.startsAt}) asc`)
      .limit(10);

    const now = new Date();
    return rows.map((r) => {
      const lastDate = new Date(r.lastVisit);
      const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown",
        lastVisit: lastDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        daysSince,
        service: r.lastService ?? "Unknown",
        urgency: daysSince > 50 ? "high" : daysSince > 40 ? "medium" : "low",
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Top Services                                                       */
/* ------------------------------------------------------------------ */

export async function getTopServices(range: Range = "30d"): Promise<TopService[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        serviceName: services.name,
        bookingCount: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`,
      })
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .where(gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`))
      .groupBy(services.name)
      .orderBy(sql`count(*) desc`)
      .limit(6);

    return rows.map((r) => ({
      service: r.serviceName ?? "Unknown",
      bookings: Number(r.bookingCount),
      revenue: Math.round(Number(r.revenue) / 100),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Revenue by Individual Service                                      */
/* ------------------------------------------------------------------ */

export async function getRevenueByService(range: Range = "30d"): Promise<ServiceRevenueItem[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        serviceName: services.name,
        category: services.category,
        revenue: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
        bookingCount: sql<number>`count(distinct ${bookings.id})`,
      })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(
        and(eq(payments.status, "paid"), gte(payments.paidAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`)),
      )
      .groupBy(services.name, services.category)
      .orderBy(sql`sum(${payments.amountInCents}) desc`);

    const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);

    return rows
      .filter((r) => r.serviceName)
      .map((r) => {
        const rev = Math.round(Number(r.revenue) / 100);
        return {
          service: r.serviceName!,
          category: CATEGORY_LABELS[r.category!] ?? r.category!,
          revenue: rev,
          bookings: Number(r.bookingCount),
          pct: totalRevenue > 0 ? Math.round((Number(r.revenue) / totalRevenue) * 100) : 0,
        };
      });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Rebooking Rates                                                    */
/* ------------------------------------------------------------------ */

export async function getRebookRates(): Promise<RebookRate[]> {
  try {
    await getUser();

    // A client "rebooked" a service if they have 2+ completed bookings for it
    const rows = await db
      .select({
        serviceName: services.name,
        totalClients: sql<number>`count(distinct ${bookings.clientId})`,
        rebookedClients: sql<number>`count(distinct ${bookings.clientId}) filter (
          where ${bookings.clientId} in (
            select b2.client_id from bookings b2
            where b2.service_id = ${bookings.serviceId} and b2.status = 'completed'
            group by b2.client_id
            having count(*) >= 2
          )
        )`,
      })
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .where(eq(bookings.status, "completed"))
      .groupBy(services.name, bookings.serviceId)
      .orderBy(sql`count(distinct ${bookings.clientId}) desc`)
      .limit(6);

    return rows
      .filter((r) => r.serviceName)
      .map((r) => {
        const total = Number(r.totalClients);
        const rebooked = Number(r.rebookedClients);
        return {
          service: r.serviceName!,
          rate: total > 0 ? Math.round((rebooked / total) * 100) : 0,
        };
      });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Peak Times                                                         */
/* ------------------------------------------------------------------ */

export async function getPeakTimes(range: Range = "30d"): Promise<{
  byHour: PeakTimeSlot[];
  byDay: PeakTimeSlot[];
}> {
  try {
    await getUser();

    const HOUR_LABELS = ["9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm"];
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const [hourRows, dayRows] = await Promise.all([
      db
        .select({
          hour: sql<number>`extract(hour from ${bookings.startsAt})`,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`))
        .groupBy(sql`extract(hour from ${bookings.startsAt})`),
      db
        .select({
          dow: sql<number>`extract(dow from ${bookings.startsAt})`,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`))
        .groupBy(sql`extract(dow from ${bookings.startsAt})`),
    ]);

    // Normalize to load %
    const hourMap = new Map(hourRows.map((r) => [Number(r.hour), Number(r.count)]));
    const dayMap = new Map(dayRows.map((r) => [Number(r.dow), Number(r.count)]));

    const maxHour = Math.max(...hourRows.map((r) => Number(r.count)), 1);
    const maxDay = Math.max(...dayRows.map((r) => Number(r.count)), 1);

    const byHour = HOUR_LABELS.map((label, i) => ({
      label,
      load: Math.round(((hourMap.get(i + 9) ?? 0) / maxHour) * 100),
    }));

    const byDay = DAY_LABELS.map((label, i) => ({
      label,
      load: Math.round(((dayMap.get(i) ?? 0) / maxDay) * 100),
    }));

    return { byHour, byDay };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Client Sources                                                     */
/* ------------------------------------------------------------------ */

export async function getClientSources(): Promise<ClientSourceItem[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        source: profiles.source,
        count: sql<number>`count(*)`,
      })
      .from(profiles)
      .where(and(eq(profiles.role, "client"), isNotNull(profiles.source)))
      .groupBy(profiles.source)
      .orderBy(sql`count(*) desc`);

    const total = rows.reduce((s, r) => s + Number(r.count), 0);

    return rows.map((r) => ({
      source: r.source!,
      count: Number(r.count),
      pct: total > 0 ? Math.round((Number(r.count) / total) * 100) : 0,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Revenue Goal (from settings)                                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Client Lifetime Value (top 10)                                     */
/* ------------------------------------------------------------------ */

export async function getClientLifetimeValues(): Promise<ClientLifetimeValue[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        clientId: payments.clientId,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        totalSpend: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
        txCount: sql<number>`count(*)`,
      })
      .from(payments)
      .leftJoin(profiles, eq(payments.clientId, profiles.id))
      .where(eq(payments.status, "paid"))
      .groupBy(payments.clientId, profiles.firstName, profiles.lastName)
      .orderBy(sql`sum(${payments.amountInCents}) desc`)
      .limit(10);

    return rows.map((r) => ({
      clientId: r.clientId,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown",
      totalSpend: Math.round(Number(r.totalSpend) / 100),
      transactionCount: Number(r.txCount),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Cancellation Reasons                                               */
/* ------------------------------------------------------------------ */

export async function getCancellationReasons(): Promise<CancellationReasonItem[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        reason: bookings.cancellationReason,
        count: sql<number>`count(*)`,
      })
      .from(bookings)
      .where(eq(bookings.status, "cancelled"))
      .groupBy(bookings.cancellationReason)
      .orderBy(sql`count(*) desc`);

    const total = rows.reduce((s, r) => s + Number(r.count), 0);

    return rows.map((r) => ({
      reason: r.reason || "No reason given",
      count: Number(r.count),
      pct: total > 0 ? Math.round((Number(r.count) / total) * 100) : 0,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Average Days Between Appointments                                  */
/* ------------------------------------------------------------------ */

export async function getAppointmentGaps(): Promise<AppointmentGapStats> {
  try {
    await getUser();

    const [overallRow, categoryRows] = await Promise.all([
      db.execute(sql`
        WITH gaps AS (
          SELECT
            b.client_id,
            extract(day from (b.starts_at - lag(b.starts_at) OVER (
              PARTITION BY b.client_id ORDER BY b.starts_at
            ))) AS gap_days
          FROM bookings b
          WHERE b.status = 'completed'
            AND b.starts_at > now() - interval '12 months'
        )
        SELECT round(avg(gap_days))::int AS avg_days
        FROM gaps
        WHERE gap_days IS NOT NULL AND gap_days > 0
      `),
      db.execute(sql`
        WITH gaps AS (
          SELECT
            b.client_id,
            s.category,
            extract(day from (b.starts_at - lag(b.starts_at) OVER (
              PARTITION BY b.client_id, s.category ORDER BY b.starts_at
            ))) AS gap_days
          FROM bookings b
          JOIN services s ON s.id = b.service_id
          WHERE b.status = 'completed'
            AND b.starts_at > now() - interval '12 months'
        )
        SELECT category, round(avg(gap_days))::int AS avg_days
        FROM gaps
        WHERE gap_days IS NOT NULL AND gap_days > 0
        GROUP BY category
        ORDER BY avg(gap_days)
      `),
    ]);

    // db.execute() returns the rows array directly with the postgres driver
    const overallRows = overallRow as unknown as { avg_days: number | null }[];
    const catRows = categoryRows as unknown as { category: string; avg_days: number }[];

    const overall = overallRows[0]?.avg_days != null ? Number(overallRows[0].avg_days) : null;

    const byCategory = catRows
      .filter((r) => r.category)
      .map((r) => ({
        category: CATEGORY_LABELS[r.category] ?? r.category,
        avgDays: Number(r.avg_days),
      }));

    return { overall, byCategory };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Visit Frequency Distribution                                       */
/* ------------------------------------------------------------------ */

const VISIT_BUCKETS = [
  { label: "1 visit", min: 1, max: 1 },
  { label: "2–3 visits", min: 2, max: 3 },
  { label: "4–6 visits", min: 4, max: 6 },
  { label: "7–12 visits", min: 7, max: 12 },
  { label: "13+ visits", min: 13, max: Infinity },
] as const;

export async function getVisitFrequency(): Promise<VisitFrequencyBucket[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        clientId: bookings.clientId,
        visits: sql<number>`count(*)`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "completed"),
          gte(bookings.startsAt, sql`now() - interval '12 months'`),
        ),
      )
      .groupBy(bookings.clientId);

    const totalClients = rows.length;

    const buckets = VISIT_BUCKETS.map((b) => {
      const clients = rows.filter((r) => {
        const v = Number(r.visits);
        return v >= b.min && v <= b.max;
      }).length;
      return {
        label: b.label,
        clients,
        pct: totalClients > 0 ? Math.round((clients / totalClients) * 100) : 0,
      };
    });

    return buckets;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Revenue per Available Hour                                         */
/* ------------------------------------------------------------------ */

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

    const daysBack =
      range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - daysBack);

    // 1. Studio-wide business hours (staffId IS NULL)
    const hours = await db
      .select({
        dayOfWeek: businessHours.dayOfWeek,
        isOpen: businessHours.isOpen,
        opensAt: businessHours.opensAt,
        closesAt: businessHours.closesAt,
      })
      .from(businessHours)
      .where(sql`${businessHours.staffId} is null`);

    // 2. Lunch break from settings
    const [lunchRow] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "lunch_break"));
    const lunch = lunchRow?.value as { enabled?: boolean; start?: string; end?: string } | null;
    const lunchHours =
      lunch?.enabled && lunch.start && lunch.end
        ? timeToHours(lunch.end) - timeToHours(lunch.start)
        : 0;

    // 3. Time-off days (studio-wide) in the last 30 days
    const timeOffRows = await db
      .select({ startDate: timeOff.startDate, endDate: timeOff.endDate })
      .from(timeOff)
      .where(
        and(
          sql`${timeOff.staffId} is null`,
          sql`${timeOff.endDate} >= ${thirtyDaysAgo.toISOString().slice(0, 10)}`,
        ),
      );

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

    // 5. Revenue by ISO day-of-week (last 30 days, paid)
    const revenueRows = await db
      .select({
        isoDay: sql<number>`extract(isodow from ${payments.paidAt})`,
        total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
      })
      .from(payments)
      .where(
        and(eq(payments.status, "paid"), gte(payments.paidAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`)),
      )
      .groupBy(sql`extract(isodow from ${payments.paidAt})`);

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

/* ------------------------------------------------------------------ */
/*  Checkout Rebook Rate                                               */
/* ------------------------------------------------------------------ */

/**
 * Of completed appointments in the last 30 days, how many clients
 * created their next booking within 24 hours of checkout?
 * Broken down overall, by staff, and by service category.
 */
export async function getCheckoutRebookRate(range: Range = "30d"): Promise<CheckoutRebookStats> {
  try {
    await getUser();

    const result = await db.execute(sql`
      WITH completed AS (
        SELECT
          b.id,
          b.client_id,
          b.staff_id,
          b.completed_at,
          s.category
        FROM bookings b
        JOIN services s ON s.id = b.service_id
        WHERE b.status = 'completed'
          AND b.completed_at IS NOT NULL
          AND b.completed_at > now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}
      ),
      rebooked AS (
        SELECT DISTINCT c.id
        FROM completed c
        WHERE EXISTS (
          SELECT 1 FROM bookings nb
          WHERE nb.client_id = c.client_id
            AND nb.id != c.id
            AND nb.starts_at > c.completed_at
            AND nb.created_at <= c.completed_at + interval '24 hours'
            AND nb.status != 'cancelled'
        )
      )
      SELECT
        c.id,
        c.staff_id,
        c.category,
        CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS did_rebook
      FROM completed c
      LEFT JOIN rebooked r ON r.id = c.id
    `);

    const rows = result as unknown as {
      id: number;
      staff_id: string | null;
      category: string;
      did_rebook: number;
    }[];

    const totalCompleted = rows.length;
    const totalRebooked = rows.filter((r) => Number(r.did_rebook) === 1).length;
    const overallRate = totalCompleted > 0 ? Math.round((totalRebooked / totalCompleted) * 100) : 0;

    // By staff
    const staffMap = new Map<string, { completed: number; rebooked: number }>();
    for (const r of rows) {
      if (!r.staff_id) continue;
      const entry = staffMap.get(r.staff_id) ?? { completed: 0, rebooked: 0 };
      entry.completed++;
      if (Number(r.did_rebook) === 1) entry.rebooked++;
      staffMap.set(r.staff_id, entry);
    }

    // Fetch staff names
    const staffIds = Array.from(staffMap.keys());
    const staffNames =
      staffIds.length > 0
        ? await db
            .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
            .from(profiles)
            .where(sql`${profiles.id} in ${staffIds}`)
        : [];
    const nameMap = new Map(
      staffNames.map((s) => [
        s.id,
        [s.firstName, s.lastName].filter(Boolean).join(" ") || "Unknown",
      ]),
    );

    const byStaff = Array.from(staffMap.entries())
      .map(([id, s]) => ({
        name: nameMap.get(id) ?? "Unknown",
        completed: s.completed,
        rebooked: s.rebooked,
        rate: s.completed > 0 ? Math.round((s.rebooked / s.completed) * 100) : 0,
      }))
      .sort((a, b) => b.completed - a.completed);

    // By category
    const catMap = new Map<string, { completed: number; rebooked: number }>();
    for (const r of rows) {
      const entry = catMap.get(r.category) ?? { completed: 0, rebooked: 0 };
      entry.completed++;
      if (Number(r.did_rebook) === 1) entry.rebooked++;
      catMap.set(r.category, entry);
    }

    const byCategory = Array.from(catMap.entries())
      .map(([cat, s]) => ({
        category: CATEGORY_LABELS[cat] ?? cat,
        completed: s.completed,
        rebooked: s.rebooked,
        rate: s.completed > 0 ? Math.round((s.rebooked / s.completed) * 100) : 0,
      }))
      .sort((a, b) => b.completed - a.completed);

    return { overallRate, totalCompleted, totalRebooked, byStaff, byCategory };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Promotion ROI                                                      */
/* ------------------------------------------------------------------ */

/**
 * For each promotion that has been used, calculates:
 * - Gross revenue: total booking price (before discount) of promo-linked bookings
 * - Total discount: sum of discountInCents on those bookings
 * - Net revenue: actual paid revenue from payments on those bookings
 * - ROI: (netRevenue - totalDiscount) / totalDiscount as a percentage
 */
export async function getPromotionRoi(): Promise<PromotionRoiItem[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        promoId: promotions.id,
        code: promotions.code,
        description: promotions.description,
        discountType: promotions.discountType,
        bookingCount: sql<number>`count(distinct ${bookings.id})`,
        grossRevenue: sql<number>`coalesce(sum(${bookings.totalInCents} + ${bookings.discountInCents}), 0)`,
        totalDiscount: sql<number>`coalesce(sum(${bookings.discountInCents}), 0)`,
        netPaid: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
      })
      .from(promotions)
      .innerJoin(bookings, eq(bookings.promotionId, promotions.id))
      .leftJoin(payments, and(eq(payments.bookingId, bookings.id), eq(payments.status, "paid")))
      .where(sql`${promotions.redemptionCount} > 0`)
      .groupBy(promotions.id, promotions.code, promotions.description, promotions.discountType)
      .orderBy(sql`sum(${bookings.discountInCents}) desc`);

    return rows.map((r) => {
      const grossRevenue = Math.round(Number(r.grossRevenue) / 100);
      const totalDiscount = Math.round(Number(r.totalDiscount) / 100);
      const netRevenue = Math.round(Number(r.netPaid) / 100);
      const roi =
        totalDiscount > 0 ? Math.round(((netRevenue - totalDiscount) / totalDiscount) * 100) : 0;

      return {
        code: r.code,
        description: r.description,
        discountType: r.discountType,
        bookings: Number(r.bookingCount),
        grossRevenue,
        totalDiscount,
        netRevenue,
        roi,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Membership Value Tracking                                          */
/* ------------------------------------------------------------------ */

export async function getMembershipValue(): Promise<MembershipValueStats> {
  try {
    await getUser();

    // 1. Get all membership subscriptions with plan names
    const subs = await db
      .select({
        id: membershipSubscriptions.id,
        clientId: membershipSubscriptions.clientId,
        planName: membershipPlans.name,
        status: membershipSubscriptions.status,
        createdAt: membershipSubscriptions.createdAt,
        cancelledAt: membershipSubscriptions.cancelledAt,
      })
      .from(membershipSubscriptions)
      .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id));

    // Collect member client IDs (anyone who has ever had a membership)
    const memberClientIds = new Set(subs.map((s) => s.clientId));

    // 2. Average spend per client (last 12 months) — members vs non-members
    const spendRows = await db
      .select({
        clientId: payments.clientId,
        total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
      })
      .from(payments)
      .where(
        and(eq(payments.status, "paid"), gte(payments.paidAt, sql`now() - interval '12 months'`)),
      )
      .groupBy(payments.clientId);

    let memberTotal = 0;
    let memberCount = 0;
    let nonMemberTotal = 0;
    let nonMemberCount = 0;

    for (const r of spendRows) {
      const spend = Math.round(Number(r.total) / 100);
      if (memberClientIds.has(r.clientId)) {
        memberTotal += spend;
        memberCount++;
      } else {
        nonMemberTotal += spend;
        nonMemberCount++;
      }
    }

    const memberAvgSpend = memberCount > 0 ? Math.round(memberTotal / memberCount) : 0;
    const nonMemberAvgSpend = nonMemberCount > 0 ? Math.round(nonMemberTotal / nonMemberCount) : 0;
    const spendLift =
      nonMemberAvgSpend > 0
        ? Math.round(((memberAvgSpend - nonMemberAvgSpend) / nonMemberAvgSpend) * 100)
        : 0;

    // 3. Membership lifetime (for cancelled memberships)
    const cancelledSubs = subs.filter((s) => s.status === "cancelled" && s.cancelledAt);
    const lifetimeDays = cancelledSubs.map((s) => {
      const created = new Date(s.createdAt);
      const cancelled = new Date(s.cancelledAt!);
      return Math.floor((cancelled.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    });
    const avgLifetimeDays =
      lifetimeDays.length > 0
        ? Math.round(lifetimeDays.reduce((a, b) => a + b, 0) / lifetimeDays.length)
        : null;

    // 4. Monthly churn rate
    // Churn = memberships cancelled in last 30 days / active memberships at start of period
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCancels = cancelledSubs.filter(
      (s) => new Date(s.cancelledAt!) >= thirtyDaysAgo,
    ).length;

    const activeCount = subs.filter((s) => s.status === "active").length;
    const cancelledCount = cancelledSubs.length;
    // Denominator: active now + recently cancelled (approximation of start-of-period active)
    const periodStart = activeCount + recentCancels;
    const monthlyChurnRate = periodStart > 0 ? Math.round((recentCancels / periodStart) * 100) : 0;

    // 5. By plan
    const planMap = new Map<
      string,
      { active: number; cancelled: number; clientIds: Set<string>; lifetimes: number[] }
    >();

    for (const s of subs) {
      const entry = planMap.get(s.planName) ?? {
        active: 0,
        cancelled: 0,
        clientIds: new Set<string>(),
        lifetimes: [],
      };
      entry.clientIds.add(s.clientId);

      if (s.status === "active") entry.active++;
      if (s.status === "cancelled") {
        entry.cancelled++;
        if (s.cancelledAt) {
          const days = Math.floor(
            (new Date(s.cancelledAt).getTime() - new Date(s.createdAt).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          entry.lifetimes.push(days);
        }
      }

      planMap.set(s.planName, entry);
    }

    // Compute per-plan spend from the spend data we already have
    const clientSpendMap = new Map(
      spendRows.map((r) => [r.clientId, Math.round(Number(r.total) / 100)]),
    );

    const byPlan = Array.from(planMap.entries())
      .map(([plan, data]) => {
        const planClientSpends = Array.from(data.clientIds)
          .map((id) => clientSpendMap.get(id) ?? 0)
          .filter((s) => s > 0);
        const avgSpend =
          planClientSpends.length > 0
            ? Math.round(planClientSpends.reduce((a, b) => a + b, 0) / planClientSpends.length)
            : 0;
        const planAvgLifetime =
          data.lifetimes.length > 0
            ? Math.round(data.lifetimes.reduce((a, b) => a + b, 0) / data.lifetimes.length)
            : null;

        const planRecentCancels = subs.filter(
          (s) =>
            s.planName === plan &&
            s.status === "cancelled" &&
            s.cancelledAt &&
            new Date(s.cancelledAt) >= thirtyDaysAgo,
        ).length;
        const planPeriodStart = data.active + planRecentCancels;
        const churnRate =
          planPeriodStart > 0 ? Math.round((planRecentCancels / planPeriodStart) * 100) : 0;

        return {
          plan,
          active: data.active,
          cancelled: data.cancelled,
          avgSpend,
          avgLifetimeDays: planAvgLifetime,
          churnRate,
        };
      })
      .sort((a, b) => b.active - a.active);

    return {
      memberAvgSpend,
      nonMemberAvgSpend,
      spendLift,
      avgLifetimeDays,
      monthlyChurnRate,
      activeCount,
      cancelledCount,
      byPlan,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Gift Card Breakage                                                 */
/* ------------------------------------------------------------------ */

const AGING_BUCKETS = [
  { label: "< 3 months", maxDays: 90 },
  { label: "3–6 months", maxDays: 180 },
  { label: "6–12 months", maxDays: 365 },
  { label: "12+ months", maxDays: Infinity },
] as const;

const GC_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  redeemed: "Fully Redeemed",
  expired: "Expired",
};

export async function getGiftCardBreakage(): Promise<GiftCardBreakageStats> {
  try {
    await getUser();

    const cards = await db
      .select({
        id: giftCards.id,
        status: giftCards.status,
        originalAmountInCents: giftCards.originalAmountInCents,
        balanceInCents: giftCards.balanceInCents,
        purchasedAt: giftCards.purchasedAt,
      })
      .from(giftCards);

    if (cards.length === 0) {
      return {
        totalSold: 0,
        totalOriginalValue: 0,
        totalRedeemed: 0,
        totalRemaining: 0,
        breakageRate: 0,
        byStatus: [],
        aging: [],
      };
    }

    const totalSold = cards.length;
    const totalOriginalValue = Math.round(
      cards.reduce((s, c) => s + c.originalAmountInCents, 0) / 100,
    );
    const totalRemaining = Math.round(cards.reduce((s, c) => s + c.balanceInCents, 0) / 100);
    const totalRedeemed = totalOriginalValue - totalRemaining;
    const breakageRate =
      totalOriginalValue > 0 ? Math.round((totalRemaining / totalOriginalValue) * 100) : 0;

    // By status
    const statusMap = new Map<string, { count: number; original: number; remaining: number }>();
    for (const c of cards) {
      const entry = statusMap.get(c.status) ?? { count: 0, original: 0, remaining: 0 };
      entry.count++;
      entry.original += c.originalAmountInCents;
      entry.remaining += c.balanceInCents;
      statusMap.set(c.status, entry);
    }

    const byStatus = Array.from(statusMap.entries())
      .map(([status, data]) => ({
        status: GC_STATUS_LABELS[status] ?? status,
        count: data.count,
        originalValue: Math.round(data.original / 100),
        remaining: Math.round(data.remaining / 100),
      }))
      .sort((a, b) => b.remaining - a.remaining);

    // Aging — cards with remaining balance, by age since purchase
    const now = new Date();
    const cardsWithBalance = cards.filter((c) => c.balanceInCents > 0);

    const aging = AGING_BUCKETS.map((bucket, i) => {
      const minDays = i === 0 ? 0 : AGING_BUCKETS[i - 1].maxDays;
      const matching = cardsWithBalance.filter((c) => {
        const days = Math.floor(
          (now.getTime() - new Date(c.purchasedAt).getTime()) / (1000 * 60 * 60 * 24),
        );
        return days >= minDays && days < bucket.maxDays;
      });
      return {
        label: bucket.label,
        count: matching.length,
        remaining: Math.round(matching.reduce((s, c) => s + c.balanceInCents, 0) / 100),
      };
    });

    return {
      totalSold,
      totalOriginalValue,
      totalRedeemed,
      totalRemaining,
      breakageRate,
      byStatus,
      aging,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  CSV Export                                                         */
/* ------------------------------------------------------------------ */

export type BookingExportRow = {
  date: string;
  client: string;
  service: string;
  status: string;
  durationMin: number;
  priceUsd: string;
  staff: string;
  notes: string;
};

/** Returns raw booking rows suitable for CSV download. */
export async function exportBookingsCsv(): Promise<BookingExportRow[]> {
  try {
    await getUser();

    const clientProfile = alias(profiles, "client_profile");
    const staffProfile = alias(profiles, "staff_profile");

    const rows = await db
      .select({
        startsAt: bookings.startsAt,
        clientFirst: clientProfile.firstName,
        clientLast: clientProfile.lastName,
        serviceName: services.name,
        status: bookings.status,
        durationMin: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        staffFirst: staffProfile.firstName,
        staffLast: staffProfile.lastName,
        notes: bookings.clientNotes,
      })
      .from(bookings)
      .leftJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
      .orderBy(desc(bookings.startsAt))
      .limit(5000);

    return rows.map((r) => ({
      date: r.startsAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      client: [r.clientFirst, r.clientLast].filter(Boolean).join(" ") || "—",
      service: r.serviceName ?? "—",
      status: r.status,
      durationMin: r.durationMin ?? 0,
      priceUsd: r.totalInCents != null ? `$${(r.totalInCents / 100).toFixed(2)}` : "—",
      staff: [r.staffFirst, r.staffLast].filter(Boolean).join(" ") || "—",
      notes: r.notes ?? "",
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Waitlist conversion                                                */
/* ------------------------------------------------------------------ */

export async function getWaitlistConversion(
  range: Range,
): Promise<WaitlistConversionStats> {
  await getUser();
  try {
    const interval = rangeToInterval(range);

    /* ---- Status counts ---- */
    const statusRows = await db
      .select({
        status: waitlist.status,
        count: sql<number>`count(*)::int`,
      })
      .from(waitlist)
      .where(gte(waitlist.createdAt, sql`now() - ${interval}::interval`))
      .groupBy(waitlist.status);

    const statusMap: Record<string, number> = {};
    for (const r of statusRows) statusMap[r.status] = r.count;
    const totalEntries =
      (statusMap.waiting ?? 0) +
      (statusMap.notified ?? 0) +
      (statusMap.booked ?? 0) +
      (statusMap.expired ?? 0) +
      (statusMap.cancelled ?? 0);
    const totalNotified =
      (statusMap.notified ?? 0) + (statusMap.booked ?? 0) + (statusMap.expired ?? 0);
    const totalBooked = statusMap.booked ?? 0;
    const totalExpired = statusMap.expired ?? 0;
    const totalCancelled = statusMap.cancelled ?? 0;
    const totalWaiting = statusMap.waiting ?? 0;

    const conversionRate =
      totalNotified > 0 ? Math.round((totalBooked / totalNotified) * 100) : 0;
    const expiryRate =
      totalNotified > 0 ? Math.round((totalExpired / totalNotified) * 100) : 0;

    /* ---- Average wait time (created → notified) ---- */
    const [waitTimeRow] = await db
      .select({
        avgWaitDays: sql<number | null>`
          round(avg(extract(epoch from ${waitlist.notifiedAt} - ${waitlist.createdAt}) / 86400)::numeric, 1)
        `,
      })
      .from(waitlist)
      .where(
        and(
          gte(waitlist.createdAt, sql`now() - ${interval}::interval`),
          isNotNull(waitlist.notifiedAt),
        ),
      );

    /* ---- Average claim time (notified → booked, in hours) ---- */
    const [claimTimeRow] = await db
      .select({
        avgClaimHours: sql<number | null>`
          round(avg(extract(epoch from ${waitlist.updatedAt} - ${waitlist.notifiedAt}) / 3600)::numeric, 1)
        `,
      })
      .from(waitlist)
      .where(
        and(
          gte(waitlist.createdAt, sql`now() - ${interval}::interval`),
          eq(waitlist.status, "booked"),
          isNotNull(waitlist.notifiedAt),
        ),
      );

    /* ---- By service ---- */
    const byServiceRows = await db
      .select({
        serviceName: services.name,
        status: waitlist.status,
        count: sql<number>`count(*)::int`,
        avgWaitDays: sql<number | null>`
          round(avg(
            case when ${waitlist.notifiedAt} is not null
              then extract(epoch from ${waitlist.notifiedAt} - ${waitlist.createdAt}) / 86400
              else null
            end
          )::numeric, 1)
        `,
      })
      .from(waitlist)
      .innerJoin(services, eq(waitlist.serviceId, services.id))
      .where(gte(waitlist.createdAt, sql`now() - ${interval}::interval`))
      .groupBy(services.name, waitlist.status);

    const serviceAgg: Record<
      string,
      { entries: number; booked: number; expired: number; avgWaitDays: number | null }
    > = {};
    for (const r of byServiceRows) {
      const name = r.serviceName ?? "Unknown";
      if (!serviceAgg[name])
        serviceAgg[name] = { entries: 0, booked: 0, expired: 0, avgWaitDays: null };
      serviceAgg[name].entries += r.count;
      if (r.status === "booked") serviceAgg[name].booked += r.count;
      if (r.status === "expired") serviceAgg[name].expired += r.count;
      if (r.avgWaitDays != null) serviceAgg[name].avgWaitDays = r.avgWaitDays;
    }
    const byService = Object.entries(serviceAgg)
      .map(([service, s]) => ({
        service,
        entries: s.entries,
        booked: s.booked,
        expired: s.expired,
        conversionRate:
          s.booked + s.expired > 0
            ? Math.round((s.booked / (s.booked + s.expired)) * 100)
            : 0,
        avgWaitDays: s.avgWaitDays,
      }))
      .sort((a, b) => b.entries - a.entries);

    /* ---- Weekly trend ---- */
    const weeklyRows = await db
      .select({
        week: sql<string>`to_char(date_trunc('week', ${waitlist.createdAt}), 'Mon DD')`,
        status: waitlist.status,
        count: sql<number>`count(*)::int`,
      })
      .from(waitlist)
      .where(gte(waitlist.createdAt, sql`now() - ${interval}::interval`))
      .groupBy(
        sql`date_trunc('week', ${waitlist.createdAt})`,
        waitlist.status,
      )
      .orderBy(sql`date_trunc('week', ${waitlist.createdAt})`);

    const weekAgg: Record<string, { joined: number; booked: number; expired: number }> =
      {};
    for (const r of weeklyRows) {
      if (!weekAgg[r.week]) weekAgg[r.week] = { joined: 0, booked: 0, expired: 0 };
      weekAgg[r.week].joined += r.count;
      if (r.status === "booked") weekAgg[r.week].booked += r.count;
      if (r.status === "expired") weekAgg[r.week].expired += r.count;
    }
    const weeklyTrend = Object.entries(weekAgg).map(([week, w]) => ({
      week,
      joined: w.joined,
      booked: w.booked,
      expired: w.expired,
    }));

    return {
      totalEntries,
      totalNotified,
      totalBooked,
      totalExpired,
      totalCancelled,
      totalWaiting,
      conversionRate,
      expiryRate,
      avgWaitDays: waitTimeRow?.avgWaitDays ?? null,
      avgClaimHours: claimTimeRow?.avgClaimHours ?? null,
      byService,
      weeklyTrend,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
