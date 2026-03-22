/**
 * lib/types/training.types.ts
 * Shared types for training programs, enrollments, and assistant training.
 * Sources: app/dashboard/training/actions.ts,
 *          app/dashboard/training/client-actions.ts
 */

/* ------------------------------------------------------------------ */
/*  Shared enums                                                       */
/* ------------------------------------------------------------------ */

export type ProgramType = "lash" | "jewelry" | "business" | "crochet";
export type StudentStatus = "active" | "completed" | "paused" | "waitlist";
export type EnrollStatus = "enrolled" | "waitlist" | "in_progress" | "completed" | null;

/* ------------------------------------------------------------------ */
/*  Admin training (programs, students)                               */
/* ------------------------------------------------------------------ */

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

export type EnrollmentFormData = {
  clientId: string;
  programId: number;
  status: StudentStatus;
  amountPaid: number;
};

/* ------------------------------------------------------------------ */
/*  Assistant training view                                            */
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
/*  Client training view                                               */
/* ------------------------------------------------------------------ */

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

export type ClientLesson = {
  id: number;
  title: string;
  content: string | null;
  resourceUrl: string | null;
  durationMin: number;
  completed: boolean;
};

export type ClientLessonModule = {
  id: number;
  name: string;
  lessons: ClientLesson[];
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
  lessonModules: ClientLessonModule[];
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
