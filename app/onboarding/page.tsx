/**
 * OnboardingPage — the /onboarding entry point (Server Component).
 *
 * ## Responsibility
 * Reads the authenticated user's Google OAuth metadata and the `?role` query
 * param, then renders `OnboardingFlow` with the right initial values.
 *
 * ## Role resolution
 * The `role` query parameter is set by the auth callback (`app/auth/callback/route.ts`)
 * based on the user's email address:
 * - Emails in `ADMIN_EMAILS` → `?role=admin`
 * - Emails in `ASSISTANT_EMAILS` → `?role=assistant`
 * - All others → defaults to `"client"`
 *
 * ## Google metadata extraction
 * Supabase maps Google's OAuth `profile` scope to `user.user_metadata`. The
 * exact field names vary slightly by provider version:
 * - `full_name` or `name` → the user's full display name
 * - `given_name` → first name only (preferred for greeting)
 * - `avatar_url` → Google profile photo URL
 *
 * We try `given_name` first, then fall back to the first word of `full_name`/`name`.
 * These values pre-populate the name fields in StepAdminName / StepName but the
 * user can always override them.
 *
 * ## Why this is a Server Component
 * Reading auth cookies (via Supabase's `createClient()`) requires server-side
 * execution. Passing the extracted values as props avoids an extra client-side
 * fetch and means the form is pre-filled on first render with no loading state.
 */
import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Welcome | T Creative Studio",
  description: "Tell us a little about yourself so we can personalize your experience.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = await searchParams;
  const role =
    params.role === "assistant" ? "assistant" : params.role === "admin" ? "admin" : "client";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  // Supabase maps Google's "name" field to user_metadata.name (full name).
  // "full_name" and "given_name" are also possible depending on provider version — try all.
  const meta = user?.user_metadata ?? {};
  const fullName =
    (meta.full_name as string | undefined) || (meta.name as string | undefined) || "";
  const firstName = (meta.given_name as string | undefined) || fullName.split(" ")[0] || "";
  const avatarUrl = (meta.avatar_url as string | undefined) ?? "";

  return (
    <OnboardingFlow
      role={role as "client" | "assistant" | "admin"}
      email={email}
      googleName={firstName}
      fullName={fullName}
      avatarUrl={avatarUrl}
    />
  );
}
