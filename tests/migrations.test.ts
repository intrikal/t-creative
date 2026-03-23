/**
 * tests/migrations.test.ts
 *
 * Integration test suite for Drizzle migrations.
 * Spins up a real Postgres 15 container via testcontainers and verifies:
 *   1. All migrations apply cleanly to a fresh database
 *   2. Expected tables exist (information_schema.tables)
 *   3. Critical indexes exist (pg_indexes)
 *   4. CHECK constraints exist on money columns (pg_constraint)
 *   5. The seed script runs without error
 *   6. Migrations are idempotent (second run produces no errors)
 *
 * Tagged @slow — skipped in watch mode via describe.skipIf(process.env.VITEST_WATCH).
 *
 * Run: npx vitest run tests/migrations.test.ts
 */

import { execSync } from "child_process";
import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ─── Skip in watch mode ────────────────────────────────────────────────────────

const isWatch = !!process.env.VITEST_WATCH;

describe.skipIf(isWatch)("@slow database migrations", () => {
  let container: StartedTestContainer;
  let connectionString: string;
  let sql: ReturnType<typeof postgres>;

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  beforeAll(async () => {
    container = await new GenericContainer("postgres:15-alpine")
      .withEnvironment({
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: "postgres",
        POSTGRES_DB: "t_creative_test",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/))
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);
    connectionString = `postgresql://postgres:postgres@${host}:${port}/t_creative_test`;

    sql = postgres(connectionString, { max: 5 });
  }, 120_000); // Allow 2 min for Docker pull on first run

  afterAll(async () => {
    await sql?.end();
    await container?.stop();
  });

  // ─── Helper ──────────────────────────────────────────────────────────────────

  async function runMigrations() {
    const db = drizzle(sql);
    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, "../drizzle"),
    });
  }

  // ─── 1. Migrations apply cleanly ─────────────────────────────────────────────

  it("applies all migrations to a fresh database without error", async () => {
    await expect(runMigrations()).resolves.not.toThrow();
  }, 60_000);

  // ─── 2. Expected tables exist ────────────────────────────────────────────────

  it("creates all expected tables", async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const tables = rows.map((r) => r.table_name);

    const expectedTables = [
      // Core domain
      "profiles",
      "services",
      "bookings",
      "payments",
      // Membership & loyalty
      "membership_plans",
      "membership_subscriptions",
      "loyalty_transactions",
      // Gift cards & promotions
      "gift_cards",
      "gift_card_transactions",
      "promotions",
      // Scheduling & availability
      "business_hours",
      "time_off",
      // Settings & config
      "settings",
      // Communication
      "messages",
      "notifications",
      "notification_preferences",
      // Reviews & media
      "reviews",
      "media",
      // Integrations
      "sync_log",
      // Email queue (added in 0050)
      "email_queue",
      // Audit
      "audit_log",
      // Waitlist
      "waitlist",
    ];

    for (const table of expectedTables) {
      expect(tables, `Missing table: ${table}`).toContain(table);
    }
  });

  // ─── 3. Critical indexes exist ───────────────────────────────────────────────

  it("creates critical partial indexes", async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;

    const indexes = rows.map((r) => r.indexname);

    // Indexes created in 0036_partial_indexes.sql
    expect(indexes, "Missing partial index: bookings_active_client_idx").toContain(
      "bookings_active_client_idx",
    );
    expect(indexes, "Missing partial index: payments_paid_range_idx").toContain(
      "payments_paid_range_idx",
    );
    expect(indexes, "Missing partial index: promotions_live_idx").toContain("promotions_live_idx");
  });

  // ─── 4. CHECK constraints on money columns ───────────────────────────────────

  it("enforces CHECK constraints on money columns", async () => {
    const rows = await sql<{ conname: string }[]>`
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE c.contype = 'c'
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY t.relname, c.conname
    `;

    const constraints = rows.map((r) => r.conname);

    // Constraints from 0035_check_constraints.sql
    const expectedConstraints = [
      "bookings_total_in_cents_nonneg",
      "bookings_duration_minutes_pos",
      "bookings_discount_in_cents_nonneg",
      "bookings_discount_lte_total",
      "bookings_deposit_paid_nonneg",
      "payments_amount_in_cents_pos",
      "gift_cards_balance_in_cents_nonneg",
    ];

    for (const constraint of expectedConstraints) {
      expect(constraints, `Missing CHECK constraint: ${constraint}`).toContain(constraint);
    }
  });

  it("rejects negative money values (CHECK constraint enforcement)", async () => {
    // Verify the constraints are actually enforced at the DB engine level
    await expect(
      sql`
        INSERT INTO gift_cards (code, original_amount_in_cents, balance_in_cents, status, purchased_at, expires_at)
        VALUES ('TEST-NEG', 5000, -1, 'active', now(), now() + interval '1 year')
      `,
    ).rejects.toThrow();
  });

  // ─── 5. Seed script runs without error ───────────────────────────────────────

  it("runs seed script against the migrated database without error", () => {
    const seedPath = path.resolve(__dirname, "../scripts/seed.ts");

    expect(() => {
      execSync(`npx tsx "${seedPath}"`, {
        env: {
          ...process.env,
          NODE_ENV: "test",
          DIRECT_URL: connectionString,
          // Satisfy lib/env.ts Zod validation at import time
          DATABASE_URL: connectionString,
          DATABASE_POOLER_URL: connectionString,
          NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder",
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
          NEXT_PUBLIC_POSTHOG_KEY: "phc_placeholder",
          NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
          RESEND_API_KEY: "re_placeholder",
          SENTRY_DSN: "",
        },
        stdio: "pipe",
        timeout: 60_000,
      });
    }, "Seed script exited with non-zero status").not.toThrow();
  }, 90_000);

  it("seed script inserts expected row counts", async () => {
    const [{ count: profileCount }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM profiles
    `;
    // 1 admin + 3 staff + 25 clients = 29
    expect(Number(profileCount)).toBe(29);

    const [{ count: serviceCount }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM services
    `;
    expect(Number(serviceCount)).toBe(8);

    const [{ count: bookingCount }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM bookings
    `;
    expect(Number(bookingCount)).toBe(40);

    const [{ count: giftCardCount }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM gift_cards
    `;
    expect(Number(giftCardCount)).toBe(5);
  });

  // ─── 6. Idempotency: second migration run ────────────────────────────────────

  it("running migrations a second time is idempotent (no errors)", async () => {
    // Drizzle tracks applied migrations in __drizzle_migrations table.
    // Re-running should be a no-op with no errors.
    await expect(runMigrations()).resolves.not.toThrow();
  });

  it("table count is unchanged after second migration run", async () => {
    const [{ count: before }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    await runMigrations();

    const [{ count: after }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    expect(Number(after)).toBe(Number(before));
  });
});
