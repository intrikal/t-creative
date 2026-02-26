"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc, asc, sql, ne, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  trainingPrograms,
  trainingSessions,
  trainingModules,
  trainingLessons,
  enrollments,
  certificates,
  profiles,
} from "@/db/schema";
import { trackEvent } from "@/lib/posthog";
import { createZohoDeal } from "@/lib/zoho";
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
export type EnrollStatus = "enrolled" | "waitlist" | "in_progress" | "completed" | null;

export type ClientProgram = {
  id: number;
  name: string;
  type: ProgramType;
  price: number;
  description: string;
  format: string;
  certificationProvided: boolean;
  kitIncluded: boolean;
  maxSpots: number;
  spotsLeft: number;
  waitlistOpen: boolean;
  modules: { name: string; description: string | null; lessonCount: number }[];
  /** Next upcoming session for this program */
  nextSession: {
    startsAt: string;
    location: string | null;
    schedule: string | null;
  } | null;
};

export type ClientEnrollment = {
  id: number;
  programId: number;
  programName: string;
  programType: ProgramType;
  status: EnrollStatus;
  progressPercent: number;
  sessionsCompleted: number;
  amountPaidCents: number;
  totalPriceCents: number;
  sessionStartsAt: string | null;
  sessionLocation: string | null;
};

export type ClientCertificate = {
  id: number;
  programName: string;
  programType: ProgramType;
  certificateCode: string;
  pdfUrl: string | null;
  issuedAt: string;
};

