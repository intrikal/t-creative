/**
 * GET /api/cron/review-requests — Triggers the Inngest review-requests function.
 * Vercel cron calls this endpoint; Inngest handles retries and observability.
 */
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { withCronMonitoring } from "@/lib/cron-monitor";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronMonitoring("review-requests", async () => {
    const ids = await inngest.send({ name: "cron/review-requests", data: {} });
    return { recordsProcessed: ids.ids.length };
  });
}
