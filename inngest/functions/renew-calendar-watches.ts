/**
 * inngest/functions/renew-calendar-watches.ts
 *
 * Runs daily. For each staff member with an active Google Calendar connection,
 * renews the push notification watch if it's expiring within 2 days.
 *
 * Google Calendar watches expire after 7 days max. This function ensures
 * continuous push notification delivery by proactively renewing watches
 * before they lapse.
 */
import * as Sentry from "@sentry/nextjs";
import { lte } from "drizzle-orm";
import { db } from "@/db";
import { googleCalendarTokens } from "@/db/schema";
import { stopWatchCalendar, watchCalendar } from "@/lib/google-calendar";
import logger from "@/lib/logger";
import { inngest } from "../client";

/** Renew watches expiring within this window (2 days). */
const RENEWAL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export const renewCalendarWatches = inngest.createFunction(
  {
    id: "renew-calendar-watches",
    retries: 3,
    triggers: [{ event: "cron/renew-calendar-watches" }],
  },
  async ({ step }) => {
    const expiringRows = await step.run("find-expiring-watches", async () => {
      const threshold = new Date(Date.now() + RENEWAL_WINDOW_MS);

      return db
        .select({
          profileId: googleCalendarTokens.profileId,
          watchExpiresAt: googleCalendarTokens.watchExpiresAt,
        })
        .from(googleCalendarTokens)
        .where(lte(googleCalendarTokens.watchExpiresAt, threshold));
    });

    let renewed = 0;
    let failed = 0;

    for (const row of expiringRows) {
      await step.run(`renew-${row.profileId}`, async () => {
        try {
          await stopWatchCalendar(row.profileId);
          await watchCalendar(row.profileId);
          renewed++;
          logger.info({ profileId: row.profileId }, "renewed Google Calendar watch");
        } catch (err) {
          failed++;
          Sentry.captureException(err);
          logger.error({ err, profileId: row.profileId }, "failed to renew Google Calendar watch");
        }
      });
    }

    // Also set up watches for newly connected accounts that don't have one yet.
    const unwatchedRows = await step.run("find-unwatched", async () => {
      return db
        .select({ profileId: googleCalendarTokens.profileId })
        .from(googleCalendarTokens)
        .where(lte(googleCalendarTokens.syncEnabled, true));
    });

    for (const row of unwatchedRows) {
      const alreadyRenewed = expiringRows.some((r) => r.profileId === row.profileId);
      if (alreadyRenewed) continue;

      await step.run(`watch-new-${row.profileId}`, async () => {
        try {
          // Check if this profile already has an active, non-expiring watch.
          const [existing] = await db
            .select({ watchExpiresAt: googleCalendarTokens.watchExpiresAt })
            .from(googleCalendarTokens)
            .where(lte(googleCalendarTokens.profileId, row.profileId))
            .limit(1);

          if (existing?.watchExpiresAt && existing.watchExpiresAt.getTime() > Date.now()) {
            return;
          }

          await watchCalendar(row.profileId);
          renewed++;
        } catch (err) {
          failed++;
          Sentry.captureException(err);
          logger.error({ err, profileId: row.profileId }, "failed to create Google Calendar watch");
        }
      });
    }

    return { renewed, failed, checked: expiringRows.length + unwatchedRows.length };
  },
);
