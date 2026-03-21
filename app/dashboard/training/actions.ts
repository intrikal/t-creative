/**
 * app/dashboard/training/actions.ts — Server actions for the Training dashboard
 * (`/dashboard/training`) and the assistant training portal.
 *
 * ## Views served
 * - **Admin Programs tab**: CRUD for `training_programs` + auto-generated
 *   `training_sessions` (placeholder weekly sessions created on program creation).
 * - **Admin Students tab**: Enrollment management — create, delete, with
 *   delete-protection on programs that have active enrollments.
 * - **Admin Stats cards**: Active students, waitlist count, certifications issued,
 *   total training revenue.
 * - **Assistant Training view**: Per-lesson progress tracking across enrolled
 *   programs, with module completion status and certificate counts.
 *
 * ## UI ↔ DB status mapping
 * The UI uses simplified statuses ("active", "completed", "paused", "waitlist")
 * while the DB uses the full `enrollment_status` enum. Two mapping functions
 * (`enrollmentStatusToUI` / `uiStatusToEnrollment`) bridge this gap so the
 * database schema can evolve independently of the UI labels.
 *
 * ## Category ↔ ProgramType mapping
 * The DB stores `service_category` enum values ("consulting") while the UI
 * uses friendlier labels ("business"). `CATEGORY_TO_TYPE` / `TYPE_TO_CATEGORY`
 * handle the translation.
 *
 * ## Related files
 * - db/schema/training.ts               — table definitions
 * - app/dashboard/training/TrainingPage  — admin client component
 * - app/dashboard/team/                  — assistant training portal
 */
"use server";

import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, sql, asc, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
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
import { getUser } from "@/lib/auth";
import { sendEmail, getEmailRecipient } from "@/lib/resend";

const PATH = "/dashboard/training";

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

/**
 * Map DB enrollment_status → UI-friendly label.
 * "enrolled" and "in_progress" both show as "active" because the UI
 * doesn't distinguish between newly enrolled and mid-course students.
 */
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

/** Map UI status back to DB enrollment_status for writes. */
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

/**
 * Generate a URL-safe slug with a timestamp suffix to guarantee uniqueness.
 * The timestamp avoids collisions if two programs share the same name
 * (e.g., "Lash Certification" created, deleted, then re-created).
 */
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

/**
 * Fetch all training programs with session counts and waitlist status.
 *
 * Three parallel queries avoid N+1: programs, session counts per program,
 * and waitlist status (aggregated via `bool_or` — true if any scheduled
 * session has its waitlist open). Results are merged via Maps.
 */
