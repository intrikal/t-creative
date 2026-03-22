/**
 * GET /api/cron/refresh-views — Refresh analytics materialized views.
 *
 * CONCURRENTLY means Postgres serves reads from the old snapshot while the
 * new one is being built — zero downtime, no blocked queries. Requires a
 * unique index on each view (created in migration 0039).
 *
 * Runs every 4 hours so analytics data is never more than ~4 hours stale.
 * Each REFRESH is issued sequentially so a failure in one doesn't skip the
 * other, but both results are reported in the response.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

const VIEWS = ["revenue_by_service_daily", "client_retention_monthly"] as const;

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, "ok" | string> = {};

  for (const view of VIEWS) {
    try {
      await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`));
      results[view] = "ok";
    } catch (err) {
      results[view] = err instanceof Error ? err.message : String(err);
    }
  }

  const allOk = Object.values(results).every((v) => v === "ok");
  return NextResponse.json(results, { status: allOk ? 200 : 500 });
}
