/**
 * GET /api/health — Liveness + database connectivity check.
 *
 * Returns 200 when the app is running and the database responds, or 503 when
 * the database ping fails. Suitable for Vercel deploy health checks and
 * external uptime monitors.
 *
 * Response shape:
 *   { status: "ok" | "error", db: "ok" | "error", latencyMs: number, timestamp: string }
 *
 * @example
 *   curl https://tcreativestudio.com/api/health
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  const start = Date.now();

  try {
    await db.execute(sql`SELECT 1`);

    return NextResponse.json(
      {
        status: "ok",
        db: "ok",
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        db: "error",
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
