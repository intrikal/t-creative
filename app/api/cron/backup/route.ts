/**
 * POST /api/cron/backup — Triggers the Inngest backup function.
 * Vercel cron calls this endpoint; Inngest handles retries and observability.
 */
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { withCronMonitoring } from "@/lib/cron-monitor";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronMonitoring("backup", async () => {
    const ids = await inngest.send({ name: "cron/backup", data: {} });
    return { recordsProcessed: ids.ids.length };
  });
}
