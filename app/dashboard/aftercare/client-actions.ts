"use server";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { policies } from "@/db/schema";

export type ClientAftercareSection = {
  id: number;
  title: string;
  category: string | null;
  dos: string[];
  donts: string[];
};

function parseAftercareContent(raw: string): { dos: string[]; donts: string[] } {
  try {
    const parsed = JSON.parse(raw);
    return {
      dos: Array.isArray(parsed.dos) ? parsed.dos : [],
      donts: Array.isArray(parsed.donts) ? parsed.donts : [],
    };
  } catch {
    return { dos: [], donts: [] };
  }
}

export async function getClientAftercare(): Promise<ClientAftercareSection[]> {
  const rows = await db
    .select()
    .from(policies)
    .where(and(eq(policies.type, "aftercare"), eq(policies.isPublished, true)))
    .orderBy(asc(policies.sortOrder), asc(policies.id));

  return rows.map((r) => {
    const { dos, donts } = parseAftercareContent(r.content);
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      dos,
      donts,
    };
  });
}
