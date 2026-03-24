/**
 * db — Drizzle ORM client for Supabase Postgres.
 *
 * Uses the `postgres` driver (porsager/postgres) with the Supabase
 * connection pooler URL (DATABASE_POOLER_URL, port 6543, transaction mode).
 * This client is intended for
 * Server Components, Server Actions, and API routes — never import
 * it in client components.
 *
 * The connection is module-scoped and reused across requests in
 * development (hot reload safe) and in production (single instance
 * per serverless invocation).
 *
 * @example
 *   import { db } from "@/db";
 *   import { profiles } from "@/db/schema";
 *
 *   const users = await db.select().from(profiles).where(eq(profiles.role, "client"));
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Raw postgres.js connection.
 *
 * `prepare: false` is required when connecting through Supabase's
 * PgBouncer-based connection pooler (transaction mode doesn't
 * support prepared statements).
 *
 * Stored on `globalThis` in development so Next.js hot-reloads don't
 * create a new pool on every module re-evaluation (which exhausts the
 * Supabase pooler's 25-connection limit and causes timeout hangs).
 */
const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
};

// Use process.env directly (not the validated `env` object) so the
// connection string is available during `next build` prerendering,
// where the Zod validation is skipped and `env.*` may be undefined.
const connectionString = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL || "";

const client =
  globalForDb.__pgClient ??
  postgres(connectionString, {
    prepare: false,
    // Supabase free tier allows 25 pooler connections. Keep headroom for
    // migrations, cron jobs, and hot-reload edge cases in dev.
    max: 10,
    // Release idle connections after 10s (down from 20s) so restarts don't
    // leave Supabase holding connections for long.
    idle_timeout: process.env.NODE_ENV === "production" ? 20 : 10,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient = client;
}

/** Drizzle ORM instance with full schema for relational queries. */
export const db = drizzle(client, { schema });
