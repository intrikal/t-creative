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
  trainingModules,
  trainingLessons,
  enrollments,
  certificates,
  sessionAttendance,
  lessonCompletions,
  profiles,
} from "@/db/schema";
import { EnrollmentConfirmation } from "@/emails/EnrollmentConfirmation";
import { sendEmail, getEmailRecipient } from "@/lib/resend";
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
  revalidatePath("/training");
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
  revalidatePath("/training");
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
  revalidatePath("/training");
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
  revalidatePath("/training");
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

  // Send enrollment confirmation email (non-fatal)
  try {
    const recipient = await getEmailRecipient(form.clientId);
    if (recipient) {
      const [program] = await db
        .select({
          name: trainingPrograms.name,
          priceInCents: trainingPrograms.priceInCents,
        })
        .from(trainingPrograms)
        .where(eq(trainingPrograms.id, form.programId));

      if (program) {
        await sendEmail({
          to: recipient.email,
          subject: `Enrollment confirmed — ${program.name} — T Creative`,
          react: EnrollmentConfirmation({
            clientName: recipient.firstName,
            programName: program.name,
            format: "In Person",
            priceInCents: program.priceInCents ?? 0,
          }),
          entityType: "enrollment_confirmation",
          localId: `${form.clientId}-${form.programId}`,
        });
      }
    }
  } catch {
    // Non-fatal
  }

  revalidatePath(PATH);
  revalidatePath("/training");
}

export async function deleteEnrollment(id: number) {
  await getUser();
  await db.delete(enrollments).where(eq(enrollments.id, id));
  revalidatePath(PATH);
  revalidatePath("/training");
}

/* ------------------------------------------------------------------ */
/*  Assistant training types                                           */
/* ------------------------------------------------------------------ */

export type AssistantLesson = {
  id: number;
  title: string;
  content: string | null;
  resourceUrl: string | null;
  durationMin: number;
  completed: boolean;
};

export type AssistantModule = {
  id: number;
  title: string;
  description: string;
  category: string;
  status: "completed" | "in_progress" | "available" | "locked";
  lessons: AssistantLesson[];
  dueDate?: string;
  completedDate?: string;
};

export type AssistantTrainingData = {
  modules: AssistantModule[];
  stats: {
    modulesCompleted: number;
    modulesTotal: number;
    lessonsCompleted: number;
    lessonsTotal: number;
    certificates: number;
  };
};

/* ------------------------------------------------------------------ */
/*  Assistant training queries                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetches all training modules + lessons for the logged-in assistant,
 * enriched with their per-lesson completion status.
 *
 * Enrolled programs → available/in_progress/completed.
 * Non-enrolled programs → locked.
 */
