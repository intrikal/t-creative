/**
 * Server action for the public contact form (/contact).
 *
 * Inserts a row into the `inquiries` table. No auth required — this is
 * a public-facing form for anonymous visitors.
 */
"use server";

import { db } from "@/db";
import { inquiries } from "@/db/schema";

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
}) {
  const category = interestMap[data.interest] ?? null;

  await db.insert(inquiries).values({
    name: data.name,
    email: data.email,
    interest: category,
    message: `[${data.interest}] ${data.message}`,
    status: "new",
  });

  return { success: true };
}
