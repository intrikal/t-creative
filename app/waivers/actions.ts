/**
 * app/waivers/actions.ts — Public server actions for waiver completion.
 *
 * These actions are token-authenticated (no Supabase session required) so
 * clients can complete waivers from an email link without logging in.
 */
"use server";

import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, clientForms, formSubmissions, services } from "@/db/schema";
import { trackEvent } from "@/lib/posthog";
import { verifyWaiverToken } from "@/lib/waiver-token";

export type WaiverFormField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
};

export type WaiverForm = {
  id: number;
  name: string;
  type: string;
  description: string | null;
  fields: WaiverFormField[] | null;
};

export type WaiverPageData = {
  clientId: string;
  bookingId: number;
  serviceName: string;
  appointmentDate: string;
  forms: WaiverForm[];
};

/** Default field sets for each form type (mirrors services/types.ts). */
const DEFAULT_FIELDS: Record<string, WaiverFormField[]> = {
  waiver: [
    { id: "fullName", label: "Full Name", type: "text", required: true },
    { id: "date", label: "Date", type: "date", required: true },
    { id: "agreement", label: "I have read and agree to the terms of this waiver", type: "checkbox", required: true },
    { id: "signature", label: "Signature", type: "signature", required: true },
  ],
  consent: [
    { id: "fullName", label: "Full Name", type: "text", required: true },
    { id: "consent", label: "I give my informed consent for this service", type: "checkbox", required: true },
    { id: "medicalConditions", label: "Known Medical Conditions or Allergies", type: "textarea", required: false },
    { id: "signature", label: "Signature", type: "signature", required: true },
  ],
  intake: [
    { id: "fullName", label: "Full Name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
    { id: "phone", label: "Phone", type: "phone", required: false },
    { id: "dateOfBirth", label: "Date of Birth", type: "date", required: false },
    { id: "allergies", label: "Known Allergies", type: "textarea", required: false },
    { id: "preferences", label: "Style Preferences", type: "textarea", required: false },
  ],
  custom: [
    { id: "fullName", label: "Full Name", type: "text", required: true },
    { id: "response", label: "Your Response", type: "textarea", required: false },
  ],
};

/**
 * Load all data needed for the waiver completion page.
 * Verifies the token and returns the required forms that haven't been completed.
 *
 * Step 1 — Fetch the booking and its service:
 *   SELECT bookings.clientId, services.name, services.category, bookings.startsAt
 *   FROM   bookings
 *   INNER JOIN services ON bookings.serviceId = services.id
 *     → pulls the service name and category so we know which waivers apply
 *   WHERE  bookings.id = <bookingId from token>
 *
 * Step 2 — Fetch all required, active forms:
 *   SELECT * FROM client_forms WHERE isActive = true AND required = true
 *   → then filter in JS to keep forms whose `appliesTo` includes "All" or the category
 *
 * Step 3 — Check which forms this client already submitted:
 *   SELECT formId FROM form_submissions
 *   WHERE  clientId = <clientId> AND formId IN (<applicable form IDs>)
 *
 * Step 4 — Return only the forms NOT yet submitted (the pending waivers).
 */
export async function getWaiverPageData(token: string): Promise<WaiverPageData | null> {
  const payload = verifyWaiverToken(token);
  if (!payload) return null;

  const { bookingId, clientId } = payload;

  // Fetch booking + service info
  const [booking] = await db
    .select({
      clientId: bookings.clientId,
      serviceName: services.name,
      serviceCategory: services.category,
      startsAt: bookings.startsAt,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.id, bookingId));

  if (!booking || booking.clientId !== clientId) return null;

  // Get required forms for this service category
  const allForms = await db
    .select()
    .from(clientForms)
    .where(and(eq(clientForms.isActive, true), eq(clientForms.required, true)));

  const categoryLabel =
    booking.serviceCategory.charAt(0).toUpperCase() + booking.serviceCategory.slice(1);
  // Filter to forms whose appliesTo array contains either "All" (universal) or
  // the capitalised service category (e.g. "Lash"). Done in JS rather than SQL
  // because appliesTo is a JSON array column and Drizzle doesn't natively
  // support array-contains queries on JSON — a client-side filter on a small
  // dataset (~5–10 forms) is simpler and fast enough.
  const applicableForms = allForms.filter(
    (f) => f.appliesTo.includes("All") || f.appliesTo.includes(categoryLabel),
  );

  if (applicableForms.length === 0) {
    return {
      clientId,
      bookingId,
      serviceName: booking.serviceName,
      appointmentDate: new Date(booking.startsAt).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      forms: [],
    };
  }

  // Check which ones are already submitted
  const submissions = await db
    .select({ formId: formSubmissions.formId })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.clientId, clientId),
        // Extract form IDs into a flat number[] for the SQL IN clause. Using
        // .map() to pluck a single field avoids passing full form objects into
        // the query builder.
        inArray(
          formSubmissions.formId,
          applicableForms.map((f) => f.id),
        ),
      ),
    );

  // Build a Set of already-submitted form IDs for O(1) membership checks.
  // A Set is preferred over an array + .includes() because the subsequent
  // .filter() runs once per applicable form, and Set.has is constant-time.
  const submittedIds = new Set(submissions.map((s) => s.formId));
  // Keep only forms the client has NOT yet submitted — these are the waivers
  // still pending completion.
  const pendingForms = applicableForms.filter((f) => !submittedIds.has(f.id));

  return {
    clientId,
    bookingId,
    serviceName: booking.serviceName,
    appointmentDate: new Date(booking.startsAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    // Reshape each pending form into the WaiverForm type the client page expects.
    // Falls back to DEFAULT_FIELDS when the form has no custom field definitions
    // stored in the DB (null), so the UI always has a renderable field list.
    forms: pendingForms.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      description: f.description,
      fields: (f.fields as WaiverFormField[] | null) ?? DEFAULT_FIELDS[f.type] ?? null,
    })),
  };
}

