/**
 * GET /api/cron/email-queue-drain — Triggers the Inngest email-queue-drain function.
 * Vercel cron calls this endpoint daily at 00:05 UTC (just after midnight reset).
 */
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { withCronMonitoring } from "@/lib/cron-monitor";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronMonitoring("email-queue-drain", async () => {
    const ids = await inngest.send({ name: "cron/email-queue-drain", data: {} });
    return { recordsProcessed: ids.ids.length };
  });
}