export type ClientTrainingData = {
  programs: ClientProgram[];
  enrollments: ClientEnrollment[];
  certificates: ClientCertificate[];
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

function mapCategory(cat: string | null): ProgramType {
  if (cat === "lash") return "lash";
  if (cat === "jewelry") return "jewelry";
  if (cat === "crochet") return "crochet";
  return "business"; // consulting → business
}

export async function getClientTraining(): Promise<ClientTrainingData> {
  const user = await getUser();

  // 1. Active programs with next session info
  const programRows = await db
    .select({
      id: trainingPrograms.id,
      name: trainingPrograms.name,
      description: trainingPrograms.description,
      category: trainingPrograms.category,
      format: trainingPrograms.format,
      priceInCents: trainingPrograms.priceInCents,
      maxStudents: trainingPrograms.maxStudents,
      certificationProvided: trainingPrograms.certificationProvided,
      kitIncluded: trainingPrograms.kitIncluded,
    })
    .from(trainingPrograms)
    .where(eq(trainingPrograms.isActive, true))
    .orderBy(asc(trainingPrograms.sortOrder));

  // 2. Modules + lesson counts per program
  const moduleRows = await db
    .select({
      programId: trainingModules.programId,
      name: trainingModules.name,
      description: trainingModules.description,
      sortOrder: trainingModules.sortOrder,
      moduleId: trainingModules.id,
    })
    .from(trainingModules)
    .orderBy(asc(trainingModules.sortOrder));

  const lessonCounts = await db
    .select({
      moduleId: trainingLessons.moduleId,
      count: sql<number>`count(*)`,
    })
    .from(trainingLessons)
    .groupBy(trainingLessons.moduleId);

  const lessonCountMap = new Map(lessonCounts.map((r) => [r.moduleId, Number(r.count)]));

  // 3. Next scheduled session per program
  const now = new Date();
  const upcomingSessions = await db
    .select({
      programId: trainingSessions.programId,
      startsAt: trainingSessions.startsAt,
      location: trainingSessions.location,
      materials: trainingSessions.materials,
      maxStudents: trainingSessions.maxStudents,
      isWaitlistOpen: trainingSessions.isWaitlistOpen,
      id: trainingSessions.id,
    })
    .from(trainingSessions)
    .where(and(eq(trainingSessions.status, "scheduled"), gte(trainingSessions.startsAt, now)))
    .orderBy(asc(trainingSessions.startsAt));

  // Group next session per program
  const nextSessionMap = new Map<number, (typeof upcomingSessions)[number]>();
  for (const s of upcomingSessions) {
    if (!nextSessionMap.has(s.programId)) {
      nextSessionMap.set(s.programId, s);
    }
  }

  // 4. Enrollment counts per session (for spots calculation)
  const enrollmentCounts = await db
    .select({
      sessionId: enrollments.sessionId,
      count: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(ne(enrollments.status, "withdrawn"))
    .groupBy(enrollments.sessionId);

  const enrollCountMap = new Map(
    enrollmentCounts
      .filter((r) => r.sessionId !== null)
      .map((r) => [r.sessionId!, Number(r.count)]),
  );

  // Also count enrollments per program (for programs without sessions)
  const programEnrollCounts = await db
    .select({
      programId: enrollments.programId,
      count: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(ne(enrollments.status, "withdrawn"))
    .groupBy(enrollments.programId);

  const programEnrollMap = new Map(programEnrollCounts.map((r) => [r.programId, Number(r.count)]));

  // Build programs list
  const programs: ClientProgram[] = programRows.map((p) => {
    const nextSess = nextSessionMap.get(p.id);
    const maxSpots = nextSess?.maxStudents ?? p.maxStudents ?? 10;
    const enrolled = nextSess
      ? (enrollCountMap.get(nextSess.id) ?? 0)
      : (programEnrollMap.get(p.id) ?? 0);
    const spotsLeft = Math.max(0, maxSpots - enrolled);
    const waitlistOpen = nextSess?.isWaitlistOpen ?? true;

    const programModules = moduleRows
      .filter((m) => m.programId === p.id)
      .map((m) => ({
        name: m.name,
        description: m.description,
        lessonCount: lessonCountMap.get(m.moduleId) ?? 0,
      }));

    let sessionInfo: ClientProgram["nextSession"] = null;
    if (nextSess) {
      const d = new Date(nextSess.startsAt);
      const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const MON = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      sessionInfo = {
        startsAt: `${DAY[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
        location: nextSess.location,
        schedule: nextSess.materials,
      };
    }

    return {
      id: p.id,
      name: p.name,
      type: mapCategory(p.category),
      price: (p.priceInCents ?? 0) / 100,
      description: p.description ?? "",
      format: p.format,
      certificationProvided: p.certificationProvided,
      kitIncluded: p.kitIncluded,
      maxSpots,
      spotsLeft,
      waitlistOpen,
      modules: programModules,
      nextSession: sessionInfo,
    };
  });

  // 5. Client's enrollments
  const enrollmentRows = await db
    .select({
      id: enrollments.id,
      programId: enrollments.programId,
      status: enrollments.status,
      progressPercent: enrollments.progressPercent,
      sessionsCompleted: enrollments.sessionsCompleted,
      amountPaidInCents: enrollments.amountPaidInCents,
      programName: trainingPrograms.name,
      programCategory: trainingPrograms.category,
      programPrice: trainingPrograms.priceInCents,
      sessionStartsAt: trainingSessions.startsAt,
      sessionLocation: trainingSessions.location,
    })
    .from(enrollments)
    .leftJoin(trainingPrograms, eq(enrollments.programId, trainingPrograms.id))
    .leftJoin(trainingSessions, eq(enrollments.sessionId, trainingSessions.id))
    .where(eq(enrollments.clientId, user.id))
    .orderBy(desc(enrollments.enrolledAt));

  const clientEnrollments: ClientEnrollment[] = enrollmentRows.map((r) => {
    let status: EnrollStatus = null;
    if (r.status === "waitlisted") status = "waitlist";
    else if (r.status === "enrolled") status = "enrolled";
    else if (r.status === "in_progress") status = "in_progress";
    else if (r.status === "completed") status = "completed";

    return {
      id: r.id,
      programId: r.programId,
      programName: r.programName ?? "Program",
      programType: mapCategory(r.programCategory),
      status,
      progressPercent: r.progressPercent,
      sessionsCompleted: r.sessionsCompleted,
      amountPaidCents: r.amountPaidInCents,
      totalPriceCents: r.programPrice ?? 0,
      sessionStartsAt: r.sessionStartsAt
        ? new Date(r.sessionStartsAt).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
      sessionLocation: r.sessionLocation,
    };
  });

  // 6. Client's certificates
  const certRows = await db
    .select({
      id: certificates.id,
      certificateCode: certificates.certificateCode,
      pdfStoragePath: certificates.pdfStoragePath,
      issuedAt: certificates.issuedAt,
      programName: trainingPrograms.name,
      programCategory: trainingPrograms.category,
    })
    .from(certificates)
    .leftJoin(trainingPrograms, eq(certificates.programId, trainingPrograms.id))
    .where(eq(certificates.clientId, user.id))
    .orderBy(desc(certificates.issuedAt));

  const clientCertificates: ClientCertificate[] = certRows.map((r) => ({
    id: r.id,
    programName: r.programName ?? "Program",
    programType: mapCategory(r.programCategory),
    certificateCode: r.certificateCode,
    pdfUrl: r.pdfStoragePath,
    issuedAt: new Date(r.issuedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

  return {
    programs,
    enrollments: clientEnrollments,
    certificates: clientCertificates,
  };
}

/* ------------------------------------------------------------------ */
/*  Enroll / Waitlist                                                  */
/* ------------------------------------------------------------------ */

export async function clientEnroll(programId: number) {
  const user = await getUser();

  // Check if already enrolled
  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.clientId, user.id),
        eq(enrollments.programId, programId),
        ne(enrollments.status, "withdrawn"),
      ),
    )
    .limit(1);

  if (existing) throw new Error("Already enrolled in this program");

  // Find next scheduled session
  const [nextSession] = await db
    .select({ id: trainingSessions.id })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.programId, programId),
        eq(trainingSessions.status, "scheduled"),
        gte(trainingSessions.startsAt, new Date()),
      ),
    )
    .orderBy(asc(trainingSessions.startsAt))
    .limit(1);

  await db.insert(enrollments).values({
    clientId: user.id,
    programId,
    sessionId: nextSession?.id ?? null,
    status: "enrolled",
  });

  trackEvent(user.id, "training_enrolled", { programId });

  // Zoho CRM: create deal for training enrollment
  const [program] = await db
    .select({ name: trainingPrograms.name, priceInCents: trainingPrograms.priceInCents })
    .from(trainingPrograms)
    .where(eq(trainingPrograms.id, programId))
    .limit(1);

  const [clientProfile] = await db
    .select({ email: profiles.email, firstName: profiles.firstName })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (clientProfile) {
    createZohoDeal({
      contactEmail: clientProfile.email,
      dealName: `Training: ${program?.name ?? "Program"} — ${clientProfile.firstName}`,
      stage: "Enrolled",
      amountInCents: program?.priceInCents ?? undefined,
      pipeline: "Training",
    });
  }

  revalidatePath(PATH);
}

export async function clientJoinWaitlist(programId: number) {
  const user = await getUser();

  // Check if already enrolled/waitlisted
  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.clientId, user.id),
        eq(enrollments.programId, programId),
        ne(enrollments.status, "withdrawn"),
      ),
    )
    .limit(1);

  if (existing) throw new Error("Already enrolled or waitlisted for this program");

  await db.insert(enrollments).values({
    clientId: user.id,
    programId,
    status: "waitlisted",
  });

  trackEvent(user.id, "training_waitlist_joined", { programId });

  revalidatePath(PATH);
}
