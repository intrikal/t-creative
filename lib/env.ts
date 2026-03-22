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
  RESEND_API_KEY: z.string().min(1),

  // ── CAPTCHA ───────────────────────────────────────────────────────────────
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),

  // ── Upstash Redis (rate limiting + caching) ───────────────────────────────
  // Optional so the app starts without Redis configured (ops degrade gracefully).
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

// Validation runs at server startup and during `next dev`, but is skipped
// during `next build`. Runtime secrets (SUPABASE_SERVICE_ROLE_KEY, etc.) are
// only injected by Vercel at request time, not during the static build phase,
// so validating them at build would always fail in CI. The server process will
// still throw immediately on first request if a required var is absent.
if (typeof window === "undefined" && process.env.NEXT_PHASE !== "phase-production-build") {
  const result = schema.safeParse({
    DATABASE_POOLER_URL: process.env.DATABASE_POOLER_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
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
  RESEND_API_KEY: process.env.RESEND_API_KEY as string,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};
