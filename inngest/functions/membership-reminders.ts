/**
 * Inngest function — Membership status sync + reminders.
 *
 * Replaces GET /api/cron/membership-reminders. Two-phase job:
 *
 * Phase 1 — Square subscription status sync:
 *   For each active/paused membership with a squareSubscriptionId, check
 *   Square and auto-renew, pause, or cancel as needed.
 *
 * Phase 2 — Reminder emails:
 *   Find active memberships whose cycle ends in 3-4 days and send reminders.
 */
import { addDays, format } from "date-fns";
import { and, eq, gte, isNotNull, lte, or } from "drizzle-orm";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { membershipPlans, membershipSubscriptions, profiles, syncLog } from "@/db/schema";
import { MembershipReminder } from "@/emails/MembershipReminder";
import { logAction } from "@/lib/audit";
import { sendEmail } from "@/lib/resend";
import { getSquareSubscriptionStatus } from "@/lib/square";
import { inngest } from "../client";

/** Send reminder this many days before the cycle resets. */
const REMINDER_DAYS_BEFORE = 3;
/** Daily job — look across a 24h window. */
const WINDOW_HOURS = 24;
/** Grace period days — how long after payment failure before cancelling. */
const GRACE_PERIOD_DAYS = 7;

/** Helper: cancel Square subscription, swallowing errors. */
async function cancelSquareSubscriptionIfNeeded(squareSubscriptionId: string): Promise<void> {
  try {
    const { cancelSquareSubscription } = await import("@/lib/square");
    await cancelSquareSubscription(squareSubscriptionId);
  } catch {
    // Non-fatal
  }
}

