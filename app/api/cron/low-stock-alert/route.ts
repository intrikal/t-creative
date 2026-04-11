/**
 * GET /api/cron/low-stock-alert — Triggers the Inngest low-stock-alert function.
 * Vercel cron calls this endpoint daily at 8 AM; Inngest handles retries and observability.
 */
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { withCronMonitoring } from "@/lib/cron-monitor";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const legacyHeader = request.headers.get("x-cron-secret");
  const providedSecret = authHeader?.replace("Bearer ", "") ?? legacyHeader;
  if (providedSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronMonitoring("low-stock-alert", async () => {
    const ids = await inngest.send({ name: "cron/low-stock-alert", data: {} });
    return { recordsProcessed: ids.ids.length };
  });
}
