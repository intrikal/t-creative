/**
 * app/training/actions.ts — Public cached queries for the /training page.
 *
 * Fetches all active training programs along with their next upcoming session
 * and curriculum modules. No authentication required. Results are cached with
 * a "training" tag and revalidated when programs are updated in the admin dashboard.
 *
 * Tables touched: training_programs (read), training_sessions (read),
 * training_modules (read).
 *
 * @module training/actions
 */
import { cacheTag, cacheLife } from "next/cache";
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

/**
 * Returns all active training programs with their next upcoming session and
 * curriculum module names. Runs 3 sequential queries:
 *
 * Query 1 — Active programs:
 *   SELECT * FROM training_programs
 *   WHERE  isActive = true
 *   ORDER BY sortOrder ASC
 *   → all programs the admin has marked as visible, in display order.
 *
 * Query 2 — Upcoming sessions:
 *   SELECT programId, startsAt, location, meetingUrl
 *   FROM   training_sessions
 *   WHERE  startsAt >= now()              ← only future sessions
 *     AND  status = 'scheduled'           ← not cancelled or completed
 *   ORDER BY startsAt ASC                 ← soonest first
 *   → grouped in JS by programId; only the first (nearest) session per program is kept.
 *
 * Query 3 — Curriculum modules:
 *   SELECT programId, name, sortOrder
 *   FROM   training_modules
 *   ORDER BY programId ASC, sortOrder ASC
 *   → module names grouped by program, used to display the curriculum outline.
 *
 * No JOINs — the three tables are queried independently and merged in JS
 * because a program may have zero sessions or zero modules.
 */
export async function getPublishedPrograms(): Promise<PublicProgram[]> {
  "use cache";
  cacheTag("training");
  cacheLife("hours");

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
