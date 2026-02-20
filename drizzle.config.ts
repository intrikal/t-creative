/**
 * drizzle.config — Drizzle Kit configuration for schema migrations and studio.
 *
 * Uses the DIRECT_URL (port 5432) for migrations to bypass PgBouncer's
 * transaction-pooling limitations on DDL statements. Falls back to
 * DATABASE_URL (port 6543, connection pooler) for runtime queries.
 *
 * @see https://orm.drizzle.team/docs/drizzle-config-file
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: true,
});
