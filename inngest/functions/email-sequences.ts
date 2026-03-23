/**
 * Inngest function — Process email sequence enrollments.
 *
 * Runs daily. For each active enrollment, checks if the delay for the
 * next step has elapsed. If so, sends the email, advances the step,
 * and marks completed when all steps are done.
 *
 * Respects notification preferences and deduplicates via sync_log.
 */
import { and, eq, sql, asc } from "drizzle-orm";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import {
  emailSequences,
  emailSequenceSteps,
  emailSequenceEnrollments,
  profiles,
  syncLog,
} from "@/db/schema";
import { isNotificationEnabled } from "@/lib/notification-preferences";
import { sendEmail, isResendConfigured } from "@/lib/resend";
import { inngest } from "../client";

export const emailSequenceCron = inngest.createFunction(
  {
    id: "email-sequences",
    retries: 2,
    triggers: [{ event: "cron/email-sequences" }],
  },
  async ({ step }) => {
    if (!isResendConfigured()) {
      return { skipped: true, reason: "Resend not configured" };
    }

    const bp = await step.run("load-config", async () => {
      return getPublicBusinessProfile();
    });

    // Find all active enrollments with their sequence and next step info
    const candidates = await step.run("find-candidates", async () => {
      const rows = await db
        .select({
          enrollmentId: emailSequenceEnrollments.id,
          sequenceId: emailSequenceEnrollments.sequenceId,
          profileId: emailSequenceEnrollments.profileId,
          currentStep: emailSequenceEnrollments.currentStep,
          lastStepSentAt: emailSequenceEnrollments.lastStepSentAt,
          enrolledAt: emailSequenceEnrollments.enrolledAt,
          sequenceName: emailSequences.name,
        })
        .from(emailSequenceEnrollments)
        .innerJoin(
          emailSequences,
          and(
            eq(emailSequenceEnrollments.sequenceId, emailSequences.id),
            eq(emailSequences.isActive, true),
          ),
        )
        .where(eq(emailSequenceEnrollments.status, "active"));

      return rows;
    });

    if (candidates.length === 0) {
      return { processed: 0, sent: 0, completed: 0, skipped: 0 };
    }

    let sent = 0;
    let completed = 0;
    let skipped = 0;

    for (const enrollment of candidates) {
      await step.run(`process-${enrollment.enrollmentId}`, async () => {
        // Get the next step for this enrollment
        const nextStepOrder = enrollment.currentStep + 1;
        const [nextStep] = await db
          .select()
          .from(emailSequenceSteps)
          .where(
            and(
              eq(emailSequenceSteps.sequenceId, enrollment.sequenceId),
              eq(emailSequenceSteps.stepOrder, nextStepOrder),
            ),
          )
          .limit(1);

        // No more steps — mark enrollment as completed
        if (!nextStep) {
          await db
            .update(emailSequenceEnrollments)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(emailSequenceEnrollments.id, enrollment.enrollmentId));
          completed++;
          return;
        }

        // Check if delay has elapsed
        const referenceTime = enrollment.lastStepSentAt ?? enrollment.enrolledAt;
        const delayMs = nextStep.delayDays * 24 * 60 * 60 * 1000;
        const dueAt = new Date(new Date(referenceTime).getTime() + delayMs);

        if (new Date() < dueAt) {
          skipped++; // Not due yet
          return;
        }

        // Check notification preference
        const canEmail = await isNotificationEnabled(enrollment.profileId, "email", "marketing");
        if (!canEmail) {
          // Cancel enrollment if marketing opted out
          await db
            .update(emailSequenceEnrollments)
            .set({ status: "cancelled", cancelledAt: new Date() })
            .where(eq(emailSequenceEnrollments.id, enrollment.enrollmentId));
          skipped++;
          return;
        }

        // Deduplication check
        const dedupKey = `seq-${enrollment.sequenceId}-step-${nextStepOrder}-${enrollment.profileId}`;
        const [existing] = await db
          .select({ id: syncLog.id })
          .from(syncLog)
          .where(and(eq(syncLog.entityType, "email_sequence_step"), eq(syncLog.localId, dedupKey)))
          .limit(1);

        if (existing) {
          skipped++;
          return;
        }

        // Fetch client email
        const [client] = await db
          .select({
            email: profiles.email,
            firstName: profiles.firstName,
          })
          .from(profiles)
          .where(eq(profiles.id, enrollment.profileId))
          .limit(1);

        if (!client?.email) {
          skipped++;
          return;
        }

        // Template variable replacement
        const subject = nextStep.subject
          .replace(/\{\{firstName\}\}/g, client.firstName || "there")
          .replace(/\{\{businessName\}\}/g, bp.businessName);

        const body = nextStep.body
          .replace(/\{\{firstName\}\}/g, client.firstName || "there")
          .replace(/\{\{businessName\}\}/g, bp.businessName);

        // Send email
        const React = await import("react");
        const success = await sendEmail({
          to: client.email,
          subject,
          react: React.createElement("div", {
            dangerouslySetInnerHTML: { __html: body },
          }),
          entityType: "email_sequence_step",
          localId: dedupKey,
          profileId: enrollment.profileId,
        });

        if (success) {
          // Advance enrollment
          const totalSteps = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(emailSequenceSteps)
            .where(eq(emailSequenceSteps.sequenceId, enrollment.sequenceId))
            .then((r) => Number(r[0]?.count ?? 0));

          const isLastStep = nextStepOrder >= totalSteps;

          await db
            .update(emailSequenceEnrollments)
            .set({
              currentStep: nextStepOrder,
              lastStepSentAt: new Date(),
              ...(isLastStep ? { status: "completed" as const, completedAt: new Date() } : {}),
            })
            .where(eq(emailSequenceEnrollments.id, enrollment.enrollmentId));

          if (isLastStep) completed++;
          sent++;
        } else {
          skipped++;
        }
      });
    }

    return { processed: candidates.length, sent, completed, skipped };
  },
);
