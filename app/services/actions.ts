/**
 * Public server actions for the /services page.
 * No authentication required — reads only active, published services.
 */
"use server";

import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";

export type PublicService = {
  id: number;
  category: string;
  name: string;
  description: string | null;
  priceInCents: number | null;
  priceMinInCents: number | null;
  priceMaxInCents: number | null;
  durationMinutes: number | null;
};

export async function getPublishedServices(): Promise<PublicService[]> {
  return db
    .select({
      id: services.id,
      category: services.category,
      name: services.name,
      description: services.description,
      priceInCents: services.priceInCents,
      priceMinInCents: services.priceMinInCents,
      priceMaxInCents: services.priceMaxInCents,
      durationMinutes: services.durationMinutes,
    })
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.category), asc(services.sortOrder));
}
