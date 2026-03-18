"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { addDays } from "date-fns";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  membershipPlans,
  membershipSubscriptions,
  membershipStatusEnum,
  profiles,
} from "@/db/schema";
import { getUser, requireAdmin } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type MembershipStatus = (typeof membershipStatusEnum.enumValues)[number];

export type MembershipPlan = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  priceInCents: number;
  fillsPerCycle: number;
  productDiscountPercent: number;
  cycleIntervalDays: number;
  isActive: boolean;
  displayOrder: number;
  perks: string[];
};

export type MembershipRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  planId: number;
  planName: string;
  planSlug: string;
  priceInCents: number;
  fillsPerCycle: number;
  productDiscountPercent: number;
  fillsRemainingThisCycle: number;
  status: MembershipStatus;
  cycleStartAt: Date;
  cycleEndsAt: Date;
  cancelledAt: Date | null;
  pausedAt: Date | null;
  notes: string | null;
  createdAt: Date;
};

export type ClientMembership = {
  id: string;
  planName: string;
  planSlug: string;
  priceInCents: number;
  fillsPerCycle: number;
  fillsRemainingThisCycle: number;
  productDiscountPercent: number;
  cycleEndsAt: Date;
  status: MembershipStatus;
  perks: string[];
};

export type CreateMembershipInput = {
  clientId: string;
  planId: number;
  notes?: string;
};

export type CreatePlanInput = {
  name: string;
  slug: string;
  description?: string;
  priceInCents: number;
  fillsPerCycle: number;
  productDiscountPercent: number;
  cycleIntervalDays?: number;
  displayOrder?: number;
  perks?: string[];
};

export type UpdatePlanInput = Partial<Omit<CreatePlanInput, "slug"> & { isActive: boolean }>;

/* ------------------------------------------------------------------ */
/*  Plan queries                                                       */
/* ------------------------------------------------------------------ */

