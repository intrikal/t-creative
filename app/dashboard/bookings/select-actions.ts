/**
 * app/dashboard/bookings/select-actions.ts — Dropdown select options for booking forms.
 *
 * Provides client, service, and staff lists used by the create/edit booking dialogs.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, ne, and, sql } from "drizzle-orm";
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

/**
 * Fuzzy-search active clients by name or email using pg_trgm word_similarity().
 * Returns up to 20 results ranked by best match. Used by the booking dialog
 * combobox to avoid loading all clients upfront.
 *
 * Threshold 0.2 is intentionally low to handle partial first names like "Tri"
 * matching "Trini". word_similarity() is used (vs similarity()) because it
 * handles prefix matches better for partial queries.
 */
export async function searchClients(
  query: string,
): Promise<{ id: string; name: string; phone: string | null; preferredRebookIntervalDays: number | null }[]> {
  try {
    await requireAdmin();

    const q = query.trim();
    if (!q) return [];

    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        phone: profiles.phone,
        preferredRebookIntervalDays: clientPreferences.preferredRebookIntervalDays,
        score: sql<number>`
          greatest(
            word_similarity(${q}, ${profiles.firstName} || ' ' || coalesce(${profiles.lastName}, '')),
            word_similarity(${q}, ${profiles.email})
          )
        `.as("score"),
      })
      .from(profiles)
      .leftJoin(clientPreferences, eq(clientPreferences.profileId, profiles.id))
      .where(
        and(
          eq(profiles.role, "client"),
          eq(profiles.isActive, true),
          sql`
            greatest(
              word_similarity(${q}, ${profiles.firstName} || ' ' || coalesce(${profiles.lastName}, '')),
              word_similarity(${q}, ${profiles.email})
            ) > 0.2
          `,
        ),
      )
      .orderBy(sql`score desc`)
      .limit(20);

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
