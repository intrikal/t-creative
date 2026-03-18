/**
 * app/dashboard/bookings/select-actions.ts — Dropdown select options for booking forms.
 *
 * Provides client, service, and staff lists used by the create/edit booking dialogs.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, ne, and } from "drizzle-orm";
import { db } from "@/db";
import { profiles, services, clientPreferences } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

const getUser = requireAdmin;

export async function getClientsForSelect(): Promise<
  { id: string; name: string; phone: string | null; preferredRebookIntervalDays: number | null }[]
> {
  try {
    await getUser();
    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        phone: profiles.phone,
        preferredRebookIntervalDays: clientPreferences.preferredRebookIntervalDays,
      })
      .from(profiles)
      .leftJoin(clientPreferences, eq(clientPreferences.profileId, profiles.id))
      .where(and(eq(profiles.role, "client"), eq(profiles.isActive, true)))
      .orderBy(profiles.firstName);

    return rows.map((r) => ({
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(" "),
      phone: r.phone,
      preferredRebookIntervalDays: r.preferredRebookIntervalDays ?? null,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getServicesForSelect(): Promise<
  {
    id: number;
    name: string;
    category: string;
    durationMinutes: number;
    priceInCents: number;
    depositInCents: number;
  }[]
> {
  try {
    await getUser();
    const rows = await db
      .select({
        id: services.id,
        name: services.name,
        category: services.category,
        durationMinutes: services.durationMinutes,
        priceInCents: services.priceInCents,
        depositInCents: services.depositInCents,
      })
      .from(services)
      .where(eq(services.isActive, true))
      .orderBy(services.category, services.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      durationMinutes: r.durationMinutes ?? 60,
      priceInCents: r.priceInCents ?? 0,
      depositInCents: r.depositInCents ?? 0,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getStaffForSelect(): Promise<{ id: string; name: string }[]> {
  try {
    await getUser();
    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(ne(profiles.role, "client"))
      .orderBy(profiles.firstName);

    return rows.map((r) => ({
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(" "),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
