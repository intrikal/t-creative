/**
 * cron-health-queries.ts — Data fetching for the AdminCronHealthSection widget.
 *
 * Reads the last `cron_success` and `cron_failure` audit_log rows for each
 * known cron job and returns a sorted list for display.
 */
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

/** All cron job names registered in vercel.json. */
export const CRON_NAMES = [
  "booking-reminders",
  "review-requests",
  "birthdays",
  "birthday-promos",
  "campaigns",
  "zoho-books",
  "fill-reminders",
  "waitlist-expiry",
  "backup",
  "recurring-bookings",
  "membership-reminders",
  "daily-flash",
  "instagram-sync",
  "refresh-views",
  "catalog-sync",
  "email-queue-drain",
] as const;

export type CronName = (typeof CRON_NAMES)[number];

export type CronHealthRow = {
  cronName: CronName;
  lastStatus: "success" | "failure" | "never";
  lastRunAt: Date | null;
  lastDurationMs: number | null;
  lastRecordsProcessed: number | null;
  lastError: string | null;
};

export async function getCronHealth(): Promise<CronHealthRow[]> {
  // Fetch the most recent audit_log entry (success or failure) per cron name.
  // One query: grab last 200 cron audit rows, then reduce to latest-per-name in JS.
  const rows = await db
    .select({
      entityId: auditLog.entityId,
      entityType: auditLog.entityType,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(inArray(auditLog.entityType, ["cron_success", "cron_failure"]))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  // Build a map of cronName → latest row
  const latest = new Map<
    string,
    { entityType: string; metadata: Record<string, unknown> | null; createdAt: Date }
  >();

  for (const row of rows) {
    if (!latest.has(row.entityId)) {
      latest.set(row.entityId, {
        entityType: row.entityType,
        metadata: row.metadata ?? null,
        createdAt: row.createdAt,
      });
    }
  }

  return CRON_NAMES.map((cronName) => {
    const entry = latest.get(cronName);
    if (!entry) {
      return {
        cronName,
        lastStatus: "never",
        lastRunAt: null,
        lastDurationMs: null,
        lastRecordsProcessed: null,
        lastError: null,
      };
    }

    const meta = entry.metadata ?? {};
    return {
      cronName,
      lastStatus: entry.entityType === "cron_success" ? "success" : "failure",
      lastRunAt: entry.createdAt,
      lastDurationMs: typeof meta.durationMs === "number" ? meta.durationMs : null,
      lastRecordsProcessed:
        typeof meta.recordsProcessed === "number" ? meta.recordsProcessed : null,
      lastError: typeof meta.error === "string" ? meta.error : null,
    };
  });
}
