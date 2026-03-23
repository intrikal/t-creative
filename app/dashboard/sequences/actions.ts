/**
 * sequences/actions — Server actions for email sequence management.
 *
 * CRUD for sequences and steps, enrollment management, and the
 * auto-enrollment helper called from lifecycle event hooks.
 *
 * @see {@link inngest/functions/email-sequences.ts} — cron processor
 * @see {@link db/schema/email-sequences.ts} — table definitions
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { and, eq, desc, asc, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  emailSequences,
  emailSequenceSteps,
  emailSequenceEnrollments,
  profiles,
} from "@/db/schema";
import { logAction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { isNotificationEnabled } from "@/lib/notification-preferences";
import { trackEvent } from "@/lib/posthog";
import type { ActionResult } from "@/lib/types/action-result";

const PATH = "/dashboard/sequences";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SequenceRow = {
  id: number;
  name: string;
  triggerEvent: string;
  isActive: boolean;
  stepCount: number;
  activeEnrollments: number;
  createdAt: Date;
};

export type SequenceStepRow = {
  id: number;
  stepOrder: number;
  delayDays: number;
  subject: string;
  body: string;
};

export type SequenceDetail = {
  id: number;
  name: string;
  triggerEvent: string;
  isActive: boolean;
  steps: SequenceStepRow[];
  enrollments: {
    id: number;
    profileName: string;
    currentStep: number;
    status: string;
    enrolledAt: Date;
  }[];
};

export type SequenceTrigger =
  | "first_booking_completed"
  | "no_visit_30_days"
  | "no_visit_60_days"
  | "membership_cancelled"
  | "new_client_signup";

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getSequences(): Promise<SequenceRow[]> {
  try {
    await requireAdmin();

    const rows = await db
      .select({
        id: emailSequences.id,
        name: emailSequences.name,
        triggerEvent: emailSequences.triggerEvent,
        isActive: emailSequences.isActive,
        createdAt: emailSequences.createdAt,
        stepCount: sql<number>`(
          select count(*)::int from email_sequence_steps s
          where s.sequence_id = ${emailSequences.id}
        )`,
        activeEnrollments: sql<number>`(
          select count(*)::int from email_sequence_enrollments e
          where e.sequence_id = ${emailSequences.id} and e.status = 'active'
        )`,
      })
      .from(emailSequences)
      .orderBy(desc(emailSequences.createdAt));

    return rows.map((r) => ({
      ...r,
      stepCount: Number(r.stepCount),
      activeEnrollments: Number(r.activeEnrollments),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getSequenceDetail(id: number): Promise<SequenceDetail | null> {
  try {
    await requireAdmin();

    const [seq] = await db.select().from(emailSequences).where(eq(emailSequences.id, id)).limit(1);

    if (!seq) return null;

    const [steps, enrollments] = await Promise.all([
      db
        .select({
          id: emailSequenceSteps.id,
          stepOrder: emailSequenceSteps.stepOrder,
          delayDays: emailSequenceSteps.delayDays,
          subject: emailSequenceSteps.subject,
          body: emailSequenceSteps.body,
        })
        .from(emailSequenceSteps)
        .where(eq(emailSequenceSteps.sequenceId, id))
        .orderBy(asc(emailSequenceSteps.stepOrder)),
      db
        .select({
          id: emailSequenceEnrollments.id,
          profileId: emailSequenceEnrollments.profileId,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          currentStep: emailSequenceEnrollments.currentStep,
          status: emailSequenceEnrollments.status,
          enrolledAt: emailSequenceEnrollments.enrolledAt,
        })
        .from(emailSequenceEnrollments)
        .leftJoin(profiles, eq(emailSequenceEnrollments.profileId, profiles.id))
        .where(eq(emailSequenceEnrollments.sequenceId, id))
        .orderBy(desc(emailSequenceEnrollments.enrolledAt)),
    ]);

    return {
      id: seq.id,
      name: seq.name,
      triggerEvent: seq.triggerEvent,
      isActive: seq.isActive,
      steps,
      enrollments: enrollments.map((e) => ({
        id: e.id,
        profileName: [e.firstName, e.lastName].filter(Boolean).join(" ") || "Unknown",
        currentStep: e.currentStep,
        status: e.status,
        enrolledAt: e.enrolledAt,
      })),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

const createSequenceSchema = z.object({
  name: z.string().min(1),
  triggerEvent: z.enum([
    "first_booking_completed",
    "no_visit_30_days",
    "no_visit_60_days",
    "membership_cancelled",
    "new_client_signup",
  ]),
  steps: z
    .array(
      z.object({
        stepOrder: z.number().int().positive(),
        delayDays: z.number().int().nonnegative(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .min(1),
});

export async function createSequence(data: {
  name: string;
  triggerEvent: SequenceTrigger;
  steps: { stepOrder: number; delayDays: number; subject: string; body: string }[];
}): Promise<ActionResult<{ id: number }>> {
  try {
    createSequenceSchema.parse(data);
    const user = await requireAdmin();

    const [seq] = await db
      .insert(emailSequences)
      .values({
        name: data.name,
        triggerEvent: data.triggerEvent,
      })
      .returning({ id: emailSequences.id });

    await db.insert(emailSequenceSteps).values(
      data.steps.map((s) => ({
        sequenceId: seq.id,
        stepOrder: s.stepOrder,
        delayDays: s.delayDays,
        subject: s.subject,
        body: s.body,
      })),
    );

    trackEvent(user.id, "email_sequence_created", { sequenceId: seq.id });

    await logAction({
      actorId: user.id,
      action: "create",
      entityType: "email_sequence",
      entityId: String(seq.id),
      description: `Created email sequence: ${data.name}`,
      metadata: { trigger: data.triggerEvent, stepCount: data.steps.length },
    });

    revalidatePath(PATH);
    return { success: true, data: { id: seq.id } };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to create sequence";
    return { success: false, error: message };
  }
}

export async function updateSequence(
  id: number,
  data: {
    name?: string;
    isActive?: boolean;
    steps?: { stepOrder: number; delayDays: number; subject: string; body: string }[];
  },
): Promise<ActionResult<void>> {
  try {
    const user = await requireAdmin();

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    if (Object.keys(updates).length > 0) {
      await db.update(emailSequences).set(updates).where(eq(emailSequences.id, id));
    }

    if (data.steps) {
      await db.delete(emailSequenceSteps).where(eq(emailSequenceSteps.sequenceId, id));
      await db.insert(emailSequenceSteps).values(
        data.steps.map((s) => ({
          sequenceId: id,
          stepOrder: s.stepOrder,
          delayDays: s.delayDays,
          subject: s.subject,
          body: s.body,
        })),
      );
    }

    await logAction({
      actorId: user.id,
      action: "update",
      entityType: "email_sequence",
      entityId: String(id),
      description: "Email sequence updated",
    });

    revalidatePath(PATH);
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to update sequence";
    return { success: false, error: message };
  }
}

export async function deleteSequence(id: number): Promise<ActionResult<void>> {
  try {
    const user = await requireAdmin();

    await db.delete(emailSequences).where(eq(emailSequences.id, id));

    await logAction({
      actorId: user.id,
      action: "delete",
      entityType: "email_sequence",
      entityId: String(id),
      description: "Email sequence deleted",
    });

    revalidatePath(PATH);
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to delete sequence";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Enrollment                                                         */
/* ------------------------------------------------------------------ */

