"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, sql, and, gte } from "drizzle-orm";
import { db } from "@/db";
import { referrals, profiles } from "@/db/schema";
import { getUser } from "./_shared";

export type ReferralStats = {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalRewardsPaid: number;
  topReferrers: {
    name: string;
    referralCount: number;
    totalReward: number;
  }[];
  recentReferrals: {
    referrerName: string;
    referredName: string;
    status: string;
    rewardAmountInCents: number;
    createdAt: string;
  }[];
};

export async function getReferralStats(): Promise<ReferralStats> {
  try {
    await getUser();

    const [totals] = await db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${referrals.status} = 'completed')`,
        pending: sql<number>`count(*) filter (where ${referrals.status} = 'pending')`,
        rewardsPaid: sql<number>`coalesce(sum(${referrals.rewardAmountInCents}) filter (where ${referrals.status} = 'completed'), 0)`,
      })
      .from(referrals);

    const referrerProfile = profiles;
    const topReferrersRows = await db
      .select({
        firstName: referrerProfile.firstName,
        lastName: referrerProfile.lastName,
        referralCount: sql<number>`count(*)`,
        totalReward: sql<number>`coalesce(sum(${referrals.rewardAmountInCents}), 0)`,
      })
      .from(referrals)
      .innerJoin(referrerProfile, eq(referrals.referrerId, referrerProfile.id))
      .where(eq(referrals.status, "completed"))
      .groupBy(referrerProfile.id, referrerProfile.firstName, referrerProfile.lastName)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    const referrerAlias = profiles;
    const recentRows = await db.execute<{
      referrer_first: string | null;
      referrer_last: string | null;
      referred_first: string | null;
      referred_last: string | null;
      status: string;
      reward_amount_in_cents: number;
      created_at: string;
    }>(sql`
      SELECT
        rr.first_name AS referrer_first,
        rr.last_name AS referrer_last,
        rd.first_name AS referred_first,
        rd.last_name AS referred_last,
        r.status,
        r.reward_amount_in_cents,
        r.created_at
      FROM referrals r
      JOIN profiles rr ON rr.id = r.referrer_id
      JOIN profiles rd ON rd.id = r.referred_id
      ORDER BY r.created_at DESC
      LIMIT 20
    `);

    return {
      totalReferrals: Number(totals.total),
      completedReferrals: Number(totals.completed),
      pendingReferrals: Number(totals.pending),
      totalRewardsPaid: Number(totals.rewardsPaid),
      topReferrers: topReferrersRows.map((r) => ({
        name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown",
        referralCount: Number(r.referralCount),
        totalReward: Number(r.totalReward),
      })),
      recentReferrals: recentRows.map((r) => ({
        referrerName: [r.referrer_first, r.referrer_last].filter(Boolean).join(" ") || "Unknown",
        referredName: [r.referred_first, r.referred_last].filter(Boolean).join(" ") || "Unknown",
        status: r.status,
        rewardAmountInCents: r.reward_amount_in_cents,
        createdAt: r.created_at,
      })),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
