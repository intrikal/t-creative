/**
 * Public server actions for the /training page.
 * No authentication required — reads only active programs with upcoming sessions.
 */
"use server";

import { eq, asc, and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { trainingPrograms, trainingSessions, trainingModules } from "@/db/schema";

export type PublicProgram = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  format: string;
  durationHours: number | null;
  durationDays: number | null;
  priceInCents: number | null;
  certificationProvided: boolean;
  kitIncluded: boolean;
  maxStudents: number | null;
  /** Upcoming session info */
  nextSession: {
    startsAt: string;
    location: string | null;
    meetingUrl: string | null;
  } | null;
  /** Curriculum module names */
  curriculum: string[];
};

export async function getPublishedPrograms(): Promise<PublicProgram[]> {
  const now = new Date();

  // Fetch active programs
  const programs = await db
    .select()
    .from(trainingPrograms)
    .where(eq(trainingPrograms.isActive, true))
    .orderBy(asc(trainingPrograms.sortOrder));

  if (programs.length === 0) return [];

  const programIds = programs.map((p) => p.id);

  // Fetch upcoming sessions for these programs
  const sessions = await db
    .select({
      programId: trainingSessions.programId,
      startsAt: trainingSessions.startsAt,
      location: trainingSessions.location,
      meetingUrl: trainingSessions.meetingUrl,
    })
    .from(trainingSessions)
    .where(and(gte(trainingSessions.startsAt, now), eq(trainingSessions.status, "scheduled")))
    .orderBy(asc(trainingSessions.startsAt));

  // Group sessions by program, take the nearest upcoming
  const nextSessionMap = new Map<number, (typeof sessions)[number]>();
  for (const s of sessions) {
    if (programIds.includes(s.programId) && !nextSessionMap.has(s.programId)) {
      nextSessionMap.set(s.programId, s);
    }
  }

  // Fetch curriculum modules
  const modules = await db
    .select({
      programId: trainingModules.programId,
      name: trainingModules.name,
      sortOrder: trainingModules.sortOrder,
    })
    .from(trainingModules)
    .orderBy(asc(trainingModules.programId), asc(trainingModules.sortOrder));

  const curriculumMap = new Map<number, string[]>();
  for (const m of modules) {
    if (!programIds.includes(m.programId)) continue;
    const list = curriculumMap.get(m.programId) ?? [];
    list.push(m.name);
    curriculumMap.set(m.programId, list);
  }

  return programs.map((p) => {
    const session = nextSessionMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      category: p.category,
      format: p.format,
      durationHours: p.durationHours,
      durationDays: p.durationDays,
      priceInCents: p.priceInCents,
      certificationProvided: p.certificationProvided,
      kitIncluded: p.kitIncluded,
      maxStudents: p.maxStudents,
      nextSession: session
        ? {
            startsAt: session.startsAt.toISOString(),
            location: session.location,
            meetingUrl: session.meetingUrl,
          }
        : null,
      curriculum: curriculumMap.get(p.id) ?? [],
    };
  });
}
