// @vitest-environment node
/**
 * Tests for the environment variable validation module.
 *
 * Covers:
 *  - All required vars present → validation passes (no throw)
 *  - Missing DATABASE_POOLER_URL → throws with descriptive message
 *  - Missing CRON_SECRET → throws
 *  - Optional vars (RESEND_API_KEY) missing → no throw
 *  - RESEND_DAILY_LIMIT coerced to integer
 *  - Invalid URL format → throws with field name
 *  - Skips validation during build phase (NEXT_PHASE=phase-production-build)
 *
 * Uses vi.resetModules + dynamic import to re-trigger module-level validation.
 * Runs in Node environment (not jsdom) so typeof window === "undefined" and
 * the validation guard is active.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** A complete set of valid required environment variables. */
const VALID_ENV: Record<string, string> = {
  DATABASE_POOLER_URL: "https://db.example.com:6543/postgres",
  DIRECT_URL: "https://db.example.com:5432/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiJ9.test",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.service",
  CRON_SECRET: "cron-secret-value",
  SQUARE_WEBHOOK_SIGNATURE_KEY: "sq-webhook-key",
  TWILIO_AUTH_TOKEN: "twilio-auth-token",
  WAIVER_TOKEN_SECRET: "waiver-secret",
};

/** All keys managed by the env module (required + optional). */
const ALL_KEYS = [
  ...Object.keys(VALID_ENV),
  "DATABASE_URL",
  "RESEND_API_KEY",
  "RESEND_DAILY_LIMIT",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_RECAPTCHA_SITE_KEY",
  "RECAPTCHA_SECRET_KEY",
  "SQUARE_ENVIRONMENT",
  "SQUARE_LOCATION_ID",
  "ADMIN_EMAIL",
  "POSTHOG_API_KEY",
];

/**
 * Stub all required env vars (with optional overrides) and ensure
 * validation guards allow the check to run.
 */
function stubAllRequired(overrides: Record<string, string> = {}) {
  const vars = { ...VALID_ENV, ...overrides };
  for (const [key, value] of Object.entries(vars)) {
    vi.stubEnv(key, value);
  }
}

describe("lib/env", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    // Ensure a clean slate — remove all env keys the module reads
    for (const key of ALL_KEYS) {
      delete process.env[key];
    }
    // Ensure validation runs (not build phase, not edge, no skip flag)
    delete process.env.NEXT_PHASE;
    delete process.env.NEXT_RUNTIME;
    delete process.env.SKIP_ENV_VALIDATION;
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it("passes validation when all required vars are present", async () => {
    stubAllRequired();

    const { env } = await import("./env");

    expect(env.CRON_SECRET).toBe("cron-secret-value");
    expect(env.DATABASE_POOLER_URL).toBe("https://db.example.com:6543/postgres");
  });

  // ── Missing required vars ───────────────────────────────────────────────

  it("throws when DATABASE_POOLER_URL is missing", async () => {
    stubAllRequired();
    delete process.env.DATABASE_POOLER_URL;

    await expect(import("./env")).rejects.toThrow("DATABASE_POOLER_URL");
  });

  it("throws when CRON_SECRET is missing", async () => {
    stubAllRequired();
    delete process.env.CRON_SECRET;

    await expect(import("./env")).rejects.toThrow("CRON_SECRET");
  });

  // ── Optional vars ───────────────────────────────────────────────────────

  it("does not throw when optional RESEND_API_KEY is missing", async () => {
    stubAllRequired();
    // RESEND_API_KEY intentionally not set

    const { env } = await import("./env");

    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  // ── Coercion ────────────────────────────────────────────────────────────

  it("coerces RESEND_DAILY_LIMIT to an integer", async () => {
    stubAllRequired();
    vi.stubEnv("RESEND_DAILY_LIMIT", "100");

    const { env } = await import("./env");

    expect(env.RESEND_DAILY_LIMIT).toBe(100);
    expect(typeof env.RESEND_DAILY_LIMIT).toBe("number");
  });

  // ── Invalid format ──────────────────────────────────────────────────────

  it("throws with field name when a URL is invalid", async () => {
    stubAllRequired({ DATABASE_POOLER_URL: "not-a-url" });

    await expect(import("./env")).rejects.toThrow("DATABASE_POOLER_URL");
  });

  it("throws with field name when DIRECT_URL is not a valid URL", async () => {
    stubAllRequired({ DIRECT_URL: "bad" });

    await expect(import("./env")).rejects.toThrow("DIRECT_URL");
  });

  // ── Build-phase skip ────────────────────────────────────────────────────

  it("skips validation during build phase (NEXT_PHASE=phase-production-build)", async () => {
    // Do NOT stub required vars — they are missing
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    // Should not throw because validation is skipped during build
    const { env } = await import("./env");

    // env exports are still accessible (as undefined/cast strings)
    expect(env).toBeDefined();
  });

  it("skips validation when SKIP_ENV_VALIDATION is set", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");

    const { env } = await import("./env");

    expect(env).toBeDefined();
  });
});