export async function getMembershipPlans(includeInactive = false): Promise<MembershipPlan[]> {
  try {
    await requireAdmin();

    const rows = await db
      .select()
      .from(membershipPlans)
      .where(includeInactive ? undefined : eq(membershipPlans.isActive, true))
      .orderBy(membershipPlans.displayOrder, membershipPlans.id);

    return rows.map((r) => ({
      ...r,
      description: r.description,
      perks: (r.perks as string[]) ?? [],
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Subscription queries                                               */
/* ------------------------------------------------------------------ */

export async function getMemberships(statusFilter?: MembershipStatus): Promise<MembershipRow[]> {
  try {
    await requireAdmin();

    const rows = await db
      .select({
        id: membershipSubscriptions.id,
        clientId: membershipSubscriptions.clientId,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        clientEmail: profiles.email,
        planId: membershipPlans.id,
        planName: membershipPlans.name,
        planSlug: membershipPlans.slug,
        priceInCents: membershipPlans.priceInCents,
        fillsPerCycle: membershipPlans.fillsPerCycle,
        productDiscountPercent: membershipPlans.productDiscountPercent,
        fillsRemainingThisCycle: membershipSubscriptions.fillsRemainingThisCycle,
        status: membershipSubscriptions.status,
        cycleStartAt: membershipSubscriptions.cycleStartAt,
        cycleEndsAt: membershipSubscriptions.cycleEndsAt,
        cancelledAt: membershipSubscriptions.cancelledAt,
        pausedAt: membershipSubscriptions.pausedAt,
        notes: membershipSubscriptions.notes,
        createdAt: membershipSubscriptions.createdAt,
      })
      .from(membershipSubscriptions)
      .innerJoin(profiles, eq(membershipSubscriptions.clientId, profiles.id))
      .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
      .where(statusFilter ? eq(membershipSubscriptions.status, statusFilter) : undefined)
      .orderBy(desc(membershipSubscriptions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" "),
      clientEmail: r.clientEmail,
      planId: r.planId,
      planName: r.planName,
      planSlug: r.planSlug,
      priceInCents: r.priceInCents,
      fillsPerCycle: r.fillsPerCycle,
      productDiscountPercent: r.productDiscountPercent,
      fillsRemainingThisCycle: r.fillsRemainingThisCycle,
      status: r.status as MembershipStatus,
      cycleStartAt: r.cycleStartAt,
      cycleEndsAt: r.cycleEndsAt,
      cancelledAt: r.cancelledAt,
      pausedAt: r.pausedAt,
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Returns the active (or paused) membership for a given client, or null if none.
 * Used by both the admin client detail view and the client's own loyalty page.
 */
export async function getClientMembership(clientId: string): Promise<ClientMembership | null> {
  try {
    await requireAdmin();

    const [row] = await db
      .select({
        id: membershipSubscriptions.id,
        planName: membershipPlans.name,
        planSlug: membershipPlans.slug,
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
          eq(membershipSubscriptions.clientId, clientId),
          or(
            eq(membershipSubscriptions.status, "active"),
            eq(membershipSubscriptions.status, "paused"),
          ),
        ),
      )
      .orderBy(desc(membershipSubscriptions.createdAt))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      planName: row.planName,
      planSlug: row.planSlug,
      priceInCents: row.priceInCents,
      fillsPerCycle: row.fillsPerCycle,
      fillsRemainingThisCycle: row.fillsRemainingThisCycle,
      productDiscountPercent: row.productDiscountPercent,
      cycleEndsAt: row.cycleEndsAt,
      status: row.status as MembershipStatus,
      perks: (row.perks as string[]) ?? [],
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Subscription mutations                                             */
/* ------------------------------------------------------------------ */

const createMembershipSchema = z.object({
  clientId: z.string().min(1),
  planId: z.number().int().positive(),
  notes: z.string().optional(),
});

const membershipStatusSchema = z.enum(["active", "paused", "cancelled", "expired"]);

const createPlanSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  priceInCents: z.number().int().nonnegative(),
  fillsPerCycle: z.number().int().nonnegative(),
  productDiscountPercent: z.number().int().nonnegative(),
  cycleIntervalDays: z.number().int().positive().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  perks: z.array(z.string()).optional(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceInCents: z.number().int().nonnegative().optional(),
  fillsPerCycle: z.number().int().nonnegative().optional(),
  productDiscountPercent: z.number().int().nonnegative().optional(),
  cycleIntervalDays: z.number().int().positive().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  perks: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/** Admin creates a new membership for a client, starting their cycle today. */
export async function createMembership(input: CreateMembershipInput): Promise<{ id: string }> {
  try {
    createMembershipSchema.parse(input);
    await requireAdmin();

    const [plan] = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.id, input.planId))
      .limit(1);

    if (!plan) throw new Error("Plan not found");

    const now = new Date();
    const cycleEndsAt = addDays(now, plan.cycleIntervalDays);

    const [sub] = await db
      .insert(membershipSubscriptions)
      .values({
        clientId: input.clientId,
        planId: input.planId,
        status: "active",
        fillsRemainingThisCycle: plan.fillsPerCycle,
        cycleStartAt: now,
        cycleEndsAt,
        notes: input.notes ?? null,
      })
      .returning({ id: membershipSubscriptions.id });

    revalidatePath("/dashboard/memberships");
    return { id: sub.id };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Update subscription status — pause, cancel, or reactivate. */
export async function updateMembershipStatus(id: string, status: MembershipStatus): Promise<void> {
  try {
    z.string().min(1).parse(id);
    membershipStatusSchema.parse(status);
    await requireAdmin();

    const updates: Partial<typeof membershipSubscriptions.$inferInsert> = { status };

    if (status === "cancelled") {
      updates.cancelledAt = new Date();
    } else if (status === "paused") {
      updates.pausedAt = new Date();
    } else if (status === "active") {
      updates.pausedAt = null;
    }

    await db.update(membershipSubscriptions).set(updates).where(eq(membershipSubscriptions.id, id));

    revalidatePath("/dashboard/memberships");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Decrement fills remaining. Called when a qualifying lash fill booking completes. */
export async function useMembershipFill(id: string): Promise<void> {
  try {
    z.string().min(1).parse(id);
    await requireAdmin();

    const [sub] = await db
      .select({ fillsRemainingThisCycle: membershipSubscriptions.fillsRemainingThisCycle })
      .from(membershipSubscriptions)
      .where(eq(membershipSubscriptions.id, id))
      .limit(1);

    if (!sub) throw new Error("Membership not found");
    if (sub.fillsRemainingThisCycle <= 0) throw new Error("No fills remaining this cycle");

    await db
      .update(membershipSubscriptions)
      .set({ fillsRemainingThisCycle: sub.fillsRemainingThisCycle - 1 })
      .where(eq(membershipSubscriptions.id, id));

    revalidatePath("/dashboard/memberships");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Renew a membership for the next billing cycle.
 * Resets fills to plan.fillsPerCycle and advances cycle dates by cycleIntervalDays.
 * Call this after collecting the monthly payment.
 */
export async function renewMembership(id: string): Promise<void> {
  try {
    z.string().min(1).parse(id);
    await requireAdmin();

    const [row] = await db
      .select({
        cycleEndsAt: membershipSubscriptions.cycleEndsAt,
        fillsPerCycle: membershipPlans.fillsPerCycle,
        cycleIntervalDays: membershipPlans.cycleIntervalDays,
      })
      .from(membershipSubscriptions)
      .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
      .where(eq(membershipSubscriptions.id, id))
      .limit(1);

    if (!row) throw new Error("Membership not found");

    const newCycleStart = row.cycleEndsAt;
    const newCycleEnd = addDays(newCycleStart, row.cycleIntervalDays);

    await db
      .update(membershipSubscriptions)
      .set({
        status: "active",
        fillsRemainingThisCycle: row.fillsPerCycle,
        cycleStartAt: newCycleStart,
        cycleEndsAt: newCycleEnd,
        pausedAt: null,
      })
      .where(eq(membershipSubscriptions.id, id));

    revalidatePath("/dashboard/memberships");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateMembershipNotes(id: string, notes: string): Promise<void> {
  try {
    z.string().min(1).parse(id);
    z.string().parse(notes);
    await requireAdmin();

    await db
      .update(membershipSubscriptions)
      .set({ notes: notes || null })
      .where(eq(membershipSubscriptions.id, id));

    revalidatePath("/dashboard/memberships");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Plan mutations (admin)                                             */
/* ------------------------------------------------------------------ */

export async function createMembershipPlan(input: CreatePlanInput): Promise<{ id: number }> {
  try {
    createPlanSchema.parse(input);
    await requireAdmin();

    const [plan] = await db
      .insert(membershipPlans)
      .values({
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        priceInCents: input.priceInCents,
        fillsPerCycle: input.fillsPerCycle,
        productDiscountPercent: input.productDiscountPercent,
        cycleIntervalDays: input.cycleIntervalDays ?? 30,
        displayOrder: input.displayOrder ?? 0,
        perks: input.perks ?? [],
      })
      .returning({ id: membershipPlans.id });

    revalidatePath("/dashboard/memberships");
    return { id: plan.id };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateMembershipPlan(id: number, input: UpdatePlanInput): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    updatePlanSchema.parse(input);
    await requireAdmin();

    await db
      .update(membershipPlans)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.priceInCents !== undefined && { priceInCents: input.priceInCents }),
        ...(input.fillsPerCycle !== undefined && { fillsPerCycle: input.fillsPerCycle }),
        ...(input.productDiscountPercent !== undefined && {
          productDiscountPercent: input.productDiscountPercent,
        }),
        ...(input.cycleIntervalDays !== undefined && {
          cycleIntervalDays: input.cycleIntervalDays,
        }),
        ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
        ...(input.perks !== undefined && { perks: input.perks }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      })
      .where(eq(membershipPlans.id, id));

    revalidatePath("/dashboard/memberships");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
