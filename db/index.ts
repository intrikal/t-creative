/**
 * db — Drizzle ORM client for Supabase Postgres.
 *
 * Uses the `postgres` driver (porsager/postgres) with the Supabase
 * connection pooler on port 6543. This client is intended for
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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

/**
 * Raw postgres.js connection.
 *
 * `prepare: false` is required when connecting through Supabase's
 * PgBouncer-based connection pooler (transaction mode doesn't
 * support prepared statements).
 */
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
});

/** Drizzle ORM instance with full schema for relational queries. */
export const db = drizzle(client, { schema });
