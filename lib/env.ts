/**
 * lib/env.ts — Validated, typed environment variables.
 *
 * Parses process.env once at module load (server-side only) and throws a
 * clear error at startup if any required variable is absent or malformed.
 * Import `env` instead of reaching for `process.env.X` directly.
 *
 * NEXT_PUBLIC_* variables are also validated here (they are available on the
 * server). Next.js inlines each `process.env.NEXT_PUBLIC_*` access as a
 * literal in client bundles, so the exports below work correctly in both
 * environments. Server-only variables (DATABASE_URL, etc.) become `""` in
 * client bundles and are never accessed there.
 */
import { z } from "zod";

const schema = z.object({
  // ── Database ──────────────────────────────────────────────────────────────
  /** Supabase pooler URL (port 6543, transaction mode) — used by the Drizzle runtime client. */
  DATABASE_POOLER_URL: z.string().url(),
  /** Direct connection (port 5432) — used by drizzle-kit for migrations only. */
  DIRECT_URL: z.string().url(),
  /** Kept for tooling compatibility (Supabase CLI, pg introspection). */
  DATABASE_URL: z.string().url().optional(),

  // ── Supabase ──────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // ── Email ─────────────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),
  /** Daily send limit. 100 for free tier, 50000 for Pro. */
  RESEND_DAILY_LIMIT: z.coerce.number().int().positive().optional(),

  // ── Upstash Redis (rate limiting) ─────────────────────────────────────────
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // ── Google reCAPTCHA v3 (bot protection) ──────────────────────────────────
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().min(1).optional(),
  RECAPTCHA_SECRET_KEY: z.string().min(1).optional(),

  // ── Security / Auth ───────────────────────────────────────────────────────
  /** Secret for authorizing Vercel cron job requests. */
  CRON_SECRET: z.string().min(1),
  /** Square webhook HMAC-SHA256 signing key for verifying inbound events. */
  SQUARE_WEBHOOK_SIGNATURE_KEY: z.string().min(1),
  /** Twilio Auth Token for verifying inbound SMS webhook signatures. */
  TWILIO_AUTH_TOKEN: z.string().min(1),
  /** HMAC secret for signing waiver completion tokens. */
  WAIVER_TOKEN_SECRET: z.string().min(1),

  // ── Square (optional — app runs in cash-only mode without these) ──────────
  SQUARE_ENVIRONMENT: z.string().optional(),
  SQUARE_LOCATION_ID: z.string().optional(),

  // ── Notifications / Analytics (optional) ─────────────────────────────────
  ADMIN_EMAIL: z.string().email().optional(),
  POSTHOG_API_KEY: z.string().optional(),
});

// Validation runs at server startup and during `next dev`, but is skipped
// during `next build` and when SKIP_ENV_VALIDATION is set. Runtime secrets
// (SUPABASE_SERVICE_ROLE_KEY, etc.) are only injected by Vercel at request
// time, not during the static build phase, so validating them at build would
// always fail in CI. SKIP_ENV_VALIDATION allows standalone tools like
// drizzle-kit to import this module without requiring every secret. The server
// process will still throw immediately on first request if a required var is
// absent.
if (
  typeof window === "undefined" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  process.env.NEXT_RUNTIME !== "edge" &&
  !process.env.SKIP_ENV_VALIDATION
) {
  const result = schema.safeParse({
    DATABASE_POOLER_URL: process.env.DATABASE_POOLER_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_DAILY_LIMIT: process.env.RESEND_DAILY_LIMIT,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    SQUARE_WEBHOOK_SIGNATURE_KEY: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    WAIVER_TOKEN_SECRET: process.env.WAIVER_TOKEN_SECRET,
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT,
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
  });

  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${String(i.path[0])}: ${i.message}`).join("\n");
    throw new Error(`Missing or invalid environment variables:\n${lines}`);
  }
}

// Individual process.env accesses let Next.js inline NEXT_PUBLIC_* as string
// literals in client bundles. The `as string` cast is safe because the
// validation above guarantees these are non-empty strings at server startup.
export const env = {
  DATABASE_POOLER_URL: process.env.DATABASE_POOLER_URL as string,
  DIRECT_URL: process.env.DIRECT_URL as string,
  DATABASE_URL: process.env.DATABASE_URL as string,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_DAILY_LIMIT: process.env.RESEND_DAILY_LIMIT
    ? parseInt(process.env.RESEND_DAILY_LIMIT, 10)
    : undefined,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
  // Required security vars — guaranteed non-empty by schema validation above
  CRON_SECRET: process.env.CRON_SECRET as string,
  SQUARE_WEBHOOK_SIGNATURE_KEY: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY as string,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN as string,
  WAIVER_TOKEN_SECRET: process.env.WAIVER_TOKEN_SECRET as string,
  // Optional vars
  SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT,
  SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
};
