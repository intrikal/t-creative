/**
 * Server action for the corporate event inquiry form (/events/corporate).
 *
 * Inserts a row into the `inquiries` table. No auth required — this is
 * a public-facing form for anonymous visitors.
 */
"use server";

import * as React from "react";
import { z } from "zod";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { CorporateEventInquiry } from "@/emails/CorporateEventInquiry";
import { trackEvent } from "@/lib/posthog";
import { sendEmail, RESEND_FROM } from "@/lib/resend";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const corporateInquirySchema = z.object({
  contactName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  companyName: z.string().min(1, "Company name is required"),
  headcount: z.number().int().min(1, "Headcount must be at least 1"),
  preferredDate: z.string().optional(),
  services: z.string().min(1, "Please select at least one service"),
  eventType: z.string().min(1, "Please select an event type"),
  details: z.string().optional(),
  turnstileToken: z.string().min(1, "Bot check is required"),
});

export type CorporateInquiryInput = z.infer<typeof corporateInquirySchema>;

const eventTypeLabels: Record<string, string> = {
  team_bonding: "Team Bonding",
  offsite: "Offsite / Retreat",
  celebration: "Celebration / Milestone",
  other: "Other",
};

const serviceLabels: Record<string, string> = {
  lash: "Lash Extensions",
  jewelry: "Permanent Jewelry",
  both: "Lash Extensions & Permanent Jewelry",
};

/**
 * Processes a corporate event inquiry form submission.
 *
 * 1. Validates all fields with Zod (corporateInquirySchema).
 * 2. Verifies the Cloudflare Turnstile bot-check token.
 * 3. Builds a structured message string from the corporate fields (company name,
 *    event type, headcount, preferred date, details).
 * 4. Inserts a row:
 *    INSERT INTO inquiries (name, email, phone, interest, message, status)
 *    VALUES (<contactName>, <email>, <phone>, 'consulting', <message>, 'new')
 *    RETURNING id
 *    → interest is always "consulting" for corporate events.
 * 5. Fires a PostHog analytics event.
 * 6. Sends an email notification to the admin with all inquiry details.
 */
export async function submitCorporateInquiry(
  data: CorporateInquiryInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = corporateInquirySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Invalid form data. Please check your inputs." };
  }

  const valid = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!valid) {
    return { success: false, error: "Bot check failed. Please try again." };
  }

  const {
    contactName,
    email,
    phone,
    companyName,
    headcount,
    preferredDate,
    services,
    eventType,
    details,
  } = parsed.data;

  const eventTypeLabel = eventTypeLabels[eventType] ?? eventType;
  const servicesLabel = serviceLabels[services] ?? services;

  // Build structured message — corporate fields stored inline since the
  // inquiries table has no separate notes column.
  const messageParts = [
    `[Corporate Event] ${companyName}`,
    `Event Type: ${eventTypeLabel}`,
    `Services: ${servicesLabel}`,
    `Headcount: ${headcount}`,
    preferredDate ? `Preferred Date: ${preferredDate}` : null,
    details ? `\nDetails:\n${details}` : null,
  ].filter(Boolean);

  const message = messageParts.join("\n");

  const [row] = await db
    .insert(inquiries)
    .values({
      name: contactName,
      email,
      phone: phone || null,
      interest: "consulting",
      message,
      status: "new",
    })
    .returning({ id: inquiries.id });

  trackEvent(email, "corporate_inquiry_submitted", {
    companyName,
    eventType,
    services,
    headcount,
  });

  const adminEmail = process.env.ADMIN_EMAIL ?? "hello@tcreativestudio.com";

  await sendEmail({
    to: adminEmail,
    subject: `New corporate event inquiry — ${companyName}`,
    react: React.createElement(CorporateEventInquiry, {
      contactName,
      email,
      phone,
      companyName,
      eventType: eventTypeLabel,
      services: servicesLabel,
      headcount,
      preferredDate,
      details,
    }),
    entityType: "corporate_inquiry",
    localId: String(row.id),
  });

  return { success: true };
}
