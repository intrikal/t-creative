/**
 * GET /api/cron/waitlist-expiry — Triggers the Inngest waitlist-expiry function.
 * Vercel cron calls this endpoint; Inngest handles retries and observability.
 */
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ids = await inngest.send({ name: "cron/waitlist-expiry", data: {} });
  return NextResponse.json({ triggered: true, ids });
}
