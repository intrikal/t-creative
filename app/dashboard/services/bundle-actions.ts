/**
 * app/dashboard/services/bundle-actions.ts — Server actions for `service_bundles`.
 *
 * ## Responsibility
 * Full CRUD for service bundles — discounted packages that combine two or more
 * services. Bundles are managed through `BundlesTab` in the Services dashboard.
 *
 * ## Data model
 * Service membership is stored as a Postgres text array (`service_names[]`) rather
 * than a junction table. This is intentional for Phase 1 simplicity — when the
 * catalog is small (< 50 services), a text array with embedded names is easy to
 * render and avoids an extra JOIN. Phase 2 may migrate to a FK junction table if
 * referential integrity becomes important.
 *
 * ## Type exports
 * - `BundleRow`   — Drizzle-inferred row type from `service_bundles`.
 * - `BundleInput` — Input shape for create/update mutations.
 *
 * @see `app/dashboard/services/components/BundlesTab.tsx` — primary consumer.
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceBundles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export type BundleRow = typeof serviceBundles.$inferSelect;

export type BundleInput = {
  name: string;
  description: string;
  serviceNames: string[];
  originalPriceInCents: number;
  bundlePriceInCents: number;
  isActive: boolean;
};

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function getBundles(): Promise<BundleRow[]> {
  await getUser();
  return db.select().from(serviceBundles).orderBy(serviceBundles.createdAt);
}

export async function createBundle(input: BundleInput): Promise<BundleRow> {
  await getUser();
  const [row] = await db
    .insert(serviceBundles)
    .values({
      name: input.name,
      description: input.description || null,
      serviceNames: input.serviceNames,
      originalPriceInCents: input.originalPriceInCents,
      bundlePriceInCents: input.bundlePriceInCents,
      isActive: input.isActive,
    })
    .returning();
  revalidatePath("/dashboard/services");
  return row;
}

export async function updateBundle(id: number, input: BundleInput): Promise<BundleRow> {
  await getUser();
  const [row] = await db
    .update(serviceBundles)
    .set({
      name: input.name,
      description: input.description || null,
      serviceNames: input.serviceNames,
      originalPriceInCents: input.originalPriceInCents,
      bundlePriceInCents: input.bundlePriceInCents,
      isActive: input.isActive,
    })
    .where(eq(serviceBundles.id, id))
    .returning();
  revalidatePath("/dashboard/services");
  return row;
}

export async function deleteBundle(id: number): Promise<void> {
  await getUser();
  await db.delete(serviceBundles).where(eq(serviceBundles.id, id));
  revalidatePath("/dashboard/services");
}

export async function toggleBundleActive(id: number, isActive: boolean): Promise<void> {
  await getUser();
  await db.update(serviceBundles).set({ isActive }).where(eq(serviceBundles.id, id));
  revalidatePath("/dashboard/services");
}