export async function getPrograms(): Promise<ProgramRow[]> {
  try {
    await getUser();

    // Promise.all runs three independent queries in parallel — programs, session
    // counts, and waitlist status have no data dependency, so wall-clock time
    // equals the slowest single query instead of the sum of all three.
    const [rows, sessionCounts, waitlistRows] = await Promise.all([
      db
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
        .orderBy(asc(trainingPrograms.sortOrder), asc(trainingPrograms.name)),
      db
        .select({
          programId: trainingSessions.programId,
          count: sql<number>`count(*)`,
        })
        .from(trainingSessions)
        .groupBy(trainingSessions.programId),
      db
        .select({
          programId: trainingSessions.programId,
          anyOpen: sql<boolean>`bool_or(${trainingSessions.isWaitlistOpen})`,
        })
        .from(trainingSessions)
        .where(eq(trainingSessions.status, "scheduled"))
        .groupBy(trainingSessions.programId),
    ]);

    // Build Map<programId, count> for O(1) session-count lookups when merging
    // into program rows below — avoids O(n*m) nested scanning.
    const sessionCountMap = new Map(sessionCounts.map((r) => [r.programId, Number(r.count)]));
    // Build Map<programId, bool> for O(1) waitlist-status lookups.
    const waitlistMap = new Map(waitlistRows.map((r) => [r.programId, r.anyOpen]));

    // Transform each DB row into a UI-friendly ProgramRow by mapping the DB
    // category enum to UI ProgramType, converting cents to dollars, and merging
    // in session counts + waitlist status from the two Maps built above.
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Fetch all enrolled students with their session progress and certification status.
 *
 * Five parallel queries pull enrollments, session counts, certificates,
 * all sessions (for the per-student session log), and attendance records.
 * The session log merges attendance data to determine per-session status:
 * attended → "completed", cancelled → "cancelled", otherwise → "upcoming".
 *
 * Session topic falls back to location then "Session N" when notes are empty,
 * giving the UI a reasonable label even for sessions with no metadata.
 */
export async function getStudents(): Promise<StudentRow[]> {
  try {
    await getUser();

    // Promise.all fires five independent queries in parallel — enrollments,
    // session counts, certificates, all sessions, and attendance records share
    // no data dependencies, so total latency equals the slowest query.
    const [rows, sessionCounts, certs, allSessions, attendanceRows] = await Promise.all([
      // Enrollments + profiles + programs
      db
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
        .orderBy(desc(enrollments.enrolledAt)),
      // Session counts per program
      db
        .select({
          programId: trainingSessions.programId,
          count: sql<number>`count(*)`,
        })
        .from(trainingSessions)
        .groupBy(trainingSessions.programId),
      // Certificates
      db
        .select({
          enrollmentId: certificates.enrollmentId,
          issuedAt: certificates.issuedAt,
        })
        .from(certificates),
      // All sessions (for session log)
      db
        .select({
          id: trainingSessions.id,
          programId: trainingSessions.programId,
          status: trainingSessions.status,
          startsAt: trainingSessions.startsAt,
          notes: trainingSessions.notes,
          location: trainingSessions.location,
        })
        .from(trainingSessions)
        .orderBy(asc(trainingSessions.startsAt)),
      // Attendance records
      db
        .select({
          sessionId: sessionAttendance.sessionId,
          enrollmentId: sessionAttendance.enrollmentId,
          attended: sessionAttendance.attended,
          notes: sessionAttendance.notes,
        })
        .from(sessionAttendance),
    ]);

    // Build Map<programId, sessionCount> for O(1) lookups during row assembly.
    const sessionCountMap = new Map(sessionCounts.map((r) => [r.programId, Number(r.count)]));
    // Build Map<enrollmentId, issuedAt> so we can check certification status per
    // enrollment in O(1) without scanning the certs array for each student.
    const certMap = new Map(certs.map((c) => [c.enrollmentId, c.issuedAt]));

    // Build attendance lookup: enrollmentId → sessionId → record
    const attendanceMap = new Map<
      number,
      Map<number, { attended: boolean; notes: string | null }>
    >();
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

    // Transform each enrollment DB row into a UI-friendly StudentRow by:
    // - Building display name/initials from nullable first/last name columns
    //   (.filter(Boolean) drops empty strings so "Jane" + "" becomes "Jane" not "Jane ")
    // - Mapping DB enrollment_status to simplified UI status via enrollmentStatusToUI
    // - Converting cents to dollars for amountPaid/amountTotal
    // - Merging session log + attendance + certificate data from the Maps above
    return rows.map((r) => {
      const first = r.firstName ?? "";
      const last = r.lastName ?? "";
      // .filter(Boolean) strips empty strings so a missing last name doesn't
      // produce a trailing space in the display name.
      const name = [first, last].filter(Boolean).join(" ");
      // Extract first character of each name part for avatar initials;
      // .filter(Boolean) handles cases where first or last name is empty.
      const initials = [first[0], last[0]].filter(Boolean).join("").toUpperCase() || "?";

      const certDate = certMap.get(r.enrollmentId);

      // Build session log
      const programSessions = sessionsByProgram.get(r.programId) ?? [];
      const enrollmentAttendance = attendanceMap.get(r.enrollmentId);
      // Transform each program session into a SessionRow, merging attendance data
      // to determine per-session status (attended → completed, cancelled → cancelled,
      // otherwise → upcoming). Topic falls back through notes → location → "Session N".
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Aggregate training dashboard stats: active students, waitlist count,
 * certifications issued, and total revenue. Feeds the summary cards
 * at the top of the Training page.
 *
 * Uses SQL `filter (where ...)` clauses to compute multiple aggregates
 * in a single table scan rather than issuing separate queries.
 */
export async function getTrainingStats(): Promise<TrainingStats> {
  try {
    await getUser();

    // Destructuring the first element from each query result — both queries
    // return a single-row aggregate. Promise.all runs them in parallel since
    // enrollment stats and certificate counts are independent queries.
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Fetch all client profiles for the "Enroll Student" dropdown. */
export async function getClients(): Promise<ClientOption[]> {
  try {
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

    // Transform each profile row into a ClientOption for the dropdown.
    // .filter(Boolean) on name parts handles null first/last names gracefully;
    // initials uses optional chaining + filter to safely extract first characters.
    return rows.map((r) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
      const initials =
        [r.firstName?.[0], r.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
      return { id: r.id, name, initials };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
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

const ProgramFormSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["lash", "jewelry", "business", "crochet"]),
  price: z.number().nonnegative(),
  sessions: z.number().int().nonnegative(),
  description: z.string(),
  active: z.boolean(),
  maxSpots: z.number().int().positive(),
  waitlistOpen: z.boolean(),
});

/**
 * Create a new training program and auto-generate placeholder sessions.
 *
 * Sessions are spaced one week apart starting from tomorrow. This gives
 * the admin a starting schedule to customise rather than requiring
 * manual session creation from scratch.
 */
export async function createProgram(form: ProgramFormData) {
  try {
    ProgramFormSchema.parse(form);
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
      // Array.from creates N session objects with weekly spacing — using Array.from
      // instead of a for-loop because we need a typed array of insert values for
      // Drizzle's batch insert, and the index-based date arithmetic is cleaner as
      // a single expression.
      const sessionValues = Array.from({ length: form.sessions }, (_, i) => ({
        programId: program.id,
        startsAt: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
        isWaitlistOpen: form.waitlistOpen,
      }));
      await db.insert(trainingSessions).values(sessionValues);
    }

    revalidatePath(PATH);
    revalidatePath("/dashboard/team");
    updateTag("training");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Update program details and propagate waitlist setting to all scheduled sessions.
 *
 * Only scheduled (not completed/cancelled) sessions are updated — historical
 * sessions retain their original waitlist state for audit accuracy.
 */
export async function updateProgram(id: number, form: ProgramFormData) {
  try {
    z.number().int().positive().parse(id);
    ProgramFormSchema.parse(form);
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
    revalidatePath("/dashboard/team");
    updateTag("training");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Delete a program — blocked if any non-withdrawn students are enrolled.
 * Returns `{ error }` string when deletion is blocked.
 */
export async function deleteProgram(id: number): Promise<{ error?: string }> {
  try {
    z.number().int().positive().parse(id);
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
    revalidatePath("/dashboard/team");
    updateTag("training");
    return {};
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Toggle waitlist open/closed for all scheduled sessions in a program.
 * Reads the current state from any scheduled session and inverts it,
 * ensuring all sessions stay in sync.
 */
export async function toggleWaitlist(programId: number) {
  try {
    z.number().int().positive().parse(programId);
    await getUser();

    // Get current state from any scheduled session
    const [current] = await db
      .select({ isWaitlistOpen: trainingSessions.isWaitlistOpen })
      .from(trainingSessions)
      .where(
        and(eq(trainingSessions.programId, programId), eq(trainingSessions.status, "scheduled")),
      )
      .limit(1);

    const newState = current ? !current.isWaitlistOpen : true;

    await db
      .update(trainingSessions)
      .set({ isWaitlistOpen: newState })
      .where(
        and(eq(trainingSessions.programId, programId), eq(trainingSessions.status, "scheduled")),
      );

    revalidatePath(PATH);
    revalidatePath("/dashboard/team");
    updateTag("training");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
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

const EnrollmentFormSchema = z.object({
  clientId: z.string().min(1),
  programId: z.number().int().positive(),
  status: z.enum(["active", "completed", "paused", "waitlist"]),
  amountPaid: z.number().nonnegative(),
});

/**
 * Enroll a student in a training program.
 *
 * Sets `isPaid: true` when any amount is paid upfront — partial payments
 * are supported (e.g., $600 of $1,200). A confirmation email is sent
 * asynchronously; failures are swallowed so the enrollment still succeeds.
 */
export async function createEnrollment(form: EnrollmentFormData) {
  try {
    EnrollmentFormSchema.parse(form);
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
          const bp = await getPublicBusinessProfile();
          await sendEmail({
            to: recipient.email,
            subject: `Enrollment confirmed — ${program.name} — ${bp.businessName}`,
            react: EnrollmentConfirmation({
              clientName: recipient.firstName,
              programName: program.name,
              format: "In Person",
              priceInCents: program.priceInCents ?? 0,
              businessName: bp.businessName,
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
    revalidatePath("/dashboard/team");
    updateTag("training");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Remove an enrollment. Cascades to attendance records via FK. */
export async function deleteEnrollment(id: number) {
  try {
    z.number().int().positive().parse(id);
    await getUser();
    await db.delete(enrollments).where(eq(enrollments.id, id));
    revalidatePath(PATH);
    revalidatePath("/dashboard/team");
    updateTag("training");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
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
  try {
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

    // Build Map<programId, enrollment> for O(1) lookups when determining each
    // module's lock/available/in_progress/completed status below.
    const enrollmentMap = new Map(assistantEnrollments.map((e) => [e.programId, e]));

    // 3. Get assistant's lesson completions
    const completions = await db
      .select({ lessonId: lessonCompletions.lessonId })
      .from(lessonCompletions)
      .where(eq(lessonCompletions.profileId, user.id));

    // Build Set<lessonId> for O(1) completion checks — .has() is called once
    // per lesson when constructing the module map below.
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

    // Build Map<programId, nextSessionDate> — .map() extracts the programId
    // and parses the date for O(1) due-date lookups per module.
    const nextSessionMap = new Map(
      upcomingSessions.map((s) => [s.programId, new Date(s.startsAt)]),
    );

    // 5. Get certificates for this assistant
    const certs = await db
      .select({ programId: certificates.programId })
      .from(certificates)
      .where(eq(certificates.clientId, user.id));

    // Build Set<programId> for O(1) certificate existence checks.
    // .size is used as the total certificate count in the stats output.
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
      // .every() checks if all lessons in this module are completed (→ "completed" status).
      // .some() checks if at least one lesson is completed (→ "in_progress" status).
      // Using both avoids a .reduce() with counter tracking — clearer intent.
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

    // Sort: available/in_progress first, then completed, then locked.
    // Using a numeric priority map with .sort() comparator — O(n log n).
    // This ordering surfaces actionable modules at the top of the UI list.
    const statusOrder = { in_progress: 0, available: 1, completed: 2, locked: 3 };
    modules.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // .flatMap() flattens nested module→lessons into a single array so we can
    // count total and completed lessons across all modules without nested loops.
    const totalLessons = modules.flatMap((m) => m.lessons).length;
    // Chain .flatMap() → .filter() to count only completed lessons across all modules.
    const totalCompletedLessons = modules
      .flatMap((m) => m.lessons)
      .filter((l) => l.completed).length;
    // .filter() counts modules with "completed" status for the stats summary card.
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Assistant lesson completion mutation                               */
/* ------------------------------------------------------------------ */

/**
 * Toggles a lesson's completion status for the logged-in assistant.
 * Inserts a `lessonCompletions` row if not completed, deletes it if already completed.
 */
export async function toggleLessonCompletion(lessonId: number) {
  try {
    z.number().int().positive().parse(lessonId);
    const user = await getUser();

    const existing = await db
      .select({ id: lessonCompletions.id })
      .from(lessonCompletions)
      .where(
        and(eq(lessonCompletions.profileId, user.id), eq(lessonCompletions.lessonId, lessonId)),
      )
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
    revalidatePath("/dashboard/team");
    updateTag("training");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