export async function cancelEnrollment(enrollmentId: number): Promise<ActionResult<void>> {
  try {
    const user = await requireAdmin();

    await db
      .update(emailSequenceEnrollments)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(emailSequenceEnrollments.id, enrollmentId));

    await logAction({
      actorId: user.id,
      action: "update",
      entityType: "email_sequence_enrollment",
      entityId: String(enrollmentId),
      description: "Enrollment cancelled",
    });

    revalidatePath(PATH);
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to cancel enrollment";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Auto-enrollment (called from lifecycle hooks)                      */
/* ------------------------------------------------------------------ */

/**
 * Auto-enroll a client into all active sequences matching a trigger event.
 * Respects notification preferences — skips if marketing email is disabled.
 * Non-fatal — never throws.
 */
export async function autoEnrollClient(profileId: string, trigger: SequenceTrigger): Promise<void> {
  try {
    // Check marketing preference
    const marketingEnabled = await isNotificationEnabled(profileId, "email", "marketing");
    if (!marketingEnabled) return;

    // Find active sequences for this trigger
    const sequences = await db
      .select({ id: emailSequences.id })
      .from(emailSequences)
      .where(and(eq(emailSequences.triggerEvent, trigger), eq(emailSequences.isActive, true)));

    for (const seq of sequences) {
      try {
        // Insert with ON CONFLICT DO NOTHING — deduplication via unique index
        await db
          .insert(emailSequenceEnrollments)
          .values({
            sequenceId: seq.id,
            profileId,
            currentStep: 0,
            status: "active",
          })
          .onConflictDoNothing();
      } catch {
        // Ignore duplicate enrollment errors
      }
    }
  } catch {
    // Non-fatal — don't break the triggering action
  }
}
