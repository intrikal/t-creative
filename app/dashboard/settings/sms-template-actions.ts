"use server";
/**
 * sms-template-actions — Admin CRUD for SMS templates.
 *
 * Thin server-action layer over `lib/sms-templates.ts`. Each mutation is
 * admin-gated, validates input with Zod, and revalidates the cache tag so
 * cron jobs pick up the latest body on the next send.
 */

import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import {
  getSmsTemplates,
  getSmsTemplate,
  updateSmsTemplate,
  renderSmsTemplate,
  getDefaultBody,
  type SmsTemplate,
} from "@/lib/sms-templates";
import type { ActionResult } from "@/lib/types/action-result";

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

const MAX_SMS_LENGTH = 320;

const updateSchema = z.object({
  slug: z.string().min(1),
  body: z
    .string()
    .min(1, "Template body cannot be empty")
    .max(MAX_SMS_LENGTH, `SMS body must be ${MAX_SMS_LENGTH} characters or fewer`),
});

/* ------------------------------------------------------------------ */
/*  Reads                                                              */
/* ------------------------------------------------------------------ */

/** Fetch all SMS templates — admin only. */
export async function getTemplates(): Promise<SmsTemplate[]> {
  try {
    await requireAdmin();
    return await getSmsTemplates();
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/** Update a template's body text — admin only. */
export async function updateTemplate(slug: string, body: string): Promise<ActionResult<void>> {
  try {
    const user = await requireAdmin();
    updateSchema.parse({ slug, body });

    await updateSmsTemplate(slug, body);

    trackEvent(user.id, "sms_template_updated", { slug });
    updateTag("sms-templates");
    revalidatePath("/dashboard/settings");

    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to update template";
    return { success: false, error: message };
  }
}

/** Render a template with sample data so the admin can preview it. */
export async function previewTemplate(slug: string): Promise<ActionResult<string>> {
  try {
    await requireAdmin();

    const template = await getSmsTemplate(slug);
    if (!template) {
      return { success: false, error: "Template not found" };
    }

    const sampleData: Record<string, string> = {};
    const vars = template.variables as string[];
    for (const v of vars) {
      sampleData[v] = `[${v}]`;
    }

    const rendered = await renderSmsTemplate(slug, sampleData);
    if (!rendered) {
      return { success: false, error: "Template is inactive" };
    }

    return { success: true, data: rendered };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to preview template";
    return { success: false, error: message };
  }
}

/** Reset a template to its hardcoded default — admin only. */
export async function resetTemplate(slug: string): Promise<ActionResult<string>> {
  try {
    const user = await requireAdmin();

    const defaultBody = getDefaultBody(slug);
    if (!defaultBody) {
      return { success: false, error: "No default exists for this template" };
    }

    await updateSmsTemplate(slug, defaultBody);

    trackEvent(user.id, "sms_template_reset", { slug });
    updateTag("sms-templates");
    revalidatePath("/dashboard/settings");

    return { success: true, data: defaultBody };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to reset template";
    return { success: false, error: message };
  }
}
