"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookingSubscriptions, profiles, services } from "@/db/schema";
import { getUser } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SubscriptionStatus = "active" | "paused" | "completed" | "cancelled";

export type SubscriptionRow = {
  id: number;
  clientId: string;
  clientName: string;
  clientEmail: string;
  serviceId: number;
  serviceName: string;
  name: string;
  totalSessions: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  intervalDays: number;
  pricePerSessionInCents: number;
  totalPaidInCents: number;
  status: SubscriptionStatus;
  notes: string | null;
  createdAt: Date;
};

export type CreateSubscriptionInput = {
  clientId: string;
  serviceId: number;
  name: string;
  totalSessions: number;
  intervalDays: number;
  pricePerSessionInCents: number;
  totalPaidInCents: number;
  notes?: string;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getSubscriptions(
  statusFilter?: SubscriptionStatus,
): Promise<SubscriptionRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: bookingSubscriptions.id,
        clientId: bookingSubscriptions.clientId,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        clientEmail: profiles.email,
        serviceId: bookingSubscriptions.serviceId,
        serviceName: services.name,
        name: bookingSubscriptions.name,
        totalSessions: bookingSubscriptions.totalSessions,
        sessionsUsed: bookingSubscriptions.sessionsUsed,
        intervalDays: bookingSubscriptions.intervalDays,
        pricePerSessionInCents: bookingSubscriptions.pricePerSessionInCents,
        totalPaidInCents: bookingSubscriptions.totalPaidInCents,
        status: bookingSubscriptions.status,
        notes: bookingSubscriptions.notes,
        createdAt: bookingSubscriptions.createdAt,
      })
      .from(bookingSubscriptions)
      .innerJoin(profiles, eq(bookingSubscriptions.clientId, profiles.id))
      .innerJoin(services, eq(bookingSubscriptions.serviceId, services.id))
      .where(statusFilter ? eq(bookingSubscriptions.status, statusFilter) : undefined)
      .orderBy(desc(bookingSubscriptions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" "),
      clientEmail: r.clientEmail,
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      name: r.name,
      totalSessions: r.totalSessions,
      sessionsUsed: r.sessionsUsed,
      sessionsRemaining: r.totalSessions - r.sessionsUsed,
      intervalDays: r.intervalDays,
      pricePerSessionInCents: r.pricePerSessionInCents,
      totalPaidInCents: r.totalPaidInCents,
      status: r.status as SubscriptionStatus,
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Active subscriptions for a specific client — used to populate the booking dialog. */
export async function getActiveSubscriptionsForClient(
  clientId: string,
): Promise<{ id: number; name: string; sessionsRemaining: number }[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: bookingSubscriptions.id,
        name: bookingSubscriptions.name,
        totalSessions: bookingSubscriptions.totalSessions,
        sessionsUsed: bookingSubscriptions.sessionsUsed,
      })
      .from(bookingSubscriptions)
      .where(eq(bookingSubscriptions.clientId, clientId))
      // Only surface active subscriptions with sessions remaining
      .then((r) => r.filter((s) => s.sessionsUsed < s.totalSessions));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sessionsRemaining: r.totalSessions - r.sessionsUsed,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

const createSubscriptionSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.number().int().positive(),
  name: z.string().min(1),
  totalSessions: z.number().int().positive(),
  intervalDays: z.number().int().positive(),
  pricePerSessionInCents: z.number().int().nonnegative(),
  totalPaidInCents: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

const subscriptionStatusSchema = z.enum(["active", "paused", "completed", "cancelled"]);

export async function createSubscription(input: CreateSubscriptionInput): Promise<{ id: number }> {
  try {
    createSubscriptionSchema.parse(input);
    await getUser();

    const [sub] = await db
      .insert(bookingSubscriptions)
      .values({
        clientId: input.clientId,
        serviceId: input.serviceId,
        name: input.name,
        totalSessions: input.totalSessions,
        sessionsUsed: 0,
        intervalDays: input.intervalDays,
        pricePerSessionInCents: input.pricePerSessionInCents,
        totalPaidInCents: input.totalPaidInCents,
        notes: input.notes ?? null,
      })
      .returning({ id: bookingSubscriptions.id });

    revalidatePath("/dashboard/subscriptions");
    return { id: sub.id };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateSubscriptionStatus(
  id: number,
  status: SubscriptionStatus,
): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    subscriptionStatusSchema.parse(status);
    await getUser();

    await db.update(bookingSubscriptions).set({ status }).where(eq(bookingSubscriptions.id, id));

    revalidatePath("/dashboard/subscriptions");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateSubscriptionNotes(id: number, notes: string): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    z.string().parse(notes);
    await getUser();

    await db
      .update(bookingSubscriptions)
      .set({ notes: notes || null })
      .where(eq(bookingSubscriptions.id, id));

    revalidatePath("/dashboard/subscriptions");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
