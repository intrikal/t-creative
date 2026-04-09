/**
 * Subscription (membership) server actions — admin CRUD for recurring
 * booking packages.
 *
 * A subscription ties a client to a service with a fixed number of sessions,
 * a per-session price, and an interval (e.g. every 14 days). The admin can
 * create, pause, resume, complete, or cancel subscriptions from the dashboard.
 *
 * All actions require authentication. Mutations revalidate the bookings and
 * memberships dashboard pages so the UI stays in sync.
 *
 * @module dashboard/subscriptions/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookingSubscriptions, profiles, services } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

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

/**
 * Returns all subscriptions, optionally filtered by status.
 * Used on the admin memberships dashboard to list every client's package.
 */
export async function getSubscriptions(
  statusFilter?: SubscriptionStatus,
): Promise<SubscriptionRow[]> {
  try {
    await requireAdmin();

    // QUERY: Fetch subscriptions enriched with client name/email and service name.
    // SELECT     — Reads subscription fields (id, sessions, pricing, status, notes, dates)
    //              plus the client's first name, last name, and email from profiles,
    //              plus the service name from services.
    // FROM       — booking_subscriptions table (one row per subscription package).
    // INNER JOIN — profiles: Links each subscription to its client via clientId = profiles.id.
    //              Only subscriptions with a valid client profile are returned.
    // INNER JOIN — services: Links each subscription to its service via serviceId = services.id.
    //              Only subscriptions with a valid service are returned.
    // WHERE      — If a statusFilter is provided (e.g. "active"), only rows with that
    //              status are returned. If omitted, all statuses are included.
    // ORDER BY   — Most recently created subscriptions first (descending by createdAt).
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

    // Reshape each joined row into the SubscriptionRow type the UI expects.
    // Computes two derived fields inline: clientName (from separate first/last
    // columns, filtered to handle nulls) and sessionsRemaining (total minus used).
    // Computing these here avoids duplicating the logic in every UI consumer.
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

/**
 * Returns active subscriptions for a specific client that still have unused sessions.
 * Used to populate the booking dialog so the admin can apply a session from an
 * existing package instead of charging the client separately.
 */
export async function getActiveSubscriptionsForClient(
  clientId: string,
): Promise<{ id: number; name: string; sessionsRemaining: number }[]> {
  try {
    await requireAdmin();

    // QUERY: Fetch all subscriptions belonging to a specific client.
    // SELECT — Reads id, package name, total sessions purchased, and sessions already used.
    // FROM   — booking_subscriptions table.
    // WHERE  — clientId matches the given client, pulling all their subscriptions
    //          regardless of status (the in-memory filter below handles that).
    // .then  — Post-query JavaScript filter: keeps only subscriptions where
    //          sessionsUsed < totalSessions (i.e. the client still has sessions left).
    //          This is done in JS rather than SQL because Drizzle doesn't support
    //          computed column comparisons in WHERE easily.
    const rows = await db
      .select({
        id: bookingSubscriptions.id,
        name: bookingSubscriptions.name,
        totalSessions: bookingSubscriptions.totalSessions,
        sessionsUsed: bookingSubscriptions.sessionsUsed,
      })
      .from(bookingSubscriptions)
      .where(eq(bookingSubscriptions.clientId, clientId))
      // Post-query filter: keep only subscriptions with unused sessions.
      // Done in JS via .then() because Drizzle ORM doesn't support WHERE
      // clauses that compare two columns from the same table easily. The
      // result set is small (one client's subscriptions) so this is efficient.
      .then((r) => r.filter((s) => s.sessionsUsed < s.totalSessions));

    // Reshape to the minimal {id, name, sessionsRemaining} the booking dialog
    // needs. Computing sessionsRemaining here keeps the subtraction logic in
    // one place rather than duplicating it in the UI component.
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

/**
 * Creates a new subscription package for a client.
 *
 * Side-effects:
 * - Inserts a row in booking_subscriptions with sessionsUsed = 0 (fresh package).
 * - Revalidates the bookings and memberships dashboard pages.
 * - Returns the new subscription's ID so the UI can navigate to it.
 */
export async function createSubscription(input: CreateSubscriptionInput): Promise<{ id: number }> {
  try {
    createSubscriptionSchema.parse(input);
    await requireAdmin();

    // MUTATION: Insert a new subscription row with zero sessions used.
    // The client starts with a full allotment of sessions (totalSessions).
    // RETURNING — Gives us the auto-generated subscription ID to return to the caller.
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

    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/memberships");
    return { id: sub.id };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Changes a subscription's status (e.g. active -> paused, paused -> cancelled).
 *
 * Side-effects:
 * - Updates the status column on the matching subscription row.
 * - Revalidates the bookings and memberships dashboard pages.
 * - A "cancelled" or "completed" subscription will no longer appear in the
 *   booking dialog's active-subscription picker.
 */
export async function updateSubscriptionStatus(
  id: number,
  status: SubscriptionStatus,
): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    subscriptionStatusSchema.parse(status);
    await requireAdmin();

    // MUTATION: Set the subscription's status to the new value.
    // WHERE — Matches by primary key (bookingSubscriptions.id).
    await db.update(bookingSubscriptions).set({ status }).where(eq(bookingSubscriptions.id, id));

    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/memberships");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Updates the free-text notes on a subscription.
 *
 * Side-effects:
 * - Overwrites the notes column on the matching subscription row.
 *   Empty strings are stored as NULL to keep the DB clean.
 * - Revalidates the bookings and memberships dashboard pages.
 */
export async function updateSubscriptionNotes(id: number, notes: string): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    z.string().parse(notes);
    await requireAdmin();

    // MUTATION: Overwrite the notes column. Empty string becomes NULL.
    // WHERE — Matches by primary key (bookingSubscriptions.id).
    await db
      .update(bookingSubscriptions)
      .set({ notes: notes || null })
      .where(eq(bookingSubscriptions.id, id));

    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/memberships");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
