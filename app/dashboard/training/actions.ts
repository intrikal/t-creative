/**
 * Server actions for the Training dashboard (`/dashboard/training`).
 *
 * Programs tab: CRUD against `training_programs` + `training_sessions`.
 * Students tab: Enrollments CRUD with delete-protected programs.
 *
 * @module training/actions
 * @see {@link ./TrainingPage.tsx} — client component
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, asc, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  trainingPrograms,
  trainingSessions,
  enrollments,
  certificates,
  sessionAttendance,
  profiles,
} from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

const PATH = "/dashboard/training";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ProgramType = "lash" | "jewelry" | "business" | "crochet";
export type StudentStatus = "active" | "completed" | "paused" | "waitlist";

export type ProgramRow = {
  id: number;
  name: string;
  type: ProgramType;
  price: number;
  sessions: number;
  description: string;
  active: boolean;
  maxSpots: number;
  waitlistOpen: boolean;
};

export type SessionRow = {
  id: number;
  date: string;
  topic: string;
  status: "completed" | "upcoming" | "cancelled";
  notes?: string;
};

export type StudentRow = {
  id: number;
  name: string;
  initials: string;
  program: ProgramType;
  programId: number;
  status: StudentStatus;
  enrolled: string;
  sessionsCompleted: number;
  sessionsTotal: number;
  amountPaid: number;
  amountTotal: number;
  certified: boolean;
  certDate?: string;
  sessions: SessionRow[];
};

export type TrainingStats = {
  activeStudents: number;
  waitlistStudents: number;
  certified: number;
  revenue: number;
};

export type ClientOption = {
  id: string;
  name: string;
  initials: string;
};

/* ------------------------------------------------------------------ */
/*  Mapping helpers                                                    */
/* ------------------------------------------------------------------ */

/** DB service_category → UI ProgramType */
const CATEGORY_TO_TYPE: Record<string, ProgramType> = {
  lash: "lash",
  jewelry: "jewelry",
  consulting: "business",
  crochet: "crochet",
};

/** UI ProgramType → DB service_category */
const TYPE_TO_CATEGORY: Record<ProgramType, string> = {
  lash: "lash",
  jewelry: "jewelry",
  business: "consulting",
  crochet: "crochet",
};

function enrollmentStatusToUI(dbStatus: string): StudentStatus {
  switch (dbStatus) {
    case "waitlisted":
      return "waitlist";
    case "enrolled":
    case "in_progress":
      return "active";
    case "completed":
      return "completed";
    case "withdrawn":
      return "paused";
    default:
      return "active";
  }
}

function uiStatusToEnrollment(uiStatus: StudentStatus): string {
  switch (uiStatus) {
    case "waitlist":
      return "waitlisted";
    case "active":
      return "enrolled";
    case "completed":
      return "completed";
    case "paused":
      return "withdrawn";
  }
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 200) + `-${Date.now()}`
  );
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getPrograms(): Promise<ProgramRow[]> {
  await getUser();

  const rows = await db
    .select({
      id: trainingPrograms.id,
      name: trainingPrograms.name,
      category: trainingPrograms.category,
      priceInCents: trainingPrograms.priceInCents,
      description: trainingPrograms.description,
      isActive: trainingPrograms.isActive,
      maxStudents: trainingPrograms.maxStudents,
    })
    .from(trainingPrograms)
    .orderBy(asc(trainingPrograms.sortOrder), asc(trainingPrograms.name));

  // Session counts per program
  const sessionCounts = await db
    .select({
      programId: trainingSessions.programId,
      count: sql<number>`count(*)`,
    })
    .from(trainingSessions)
    .groupBy(trainingSessions.programId);

  const sessionCountMap = new Map(sessionCounts.map((r) => [r.programId, Number(r.count)]));

  // Waitlist status — true if any scheduled session has isWaitlistOpen
  const waitlistRows = await db
    .select({
      programId: trainingSessions.programId,
      anyOpen: sql<boolean>`bool_or(${trainingSessions.isWaitlistOpen})`,
    })
    .from(trainingSessions)
    .where(eq(trainingSessions.status, "scheduled"))
    .groupBy(trainingSessions.programId);

  const waitlistMap = new Map(waitlistRows.map((r) => [r.programId, r.anyOpen]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: CATEGORY_TO_TYPE[r.category ?? ""] ?? "lash",
    price: (r.priceInCents ?? 0) / 100,
    sessions: sessionCountMap.get(r.id) ?? 0,
    description: r.description ?? "",
    active: r.isActive,
    maxSpots: r.maxStudents ?? 6,
    waitlistOpen: waitlistMap.get(r.id) ?? false,
  }));
}

