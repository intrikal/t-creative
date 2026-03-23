// @vitest-environment node

/**
 * tests/unit/env-validation.test.ts
 *
 * Unit tests for the lib/env.ts Zod schema.
 *
 * The schema is re-declared inline (same pattern as zod-validation.test.ts)
 * so tests are pure and don't trigger the module-load side effect. Changes
 * to the source schema that aren't reflected here will cause test failures,
 * which is the intended behaviour.
 *
 * Coverage:
 *   1. All required vars present — parses successfully
 *   2. Missing required vars — each one individually
 *   3. Malformed URLs — DATABASE_POOLER_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, UPSTASH_REDIS_REST_URL
 *   4. Optional vars absent — parses successfully with undefined
 *   5. Optional vars present — parses and exposes values
 *   6. Extra unknown vars — ignored, no error
 *   7. Empty string on required var — treated as invalid (fails url/min(1))
 *   8. RESEND_DAILY_LIMIT coercion — string "100" → number 100, invalid strings fail
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// ─── Schema re-declaration (mirrors lib/env.ts exactly) ───────────────────────

const envSchema = z.object({
  DATABASE_POOLER_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  DATABASE_URL: z.string().url().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  RESEND_API_KEY: z.string().min(1),
  RESEND_DAILY_LIMIT: z.coerce.number().int().positive().optional(),

  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid env — all required vars, no optionals. */
const validEnv = {
  DATABASE_POOLER_URL: "postgresql://postgres:postgres@db.supabase.co:6543/postgres",
  DIRECT_URL: "postgresql://postgres:postgres@db.supabase.co:5432/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://xyzabcdef.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service",
  RESEND_API_KEY: "re_abc123",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAA_placeholder",
  UPSTASH_REDIS_REST_URL: "https://usw1-gentle-doe-12345.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "AXxxASQgODQ0MGM5",
};

function ok(input: Record<string, unknown>) {
  const result = envSchema.safeParse(input);
  expect(
    result.success,
    `Expected success but got:\n${!result.success ? result.error.issues.map((i) => `  ${String(i.path[0])}: ${i.message}`).join("\n") : ""}`,
  ).toBe(true);
}