/**
 * Submit a completed waiver form. Token-authenticated (no session needed).
 *
 * Step 1 — Verify the form exists and is active:
 *   SELECT id, name FROM client_forms
 *   WHERE  id = <formId> AND isActive = true
 *
 * Step 2 — Check for duplicate submission (idempotency):
 *   SELECT id FROM form_submissions
 *   WHERE  clientId = <clientId> AND formId = <formId>
 *   → if already submitted, return success without inserting again.
 *
 * Step 3 — Insert the submission:
 *   INSERT INTO form_submissions (clientId, formId, data, signatureUrl, formVersion, ipAddress)
 *   VALUES (...)
 */
export async function submitWaiverForm(
  token: string,
  formId: number,
  data: Record<string, unknown>,
  signatureDataUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  const payload = verifyWaiverToken(token);
  if (!payload) return { success: false, error: "Invalid or expired link" };

  const { clientId, bookingId } = payload;

  // Verify the form exists and is required
  const [form] = await db
    .select({ id: clientForms.id, name: clientForms.name })
    .from(clientForms)
    .where(and(eq(clientForms.id, formId), eq(clientForms.isActive, true)));

  if (!form) return { success: false, error: "Form not found" };

  // Check for duplicate submission
  const [existing] = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .where(
      and(eq(formSubmissions.clientId, clientId), eq(formSubmissions.formId, formId)),
    );

  if (existing) return { success: true }; // Already submitted, treat as success

  await db.insert(formSubmissions).values({
    clientId,
    formId,
    data,
    signatureUrl: signatureDataUrl ?? null,
    formVersion: new Date().toISOString().slice(0, 7), // "2026-03"
    ipAddress: null, // Not available in server actions
  });

  trackEvent(clientId, "waiver_completed", { bookingId, formId, formName: form.name });

  return { success: true };
}
