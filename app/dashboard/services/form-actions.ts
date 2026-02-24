/**
 * app/dashboard/services/form-actions.ts — Server actions for `client_forms`.
 *
 * ## Responsibility
 * Full CRUD for intake forms, waivers, and consent forms sent to clients before
 * appointments. Forms are managed through `FormsTab` in the Services dashboard.
 *
 * ## Data model
 * - `appliesTo` — Postgres text[] indicating which service categories require this form.
 *   Default is `["All"]` (applies to all categories).
 * - `fields`    — JSONB array of `{ id, label, type, required }` objects stored as
 *   `unknown` by Drizzle. Cast to `FormField[]` at the component layer.
 *   Null means no custom fields have been configured yet; the component
 *   falls back to `DEFAULT_FIELDS[form.type]`.
 *
 * ## updateFormFields
 * Accepts `unknown` for the fields argument to stay flexible with the JSONB type.
 * The caller (EditFieldsDialog) always passes a `FormField[]` — the loose typing
 * here is intentional to avoid a circular import between actions and types.ts.
 *
 * ## Type exports
 * - `FormRow`   — Drizzle-inferred row type from `client_forms`.
 * - `FormInput` — Input shape for create/update mutations.
 *
 * @see `app/dashboard/services/components/FormsTab.tsx` — primary consumer.
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientForms } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export type FormRow = typeof clientForms.$inferSelect;

export type FormInput = {
  name: string;
  type: "intake" | "waiver" | "consent" | "custom";
  description: string;
  appliesTo: string[];
  required: boolean;
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

export async function getForms(): Promise<FormRow[]> {
  await getUser();
  return db.select().from(clientForms).orderBy(clientForms.createdAt);
}

export async function createForm(input: FormInput): Promise<FormRow> {
  await getUser();
  const [row] = await db
    .insert(clientForms)
    .values({
      name: input.name,
      type: input.type,
      description: input.description || null,
      appliesTo: input.appliesTo,
      required: input.required,
      isActive: input.isActive,
    })
    .returning();
  revalidatePath("/dashboard/services");
  return row;
}

export async function updateForm(id: number, input: FormInput): Promise<FormRow> {
  await getUser();
  const [row] = await db
    .update(clientForms)
    .set({
      name: input.name,
      type: input.type,
      description: input.description || null,
      appliesTo: input.appliesTo,
      required: input.required,
      isActive: input.isActive,
    })
    .where(eq(clientForms.id, id))
    .returning();
  revalidatePath("/dashboard/services");
  return row;
}

export async function deleteForm(id: number): Promise<void> {
  await getUser();
  await db.delete(clientForms).where(eq(clientForms.id, id));
  revalidatePath("/dashboard/services");
}

export async function toggleFormActive(id: number, isActive: boolean): Promise<void> {
  await getUser();
  await db.update(clientForms).set({ isActive }).where(eq(clientForms.id, id));
  revalidatePath("/dashboard/services");
}

export async function updateFormFields(id: number, fields: unknown): Promise<void> {
  await getUser();
  await db.update(clientForms).set({ fields }).where(eq(clientForms.id, id));
  revalidatePath("/dashboard/services");
}
