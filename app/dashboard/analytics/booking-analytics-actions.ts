/**
 * app/dashboard/analytics/booking-analytics-actions.ts — Booking-focused analytics.
 *
 * Booking trends, service mix, attendance stats, peak times, appointment gaps,
 * checkout rebook rate, top services, and CSV export.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, payments, services, profiles } from "@/db/schema";
import { getUser, rangeToInterval, weekLabel, CATEGORY_LABELS } from "./_shared";
import type { Range } from "./_shared";

export type WeeklyBookings = {
  week: string;
  lash: number;
  jewelry: number;
  crochet: number;
  consulting: number;
};

export type ServiceMixItem = {
  label: string;
  pct: number;
  count: number;
};

export type AttendanceStats = {
  completed: number;
  noShow: number;
  cancelled: number;
  total: number;
  revenueLost: number;
};

export type PeakTimeSlot = {
  label: string;
  load: number;
};

export type AppointmentGapStats = {
  overall: number | null;
  byCategory: { category: string; avgDays: number }[];
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

export type TopService = {
  service: string;
  bookings: number;
  revenue: number;
};

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
      .where(
        gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
      )
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
      .where(
        gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
      )
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
      .where(
        gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
      );

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
        .where(
          gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
        )
        .groupBy(sql`extract(hour from ${bookings.startsAt})`),
      db
        .select({
          dow: sql<number>`extract(dow from ${bookings.startsAt})`,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(
          gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
        )
        .groupBy(sql`extract(dow from ${bookings.startsAt})`),
    ]);

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

export async function getAppointmentGaps(range: Range = "30d"): Promise<AppointmentGapStats> {
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
            AND b.starts_at > now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}
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
            AND b.starts_at > now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}
        )
        SELECT category, round(avg(gap_days))::int AS avg_days
        FROM gaps
        WHERE gap_days IS NOT NULL AND gap_days > 0
        GROUP BY category
        ORDER BY avg(gap_days)
      `),
    ]);

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
      .where(
        gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
      )
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
