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

import { eq, desc, sql, and, gte, lt, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, payments, services, profiles, settings } from "@/db/schema";
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

export type RebookRate = {
  service: string;
  rate: number;
};

export type PeakTimeSlot = {
  label: string;
  load: number;
};

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
}

/* ------------------------------------------------------------------ */
/*  Weekly Bookings by Category                                        */
/* ------------------------------------------------------------------ */

export async function getBookingsTrend(): Promise<WeeklyBookings[]> {
  await getUser();

  const rows = await db
    .select({
      weekStart: sql<Date>`date_trunc('week', ${bookings.startsAt})`,
      category: services.category,
      count: sql<number>`count(*)`,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(gte(bookings.startsAt, sql`now() - interval '8 weeks'`))
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
}

/* ------------------------------------------------------------------ */
/*  Weekly Revenue                                                     */
/* ------------------------------------------------------------------ */

export async function getRevenueTrend(): Promise<WeeklyRevenue[]> {
  await getUser();

  const rows = await db
    .select({
      weekStart: sql<Date>`date_trunc('week', coalesce(${payments.paidAt}, ${payments.createdAt}))`,
      total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
    })
    .from(payments)
    .where(and(eq(payments.status, "paid"), gte(payments.paidAt, sql`now() - interval '8 weeks'`)))
    .groupBy(sql`date_trunc('week', coalesce(${payments.paidAt}, ${payments.createdAt}))`)
    .orderBy(sql`date_trunc('week', coalesce(${payments.paidAt}, ${payments.createdAt}))`);

  return rows.map((r) => ({
    week: weekLabel(new Date(r.weekStart)),
    revenue: Math.round(Number(r.total) / 100),
  }));
}

/* ------------------------------------------------------------------ */
/*  Service Mix                                                        */
/* ------------------------------------------------------------------ */

export async function getServiceMix(): Promise<ServiceMixItem[]> {
  await getUser();

  const rows = await db
    .select({
      category: services.category,
      count: sql<number>`count(*)`,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(gte(bookings.startsAt, sql`now() - interval '30 days'`))
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
}

/* ------------------------------------------------------------------ */
/*  Staff Performance                                                  */
/* ------------------------------------------------------------------ */

export async function getStaffPerformance(): Promise<StaffPerformanceItem[]> {
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
    .where(gte(bookings.startsAt, sql`now() - interval '30 days'`))
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
}

/* ------------------------------------------------------------------ */
/*  Attendance & Cancellations                                         */
/* ------------------------------------------------------------------ */

export async function getAttendanceStats(): Promise<AttendanceStats> {
  await getUser();

  const [row] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
      noShow: sql<number>`count(*) filter (where ${bookings.status} = 'no_show')`,
      cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')`,
      lostCents: sql<number>`coalesce(sum(${bookings.totalInCents}) filter (where ${bookings.status} = 'no_show'), 0)`,
    })
    .from(bookings)
    .where(gte(bookings.startsAt, sql`now() - interval '30 days'`));

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
}

/* ------------------------------------------------------------------ */
/*  Client Retention (new vs returning per week)                       */
/* ------------------------------------------------------------------ */

export async function getRetentionTrend(): Promise<RetentionWeek[]> {
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
    .where(gte(bookings.startsAt, sql`now() - interval '8 weeks'`))
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
}

/* ------------------------------------------------------------------ */
/*  At-Risk Clients                                                    */
/* ------------------------------------------------------------------ */

export async function getAtRiskClients(): Promise<AtRiskClient[]> {
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
}

/* ------------------------------------------------------------------ */
/*  Top Services                                                       */
/* ------------------------------------------------------------------ */

export async function getTopServices(): Promise<TopService[]> {
  await getUser();

  const rows = await db
    .select({
      serviceName: services.name,
      bookingCount: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(gte(bookings.startsAt, sql`now() - interval '30 days'`))
    .groupBy(services.name)
    .orderBy(sql`count(*) desc`)
    .limit(6);

  return rows.map((r) => ({
    service: r.serviceName ?? "Unknown",
    bookings: Number(r.bookingCount),
    revenue: Math.round(Number(r.revenue) / 100),
  }));
}

/* ------------------------------------------------------------------ */
/*  Rebooking Rates                                                    */
/* ------------------------------------------------------------------ */

export async function getRebookRates(): Promise<RebookRate[]> {
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
}

/* ------------------------------------------------------------------ */
/*  Peak Times                                                         */
/* ------------------------------------------------------------------ */

export async function getPeakTimes(): Promise<{
  byHour: PeakTimeSlot[];
  byDay: PeakTimeSlot[];
}> {
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
      .where(gte(bookings.startsAt, sql`now() - interval '30 days'`))
      .groupBy(sql`extract(hour from ${bookings.startsAt})`),
    db
      .select({
        dow: sql<number>`extract(dow from ${bookings.startsAt})`,
        count: sql<number>`count(*)`,
      })
      .from(bookings)
      .where(gte(bookings.startsAt, sql`now() - interval '30 days'`))
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
}

/* ------------------------------------------------------------------ */
/*  Client Sources                                                     */
/* ------------------------------------------------------------------ */

export async function getClientSources(): Promise<ClientSourceItem[]> {
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
}

/* ------------------------------------------------------------------ */
/*  Revenue Goal (from settings)                                       */
/* ------------------------------------------------------------------ */

export async function getRevenueGoal(): Promise<number> {
  await getUser();

  const [row] = await db.select().from(settings).where(eq(settings.key, "financial_config"));
  if (!row) return 12000;
  const config = row.value as { revenueGoalMonthly?: number };
  return config.revenueGoalMonthly ?? 12000;
}

/* ------------------------------------------------------------------ */
/*  Client Lifetime Value (top 10)                                     */
/* ------------------------------------------------------------------ */

export async function getClientLifetimeValues(): Promise<ClientLifetimeValue[]> {
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
}

/* ------------------------------------------------------------------ */
/*  Cancellation Reasons                                               */
/* ------------------------------------------------------------------ */

export async function getCancellationReasons(): Promise<CancellationReasonItem[]> {
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
}

/* ------------------------------------------------------------------ */
/*  Average Days Between Appointments                                  */
/* ------------------------------------------------------------------ */

export async function getAppointmentGaps(): Promise<AppointmentGapStats> {
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
}
