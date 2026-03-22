/**
 * Square subscription webhook handler.
 * @module api/webhooks/square/handlers/subscription
 */
import { addDays } from "date-fns";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { membershipSubscriptions, membershipPlans } from "@/db/schema";
import { logAction } from "@/lib/audit";

/**
 * Handles subscription.updated events from Square. Syncs the subscription
 * status to the local membership_subscriptions table.
 *
 * Square subscription statuses:
 *   ACTIVE      → local "active" (auto-renew if cycle expired)
 *   PAUSED      → local "paused"
 *   DEACTIVATED → local "paused" (payment failed, grace period)
 *   CANCELED    → local "cancelled"
 */
export async function handleSubscriptionUpdated(
  data: Record<string, unknown> | undefined,
): Promise<string> {
  const subscription = (data as Record<string, unknown>)?.object as
    | Record<string, unknown>
    | undefined;
  const sub = (subscription as Record<string, unknown>)?.subscription as
    | Record<string, unknown>
    | undefined;

  const squareSubId = sub?.id as string | undefined;
  if (!squareSubId) return "No subscription ID in event";

  const squareStatus = sub?.status as string | undefined;
  if (!squareStatus) return "No subscription status in event";

  const [localSub] = await db
    .select({
      id: membershipSubscriptions.id,
      status: membershipSubscriptions.status,
      cycleEndsAt: membershipSubscriptions.cycleEndsAt,
      fillsPerCycle: membershipPlans.fillsPerCycle,
      cycleIntervalDays: membershipPlans.cycleIntervalDays,
    })
    .from(membershipSubscriptions)
    .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
    .where(eq(membershipSubscriptions.squareSubscriptionId, squareSubId))
    .limit(1);

  if (!localSub) return `No local membership found for Square subscription ${squareSubId}`;

  const now = new Date();

  if (squareStatus === "ACTIVE") {
    if (localSub.cycleEndsAt <= now) {
      const newCycleStart = localSub.cycleEndsAt;
      const newCycleEnd = addDays(newCycleStart, localSub.cycleIntervalDays);

      await db
        .update(membershipSubscriptions)
        .set({
          status: "active",
          fillsRemainingThisCycle: localSub.fillsPerCycle,
          cycleStartAt: newCycleStart,
          cycleEndsAt: newCycleEnd,
          pausedAt: null,
        })
        .where(eq(membershipSubscriptions.id, localSub.id));

      await logAction({
        actorId: "system",
        action: "update",
        entityType: "membership_subscription",
        entityId: localSub.id,
        description: "Membership auto-renewed via Square subscription webhook",
      });

      return `Auto-renewed membership ${localSub.id}`;
    }

    if (localSub.status === "paused") {
      await db
        .update(membershipSubscriptions)
        .set({ status: "active", pausedAt: null })
        .where(eq(membershipSubscriptions.id, localSub.id));

      return `Reactivated membership ${localSub.id}`;
    }

    return `Membership ${localSub.id} already active`;
  }

  if (squareStatus === "PAUSED" || squareStatus === "DEACTIVATED") {
    if (localSub.status !== "paused") {
      await db
        .update(membershipSubscriptions)
        .set({ status: "paused", pausedAt: now })
        .where(eq(membershipSubscriptions.id, localSub.id));

      await logAction({
        actorId: "system",
        action: "status_change",
        entityType: "membership_subscription",
        entityId: localSub.id,
        description: `Membership paused via Square webhook (${squareStatus})`,
      });

      return `Paused membership ${localSub.id} (Square: ${squareStatus})`;
    }

    return `Membership ${localSub.id} already paused`;
  }

  if (squareStatus === "CANCELED") {
    if (localSub.status !== "cancelled") {
      await db
        .update(membershipSubscriptions)
        .set({ status: "cancelled", cancelledAt: now })
        .where(eq(membershipSubscriptions.id, localSub.id));

      await logAction({
        actorId: "system",
        action: "status_change",
        entityType: "membership_subscription",
        entityId: localSub.id,
        description: "Membership cancelled via Square webhook",
      });

      return `Cancelled membership ${localSub.id}`;
    }

    return `Membership ${localSub.id} already cancelled`;
  }

  return `Unhandled Square subscription status: ${squareStatus}`;
}
