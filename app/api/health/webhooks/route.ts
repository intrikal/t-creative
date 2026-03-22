/**
 * GET /api/health/webhooks — Square webhook health check.
 *
 * Returns the last successful webhook timestamp and the signature-failure
 * count for the current 1-hour sliding window. Used by the admin dashboard
 * Webhooks status badge and for external uptime monitoring.
 *
 * status values:
 *   healthy  — 0 failures in the last hour
 *   degraded — 1–4 failures in the last hour
 *   failing  — 5+ failures in the last hour
 *
 * Secured with CRON_SECRET (same mechanism as cron routes) so it isn't
 * publicly enumerable, but it can also be called unauthenticated from the
 * admin dashboard server component which passes the secret server-side.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { redis } from "@/lib/redis";

export async function GET() {
  await requireAdmin();

  const [lastSuccess, failures] = await Promise.all([
    redis.get<string>("webhook:last_success"),
    redis.get<number>("webhook:sig_failures"),
  ]);

  const failureCount = Number(failures ?? 0);
  const status: "healthy" | "degraded" | "failing" =
    failureCount >= 5 ? "failing" : failureCount > 0 ? "degraded" : "healthy";

  return NextResponse.json({
    lastSuccessfulWebhook: lastSuccess ?? null,
    failureCountLastHour: failureCount,
    status,
  });
}