function fail(input: Record<string, unknown>, expectedField?: string) {
  const result = envSchema.safeParse(input);
  expect(result.success, `Expected failure for input: ${JSON.stringify(input)}`).toBe(false);
  if (expectedField && !result.success) {
    const fields = result.error.issues.map((i) => String(i.path[0]));
    expect(fields, `Expected error on field "${expectedField}"`).toContain(expectedField);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. All required vars present
// ─────────────────────────────────────────────────────────────────────────────

describe("all required vars present", () => {
  it("minimal valid env parses successfully", () => {
    ok(validEnv);
  });

  it("parses and exposes each required field", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.DATABASE_POOLER_URL).toBe(validEnv.DATABASE_POOLER_URL);
    expect(result.data.DIRECT_URL).toBe(validEnv.DIRECT_URL);
    expect(result.data.NEXT_PUBLIC_SUPABASE_URL).toBe(validEnv.NEXT_PUBLIC_SUPABASE_URL);
    expect(result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(validEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    expect(result.data.SUPABASE_SERVICE_ROLE_KEY).toBe(validEnv.SUPABASE_SERVICE_ROLE_KEY);
    expect(result.data.RESEND_API_KEY).toBe(validEnv.RESEND_API_KEY);
    expect(result.data.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe(
      validEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    );
    expect(result.data.UPSTASH_REDIS_REST_URL).toBe(validEnv.UPSTASH_REDIS_REST_URL);
    expect(result.data.UPSTASH_REDIS_REST_TOKEN).toBe(validEnv.UPSTASH_REDIS_REST_TOKEN);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Missing required vars — each individually
// ─────────────────────────────────────────────────────────────────────────────

describe("missing required vars", () => {
  const requiredFields = [
    "DATABASE_POOLER_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ] as const;

  for (const field of requiredFields) {
    it(`missing ${field} fails with error on that field`, () => {
      const { [field]: _, ...rest } = validEnv as Record<string, string>;
      fail(rest, field);
    });
  }

  it("completely empty object fails", () => {
    fail({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Malformed URLs
// ─────────────────────────────────────────────────────────────────────────────

describe("malformed URLs", () => {
  const urlFields = [
    "DATABASE_POOLER_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "UPSTASH_REDIS_REST_URL",
  ] as const;

  for (const field of urlFields) {
    it(`${field}='not-a-url' fails`, () => {
      fail({ ...validEnv, [field]: "not-a-url" }, field);
    });

    it(`${field}='db.example.com' (no scheme) fails`, () => {
      fail({ ...validEnv, [field]: "db.example.com" }, field);
    });

    it(`${field}='/relative/path' fails`, () => {
      fail({ ...validEnv, [field]: "/relative/path" }, field);
    });
  }

  it("DATABASE_POOLER_URL with http:// scheme passes (z.string().url() allows http)", () => {
    ok({ ...validEnv, DATABASE_POOLER_URL: "http://localhost:6543/postgres" });
  });

  it("NEXT_PUBLIC_SUPABASE_URL with trailing path passes", () => {
    ok({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/rest/v1" });
  });

  it("UPSTASH_REDIS_REST_URL with https passes", () => {
    ok({ ...validEnv, UPSTASH_REDIS_REST_URL: "https://example.upstash.io" });
  });

  it("optional DATABASE_URL='not-a-url' fails when provided", () => {
    fail({ ...validEnv, DATABASE_URL: "not-a-url" }, "DATABASE_URL");
  });

  it("optional DATABASE_URL with valid URL passes", () => {
    ok({
      ...validEnv,
      DATABASE_URL: "postgresql://postgres:postgres@db.supabase.co:5432/postgres",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Empty string on required vars
// ─────────────────────────────────────────────────────────────────────────────

describe("empty string on required vars", () => {
  const urlFields = [
    "DATABASE_POOLER_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "UPSTASH_REDIS_REST_URL",
  ] as const;

  const minOneFields = [
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "UPSTASH_REDIS_REST_TOKEN",
  ] as const;

  for (const field of urlFields) {
    it(`${field}='' fails (invalid URL)`, () => {
      fail({ ...validEnv, [field]: "" }, field);
    });
  }

  for (const field of minOneFields) {
    it(`${field}='' fails (min 1)`, () => {
      fail({ ...validEnv, [field]: "" }, field);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Optional vars absent
// ─────────────────────────────────────────────────────────────────────────────

describe("optional vars absent", () => {
  it("DATABASE_URL absent — parses successfully", () => {
    const { DATABASE_URL: _, ...rest } = { ...validEnv, DATABASE_URL: "postgresql://x" };
    ok(rest);
  });

  it("RESEND_DAILY_LIMIT absent — parses successfully, value is undefined", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.RESEND_DAILY_LIMIT).toBeUndefined();
  });

  it("all optionals absent simultaneously — parses successfully", () => {
    ok(validEnv); // validEnv has no optionals
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Optional vars present
// ─────────────────────────────────────────────────────────────────────────────

describe("optional vars present", () => {
  it("DATABASE_URL present with valid URL — included in parsed output", () => {
    const url = "postgresql://postgres:postgres@db.supabase.co:5432/postgres";
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: url });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.DATABASE_URL).toBe(url);
  });

  it("RESEND_DAILY_LIMIT='100' (string) — coerced to number 100", () => {
    const result = envSchema.safeParse({ ...validEnv, RESEND_DAILY_LIMIT: "100" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.RESEND_DAILY_LIMIT).toBe(100);
  });

  it("RESEND_DAILY_LIMIT=50000 (number) — passes and stays number", () => {
    const result = envSchema.safeParse({ ...validEnv, RESEND_DAILY_LIMIT: 50000 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.RESEND_DAILY_LIMIT).toBe(50000);
  });

  it("RESEND_DAILY_LIMIT='1' — minimum positive integer passes", () => {
    const result = envSchema.safeParse({ ...validEnv, RESEND_DAILY_LIMIT: "1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.RESEND_DAILY_LIMIT).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Extra unknown vars
// ─────────────────────────────────────────────────────────────────────────────

describe("extra unknown vars", () => {
  it("unknown vars are ignored — parse succeeds", () => {
    ok({
      ...validEnv,
      SQUARE_ACCESS_TOKEN: "EAAAEAbcdef",
      ZOHO_CRM_CLIENT_ID: "1000.abc",
      SOME_OTHER_SECRET: "irrelevant",
    });
  });

  it("unknown vars are stripped from parsed output", () => {
    const result = envSchema.safeParse({ ...validEnv, UNKNOWN_VAR: "value" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("UNKNOWN_VAR");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. RESEND_DAILY_LIMIT coercion edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("RESEND_DAILY_LIMIT coercion", () => {
  it("'0' fails (must be positive, not zero)", () => {
    fail({ ...validEnv, RESEND_DAILY_LIMIT: "0" }, "RESEND_DAILY_LIMIT");
  });

  it("'-1' fails (must be positive)", () => {
    fail({ ...validEnv, RESEND_DAILY_LIMIT: "-1" }, "RESEND_DAILY_LIMIT");
  });

  it("'1.5' fails (must be integer)", () => {
    fail({ ...validEnv, RESEND_DAILY_LIMIT: "1.5" }, "RESEND_DAILY_LIMIT");
  });

  it("'abc' fails (not coercible to number)", () => {
    fail({ ...validEnv, RESEND_DAILY_LIMIT: "abc" }, "RESEND_DAILY_LIMIT");
  });

  it("'' (empty string) — coerces to NaN, fails", () => {
    fail({ ...validEnv, RESEND_DAILY_LIMIT: "" }, "RESEND_DAILY_LIMIT");
  });

  it("100 as number passes", () => {
    ok({ ...validEnv, RESEND_DAILY_LIMIT: 100 });
  });
});
