/**
 * GET /api/cron/waitlist-expiry — Advance the waitlist queue after token expiry.
 *
 * Runs hourly via pg_cron. For each "notified" waitlist entry whose claim token
 * has expired without being claimed, it:
 *
 *  1. Marks the entry as "expired".
 *  2. Checks whether the offered slot is still in the future.
 *  3. If so, finds the next "waiting" entry for the same service and offers it
 *     the same slot (new token, new 24-hour window).
 *
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { notifyNextWaitlistEntry } from "@/lib/waitlist-notify";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all expired "notified" entries
  const expired = await db
    .select({
      id: waitlist.id,
      serviceId: waitlist.serviceId,
      offeredSlotStartsAt: waitlist.offeredSlotStartsAt,
      offeredStaffId: waitlist.offeredStaffId,
    })
    .from(waitlist)
    .where(and(eq(waitlist.status, "notified"), lt(waitlist.claimTokenExpiresAt, now)));

  let advanced = 0;
  let skipped = 0;

  for (const entry of expired) {
    // Mark as expired first so the next query won't find it
    await db
      .update(waitlist)
      .set({ status: "expired", claimToken: null, claimTokenExpiresAt: null })
      .where(eq(waitlist.id, entry.id));

    // Only re-offer the slot if it's still in the future
    if (!entry.offeredSlotStartsAt || entry.offeredSlotStartsAt <= now) {
      skipped++;
      continue;
    }

    try {
      await notifyNextWaitlistEntry({
        serviceId: entry.serviceId,
        offeredSlotStartsAt: entry.offeredSlotStartsAt,
        offeredStaffId: entry.offeredStaffId,
      });
      advanced++;
    } catch (err) {
      Sentry.captureException(err);
      // Non-fatal — log but keep going
    }
  }

  return NextResponse.json({
    expired: expired.length,
    advanced,
    skippedPastSlots: skipped,
  });
}
