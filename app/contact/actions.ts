/**
 * Server action for the public contact form (/contact).
 *
 * Inserts a row into the `inquiries` table. No auth required — this is
 * a public-facing form for anonymous visitors.
 */
"use server";

import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { trackEvent } from "@/lib/posthog";
import { verifyTurnstileToken } from "@/lib/turnstile";

type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | null;

/** Map display labels from the contact form to DB enum values. */
const interestMap: Record<string, ServiceCategory> = {
  "Lash Extensions": "lash",
  "Permanent Jewelry": "jewelry",
  "Crochet Hair Install": "crochet",
  "Custom Crochet Crafts": "crochet",
  "Beauty Business Consulting": "consulting",
  "HR Consulting": "consulting",
  "Training Programs": null,
  "Shop Products": null,
  Other: null,
};

export async function submitContactForm(data: {
  name: string;
  email: string;
  interest: string;
  message: string;
  turnstileToken: string;
}) {
  const valid = await verifyTurnstileToken(data.turnstileToken);
  if (!valid) throw new Error("Bot check failed. Please try again.");

  const category = interestMap[data.interest] ?? null;

  await db.insert(inquiries).values({
    name: data.name,
    email: data.email,
    interest: category,
    message: `[${data.interest}] ${data.message}`,
    status: "new",
  });

  trackEvent(data.email, "contact_form_submitted", { interest: data.interest, category });

  return { success: true };
}
