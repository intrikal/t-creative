/**
 * Server action for the public contact form (/contact).
 *
 * Inserts a row into the `inquiries` table. No auth required — this is
 * a public-facing form for anonymous visitors.
 */
"use server";

import React from "react";
import { Ratelimit } from "@upstash/ratelimit";
import { z } from "zod";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { InquiryReply } from "@/emails/InquiryReply";
import { trackEvent } from "@/lib/posthog";
import { redis } from "@/lib/redis";
import { sendEmail } from "@/lib/resend";

const contactFormSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(30).optional(),
  interest: z.string().min(1),
  message: z.string().min(1).max(5000),
});

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

const contactRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "rl:contact-form",
});

/**
 * Processes a public contact form submission.
 *
 * 1. Validates the form fields with Zod.
 * 2. Enforces a 5-submissions-per-minute rate limit (keyed by email).
 * 3. Verifies the Google reCAPTCHA token.
 * 4. Maps the human-readable interest label (e.g. "Lash Extensions") to the
 *    DB enum value (e.g. "lash") using `interestMap`.
 * 5. Inserts a row:
 *    INSERT INTO inquiries (name, email, interest, message, status)
 *    VALUES (<name>, <email>, <category>, '[<interest>] <message>', 'new')
 *    → the interest label is prefixed to the message so the admin can see the
 *      original selection even though the DB stores the enum.
 * 6. Sends a confirmation email to the submitter.
 * 7. Fires a PostHog analytics event.
 */
export async function submitContactForm(data: {
  name: string;
  email: string;
  phone?: string;
  interest: string;
  message: string;
}) {
  const parsed = contactFormSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid form data. Please check your inputs.");

  const { success: allowed } = await contactRateLimit.limit(data.email);
  if (!allowed) throw new Error("Too many submissions. Please wait a moment and try again.");

  const category = interestMap[data.interest] ?? null;

  await db.insert(inquiries).values({
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    interest: category,
    message: `[${data.interest}] ${data.message}`,
    status: "new",
  });

  await sendEmail({
    to: data.email,
    subject: "We received your inquiry — T Creative",
    react: React.createElement(InquiryReply, {
      clientName: data.name,
      replyText:
        "Thanks for reaching out! We've received your message and will get back to you shortly.",
      originalMessage: data.message,
    }),
    entityType: "contact_inquiry",
    localId: data.email,
  });

  trackEvent(data.email, "contact_form_submitted", { interest: data.interest, category });

  return { success: true };
}
