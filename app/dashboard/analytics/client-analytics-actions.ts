/**
 * app/dashboard/analytics/client-analytics-actions.ts — Client-focused analytics.
 *
 * Retention trends, at-risk clients, client sources, lifetime values,
 * visit frequency, rebook rates, and cancellation reasons.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, sql, and, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, services, profiles } from "@/db/schema";
import { getUser, rangeToInterval, weekLabel } from "./_shared";
import type { Range } from "./_shared";

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

export type VisitFrequencyBucket = {
  label: string;
  clients: number;
  pct: number;
};

export type RebookRate = {
  service: string;
  rate: number;
};

export type CancellationReasonItem = {
  reason: string;
  count: number;
  pct: number;
};

export async function getRetentionTrend(range: Range = "30d"): Promise<RetentionWeek[]> {
  try {
    await getUser();

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
      .where(
        gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
      )
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

const VISIT_BUCKETS = [
  { label: "1 visit", min: 1, max: 1 },
  { label: "2–3 visits", min: 2, max: 3 },
  { label: "4–6 visits", min: 4, max: 6 },
  { label: "7–12 visits", min: 7, max: 12 },
  { label: "13+ visits", min: 13, max: Infinity },
] as const;

export async function getVisitFrequency(range: Range = "30d"): Promise<VisitFrequencyBucket[]> {
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
          gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
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

export async function getRebookRates(): Promise<RebookRate[]> {
  try {
    await getUser();

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
