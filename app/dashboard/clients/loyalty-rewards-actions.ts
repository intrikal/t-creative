"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { loyaltyRewards } from "@/db/schema";
import { getUser } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type LoyaltyRewardRow = {
  id: number;
  label: string;
  pointsCost: number;
  discountInCents: number | null;
  category: "discount" | "add_on" | "service" | "product";
  description: string | null;
  active: boolean;
  sortOrder: number;
};

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const CreateRewardSchema = z.object({
  label: z.string().min(1).max(200),
  pointsCost: z.number().int().positive(),
  discountInCents: z.number().int().nonnegative().nullable(),
  category: z.enum(["discount", "add_on", "service", "product"]),
  description: z.string().max(500).nullable(),
  sortOrder: z.number().int().nonnegative().default(0),
});

const UpdateRewardSchema = CreateRewardSchema.extend({
  id: z.number().int().positive(),
  active: z.boolean(),
});

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getLoyaltyRewards(): Promise<LoyaltyRewardRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: loyaltyRewards.id,
        label: loyaltyRewards.label,
        pointsCost: loyaltyRewards.pointsCost,
        discountInCents: loyaltyRewards.discountInCents,
        category: loyaltyRewards.category,
        description: loyaltyRewards.description,
        active: loyaltyRewards.active,
        sortOrder: loyaltyRewards.sortOrder,
      })
      .from(loyaltyRewards)
      .orderBy(asc(loyaltyRewards.sortOrder), asc(loyaltyRewards.pointsCost));

    return rows;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function createLoyaltyReward(data: z.infer<typeof CreateRewardSchema>): Promise<void> {
  try {
    CreateRewardSchema.parse(data);
    await getUser();

    await db.insert(loyaltyRewards).values({
      label: data.label,
      pointsCost: data.pointsCost,
      discountInCents: data.discountInCents,
      category: data.category,
      description: data.description,
      sortOrder: data.sortOrder,
    });

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/loyalty");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateLoyaltyReward(data: z.infer<typeof UpdateRewardSchema>): Promise<void> {
  try {
    UpdateRewardSchema.parse(data);
    await getUser();

    await db
      .update(loyaltyRewards)
      .set({
        label: data.label,
        pointsCost: data.pointsCost,
        discountInCents: data.discountInCents,
        category: data.category,
        description: data.description,
        active: data.active,
        sortOrder: data.sortOrder,
      })
      .where(eq(loyaltyRewards.id, data.id));

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/loyalty");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function deleteLoyaltyReward(id: number): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    await getUser();

    // Soft-delete by deactivating rather than hard delete to preserve redemption history
    await db.update(loyaltyRewards).set({ active: false }).where(eq(loyaltyRewards.id, id));

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/loyalty");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
