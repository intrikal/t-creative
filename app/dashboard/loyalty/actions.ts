/**
 * app/dashboard/loyalty/actions.ts — Server actions for the client Loyalty & Membership page.
 *
 * Provides:
 *   - getClientLoyaltyData() — aggregates the client's points balance, transaction
 *     history, membership plan details, available rewards catalog, and any pending
 *     reward redemptions into one payload.
 *   - redeemPoints()         — exchanges loyalty points for a reward.
 *   - cancelRedemption()     — cancels a pending (not yet applied) redemption and
 *     refunds the points.
 *
 * Tables touched: profiles, loyaltyTransactions, loyaltyRewards, loyaltyRedemptions,
 * membershipSubscriptions, membershipPlans.
 *
 * @module dashboard/loyalty/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { and, asc, eq, or, sum, desc, count, sql } from "drizzle-orm";
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
import { getUser } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";

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

/**
 * Exchanges loyalty points for a reward from the catalog.
 *
 * Step 1 — Validate the reward exists and is active:
 *   SELECT * FROM loyalty_rewards
 *   WHERE id = <rewardId> AND active = true
 *   LIMIT 1
 *
 * Step 2 — Re-check the client's current points balance server-side
 *   (prevents a race where the client redeems twice before the first deduction settles):
 *   SELECT sum(points) FROM loyalty_transactions WHERE profileId = <user>
 *
 * Step 3 — Deduct points:
 *   INSERT INTO loyalty_transactions (profileId, points, type, description)
 *   VALUES (<user>, -<pointsCost>, 'redeemed', 'Redeemed: <label>')
 *
 * Step 4 — Record the redemption as "pending" (applied to a future booking):
 *   INSERT INTO loyalty_redemptions (profileId, rewardId, transactionId, status)
 *   VALUES (<user>, <rewardId>, <txId>, 'pending')
 */
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

    // Transaction: check balance + deduct points + create redemption.
    // Advisory lock on the profile prevents two concurrent redemptions from
    // reading the same balance and both succeeding (double-spend).
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`);

      const [pointsRow] = await tx
        .select({ total: sum(loyaltyTransactions.points) })
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.profileId, user.id));

      const currentPoints = Number(pointsRow?.total ?? 0);

      if (currentPoints < reward.pointsCost) {
        throw new Error("Not enough points to redeem this reward");
      }

      // Insert the loyalty transaction (negative points)
      const [txRow] = await tx
        .insert(loyaltyTransactions)
        .values({
          profileId: user.id,
          points: -reward.pointsCost,
          type: "redeemed",
          description: `Redeemed: ${reward.label}`,
        })
        .returning({ id: loyaltyTransactions.id });

      // Create the redemption record (pending until applied to a booking)
      await tx.insert(loyaltyRedemptions).values({
        profileId: user.id,
        rewardId: reward.id,
        transactionId: txRow.id,
        status: "pending",
      });
    });

    trackEvent(user.id, "loyalty_reward_redeemed", {
      rewardId: input.rewardId,
      pointsCost: reward.pointsCost,
    });

    revalidatePath("/dashboard/loyalty");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Cancel a pending redemption and refund the points.
 *
 * Step 1 — Ownership + status check:
 *   SELECT id, profileId, rewardId, status
 *   FROM   loyalty_redemptions
 *   WHERE  id = <redemptionId>
 *     AND  profileId = <current user>   ← must belong to this client
 *     AND  status = 'pending'           ← only pending redemptions can be cancelled
 *   LIMIT 1
 *
 * Step 2 — Look up the reward's point cost:
 *   SELECT pointsCost, label FROM loyalty_rewards WHERE id = <rewardId>
 *
 * Step 3 — Credit the points back:
 *   INSERT INTO loyalty_transactions (profileId, points, type, description)
 *   VALUES (<user>, +<pointsCost>, 'manual_credit', 'Cancelled: <label> (points refunded)')
 *
 * Step 4 — Mark redemption as cancelled:
 *   UPDATE loyalty_redemptions SET status = 'cancelled' WHERE id = <redemptionId>
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

    // Transaction: refund points + mark redemption cancelled atomically.
    await db.transaction(async (tx) => {
      await tx.insert(loyaltyTransactions).values({
        profileId: user.id,
        points: reward.pointsCost,
        type: "manual_credit",
        description: `Cancelled: ${reward.label} (points refunded)`,
      });

      await tx
        .update(loyaltyRedemptions)
        .set({ status: "cancelled" })
        .where(eq(loyaltyRedemptions.id, redemptionId));
    });

    revalidatePath("/dashboard/loyalty");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

/**
 * Aggregates all loyalty-related data for the current client into one payload.
 * Runs 7 queries in parallel (Promise.all) for speed:
 *
 * 1. Profile — SELECT firstName, referralCode FROM profiles WHERE id = <user>
 *    → client's display name and unique referral code.
 *
 * 2. Total points — SELECT sum(points) FROM loyalty_transactions WHERE profileId = <user>
 *    → net points balance (positive entries = earned, negative = redeemed).
 *
 * 3. Recent transactions (last 20) —
 *    SELECT id, points, type, description, createdAt
 *    FROM   loyalty_transactions
 *    WHERE  profileId = <user>
 *    ORDER BY createdAt DESC  LIMIT 20
 *    → transaction history feed (earned, redeemed, manual credits, etc.).
 *
 * 4. Referral count — SELECT count(*) FROM profiles WHERE referredBy = <user>
 *    → how many other clients this user has referred.
 *
 * 5. Active membership —
 *    SELECT plan.name, plan.priceInCents, plan.fillsPerCycle, sub.fillsRemainingThisCycle, ...
 *    FROM   membership_subscriptions sub
 *    INNER JOIN membership_plans plan ON sub.planId = plan.id
 *      → pulls the plan's pricing and perks alongside the subscription's usage state
 *    WHERE  sub.clientId = <user>
 *      AND  sub.status IN ('active', 'paused')
 *    ORDER BY sub.createdAt DESC  LIMIT 1
 *    → the client's current (or paused) membership, if any.
 *
 * 6. Active rewards catalog —
 *    SELECT id, label, pointsCost, discountInCents, category, description
 *    FROM   loyalty_rewards
 *    WHERE  active = true
 *    ORDER BY sortOrder, pointsCost
 *    → every reward the client can currently redeem.
 *
 * 7. Pending redemptions —
 *    SELECT redemptions.id, rewards.label, rewards.category, rewards.pointsCost, ...
 *    FROM   loyalty_redemptions
 *    INNER JOIN loyalty_rewards ON redemptions.rewardId = rewards.id
 *      → pulls reward details (label, category, cost) for each pending redemption
 *    WHERE  redemptions.profileId = <user>
 *      AND  redemptions.status = 'pending'
 *    ORDER BY redemptions.createdAt DESC
 *    → rewards the client has redeemed but that haven't been applied to a booking yet.
 */
export async function getClientLoyaltyData(): Promise<LoyaltyPageData> {
  try {
    const user = await getUser();

    const [
      [profileRow],
      [pointsRow],
      txRows,
      referralCountRow,
      [memRow],
      rewardRows,
      pendingRows,
      // Run all 7 independent queries in parallel via Promise.all to minimise
      // total latency. Each query hits a different table/index so there is no
      // contention. Sequential execution would be ~7x slower on a cold connection.
    ] = await Promise.all([
      // Profile
      db
        .select({ firstName: profiles.firstName, referralCode: profiles.referralCode })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1),
      // Total points
      db
        .select({ total: sum(loyaltyTransactions.points) })
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.profileId, user.id)),
      // Recent transactions (last 20)
      db
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
        .limit(20),
      // Referral count (always query — cheap COUNT)
      db.select({ n: count() }).from(profiles).where(eq(profiles.referredBy, user.id)),
      // Active membership
      db
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
        .limit(1),
      // Active rewards catalog
      db
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
        .orderBy(asc(loyaltyRewards.sortOrder), asc(loyaltyRewards.pointsCost)),
      // Pending redemptions
      db
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
        .orderBy(desc(loyaltyRedemptions.createdAt)),
    ]);

    const totalPoints = Number(pointsRow?.total ?? 0);
    const referralCount = Number(referralCountRow[0]?.n ?? 0);

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

    return {
      firstName: profileRow?.firstName ?? "",
      totalPoints,
      referralCode: profileRow?.referralCode ?? "",
      referralCount,
      membership,
      rewards: rewardRows,
      // Transform each pending redemption row into the PendingRedemption shape,
      // converting the Date to a formatted string for JSON serialisation across
      // the RSC boundary. Keeps only the fields the loyalty page card needs.
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
      // Transform each transaction row into the LoyaltyTransaction shape,
      // defaulting null descriptions to "" and converting Date to a formatted
      // string. The UI renders this as the "Points History" feed.
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
