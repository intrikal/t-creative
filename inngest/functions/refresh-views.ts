/**
 * Inngest function — Refresh analytics materialized views.
 *
 * Replaces GET /api/cron/refresh-views. CONCURRENTLY means Postgres serves
 * reads from the old snapshot while the new one is being built — zero downtime.
 * Each REFRESH is issued sequentially so a failure in one doesn't skip the other.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { inngest } from "../client";

const VIEWS = ["revenue_by_service_daily", "client_retention_monthly"] as const;

export const refreshViews = inngest.createFunction(
  { id: "refresh-views", retries: 3, triggers: [{ event: "cron/refresh-views" }] },
  async ({ step }) => {
    const results: Record<string, "ok" | string> = {};

    for (const view of VIEWS) {
      const result = await step.run(`refresh-${view}`, async () => {
        try {
          await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`));
          return "ok" as const;
        } catch (err) {
          return err instanceof Error ? err.message : String(err);
        }
      });

      results[view] = result;
    }

    const allOk = Object.values(results).every((v) => v === "ok");
    return { ...results, allOk };
  },
);
