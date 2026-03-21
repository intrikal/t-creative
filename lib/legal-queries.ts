/**
 * Cached queries for legal documents (privacy policy, terms of service).
 */
import { cacheTag, cacheLife } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { legalDocuments } from "@/db/schema";

export async function getLegalDocument(type: "privacy_policy" | "terms_of_service") {
  "use cache";
  cacheTag("legal");
  cacheLife("days");

  const rows = await db
    .select()
    .from(legalDocuments)
    .where(and(eq(legalDocuments.type, type), eq(legalDocuments.isPublished, true)))
    .limit(1);

  return rows[0] ?? null;
}
