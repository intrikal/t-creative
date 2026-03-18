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

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceAddOns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";

export type AddOnRow = typeof serviceAddOns.$inferSelect;

export type AddOnInput = {
  name: string;
  description?: string;
  priceInCents: number;
  additionalMinutes: number;
};

const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const addOnInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  priceInCents: z.number().int().nonnegative(),
  additionalMinutes: z.number().int().nonnegative(),
});

const idSchema = z.number().int().positive();

export async function getAddOns(serviceId: number): Promise<AddOnRow[]> {
  try {
    await getUser();
    return db
      .select()
      .from(serviceAddOns)
      .where(eq(serviceAddOns.serviceId, serviceId))
      .orderBy(serviceAddOns.id);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function createAddOn(serviceId: number, input: AddOnInput): Promise<AddOnRow> {
  try {
    idSchema.parse(serviceId);
    addOnInputSchema.parse(input);
    const user = await getUser();
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
    trackEvent(user.id, "addon_created", { serviceId, name: input.name });
    revalidatePath("/dashboard/services");
    return row;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateAddOn(id: number, input: AddOnInput): Promise<AddOnRow> {
  try {
    idSchema.parse(id);
    addOnInputSchema.parse(input);
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function deleteAddOn(id: number): Promise<void> {
  try {
    idSchema.parse(id);
    const user = await getUser();
    await db.delete(serviceAddOns).where(eq(serviceAddOns.id, id));
    trackEvent(user.id, "addon_deleted", { addonId: id });
    revalidatePath("/dashboard/services");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function toggleAddOnActive(id: number, isActive: boolean): Promise<void> {
  try {
    idSchema.parse(id);
    z.boolean().parse(isActive);
    await getUser();
    await db.update(serviceAddOns).set({ isActive }).where(eq(serviceAddOns.id, id));
    revalidatePath("/dashboard/services");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
