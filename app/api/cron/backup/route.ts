/**
 * POST /api/cron/backup — Triggers the Inngest backup function.
 * Vercel cron calls this endpoint; Inngest handles retries and observability.
 */
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { withCronMonitoring } from "@/lib/cron-monitor";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  // Vercel sends the cron secret as Authorization: Bearer <secret>.
  // Fall back to x-cron-secret for backward compat with local dev.
  const authHeader = request.headers.get("authorization");
  const legacyHeader = request.headers.get("x-cron-secret");
  const providedSecret = authHeader?.replace("Bearer ", "") ?? legacyHeader;
  if (providedSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronMonitoring("backup", async () => {
    const ids = await inngest.send({ name: "cron/backup", data: {} });
    return { recordsProcessed: ids.ids.length };
  });
}
