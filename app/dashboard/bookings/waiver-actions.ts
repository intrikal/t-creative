/**
 * app/dashboard/bookings/waiver-actions.ts — Waiver / consent enforcement actions.
 *
 * Checks whether clients have completed required waivers before booking
 * confirmation, and sends waiver completion links via email.
 */
"use server";

import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, services, clientForms, formSubmissions } from "@/db/schema";
import { WaiverRequired } from "@/emails/WaiverRequired";
import { trackEvent } from "@/lib/posthog";
import { getEmailRecipient, sendEmail } from "@/lib/resend";
import { getPublicBookingRules } from "@/app/dashboard/settings/settings-actions";
import { generateWaiverToken } from "@/lib/waiver-token";
import { getUser } from "@/lib/auth";

export type MissingWaiver = {
  formId: number;
  formName: string;
  formType: string;
};

export type WaiverCheckResult = {
  passed: boolean;
  missing: MissingWaiver[];
};

/**
 * Check whether a client has completed all required waivers/forms for
 * a booking's service category. Returns the list of missing forms.
 */
export async function checkBookingWaivers(bookingId: number): Promise<WaiverCheckResult> {
  await getUser();

  // Get booking's client + service category
  const [booking] = await db
    .select({
      clientId: bookings.clientId,
      serviceCategory: services.category,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.id, bookingId));

  if (!booking) throw new Error("Booking not found");

  // Find all active, required forms that apply to this service category
  const allForms = await db
    .select({
      id: clientForms.id,
      name: clientForms.name,
      type: clientForms.type,
      appliesTo: clientForms.appliesTo,
    })
    .from(clientForms)
    .where(and(eq(clientForms.isActive, true), eq(clientForms.required, true)));

  // Filter forms that apply to this service category
  const categoryLabel =
    booking.serviceCategory.charAt(0).toUpperCase() + booking.serviceCategory.slice(1);
  const applicableForms = allForms.filter(
    (f) => f.appliesTo.includes("All") || f.appliesTo.includes(categoryLabel),
  );

  if (applicableForms.length === 0) return { passed: true, missing: [] };

  // Check which forms the client has already submitted
  const submissions = await db
    .select({ formId: formSubmissions.formId })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.clientId, booking.clientId),
        inArray(
          formSubmissions.formId,
          applicableForms.map((f) => f.id),
        ),
      ),
    );

  const submittedIds = new Set(submissions.map((s) => s.formId));
  const missing = applicableForms
    .filter((f) => !submittedIds.has(f.id))
    .map((f) => ({ formId: f.id, formName: f.name, formType: f.type }));

  return { passed: missing.length === 0, missing };
}

/**
 * Send the client a waiver completion link via email for a specific booking.
 * Returns true if the email was sent successfully.
 */
export async function sendWaiverLink(bookingId: number): Promise<boolean> {
  await getUser();

  const [booking] = await db
    .select({
      clientId: bookings.clientId,
      serviceName: services.name,
      startsAt: bookings.startsAt,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.id, bookingId));

  if (!booking) throw new Error("Booking not found");

  const recipient = await getEmailRecipient(booking.clientId);
  if (!recipient) throw new Error("Client has no email or notifications disabled");

  const bookingRules = await getPublicBookingRules();
  const token = generateWaiverToken({ bookingId, clientId: booking.clientId }, bookingRules.waiverTokenExpiryDays);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tcreativestudio.com";
  const waiverUrl = `${baseUrl}/waivers/${token}`;

  const sent = await sendEmail({
    to: recipient.email,
    subject: `Action Required: Complete Your Waiver for ${booking.serviceName}`,
    react: WaiverRequired({
      clientName: recipient.firstName,
      serviceName: booking.serviceName,
      appointmentDate: new Date(booking.startsAt).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      waiverUrl,
    }),
    entityType: "waiver_required",
    localId: String(bookingId),
  });

  if (sent) {
    trackEvent(booking.clientId, "waiver_link_sent", { bookingId });
  }

  return sent;
}
