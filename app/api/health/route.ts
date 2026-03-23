/**
 * GET /api/health — Deep health check for all critical dependencies.
 *
 * Runs checks in parallel and returns a structured JSON response.
 * Always returns within ~3 seconds (each check has its own timeout).
 *
 * Status logic:
 *   healthy  — all checks pass
 *   degraded — database ok, but an optional service (Redis, Square) is down
 *   failing  — database is down (app cannot serve requests)
 *
 * HTTP status codes:
 *   200 — healthy or degraded (app is up, may have reduced functionality)
 *   503 — failing (database unreachable)
 *
 * Response shape:
 * {
 *   status: "healthy" | "degraded" | "failing",
 *   checks: {
 *     database: { status: "pass" | "fail", latencyMs: number },
 *     redis:    { status: "pass" | "fail" | "skipped", latencyMs: number },
 *     env:      { status: "pass" | "fail", missing: string[] },
 *     square:   { status: "pass" | "fail" | "skipped" },
 *   },
 *   timestamp: string,
 *   version: string | undefined,
 * }
 *
 * @example
 *   curl https://tcreativestudio.com/api/health
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { redis } from "@/lib/redis";
import { squareClient, isSquareConfigured } from "@/lib/square";

/* ------------------------------------------------------------------ */
/*  Required env vars (keys only — no values exposed)                 */
/* ------------------------------------------------------------------ */

const REQUIRED_ENV_VARS = [
  "DATABASE_POOLER_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

/* ------------------------------------------------------------------ */
/*  Individual checks                                                  */
/* ------------------------------------------------------------------ */

async function checkDatabase(): Promise<{ status: "pass" | "fail"; latencyMs: number }> {
  const start = Date.now();
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    return { status: "pass", latencyMs: Date.now() - start };
  } catch {
    return { status: "fail", latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<{
  status: "pass" | "fail" | "skipped";
  latencyMs: number;
}> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { status: "skipped", latencyMs: 0 };
  }
  const start = Date.now();
  try {
    const result = await Promise.race([
      redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    return { status: result === "PONG" ? "pass" : "fail", latencyMs: Date.now() - start };
  } catch {
    return { status: "fail", latencyMs: Date.now() - start };
  }
}

function checkEnv(): { status: "pass" | "fail"; missing: string[] } {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  return { status: missing.length === 0 ? "pass" : "fail", missing };
}

async function checkSquare(): Promise<{ status: "pass" | "fail" | "skipped" }> {
  if (!isSquareConfigured()) {
    return { status: "skipped" };
  }
  try {
    await Promise.race([
      squareClient.locations.list(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    return { status: "pass" };
  } catch {
    return { status: "fail" };
  }
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function GET() {
  const [database, redisCheck, square] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkSquare(),
  ]);
  const env = checkEnv();

  const dbOk = database.status === "pass";
  const optionalFailing =
    redisCheck.status === "fail" || square.status === "fail" || env.status === "fail";

  const overallStatus = !dbOk ? "failing" : optionalFailing ? "degraded" : "healthy";

  return Response.json(
    {
      status: overallStatus,
      checks: {
        database,
        redis: redisCheck,
        env,
        square,
      },
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA,
    },
    {
      status: dbOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
