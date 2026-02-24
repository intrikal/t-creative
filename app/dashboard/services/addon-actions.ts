/**
 * app/dashboard/services/addon-actions.ts — Server actions for `service_add_ons`.
 *
 * ## Responsibility
 * Full CRUD for optional add-ons attached to a parent service. Add-ons are
 * managed through the `AddOnsDialog` in the Services dashboard.
 *
 * ## Data model
 * Each add-on belongs to exactly one service (`serviceId` FK with cascade delete).
 * When a service is deleted, its add-ons are automatically removed by the DB.
 *
 * ## Type exports
 * - `AddOnRow`   — Drizzle-inferred row type from `service_add_ons`.
 * - `AddOnInput` — Input shape for create/update mutations.
 *
 * @see `app/dashboard/services/components/AddOnsDialog.tsx` — primary consumer.
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceAddOns } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export type AddOnRow = typeof serviceAddOns.$inferSelect;

export type AddOnInput = {
  name: string;
  description?: string;
  priceInCents: number;
  additionalMinutes: number;
};

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function getAddOns(serviceId: number): Promise<AddOnRow[]> {
  await getUser();
  return db
    .select()
    .from(serviceAddOns)
    .where(eq(serviceAddOns.serviceId, serviceId))
    .orderBy(serviceAddOns.id);
}

export async function createAddOn(serviceId: number, input: AddOnInput): Promise<AddOnRow> {
  await getUser();
  const [row] = await db
    .insert(serviceAddOns)
    .values({
      serviceId,
      name: input.name,
      description: input.description || null,
      priceInCents: input.priceInCents,
      additionalMinutes: input.additionalMinutes,
      isActive: true,
    })
    .returning();
  revalidatePath("/dashboard/services");
  return row;
}

export async function updateAddOn(id: number, input: AddOnInput): Promise<AddOnRow> {
  await getUser();
  const [row] = await db
    .update(serviceAddOns)
    .set({
      name: input.name,
      description: input.description || null,
      priceInCents: input.priceInCents,
      additionalMinutes: input.additionalMinutes,
    })
    .where(eq(serviceAddOns.id, id))
    .returning();
  revalidatePath("/dashboard/services");
  return row;
}

export async function deleteAddOn(id: number): Promise<void> {
  await getUser();
  await db.delete(serviceAddOns).where(eq(serviceAddOns.id, id));
  revalidatePath("/dashboard/services");
}

export async function toggleAddOnActive(id: number, isActive: boolean): Promise<void> {
  await getUser();
  await db.update(serviceAddOns).set({ isActive }).where(eq(serviceAddOns.id, id));
  revalidatePath("/dashboard/services");
}
