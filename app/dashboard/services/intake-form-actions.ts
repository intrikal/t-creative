/**
 * app/dashboard/services/intake-form-actions.ts — Server actions for intake forms.
 *
 * CRUD for intake form definitions (admin) and submission/query helpers
 * used by the booking flow and staff booking detail.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { eq, and, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  intakeFormDefinitions,
  intakeFormSubmissions,
  services,
  profiles,
} from "@/db/schema";
import type { IntakeFormField } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getUser as getAuthUser } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type IntakeFormDefinitionRow = typeof intakeFormDefinitions.$inferSelect;

export type IntakeFormSubmissionRow = typeof intakeFormSubmissions.$inferSelect & {
  formName?: string;
  fields?: IntakeFormField[];
};

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const idSchema = z.number().int().positive();

const intakeFieldSchema: z.ZodType<IntakeFormField> = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "select", "multiselect", "checkbox", "date"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const createIntakeFormSchema = z.object({
  serviceId: z.number().int().positive().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  fields: z.array(intakeFieldSchema).min(1),
});

const updateFieldsSchema = z.object({
  id: z.number().int().positive(),
  fields: z.array(intakeFieldSchema).min(1),
});

const submitIntakeFormSchema = z.object({
  bookingId: z.number().int().positive(),
  formDefinitionId: z.number().int().positive(),
  responses: z.record(z.string(), z.unknown()),
});

/* ------------------------------------------------------------------ */
/*  Admin CRUD                                                         */
/* ------------------------------------------------------------------ */

