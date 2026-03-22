/**
 * app/dashboard/analytics/business-analytics-actions.ts — Business operations analytics.
 *
 * Staff performance, promotion ROI, membership value, gift card breakage,
 * and waitlist conversion tracking.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, sql, and, gte, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  bookings,
  payments,
  services,
  profiles,
  promotions,
  membershipSubscriptions,
  membershipPlans,
  giftCards,
  waitlist,
  serviceRecords,
} from "@/db/schema";
import { getUser, rangeToInterval } from "./_shared";
import type {
  Range,
  StaffPerformanceItem,
  PromotionRoiItem,
  MembershipValueStats,
  GiftCardBreakageStats,
  WaitlistConversionStats,
} from "@/lib/types/analytics.types";

export type {
  StaffPerformanceItem,
  PromotionRoiItem,
  MembershipValueStats,
  GiftCardBreakageStats,
  WaitlistConversionStats,
} from "@/lib/types/analytics.types";


export async function getStaffPerformance(range: Range = "30d"): Promise<StaffPerformanceItem[]> {
  try {
    await getUser();

    const staffProfile = alias(profiles, "staff");
    const interval = sql.raw(`'${rangeToInterval(range)}'`);

    const [bookingRows, srRows] = await Promise.all([
      db
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
        .where(gte(bookings.startsAt, sql`now() - interval ${interval}`))
        .groupBy(bookings.staffId, staffProfile.firstName, staffProfile.lastName, staffProfile.role)
        .orderBy(sql`sum(${bookings.totalInCents}) desc`),
      db
        .select({
          staffId: bookings.staffId,
          srCount: sql<number>`count(${serviceRecords.id})`,
        })
        .from(bookings)
        .innerJoin(serviceRecords, eq(bookings.id, serviceRecords.bookingId))
        .where(
          and(
            gte(bookings.startsAt, sql`now() - interval ${interval}`),
            eq(bookings.status, "completed"),
          ),
        )
        .groupBy(bookings.staffId),
    ]);

    const srByStaff = new Map(srRows.map((r) => [r.staffId, Number(r.srCount)]));

    return bookingRows
      .filter((r) => r.staffId)
      .map((r) => {
        const name = [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown";
        const bk = Number(r.bookingCount);
        const rev = Math.round(Number(r.revenue) / 100);
        const totalSlots = Number(r.totalSlots);
        const completed = Number(r.completedCount);
        const srCount = srByStaff.get(r.staffId!) ?? 0;
        return {
          name,
          role: r.role === "admin" ? "Owner" : "Staff",
          avatar: (r.firstName ?? "?")[0].toUpperCase(),
          bookings: bk,
          revenue: rev,
          avgTicket: bk > 0 ? Math.round(rev / bk) : 0,
          utilization: totalSlots > 0 ? Math.round((completed / totalSlots) * 100) : 0,
          serviceRecordCompletion: completed > 0 ? Math.round((srCount / completed) * 100) : 0,
        };
      });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getPromotionRoi(range: Range = "30d"): Promise<PromotionRoiItem[]> {
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
      .where(
        and(
          sql`${promotions.redemptionCount} > 0`,
          gte(bookings.startsAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
        ),
      )
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

export async function getMembershipValue(range: Range = "30d"): Promise<MembershipValueStats> {
  try {
    await getUser();

    const [subs, spendRows] = await Promise.all([
      db
        .select({
          id: membershipSubscriptions.id,
          clientId: membershipSubscriptions.clientId,
          planName: membershipPlans.name,
          status: membershipSubscriptions.status,
          createdAt: membershipSubscriptions.createdAt,
          cancelledAt: membershipSubscriptions.cancelledAt,
        })
        .from(membershipSubscriptions)
        .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id)),
      db
        .select({
          clientId: payments.clientId,
          total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.status, "paid"),
            gte(payments.paidAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
          ),
        )
        .groupBy(payments.clientId),
    ]);

    const memberClientIds = new Set(subs.map((s) => s.clientId));

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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCancels = cancelledSubs.filter(
      (s) => new Date(s.cancelledAt!) >= thirtyDaysAgo,
    ).length;

    const activeCount = subs.filter((s) => s.status === "active").length;
    const cancelledCount = cancelledSubs.length;
    const periodStart = activeCount + recentCancels;
    const monthlyChurnRate = periodStart > 0 ? Math.round((recentCancels / periodStart) * 100) : 0;

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

export async function getGiftCardBreakage(range: Range = "30d"): Promise<GiftCardBreakageStats> {
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
      .from(giftCards)
      .where(
        gte(giftCards.purchasedAt, sql`now() - interval ${sql.raw(`'${rangeToInterval(range)}'`)}`),
      );

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

export async function getWaitlistConversion(range: Range): Promise<WaitlistConversionStats> {
  await getUser();
  try {
    const interval = rangeToInterval(range);

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

    const conversionRate = totalNotified > 0 ? Math.round((totalBooked / totalNotified) * 100) : 0;
    const expiryRate = totalNotified > 0 ? Math.round((totalExpired / totalNotified) * 100) : 0;

    const [[waitTimeRow], [claimTimeRow], byServiceRows, weeklyRows] = await Promise.all([
      db
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
        ),
      db
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
        ),
      db
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
        .groupBy(services.name, waitlist.status),
      db
        .select({
          week: sql<string>`to_char(date_trunc('week', ${waitlist.createdAt}), 'Mon DD')`,
          status: waitlist.status,
          count: sql<number>`count(*)::int`,
        })
        .from(waitlist)
        .where(gte(waitlist.createdAt, sql`now() - ${interval}::interval`))
        .groupBy(sql`date_trunc('week', ${waitlist.createdAt})`, waitlist.status)
        .orderBy(sql`date_trunc('week', ${waitlist.createdAt})`),
    ]);

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
          s.booked + s.expired > 0 ? Math.round((s.booked / (s.booked + s.expired)) * 100) : 0,
        avgWaitDays: s.avgWaitDays,
      }))
      .sort((a, b) => b.entries - a.entries);

    const weekAgg: Record<string, { joined: number; booked: number; expired: number }> = {};
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
