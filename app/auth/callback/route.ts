/**
 * GET /auth/callback — Supabase PKCE OAuth callback handler.
 *
 * ## What is this route?
 * When a user clicks "Continue with Google" (or any OAuth provider), they are
 * redirected to that provider's login page. After they approve, the provider
 * sends them back to THIS URL with a short-lived `code` in the query string.
 * This route takes that code and completes the sign-in process.
 *
 * ## What is PKCE?
 * PKCE (Proof Key for Code Exchange) is a security mechanism used by OAuth.
 * Instead of storing a secret on the client, it generates a random "verifier"
 * before the redirect and a "challenge" that the server validates on return.
 * Supabase handles all the PKCE cryptography automatically — we just call
 * `exchangeCodeForSession(code)` and it does the rest.
 *
 * ## Full flow (in order):
 * 1. Validate that a `code` was actually provided (guards against direct access to this URL).
 * 2. Exchange the code for a real Supabase session (sets auth cookies in the browser).
 * 3. Look up the user's profile row in our own database.
 * 4. If an `invite` token is present in the URL, verify it and promote the user to "assistant".
 * 5. If the user's account is deactivated, sign them out and send to /suspended.
 * 6. If onboarding hasn't been completed, send them to /onboarding with their role.
 * 7. Otherwise, send them to the home page.
 *
 * ## Where does the `invite` query param come from?
 * Trini (admin) generates invite links via the /api/invites endpoint. Those links
 * include the login URL with an `invite=<jwt>` parameter. The LoginPage threads
 * that token through the OAuth redirect so it arrives here after sign-in.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { isOnboardingComplete } from "@/lib/auth";
import { verifyInviteToken } from "@/lib/invite";
import { createClient } from "@/utils/supabase/server";

/**
 * Known admin email addresses. Add Trini's email here when she joins.
 * On first sign-in, these users are automatically promoted to the "admin" role.
 */
const ADMIN_EMAILS = ["alvinwquach@gmail.com"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // `code` is the one-time authorization code from the OAuth provider
  const code = searchParams.get("code");
  // `invite` is an optional JWT from an admin invite link (may be null for regular sign-ins)
  const invite = searchParams.get("invite");

  // Guard: if there's no code, something went wrong before we got here
  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/error?detail=Something+went+wrong+during+sign-in.+Please+try+again.`,
    );
  }

  const supabase = await createClient();

  /**
   * Exchange the short-lived `code` for a full Supabase session.
   * This call sets the auth cookies on the response so the user is
   * considered logged in for all subsequent server requests.
   */
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?detail=Authentication+failed.+Please+try+again.`,
    );
  }

  /**
   * Re-fetch the user from the newly established session.
   * We call getUser() rather than trusting the session data directly
   * because getUser() validates the JWT against Supabase's servers,
   * making it safe to use for authorization decisions.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${origin}/auth/error?detail=Authentication+failed.+Please+try+again.`,
    );
  }

  /**
   * Look up this user's profile row in our own `profiles` table.
   * This row is auto-created by a Supabase database trigger on first sign-up.
   * It may be null on the very first sign-in if the trigger hasn't run yet
   * (in practice it should always exist by this point).
   */
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  /**
   * Invite token handling — promote user to "assistant" role.
   *
   * If the URL contains a valid `invite` JWT, we verify it and update
   * the user's role. We only do this if the profile exists (it should)
   * and the token passes cryptographic verification (not expired, not tampered).
   *
   * `assignedAssistant` tracks whether we just promoted them so the
   * onboarding redirect below can use the correct role even before
   * the database update is reflected back in the `profile` variable.
   */
  /**
   * Admin promotion — if the signing-in user's email is in the ADMIN_EMAILS
   * allowlist, ensure their role is set to "admin". This runs on every sign-in
   * so adding a new email to the list takes effect automatically.
   */
  let assignedAdmin = false;
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
    if (profile && profile.role !== "admin") {
      await db.update(profiles).set({ role: "admin" }).where(eq(profiles.id, user.id));
    }
    assignedAdmin = true;
  }

  let assignedAssistant = false;
  if (!assignedAdmin && invite) {
    const payload = await verifyInviteToken(invite);
    if (payload && profile) {
      await db.update(profiles).set({ role: "assistant" }).where(eq(profiles.id, user.id));
      assignedAssistant = true;
    }
  }

  /**
   * Ban check — if the account has been deactivated by an admin, block access.
   * We sign them out first to clear the session we just created, then redirect
   * to /suspended so they see an explanation instead of a blank error.
   */
  if (profile && !profile.isActive) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/suspended`);
  }

  // Admins need minimal onboarding (just name) before accessing the dashboard
  if (assignedAdmin || profile?.role === "admin") {
    if (!isOnboardingComplete(profile ?? null)) {
      return NextResponse.redirect(`${origin}/onboarding?role=admin`);
    }
    return NextResponse.redirect(`${origin}/admin`);
  }

  /**
   * Onboarding check — new users must complete onboarding before using the app.
   *
   * `isOnboardingComplete` checks if `profile.firstName` has been filled in,
   * which is set at the end of the onboarding wizard. If it's empty, the user
   * is new and needs to go through onboarding.
   *
   * The role determines which onboarding flow they see:
   * - "assistant" flow: shift availability, skills, emergency contact, etc.
   * - "client" flow:    interests, allergies, contact info, waiver, etc.
   *
   * We use `assignedAssistant` here because the profile row's `role` field
   * may not reflect the update we just made above (stale local variable).
   */
  if (!isOnboardingComplete(profile ?? null)) {
    const role = assignedAssistant || profile?.role === "assistant" ? "assistant" : "client";
    return NextResponse.redirect(`${origin}/onboarding?role=${role}`);
  }

  // Route each role to their home base after sign-in
  if (assignedAssistant || profile?.role === "assistant") {
    return NextResponse.redirect(`${origin}/assistant`);
  }

  return NextResponse.redirect(`${origin}/`);
}
