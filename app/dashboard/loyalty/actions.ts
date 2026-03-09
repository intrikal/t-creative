"use server";

import { revalidatePath } from "next/cache";
import { eq, sum, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { profiles, loyaltyTransactions } from "@/db/schema";
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

export type LoyaltyPageData = {
  firstName: string;
  totalPoints: number;
  referralCode: string;
  referralCount: number;
  transactions: LoyaltyTransaction[];
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Redeem points                                                      */
/* ------------------------------------------------------------------ */

export async function redeemPoints(reward: { label: string; points: number }): Promise<void> {
  const user = await getUser();

  if (reward.points <= 0) throw new Error("Invalid reward");

  // Re-query balance server-side to prevent races
  const [pointsRow] = await db
    .select({ total: sum(loyaltyTransactions.points) })
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.profileId, user.id));

  const currentPoints = Number(pointsRow?.total ?? 0);

  if (currentPoints < reward.points) {
    throw new Error("Not enough points to redeem this reward");
  }

  await db.insert(loyaltyTransactions).values({
    profileId: user.id,
    points: -reward.points,
    type: "redeemed",
    description: `Redeemed: ${reward.label}`,
  });

  revalidatePath("/dashboard/loyalty");
}

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getClientLoyaltyData(): Promise<LoyaltyPageData> {
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

  return {
    firstName: profileRow?.firstName ?? "",
    totalPoints,
    referralCode: profileRow?.referralCode ?? "",
    referralCount,
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
}
