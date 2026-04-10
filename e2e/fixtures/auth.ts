/**
 * E2E auth fixture — Supabase test-user helpers.
 *
 * ## How it works
 * 1. Uses the Supabase admin SDK (service-role key) to create a test user in
 *    `auth.users` (idempotent — skips creation if the email already exists).
 * 2. Upserts a `profiles` row with the desired role and a non-empty `first_name`
 *    so `isOnboardingComplete()` returns true and the auth callback doesn't
 *    redirect to /onboarding.
 * 3. Generates a magic-link via `auth.admin.generateLink()` and navigates to it.
 *    The link goes through the real `/auth/callback` route which sets session
 *    cookies exactly as a real sign-in would.
 *
 * ## Requirements
 * Set these env vars (in .env.local or CI secrets) to enable authenticated tests:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
 *
 * Tests that call `signInAs*` return false and are skipped via `test.skip()`
 * when these variables are absent, so the suite stays green in environments
 * without a live Supabase project.
 */

import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = "http://localhost:3000";

/** Dedicated test-user email addresses — never used by real accounts. */
export const TEST_EMAILS = {
  client: "e2e-client@test.tcreativestudio.com",
  admin: "e2e-admin@test.tcreativestudio.com",
  assistant: "e2e-assistant@test.tcreativestudio.com",
} as const;

/** Returns true when both Supabase admin env vars are present. */
export function hasAuthConfig(): boolean {
  return !!(SUPABASE_URL && SERVICE_ROLE_KEY);
}

/**
 * Signs the given email into the running dev server via a Supabase magic link.
 *
 * @param page     - Playwright Page to navigate with.
 * @param email    - Email to sign in as (must already exist or will be created).
 * @param role     - Role to seed onto the profile row ("client" | "admin").
 * @returns true on success, false if auth config is missing or an error occurs.
 */
export async function signInAs(
  page: Page,
  email: string,
  role: "client" | "admin" | "assistant" = "client",
): Promise<boolean> {
  if (!hasAuthConfig()) return false;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Ensure the auth.users row exists ───────────────────────────
  let userId: string;

  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createError) {
    // User likely already exists — find their ID via the profiles table.
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .limit(1);

    const existing = profileRows?.[0] as { id: string } | undefined;
    if (!existing) {
      console.error("[e2e/auth] Could not create or find test user:", createError.message);
      return false;
    }
    userId = existing.id;
  } else {
    userId = userData.user.id;
  }

  // ── 2. Seed the profile row with a complete onboarding state ──────
  // first_name must be non-empty so isOnboardingComplete() returns true.
  // last_name is NOT NULL in the schema so we provide a placeholder too.
  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      role,
      first_name: "E2E",
      last_name: "Test",
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    console.error("[e2e/auth] Failed to upsert profile:", upsertError.message);
    return false;
  }

  // ── 3. Generate a magic link and navigate to it ───────────────────
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${BASE_URL}/auth/callback` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[e2e/auth] Failed to generate magic link:", linkError?.message);
    return false;
  }

  await page.goto(linkData.properties.action_link);
  await page.waitForLoadState("networkidle");

  return true;
}

/** Convenience wrapper: sign in as the shared E2E client user. */
export async function signInAsClient(page: Page): Promise<boolean> {
  return signInAs(page, TEST_EMAILS.client, "client");
}

/**
 * Convenience wrapper: sign in as the shared E2E admin user.
 *
 * Note: the auth callback only hard-redirects known admin emails to /admin.
 * Our test admin email is NOT in ADMIN_EMAILS, so the callback falls through
 * to the generic `profile.role` check. Because we seed `role = "admin"` on the
 * profile row *before* the callback reads it, the callback sees role="admin"
 * and redirects to /admin correctly.
 */
export async function signInAsAdmin(page: Page): Promise<boolean> {
  return signInAs(page, TEST_EMAILS.admin, "admin");
}

/** Convenience wrapper: sign in as the shared E2E assistant user. */
export async function signInAsAssistant(page: Page): Promise<boolean> {
  return signInAs(page, TEST_EMAILS.assistant, "assistant");
}