export async function getIntakeFormDefinitions(): Promise<IntakeFormDefinitionRow[]> {
  try {
    await requireAdmin();
    return db
      .select()
      .from(intakeFormDefinitions)
      .orderBy(desc(intakeFormDefinitions.createdAt));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getIntakeFormsForService(
  serviceId: number,
): Promise<IntakeFormDefinitionRow[]> {
  try {
    await requireAdmin();
    return db
      .select()
      .from(intakeFormDefinitions)
      .where(
        and(
          eq(intakeFormDefinitions.isActive, true),
          eq(intakeFormDefinitions.serviceId, serviceId),
        ),
      )
      .orderBy(intakeFormDefinitions.name);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function createIntakeFormDefinition(
  input: z.infer<typeof createIntakeFormSchema>,
): Promise<IntakeFormDefinitionRow> {
  try {
    createIntakeFormSchema.parse(input);
    const user = await requireAdmin();
    const [row] = await db
      .insert(intakeFormDefinitions)
      .values({
        serviceId: input.serviceId,
        name: input.name,
        description: input.description ?? null,
        fields: input.fields,
      })
      .returning();
    trackEvent(user.id, "intake_form_created", { name: input.name });
    revalidatePath("/dashboard/services");
    return row;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateIntakeFormFields(
  input: z.infer<typeof updateFieldsSchema>,
): Promise<IntakeFormDefinitionRow> {
  try {
    updateFieldsSchema.parse(input);
    await requireAdmin();

    // Fetch current version to bump
    const [current] = await db
      .select({ version: intakeFormDefinitions.version })
      .from(intakeFormDefinitions)
      .where(eq(intakeFormDefinitions.id, input.id));

    if (!current) throw new Error("Intake form not found");

    const [row] = await db
      .update(intakeFormDefinitions)
      .set({
        fields: input.fields,
        version: current.version + 1,
      })
      .where(eq(intakeFormDefinitions.id, input.id))
      .returning();

    revalidatePath("/dashboard/services");
    return row;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateIntakeFormDefinition(
  id: number,
  input: { name?: string; description?: string; serviceId?: number | null; isActive?: boolean },
): Promise<IntakeFormDefinitionRow> {
  try {
    idSchema.parse(id);
    await requireAdmin();
    const [row] = await db
      .update(intakeFormDefinitions)
      .set(input)
      .where(eq(intakeFormDefinitions.id, id))
      .returning();
    revalidatePath("/dashboard/services");
    return row;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function deleteIntakeFormDefinition(id: number): Promise<void> {
  try {
    idSchema.parse(id);
    const user = await requireAdmin();
    await db.delete(intakeFormDefinitions).where(eq(intakeFormDefinitions.id, id));
    trackEvent(user.id, "intake_form_deleted", { formId: id });
    revalidatePath("/dashboard/services");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function toggleIntakeFormActive(id: number, isActive: boolean): Promise<void> {
  try {
    idSchema.parse(id);
    z.boolean().parse(isActive);
    await requireAdmin();
    await db
      .update(intakeFormDefinitions)
      .set({ isActive })
      .where(eq(intakeFormDefinitions.id, id));
    revalidatePath("/dashboard/services");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Public — used in booking flow                                      */
/* ------------------------------------------------------------------ */

/**
 * Get active intake form definitions for a given service.
 * Includes global forms (serviceId IS NULL) and service-specific forms.
 * No auth required — called during public booking flow.
 */
export async function getActiveIntakeFormsForBooking(
  serviceId: number,
): Promise<IntakeFormDefinitionRow[]> {
  try {
    const serviceSpecific = await db
      .select()
      .from(intakeFormDefinitions)
      .where(
        and(
          eq(intakeFormDefinitions.isActive, true),
          eq(intakeFormDefinitions.serviceId, serviceId),
        ),
      );

    const global = await db
      .select()
      .from(intakeFormDefinitions)
      .where(
        and(
          eq(intakeFormDefinitions.isActive, true),
          isNull(intakeFormDefinitions.serviceId),
        ),
      );

    return [...serviceSpecific, ...global];
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/**
 * Get the current authenticated client's last submission for a given form definition.
 * Used for pre-filling returning clients. Returns null for guests.
 */
export async function getLastSubmissionForCurrentUser(
  formDefinitionId: number,
): Promise<Record<string, unknown> | null> {
  try {
    const user = await getAuthUser();
    const [row] = await db
      .select({ responses: intakeFormSubmissions.responses })
      .from(intakeFormSubmissions)
      .where(
        and(
          eq(intakeFormSubmissions.clientId, user.id),
          eq(intakeFormSubmissions.formDefinitionId, formDefinitionId),
        ),
      )
      .orderBy(desc(intakeFormSubmissions.submittedAt))
      .limit(1);

    return row?.responses ?? null;
  } catch {
    // Guest or unauthenticated — no pre-fill
    return null;
  }
}

/**
 * Submit an intake form response.
 * Validates required fields against the form definition server-side.
 */
export async function submitIntakeForm(
  input: z.infer<typeof submitIntakeFormSchema>,
): Promise<void> {
  try {
    submitIntakeFormSchema.parse(input);
    const user = await getAuthUser();

    // Fetch the form definition for server-side required field validation
    const [definition] = await db
      .select()
      .from(intakeFormDefinitions)
      .where(eq(intakeFormDefinitions.id, input.formDefinitionId));

    if (!definition) throw new Error("Intake form not found");

    // Validate required fields
    const fields = definition.fields as IntakeFormField[];
    const missingRequired = fields
      .filter((f) => f.required)
      .filter((f) => {
        const val = input.responses[f.id];
        if (val === undefined || val === null || val === "") return true;
        if (Array.isArray(val) && val.length === 0) return true;
        return false;
      });

    if (missingRequired.length > 0) {
      throw new Error(
        `Required fields missing: ${missingRequired.map((f) => f.label).join(", ")}`,
      );
    }

    await db.insert(intakeFormSubmissions).values({
      bookingId: input.bookingId,
      formDefinitionId: input.formDefinitionId,
      clientId: user.id,
      responses: input.responses,
      formVersion: definition.version,
    });

    trackEvent(user.id, "intake_form_submitted", {
      formId: input.formDefinitionId,
      bookingId: input.bookingId,
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Staff — booking detail view                                        */
/* ------------------------------------------------------------------ */

/**
 * Get all intake form submissions for a booking.
 * Joins form definition to include field labels for display.
 */
export async function getIntakeSubmissionsForBooking(
  bookingId: number,
): Promise<IntakeFormSubmissionRow[]> {
  try {
    await requireAdmin();

    const rows = await db
      .select({
        id: intakeFormSubmissions.id,
        bookingId: intakeFormSubmissions.bookingId,
        formDefinitionId: intakeFormSubmissions.formDefinitionId,
        clientId: intakeFormSubmissions.clientId,
        responses: intakeFormSubmissions.responses,
        formVersion: intakeFormSubmissions.formVersion,
        submittedAt: intakeFormSubmissions.submittedAt,
        formName: intakeFormDefinitions.name,
        fields: intakeFormDefinitions.fields,
      })
      .from(intakeFormSubmissions)
      .innerJoin(
        intakeFormDefinitions,
        eq(intakeFormSubmissions.formDefinitionId, intakeFormDefinitions.id),
      )
      .where(eq(intakeFormSubmissions.bookingId, bookingId))
      .orderBy(intakeFormSubmissions.submittedAt);

    return rows as IntakeFormSubmissionRow[];
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}
