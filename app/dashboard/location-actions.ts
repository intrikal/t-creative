/**
 * location-actions.ts — Server actions for multi-location support.
 *
 * CRUD for locations (admin only) and public getActiveLocations for
 * the location selector dropdown.
 */
"use server";

import { revalidatePath, updateTag, unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { requireAdmin, getUser } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type LocationRow = typeof locations.$inferSelect;

/* ------------------------------------------------------------------ */
/*  Read                                                               */
/* ------------------------------------------------------------------ */

/** Cached DB fetch — revalidated when locations are mutated. */
const fetchActiveLocations = unstable_cache(
  () => db.select().from(locations).where(eq(locations.isActive, true)).orderBy(locations.name),
  ["active-locations"],
  { revalidate: 300, tags: ["active-locations"] },
);

/** Get all active locations — used by the dashboard location selector. */
export async function getActiveLocations(): Promise<LocationRow[]> {
  try {
    await getUser();
    return await fetchActiveLocations();
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/** Get all locations (including inactive) — admin only. */
export async function getAllLocations(): Promise<LocationRow[]> {
  try {
    await requireAdmin();
    return db.select().from(locations).orderBy(locations.name);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations (admin only)                                             */
/* ------------------------------------------------------------------ */

const locationInputSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  squareLocationId: z.string().optional(),
});

export async function createLocation(
  input: z.infer<typeof locationInputSchema>,
): Promise<LocationRow> {
  try {
    locationInputSchema.parse(input);
    await requireAdmin();
    const [row] = await db
      .insert(locations)
      .values({
        name: input.name,
        address: input.address ?? null,
        city: input.city ?? null,
        timezone: input.timezone,
        phone: input.phone ?? null,
        email: input.email ?? null,
        squareLocationId: input.squareLocationId ?? null,
      })
      .returning();
    updateTag("active-locations");
    revalidatePath("/dashboard");
    return row;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateLocation(
  id: number,
  input: Partial<z.infer<typeof locationInputSchema> & { isActive: boolean }>,
): Promise<LocationRow> {
  try {
    await requireAdmin();
    const [row] = await db.update(locations).set(input).where(eq(locations.id, id)).returning();
    updateTag("active-locations");
    revalidatePath("/dashboard");
    return row;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
