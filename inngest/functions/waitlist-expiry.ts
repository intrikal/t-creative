/**
 * Inngest function — Advance the waitlist queue after token expiry.
 *
 * Replaces GET /api/cron/waitlist-expiry. For each "notified" waitlist entry
 * whose claim token has expired without being claimed, it marks the entry as
 * "expired" and offers the slot to the next "waiting" entry.
 */
import * as Sentry from "@sentry/nextjs";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { notifyNextWaitlistEntry } from "@/lib/waitlist-notify";
import { inngest } from "../client";

export const waitlistExpiry = inngest.createFunction(
  { id: "waitlist-expiry", retries: 3, triggers: [{ event: "cron/waitlist-expiry" }] },
  async ({ step }) => {
    const expired = await step.run("query-records", async () => {
      const now = new Date();

      return db
        .select({
          id: waitlist.id,
          serviceId: waitlist.serviceId,
          offeredSlotStartsAt: waitlist.offeredSlotStartsAt,
          offeredStaffId: waitlist.offeredStaffId,
        })
        .from(waitlist)
        .where(and(eq(waitlist.status, "notified"), lt(waitlist.claimTokenExpiresAt, now)));
    });

    let advanced = 0;
    let skipped = 0;

    for (const entry of expired) {
      const result = await step.run(`process-${entry.id}`, async () => {
        const now = new Date();

        // Mark as expired first so the next query won't find it
        await db
          .update(waitlist)
          .set({ status: "expired", claimToken: null, claimTokenExpiresAt: null })
          .where(eq(waitlist.id, entry.id));

        // Only re-offer the slot if it's still in the future
        // Dates are JSON-serialized between Inngest steps, so parse back
        const slotStart = entry.offeredSlotStartsAt ? new Date(entry.offeredSlotStartsAt) : null;
        if (!slotStart || slotStart <= now) {
          return { advanced: 0, skipped: 1 };
        }

        try {
          await notifyNextWaitlistEntry({
            serviceId: entry.serviceId,
            offeredSlotStartsAt: slotStart,
            offeredStaffId: entry.offeredStaffId,
          });
          return { advanced: 1, skipped: 0 };
        } catch (err) {
          Sentry.captureException(err);
          // Non-fatal — log but keep going
          return { advanced: 0, skipped: 0 };
        }
      });

      advanced += result.advanced;
      skipped += result.skipped;
    }

    return {
      expired: expired.length,
      advanced,
      skippedPastSlots: skipped,
    };
  },
);