export async function getStudents(): Promise<StudentRow[]> {
  await getUser();

  // Enrollments + profiles + programs
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      programId: enrollments.programId,
      programCategory: trainingPrograms.category,
      programPriceInCents: trainingPrograms.priceInCents,
      enrollmentStatus: enrollments.status,
      enrolledAt: enrollments.enrolledAt,
      sessionsCompleted: enrollments.sessionsCompleted,
      amountPaidInCents: enrollments.amountPaidInCents,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(enrollments.clientId, profiles.id))
    .innerJoin(trainingPrograms, eq(enrollments.programId, trainingPrograms.id))
    .orderBy(desc(enrollments.enrolledAt));

  // Session counts per program
  const sessionCounts = await db
    .select({
      programId: trainingSessions.programId,
      count: sql<number>`count(*)`,
    })
    .from(trainingSessions)
    .groupBy(trainingSessions.programId);

  const sessionCountMap = new Map(sessionCounts.map((r) => [r.programId, Number(r.count)]));

  // Certificates
  const certs = await db
    .select({
      enrollmentId: certificates.enrollmentId,
      issuedAt: certificates.issuedAt,
    })
    .from(certificates);

  const certMap = new Map(certs.map((c) => [c.enrollmentId, c.issuedAt]));

  // All sessions (for session log)
  const allSessions = await db
    .select({
      id: trainingSessions.id,
      programId: trainingSessions.programId,
      status: trainingSessions.status,
      startsAt: trainingSessions.startsAt,
      notes: trainingSessions.notes,
      location: trainingSessions.location,
    })
    .from(trainingSessions)
    .orderBy(asc(trainingSessions.startsAt));

  // Attendance records
  const attendanceRows = await db
    .select({
      sessionId: sessionAttendance.sessionId,
      enrollmentId: sessionAttendance.enrollmentId,
      attended: sessionAttendance.attended,
      notes: sessionAttendance.notes,
    })
    .from(sessionAttendance);

  // Build attendance lookup: enrollmentId → sessionId → record
  const attendanceMap = new Map<number, Map<number, { attended: boolean; notes: string | null }>>();
  for (const a of attendanceRows) {
    if (!attendanceMap.has(a.enrollmentId)) attendanceMap.set(a.enrollmentId, new Map());
    attendanceMap.get(a.enrollmentId)!.set(a.sessionId, {
      attended: a.attended,
      notes: a.notes,
    });
  }

  // Group sessions by program
  const sessionsByProgram = new Map<number, typeof allSessions>();
  for (const s of allSessions) {
    if (!sessionsByProgram.has(s.programId)) sessionsByProgram.set(s.programId, []);
    sessionsByProgram.get(s.programId)!.push(s);
  }

  return rows.map((r) => {
    const first = r.firstName ?? "";
    const last = r.lastName ?? "";
    const name = [first, last].filter(Boolean).join(" ");
    const initials = [first[0], last[0]].filter(Boolean).join("").toUpperCase() || "?";

    const certDate = certMap.get(r.enrollmentId);

    // Build session log
    const programSessions = sessionsByProgram.get(r.programId) ?? [];
    const enrollmentAttendance = attendanceMap.get(r.enrollmentId);
    const sessions: SessionRow[] = programSessions.map((s, idx) => {
      const att = enrollmentAttendance?.get(s.id);
      let status: "completed" | "upcoming" | "cancelled";

      if (s.status === "cancelled") {
        status = "cancelled";
      } else if (att?.attended) {
        status = "completed";
      } else if (s.status === "completed") {
        status = "completed";
      } else {
        status = "upcoming";
      }

      return {
        id: s.id,
        date: new Date(s.startsAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        topic: s.notes ?? s.location ?? `Session ${idx + 1}`,
        status,
        notes: att?.notes ?? undefined,
      };
    });

    return {
      id: r.enrollmentId,
      name,
      initials,
      program: CATEGORY_TO_TYPE[r.programCategory ?? ""] ?? "lash",
      programId: r.programId,
      status: enrollmentStatusToUI(r.enrollmentStatus),
      enrolled: new Date(r.enrolledAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      sessionsCompleted: r.sessionsCompleted,
      sessionsTotal: sessionCountMap.get(r.programId) ?? 0,
      amountPaid: r.amountPaidInCents / 100,
      amountTotal: (r.programPriceInCents ?? 0) / 100,
      certified: !!certDate,
      certDate: certDate
        ? new Date(certDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : undefined,
      sessions,
    };
  });
}

export async function getTrainingStats(): Promise<TrainingStats> {
  await getUser();

  const [[enrollmentStats], [certStats]] = await Promise.all([
    db
      .select({
        active: sql<number>`count(*) filter (where ${enrollments.status} in ('enrolled', 'in_progress'))`,
        waitlist: sql<number>`count(*) filter (where ${enrollments.status} = 'waitlisted')`,
        revenue: sql<number>`coalesce(sum(${enrollments.amountPaidInCents}), 0)`,
      })
      .from(enrollments),
    db.select({ count: sql<number>`count(*)` }).from(certificates),
  ]);

  return {
    activeStudents: Number(enrollmentStats.active),
    waitlistStudents: Number(enrollmentStats.waitlist),
    certified: Number(certStats.count),
    revenue: Number(enrollmentStats.revenue) / 100,
  };
}

export async function getClients(): Promise<ClientOption[]> {
  await getUser();

  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(eq(profiles.role, "client"))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));

  return rows.map((r) => {
    const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
    const initials =
      [r.firstName?.[0], r.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
    return { id: r.id, name, initials };
  });
}

/* ------------------------------------------------------------------ */
/*  Program mutations                                                  */
/* ------------------------------------------------------------------ */

export type ProgramFormData = {
  name: string;
  type: ProgramType;
  price: number;
  sessions: number;
  description: string;
  active: boolean;
  maxSpots: number;
  waitlistOpen: boolean;
};

export async function createProgram(form: ProgramFormData) {
  await getUser();

  const [program] = await db
    .insert(trainingPrograms)
    .values({
      name: form.name,
      slug: slugify(form.name),
      description: form.description || null,
      category: TYPE_TO_CATEGORY[form.type] as "lash" | "jewelry" | "consulting" | "crochet",
      priceInCents: Math.round(form.price * 100),
      isActive: form.active,
      maxStudents: form.maxSpots,
    })
    .returning({ id: trainingPrograms.id });

  // Create placeholder sessions (weekly from now)
  if (form.sessions > 0 && program) {
    const sessionValues = Array.from({ length: form.sessions }, (_, i) => ({
      programId: program.id,
      startsAt: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
      isWaitlistOpen: form.waitlistOpen,
    }));
    await db.insert(trainingSessions).values(sessionValues);
  }

  revalidatePath(PATH);
}

export async function updateProgram(id: number, form: ProgramFormData) {
  await getUser();

  await db
    .update(trainingPrograms)
    .set({
      name: form.name,
      description: form.description || null,
      category: TYPE_TO_CATEGORY[form.type] as "lash" | "jewelry" | "consulting" | "crochet",
      priceInCents: Math.round(form.price * 100),
      isActive: form.active,
      maxStudents: form.maxSpots,
      updatedAt: new Date(),
    })
    .where(eq(trainingPrograms.id, id));

  // Update waitlist status on all scheduled sessions
  await db
    .update(trainingSessions)
    .set({ isWaitlistOpen: form.waitlistOpen })
    .where(and(eq(trainingSessions.programId, id), eq(trainingSessions.status, "scheduled")));

  revalidatePath(PATH);
}

/**
 * Delete a program — blocked if any non-withdrawn students are enrolled.
 * Returns `{ error }` string when deletion is blocked.
 */
export async function deleteProgram(id: number): Promise<{ error?: string }> {
  await getUser();

  // Check for active enrollments
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(and(eq(enrollments.programId, id), sql`${enrollments.status} != 'withdrawn'`));

  if (Number(count) > 0) {
    return {
      error: `Cannot delete — ${count} student${Number(count) !== 1 ? "s" : ""} enrolled. Remove all enrollments first.`,
    };
  }

  await db.delete(trainingSessions).where(eq(trainingSessions.programId, id));
  await db.delete(trainingPrograms).where(eq(trainingPrograms.id, id));

  revalidatePath(PATH);
  return {};
}

export async function toggleWaitlist(programId: number) {
  await getUser();

  // Get current state from any scheduled session
  const [current] = await db
    .select({ isWaitlistOpen: trainingSessions.isWaitlistOpen })
    .from(trainingSessions)
    .where(and(eq(trainingSessions.programId, programId), eq(trainingSessions.status, "scheduled")))
    .limit(1);

  const newState = current ? !current.isWaitlistOpen : true;

  await db
    .update(trainingSessions)
    .set({ isWaitlistOpen: newState })
    .where(
      and(eq(trainingSessions.programId, programId), eq(trainingSessions.status, "scheduled")),
    );

  revalidatePath(PATH);
}

/* ------------------------------------------------------------------ */
/*  Enrollment mutations                                               */
/* ------------------------------------------------------------------ */

export type EnrollmentFormData = {
  clientId: string;
  programId: number;
  status: StudentStatus;
  amountPaid: number;
};

export async function createEnrollment(form: EnrollmentFormData) {
  await getUser();

  await db.insert(enrollments).values({
    clientId: form.clientId,
    programId: form.programId,
    status: uiStatusToEnrollment(form.status) as
      | "waitlisted"
      | "enrolled"
      | "in_progress"
      | "completed"
      | "withdrawn",
    amountPaidInCents: Math.round(form.amountPaid * 100),
    isPaid: form.amountPaid > 0,
  });

  revalidatePath(PATH);
}

export async function deleteEnrollment(id: number) {
  await getUser();
  await db.delete(enrollments).where(eq(enrollments.id, id));
  revalidatePath(PATH);
}
