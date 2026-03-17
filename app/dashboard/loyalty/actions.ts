"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { and, asc, eq, or, sum, desc, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  membershipPlans,
  membershipSubscriptions,
  profiles,
  loyaltyTransactions,
  loyaltyRewards,
  loyaltyRedemptions,
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

export type LoyaltyTransaction = {
  id: string;
  points: number;
  type: string;
  description: string;
  createdAt: string;
};

export type ClientMembershipData = {
  planName: string;
  priceInCents: number;
  fillsPerCycle: number;
  fillsRemainingThisCycle: number;
  productDiscountPercent: number;
  cycleEndsAt: string;
  status: "active" | "paused";
  perks: string[];
};

export type ClientReward = {
  id: number;
  label: string;
  pointsCost: number;
  discountInCents: number | null;
  category: string;
  description: string | null;
};

export type PendingRedemption = {
  id: string;
  rewardLabel: string;
  rewardCategory: string;
  pointsCost: number;
  discountInCents: number | null;
  createdAt: string;
};

export type LoyaltyPageData = {
  firstName: string;
  totalPoints: number;
  referralCode: string;
  referralCount: number;
  transactions: LoyaltyTransaction[];
  membership: ClientMembershipData | null;
  rewards: ClientReward[];
  pendingRedemptions: PendingRedemption[];
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Redeem points                                                      */
/* ------------------------------------------------------------------ */

const RedeemPointsSchema = z.object({
  rewardId: z.number().int().positive(),
});

export async function redeemPoints(input: { rewardId: number }): Promise<void> {
  try {
    RedeemPointsSchema.parse(input);

    const user = await getUser();

    // Fetch the reward to validate it exists and is active
    const [reward] = await db
      .select()
      .from(loyaltyRewards)
      .where(and(eq(loyaltyRewards.id, input.rewardId), eq(loyaltyRewards.active, true)))
      .limit(1);

    if (!reward) throw new Error("Reward not found or no longer available");

    // Re-query balance server-side to prevent races
    const [pointsRow] = await db
      .select({ total: sum(loyaltyTransactions.points) })
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.profileId, user.id));

    const currentPoints = Number(pointsRow?.total ?? 0);

    if (currentPoints < reward.pointsCost) {
      throw new Error("Not enough points to redeem this reward");
    }

    // Insert the loyalty transaction (negative points)
    const [tx] = await db
      .insert(loyaltyTransactions)
      .values({
        profileId: user.id,
        points: -reward.pointsCost,
        type: "redeemed",
        description: `Redeemed: ${reward.label}`,
      })
      .returning({ id: loyaltyTransactions.id });

    // Create the redemption record (pending until applied to a booking)
    await db.insert(loyaltyRedemptions).values({
      profileId: user.id,
      rewardId: reward.id,
      transactionId: tx.id,
      status: "pending",
    });

    revalidatePath("/dashboard/loyalty");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Cancel a pending redemption and refund the points.
 */
export async function cancelRedemption(redemptionId: string): Promise<void> {
  try {
    z.string().uuid().parse(redemptionId);
    const user = await getUser();

    // Fetch redemption and verify ownership
    const [redemption] = await db
      .select({
        id: loyaltyRedemptions.id,
        profileId: loyaltyRedemptions.profileId,
        rewardId: loyaltyRedemptions.rewardId,
        status: loyaltyRedemptions.status,
      })
      .from(loyaltyRedemptions)
      .where(
        and(
          eq(loyaltyRedemptions.id, redemptionId),
          eq(loyaltyRedemptions.profileId, user.id),
          eq(loyaltyRedemptions.status, "pending"),
        ),
      )
      .limit(1);

    if (!redemption) throw new Error("Redemption not found or already applied");

    // Get the reward to know how many points to refund
    const [reward] = await db
      .select({ pointsCost: loyaltyRewards.pointsCost, label: loyaltyRewards.label })
      .from(loyaltyRewards)
      .where(eq(loyaltyRewards.id, redemption.rewardId))
      .limit(1);

    if (!reward) throw new Error("Reward not found");

    // Refund points
    await db.insert(loyaltyTransactions).values({
      profileId: user.id,
      points: reward.pointsCost,
      type: "manual_credit",
      description: `Cancelled: ${reward.label} (points refunded)`,
    });

    // Update redemption status
    await db
      .update(loyaltyRedemptions)
      .set({ status: "cancelled" })
      .where(eq(loyaltyRedemptions.id, redemptionId));

    revalidatePath("/dashboard/loyalty");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getClientLoyaltyData(): Promise<LoyaltyPageData> {
  try {
    const user = await getUser();

    // Profile
    const [profileRow] = await db
      .select({
        firstName: profiles.firstName,
        referralCode: profiles.referralCode,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    // Total points
    const [pointsRow] = await db
      .select({ total: sum(loyaltyTransactions.points) })
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.profileId, user.id));

    const totalPoints = Number(pointsRow?.total ?? 0);

    // Recent transactions (last 20)
    const txRows = await db
      .select({
        id: loyaltyTransactions.id,
        points: loyaltyTransactions.points,
        type: loyaltyTransactions.type,
        description: loyaltyTransactions.description,
        createdAt: loyaltyTransactions.createdAt,
      })
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.profileId, user.id))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(20);

    // Referral count
    const referralCount = profileRow?.referralCode
      ? await db
          .select({ n: count() })
          .from(profiles)
          .where(eq(profiles.referredBy, user.id))
          .then((r) => Number(r[0]?.n ?? 0))
      : 0;

    // Active membership (if any)
    const [memRow] = await db
      .select({
        planName: membershipPlans.name,
        priceInCents: membershipPlans.priceInCents,
        fillsPerCycle: membershipPlans.fillsPerCycle,
        fillsRemainingThisCycle: membershipSubscriptions.fillsRemainingThisCycle,
        productDiscountPercent: membershipPlans.productDiscountPercent,
        cycleEndsAt: membershipSubscriptions.cycleEndsAt,
        status: membershipSubscriptions.status,
        perks: membershipPlans.perks,
      })
      .from(membershipSubscriptions)
      .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
      .where(
        and(
          eq(membershipSubscriptions.clientId, user.id),
          or(
            eq(membershipSubscriptions.status, "active"),
            eq(membershipSubscriptions.status, "paused"),
          ),
        ),
      )
      .orderBy(desc(membershipSubscriptions.createdAt))
      .limit(1);

    const membership: ClientMembershipData | null = memRow
      ? {
          planName: memRow.planName,
          priceInCents: memRow.priceInCents,
          fillsPerCycle: memRow.fillsPerCycle,
          fillsRemainingThisCycle: memRow.fillsRemainingThisCycle,
          productDiscountPercent: memRow.productDiscountPercent,
          cycleEndsAt: new Date(memRow.cycleEndsAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          status: memRow.status as "active" | "paused",
          perks: (memRow.perks as string[]) ?? [],
        }
      : null;

    // Active rewards catalog
    const rewardRows = await db
      .select({
        id: loyaltyRewards.id,
        label: loyaltyRewards.label,
        pointsCost: loyaltyRewards.pointsCost,
        discountInCents: loyaltyRewards.discountInCents,
        category: loyaltyRewards.category,
        description: loyaltyRewards.description,
      })
      .from(loyaltyRewards)
      .where(eq(loyaltyRewards.active, true))
      .orderBy(asc(loyaltyRewards.sortOrder), asc(loyaltyRewards.pointsCost));

    // Pending redemptions for this client
    const pendingRows = await db
      .select({
        id: loyaltyRedemptions.id,
        rewardLabel: loyaltyRewards.label,
        rewardCategory: loyaltyRewards.category,
        pointsCost: loyaltyRewards.pointsCost,
        discountInCents: loyaltyRewards.discountInCents,
        createdAt: loyaltyRedemptions.createdAt,
      })
      .from(loyaltyRedemptions)
      .innerJoin(loyaltyRewards, eq(loyaltyRedemptions.rewardId, loyaltyRewards.id))
      .where(
        and(eq(loyaltyRedemptions.profileId, user.id), eq(loyaltyRedemptions.status, "pending")),
      )
      .orderBy(desc(loyaltyRedemptions.createdAt));

    return {
      firstName: profileRow?.firstName ?? "",
      totalPoints,
      referralCode: profileRow?.referralCode ?? "",
      referralCount,
      membership,
      rewards: rewardRows,
      pendingRedemptions: pendingRows.map((r) => ({
        id: r.id,
        rewardLabel: r.rewardLabel,
        rewardCategory: r.rewardCategory,
        pointsCost: r.pointsCost,
        discountInCents: r.discountInCents,
        createdAt: new Date(r.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      })),
      transactions: txRows.map((tx) => ({
        id: tx.id,
        points: tx.points,
        type: tx.type,
        description: tx.description ?? "",
        createdAt: new Date(tx.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      })),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
