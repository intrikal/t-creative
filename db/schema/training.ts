/**
 * training — Certification programs, sessions, and enrollment tracking.
 *
 * Supports the current programs (Lash Extension Masterclass, Permanent
 * Jewelry Certification) and scales for future additions. Programs have
 * scheduled sessions, modules with lessons, and tracked enrollments.
 *
 * Admin actions: Create Program, Edit, Enroll Student, issue certificates.
 * Client actions: View enrolled programs, track progress, access materials.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { serviceCategoryEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** Delivery format for a training program. */
export const trainingFormatEnum = pgEnum("training_format", ["in_person", "hybrid", "online"]);

/** Status of a scheduled training session. */
export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

/**
 * Status of a student enrollment.
 *
 * `waitlisted` — client joined the waitlist when all spots were filled.
 * Trini can promote waitlisted students to `enrolled` when spots open.
 */
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "waitlisted",
  "enrolled",
  "in_progress",
  "completed",
  "withdrawn",
]);

/* ------------------------------------------------------------------ */
/*  Programs                                                           */
/* ------------------------------------------------------------------ */

export const trainingPrograms = pgTable("training_programs", {
  id: serial("id").primaryKey(),

  name: varchar("name", { length: 300 }).notNull(),
  slug: varchar("slug", { length: 300 }).notNull().unique(),
  description: text("description"),

  category: serviceCategoryEnum("category"),
  format: trainingFormatEnum("format").notNull().default("in_person"),

  /** Total duration in hours (e.g. 16 for the lash cert). */
  durationHours: integer("duration_hours"),

  /** Number of days the program spans (e.g. 2 for a 16-hour weekend course). */
  durationDays: integer("duration_days"),

  /** Price in cents. */
  priceInCents: integer("price_in_cents"),

  /** Whether accepting new enrollments. */
  isActive: boolean("is_active").notNull().default(true),

  /** Maximum students per cohort (null = unlimited). */
  maxStudents: integer("max_students"),

  /** Whether a certificate is issued on completion. */
  certificationProvided: boolean("certification_provided").notNull().default(false),

  /** Whether a physical kit (tools, supplies) is included in the price. */
  kitIncluded: boolean("kit_included").notNull().default(false),

  /** What students receive on completion — displayed on certificate. */
  certificateDescription: text("certificate_description"),

  sortOrder: integer("sort_order").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* ------------------------------------------------------------------ */
/*  Sessions                                                           */
/* ------------------------------------------------------------------ */

/**
 * Scheduled training sessions — specific dates/times when a program runs.
 *
 * A program can have multiple sessions (e.g. "Feb 14 cohort", "Mar 7 cohort").
 * The "Sessions" tab and "Upcoming Sessions" count in the dashboard aggregate
 * these. Students enroll in a specific session.
 */
export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: serial("id").primaryKey(),

    programId: integer("program_id")
      .notNull()
      .references(() => trainingPrograms.id, { onDelete: "cascade" }),

    status: sessionStatusEnum("status").notNull().default("scheduled"),

    /** Session start time (e.g. "2026-02-14 09:00"). */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

    /** Session end time. */
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Location for in-person sessions. */
    location: varchar("location", { length: 300 }),

    /** Duration of this session in hours (e.g. 8 for a full-day session). */
    durationHours: integer("duration_hours"),

    /** Meeting link for hybrid/online sessions. */
    meetingUrl: text("meeting_url"),

    /** Max students for this specific session (overrides program default). */
    maxStudents: integer("max_students"),

    /**
     * Whether the waitlist is accepting entries when all spots are filled.
     * When true + spots full: clients see "Join Waitlist" button.
     * When false + spots full: enrollment is completely closed.
     */
    isWaitlistOpen: boolean("is_waitlist_open").notNull().default(true),

    /**
     * Comma-separated material tags shown as pills on the session card.
     * E.g. "Training manual, Tool kit, Practice materials"
     */
    materials: text("materials"),

    /** Internal notes (e.g. "room B", "bring extra kits"). */
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sessions_program_idx").on(t.programId),
    index("sessions_starts_at_idx").on(t.startsAt),
    index("sessions_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/*  Modules                                                            */
/* ------------------------------------------------------------------ */

export const trainingModules = pgTable(
  "training_modules",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id")
      .notNull()
      .references(() => trainingPrograms.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 300 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),

    /** Estimated duration in minutes. */
    durationMinutes: integer("duration_minutes"),
  },
  (t) => [index("modules_program_idx").on(t.programId)],
);

/* ------------------------------------------------------------------ */
/*  Lessons                                                            */
/* ------------------------------------------------------------------ */

export const trainingLessons = pgTable(
  "training_lessons",
  {
    id: serial("id").primaryKey(),
    moduleId: integer("module_id")
      .notNull()
      .references(() => trainingModules.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 300 }).notNull(),
    content: text("content"),

    /** Optional video or resource URL. */
    resourceUrl: text("resource_url"),

    sortOrder: integer("sort_order").notNull().default(0),
    durationMinutes: integer("duration_minutes"),
  },
  (t) => [index("lessons_module_idx").on(t.moduleId)],
);

/* ------------------------------------------------------------------ */
/*  Enrollments                                                        */
/* ------------------------------------------------------------------ */

/**
 * Tracks a student's enrollment in a specific training session.
 *
 * Admin can enroll students directly via "Enroll Student" button,
 * or students can self-enroll from the client portal. The `enrolledBy`
 * field tracks who initiated the enrollment.
 */
export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),

    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    programId: integer("program_id")
      .notNull()
      .references(() => trainingPrograms.id, { onDelete: "restrict" }),

    /** Specific session the student is attending (nullable for flexible enrollment). */
    sessionId: integer("session_id").references(() => trainingSessions.id, {
      onDelete: "set null",
    }),

    status: enrollmentStatusEnum("status").notNull().default("enrolled"),

    /** Payment status for the enrollment. */
    isPaid: boolean("is_paid").notNull().default(false),

    /** Amount paid so far in cents (supports partial payments like $600 / $1200). */
    amountPaidInCents: integer("amount_paid_in_cents").notNull().default(0),

    /** Square payment ID for the enrollment fee. */
    squarePaymentId: varchar("square_payment_id", { length: 100 }),

    /** Number of sessions this student has attended. */
    sessionsCompleted: integer("sessions_completed").notNull().default(0),

    /** Completion percentage (0–100). Updated as sessions are attended. */
    progressPercent: integer("progress_percent").notNull().default(0),

    /** Who enrolled this student — null means self-enrolled. */
    enrolledBy: uuid("enrolled_by").references(() => profiles.id, {
      onDelete: "set null",
    }),

    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("enrollments_client_idx").on(t.clientId),
    index("enrollments_program_idx").on(t.programId),
    index("enrollments_session_idx").on(t.sessionId),
    index("enrollments_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/*  Session Attendance                                                 */
/* ------------------------------------------------------------------ */

/**
 * Tracks which students attended which sessions.
 *
 * Populated via the "Take Attendance" button on the Sessions tab.
 * Completed sessions show "Attendance: 2 / 5" from this data.
 * Also drives the student's `sessionsCompleted` count.
 */
export const sessionAttendance = pgTable(
  "session_attendance",
  {
    id: serial("id").primaryKey(),

    sessionId: integer("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),

    enrollmentId: integer("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),

    /** Whether the student was present. False = absent/excused. */
    attended: boolean("attended").notNull().default(true),

    /** Optional note (e.g. "arrived late", "left early"). */
    notes: text("notes"),

    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("attendance_session_idx").on(t.sessionId),
    index("attendance_enrollment_idx").on(t.enrollmentId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Certificates                                                       */
/* ------------------------------------------------------------------ */

/**
 * Issued certificates — created when a student completes a certified program.
 *
 * Feeds the "Certifications Issued" metric on the training dashboard.
 * Each certificate has a unique code for verification.
 */
export const certificates = pgTable(
  "certificates",
  {
    id: serial("id").primaryKey(),

    enrollmentId: integer("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict" }),

    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    programId: integer("program_id")
      .notNull()
      .references(() => trainingPrograms.id, { onDelete: "restrict" }),

    /** Unique verification code (e.g. "TC-LASH-2026-001"). */
    certificateCode: varchar("certificate_code", { length: 100 }).notNull().unique(),

    /** PDF storage path in Supabase Storage. */
    pdfStoragePath: text("pdf_storage_path"),

    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),

    /** Nullable — most certs don't expire. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    index("certificates_client_idx").on(t.clientId),
    index("certificates_program_idx").on(t.programId),
    index("certificates_code_idx").on(t.certificateCode),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const trainingProgramsRelations = relations(trainingPrograms, ({ many }) => ({
  /** One-to-many: one program has many modules (training_modules.program_id → training_programs.id). */
  modules: many(trainingModules),
  /** One-to-many: one program has many sessions (training_sessions.program_id → training_programs.id). */
  sessions: many(trainingSessions),
  /** One-to-many: one program has many enrollments (enrollments.program_id → training_programs.id). */
  enrollments: many(enrollments),
  /** One-to-many: one program has many certificates (certificates.program_id → training_programs.id). */
  certificates: many(certificates),
}));

export const trainingSessionsRelations = relations(trainingSessions, ({ one, many }) => ({
  /** Many-to-one: many sessions belong to one program (training_sessions.program_id → training_programs.id). */
  program: one(trainingPrograms, {
    fields: [trainingSessions.programId],
    references: [trainingPrograms.id],
  }),
  /** One-to-many: one session has many enrollments (enrollments.session_id → training_sessions.id). */
  enrollments: many(enrollments),
  /** One-to-many: one session has many attendance records (session_attendance.session_id → training_sessions.id). */
  attendance: many(sessionAttendance),
}));

export const trainingModulesRelations = relations(trainingModules, ({ one, many }) => ({
  /** Many-to-one: many modules belong to one program (training_modules.program_id → training_programs.id). */
  program: one(trainingPrograms, {
    fields: [trainingModules.programId],
    references: [trainingPrograms.id],
  }),
  /** One-to-many: one module has many lessons (training_lessons.module_id → training_modules.id). */
  lessons: many(trainingLessons),
}));

export const trainingLessonsRelations = relations(trainingLessons, ({ one }) => ({
  /** Many-to-one: many lessons belong to one module (training_lessons.module_id → training_modules.id). */
  module: one(trainingModules, {
    fields: [trainingLessons.moduleId],
    references: [trainingModules.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  /** One-to-many: one enrollment has many attendance records (session_attendance.enrollment_id → enrollments.id). */
  attendance: many(sessionAttendance),
  /** Many-to-one: many enrollments belong to one client (enrollments.client_id → profiles.id). */
  client: one(profiles, {
    fields: [enrollments.clientId],
    references: [profiles.id],
  }),
  /** Many-to-one: many enrollments belong to one program (enrollments.program_id → training_programs.id). */
  program: one(trainingPrograms, {
    fields: [enrollments.programId],
    references: [trainingPrograms.id],
  }),
  /** Many-to-one: many enrollments belong to one session (enrollments.session_id → training_sessions.id). */
  session: one(trainingSessions, {
    fields: [enrollments.sessionId],
    references: [trainingSessions.id],
  }),
  /** Many-to-one: many enrollments reference one staff member who enrolled them (enrollments.enrolled_by → profiles.id). */
  enrolledByProfile: one(profiles, {
    fields: [enrollments.enrolledBy],
    references: [profiles.id],
    relationName: "enrolledByStaff",
  }),
}));

export const sessionAttendanceRelations = relations(sessionAttendance, ({ one }) => ({
  /** Many-to-one: many attendance records belong to one session (session_attendance.session_id → training_sessions.id). */
  session: one(trainingSessions, {
    fields: [sessionAttendance.sessionId],
    references: [trainingSessions.id],
  }),
  /** Many-to-one: many attendance records belong to one enrollment (session_attendance.enrollment_id → enrollments.id). */
  enrollment: one(enrollments, {
    fields: [sessionAttendance.enrollmentId],
    references: [enrollments.id],
  }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  /** Many-to-one: many certificates reference one enrollment (certificates.enrollment_id → enrollments.id). */
  enrollment: one(enrollments, {
    fields: [certificates.enrollmentId],
    references: [enrollments.id],
  }),
  /** Many-to-one: many certificates belong to one client (certificates.client_id → profiles.id). */
  client: one(profiles, {
    fields: [certificates.clientId],
    references: [profiles.id],
  }),
  /** Many-to-one: many certificates belong to one program (certificates.program_id → training_programs.id). */
  program: one(trainingPrograms, {
    fields: [certificates.programId],
    references: [trainingPrograms.id],
  }),
}));