export const membershipReminders = inngest.createFunction(
  { id: "membership-reminders", retries: 3, triggers: [{ event: "cron/membership-reminders" }] },
  async ({ step }) => {
    // ── Phase 1: Square subscription status sync ────────────────────
    const squareSubs = await step.run("query-square-subs", async () => {
      return db
        .select({
          id: membershipSubscriptions.id,
          status: membershipSubscriptions.status,
          squareSubscriptionId: membershipSubscriptions.squareSubscriptionId,
          cycleEndsAt: membershipSubscriptions.cycleEndsAt,
          fillsPerCycle: membershipPlans.fillsPerCycle,
          cycleIntervalDays: membershipPlans.cycleIntervalDays,
        })
        .from(membershipSubscriptions)
        .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
        .where(
          and(
            or(
              eq(membershipSubscriptions.status, "active"),
              eq(membershipSubscriptions.status, "paused"),
            ),
            isNotNull(membershipSubscriptions.squareSubscriptionId),
          ),
        );
    });

    let synced = 0;
    let renewed = 0;
    let deactivated = 0;
    let cancelled = 0;

    for (const sub of squareSubs) {
      const result = await step.run(`sync-square-${sub.id}`, async () => {
        if (!sub.squareSubscriptionId) return { synced: 0, renewed: 0, deactivated: 0, cancelled: 0 };

        const squareStatus = await getSquareSubscriptionStatus(sub.squareSubscriptionId);
        if (!squareStatus) return { synced: 0, renewed: 0, deactivated: 0, cancelled: 0 };

        const now = new Date();
        let localSynced = 1;
        let localRenewed = 0;
        let localDeactivated = 0;
        let localCancelled = 0;

        // Dates are JSON-serialized between Inngest steps, so parse back
        const cycleEndsAt = new Date(sub.cycleEndsAt);

        // Square says ACTIVE and local cycle has expired -> auto-renew
        if (squareStatus.status === "ACTIVE" && cycleEndsAt <= now) {
          const newCycleStart = cycleEndsAt;
          const newCycleEnd = addDays(newCycleStart, sub.cycleIntervalDays);

          await db
            .update(membershipSubscriptions)
            .set({
              status: "active",
              fillsRemainingThisCycle: sub.fillsPerCycle,
              cycleStartAt: newCycleStart,
              cycleEndsAt: newCycleEnd,
              pausedAt: null,
            })
            .where(eq(membershipSubscriptions.id, sub.id));

          await logAction({
            actorId: "system",
            action: "update",
            entityType: "membership_subscription",
            entityId: sub.id,
            description: "Membership auto-renewed via Square subscription sync",
            metadata: { squareStatus: squareStatus.status, newCycleEnd: newCycleEnd.toISOString() },
          });

          localRenewed++;
        }

        // Square says DEACTIVATED (payment failed) -> pause locally with grace period
        if (squareStatus.status === "DEACTIVATED" && sub.status === "active") {
          await db
            .update(membershipSubscriptions)
            .set({
              status: "paused",
              pausedAt: now,
              notes: `Auto-paused: Square payment failed (grace period until ${format(addDays(now, GRACE_PERIOD_DAYS), "MMM d, yyyy")})`,
            })
            .where(eq(membershipSubscriptions.id, sub.id));

          await logAction({
            actorId: "system",
            action: "status_change",
            entityType: "membership_subscription",
            entityId: sub.id,
            description: "Membership paused — Square payment failed (grace period started)",
            metadata: { squareStatus: squareStatus.status },
          });

          localDeactivated++;
        }

        // Square says CANCELED -> cancel locally
        if (squareStatus.status === "CANCELED" && sub.status !== "cancelled") {
          await db
            .update(membershipSubscriptions)
            .set({
              status: "cancelled",
              cancelledAt: now,
            })
            .where(eq(membershipSubscriptions.id, sub.id));

          await logAction({
            actorId: "system",
            action: "status_change",
            entityType: "membership_subscription",
            entityId: sub.id,
            description: "Membership cancelled — Square subscription cancelled",
            metadata: { squareStatus: squareStatus.status },
          });

          localCancelled++;
        }

        // Paused locally but past grace period -> cancel
        if (sub.status === "paused" && squareStatus.status === "DEACTIVATED") {
          const [pausedSub] = await db
            .select({ pausedAt: membershipSubscriptions.pausedAt })
            .from(membershipSubscriptions)
            .where(eq(membershipSubscriptions.id, sub.id))
            .limit(1);

          if (
            pausedSub?.pausedAt &&
            now.getTime() - pausedSub.pausedAt.getTime() > GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
          ) {
            await cancelSquareSubscriptionIfNeeded(sub.squareSubscriptionId);
            await db
              .update(membershipSubscriptions)
              .set({ status: "cancelled", cancelledAt: now })
              .where(eq(membershipSubscriptions.id, sub.id));

            await logAction({
              actorId: "system",
              action: "status_change",
              entityType: "membership_subscription",
              entityId: sub.id,
              description: "Membership cancelled — grace period expired after payment failure",
            });

            localCancelled++;
          }
        }

        return {
          synced: localSynced,
          renewed: localRenewed,
          deactivated: localDeactivated,
          cancelled: localCancelled,
        };
      });

      synced += result.synced;
      renewed += result.renewed;
      deactivated += result.deactivated;
      cancelled += result.cancelled;
    }

    // ── Phase 2: Reminder emails ─────────────────────────────────────
    const { candidates, businessName, slug, baseUrl } = await step.run(
      "query-reminder-candidates",
      async () => {
        const now = new Date();
        const windowStart = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(windowStart.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

        const rows = await db
          .select({
            subscriptionId: membershipSubscriptions.id,
            clientId: membershipSubscriptions.clientId,
            fillsRemainingThisCycle: membershipSubscriptions.fillsRemainingThisCycle,
            cycleEndsAt: membershipSubscriptions.cycleEndsAt,
            planName: membershipPlans.name,
            fillsPerCycle: membershipPlans.fillsPerCycle,
            clientEmail: profiles.email,
            clientFirstName: profiles.firstName,
            notifyEmail: profiles.notifyEmail,
          })
          .from(membershipSubscriptions)
          .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
          .innerJoin(profiles, eq(membershipSubscriptions.clientId, profiles.id))
          .where(
            and(
              eq(membershipSubscriptions.status, "active"),
              gte(membershipSubscriptions.cycleEndsAt, windowStart),
              lte(membershipSubscriptions.cycleEndsAt, windowEnd),
            ),
          );

        const bp = await getPublicBusinessProfile();

        const [adminProfile] = await db
          .select({ onboardingData: profiles.onboardingData })
          .from(profiles)
          .where(eq(profiles.role, "admin"))
          .limit(1);

        const adminData = adminProfile?.onboardingData as Record<string, unknown> | null;
        const studioName = (adminData?.studioName as string) ?? "";
        const studioSlug = studioName.toLowerCase().replace(/\s+/g, "");
        const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

        return {
          candidates: rows,
          businessName: bp.businessName,
          slug: studioSlug,
          baseUrl: siteBaseUrl,
        };
      },
    );

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const result = await step.run(`remind-${candidate.subscriptionId}`, async () => {
        if (!candidate.clientEmail || !candidate.notifyEmail) {
          return { sent: 0, failed: 0, skipped: 1 };
        }

        const now = new Date();
        // Dates are JSON-serialized between Inngest steps, so parse back
        const cycleEndsAt = new Date(candidate.cycleEndsAt);
        const localId = `${candidate.subscriptionId}:${cycleEndsAt.toISOString()}`;

        const [existing] = await db
          .select({ id: syncLog.id })
          .from(syncLog)
          .where(
            and(
              eq(syncLog.entityType, "membership_cycle_reminder"),
              eq(syncLog.localId, localId),
              eq(syncLog.status, "success"),
            ),
          )
          .limit(1);

        if (existing) {
          return { sent: 0, failed: 0, skipped: 1 };
        }

        const daysUntilReset = Math.ceil(
          (cycleEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );
        const cycleEndsFormatted = format(cycleEndsAt, "MMMM d");
        const bookingUrl = slug ? `${baseUrl}/book/${slug}` : `${baseUrl}/dashboard/book`;

        const hasUnusedFills = candidate.fillsRemainingThisCycle > 0;
        const subject = hasUnusedFills
          ? `You have ${candidate.fillsRemainingThisCycle} ${candidate.fillsRemainingThisCycle === 1 ? "fill" : "fills"} remaining — use ${candidate.fillsRemainingThisCycle === 1 ? "it" : "them"} before ${cycleEndsFormatted}`
          : `Your ${candidate.planName} cycle renews on ${cycleEndsFormatted}`;

        const success = await sendEmail({
          to: candidate.clientEmail,
          subject,
          react: MembershipReminder({
            clientName: candidate.clientFirstName,
            planName: candidate.planName,
            fillsRemaining: candidate.fillsRemainingThisCycle,
            fillsPerCycle: candidate.fillsPerCycle,
            cycleEndsAt: cycleEndsFormatted,
            daysUntilReset,
            bookingUrl,
            businessName,
          }),
          entityType: "membership_cycle_reminder",
          localId,
        });

        return success ? { sent: 1, failed: 0, skipped: 0 } : { sent: 0, failed: 1, skipped: 0 };
      });

      sent += result.sent;
      failed += result.failed;
      skipped += result.skipped;
    }

    return {
      sync: { checked: synced, renewed, deactivated, cancelled },
      reminders: { matched: candidates.length, sent, failed, skipped },
    };
  },
);