export async function getAssistantTraining(): Promise<AssistantTrainingData> {
  const user = await getUser();

  // 1. Get all programs with their modules and lessons
  const allPrograms = await db
    .select({
      programId: trainingPrograms.id,
      programName: trainingPrograms.name,
      programCategory: trainingPrograms.category,
      moduleId: trainingModules.id,
      moduleName: trainingModules.name,
      moduleDescription: trainingModules.description,
      moduleSortOrder: trainingModules.sortOrder,
      lessonId: trainingLessons.id,
      lessonTitle: trainingLessons.title,
      lessonContent: trainingLessons.content,
      lessonResourceUrl: trainingLessons.resourceUrl,
      lessonDurationMin: trainingLessons.durationMinutes,
      lessonSortOrder: trainingLessons.sortOrder,
    })
    .from(trainingPrograms)
    .innerJoin(trainingModules, eq(trainingModules.programId, trainingPrograms.id))
    .innerJoin(trainingLessons, eq(trainingLessons.moduleId, trainingModules.id))
    .where(eq(trainingPrograms.isActive, true))
    .orderBy(
      asc(trainingPrograms.sortOrder),
      asc(trainingModules.sortOrder),
      asc(trainingLessons.sortOrder),
    );

  // 2. Get assistant's enrollments
  const assistantEnrollments = await db
    .select({
      programId: enrollments.programId,
      status: enrollments.status,
      completedAt: enrollments.completedAt,
    })
    .from(enrollments)
    .where(eq(enrollments.clientId, user.id));

  const enrollmentMap = new Map(assistantEnrollments.map((e) => [e.programId, e]));

  // 3. Get assistant's lesson completions
  const completions = await db
    .select({ lessonId: lessonCompletions.lessonId })
    .from(lessonCompletions)
    .where(eq(lessonCompletions.profileId, user.id));

  const completedLessonIds = new Set(completions.map((c) => c.lessonId));

  // 4. Get next session date per program (for due date)
  const now = new Date();
  const upcomingSessions = await db
    .select({
      programId: trainingSessions.programId,
      startsAt: sql<Date>`min(${trainingSessions.startsAt})`.as("next_session"),
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.status, "scheduled"),
        sql`${trainingSessions.startsAt} >= ${now.toISOString()}`,
      ),
    )
    .groupBy(trainingSessions.programId);

  const nextSessionMap = new Map(upcomingSessions.map((s) => [s.programId, new Date(s.startsAt)]));

  // 5. Get certificates for this assistant
  const certs = await db
    .select({ programId: certificates.programId })
    .from(certificates)
    .where(eq(certificates.clientId, user.id));

  const certProgramIds = new Set(certs.map((c) => c.programId));

  // 6. Group rows into modules
  const moduleMap = new Map<
    number,
    {
      programId: number;
      category: string;
      title: string;
      description: string;
      sortOrder: number;
      lessons: AssistantLesson[];
    }
  >();

  for (const row of allPrograms) {
    if (!row.moduleId || !row.lessonId) continue;

    if (!moduleMap.has(row.moduleId)) {
      moduleMap.set(row.moduleId, {
        programId: row.programId,
        category: row.programCategory ?? "lash",
        title: row.moduleName,
        description: row.moduleDescription ?? "",
        sortOrder: row.moduleSortOrder,
        lessons: [],
      });
    }

    moduleMap.get(row.moduleId)!.lessons.push({
      id: row.lessonId,
      title: row.lessonTitle,
      content: row.lessonContent,
      resourceUrl: row.lessonResourceUrl,
      durationMin: row.lessonDurationMin ?? 10,
      completed: completedLessonIds.has(row.lessonId),
    });
  }

  // 7. Build final module list
  const modules: AssistantModule[] = [];
  for (const [moduleId, mod] of moduleMap) {
    const enrollment = enrollmentMap.get(mod.programId);
    const allLessonsDone = mod.lessons.every((l) => l.completed);
    const anyStarted = mod.lessons.some((l) => l.completed);
    const nextSession = nextSessionMap.get(mod.programId);

    let status: AssistantModule["status"];
    if (!enrollment) {
      status = "locked";
    } else if (allLessonsDone) {
      status = "completed";
    } else if (anyStarted) {
      status = "in_progress";
    } else {
      status = "available";
    }

    const completedDate =
      allLessonsDone && enrollment?.completedAt
        ? new Date(enrollment.completedAt).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })
        : allLessonsDone
          ? new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })
          : undefined;

    modules.push({
      id: moduleId,
      title: mod.title,
      description: mod.description,
      category: CATEGORY_TO_TYPE[mod.category] ?? mod.category,
      status,
      lessons: mod.lessons,
      dueDate: nextSession
        ? nextSession.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : undefined,
      completedDate,
    });
  }

  // Sort: available/in_progress first, then completed, then locked
  const statusOrder = { in_progress: 0, available: 1, completed: 2, locked: 3 };
  modules.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const totalLessons = modules.flatMap((m) => m.lessons).length;
  const totalCompletedLessons = modules.flatMap((m) => m.lessons).filter((l) => l.completed).length;
  const completedModules = modules.filter((m) => m.status === "completed").length;

  return {
    modules,
    stats: {
      modulesCompleted: completedModules,
      modulesTotal: modules.length,
      lessonsCompleted: totalCompletedLessons,
      lessonsTotal: totalLessons,
      certificates: certProgramIds.size,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Assistant lesson completion mutation                               */
/* ------------------------------------------------------------------ */

/**
 * Toggles a lesson's completion status for the logged-in assistant.
 * Inserts a `lessonCompletions` row if not completed, deletes it if already completed.
 */
export async function toggleLessonCompletion(lessonId: number) {
  const user = await getUser();

  const existing = await db
    .select({ id: lessonCompletions.id })
    .from(lessonCompletions)
    .where(and(eq(lessonCompletions.profileId, user.id), eq(lessonCompletions.lessonId, lessonId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(lessonCompletions).where(eq(lessonCompletions.id, existing[0].id));
  } else {
    await db.insert(lessonCompletions).values({
      profileId: user.id,
      lessonId,
    });
  }

  revalidatePath(PATH);
  revalidatePath("/training");
}
