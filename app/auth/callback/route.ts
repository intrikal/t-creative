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
import React from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, loyaltyTransactions } from "@/db/schema";
import { ReferralBonus } from "@/emails/ReferralBonus";
import { isOnboardingComplete } from "@/lib/auth";
import { verifyInviteToken } from "@/lib/invite";
import { identifyUser, trackEvent } from "@/lib/posthog";
import { sendEmail, getEmailRecipient, isResendConfigured } from "@/lib/resend";
import { upsertZohoContact } from "@/lib/zoho";
import { createClient } from "@/utils/supabase/server";

const REFERRAL_REFERRER_POINTS = 100;
const REFERRAL_REFEREE_POINTS = 50;

/**
 * Award referral points to both the referrer and the new client (referee).
 * Fire-and-forget — errors are caught internally so they never block the redirect.
 */
async function awardReferralBonus(
  newClientId: string,
  newClientFirstName: string,
  refCode: string,
): Promise<void> {
  try {
    const [referrer] = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        referralCode: profiles.referralCode,
      })
      .from(profiles)
      .where(eq(profiles.referralCode, refCode))
      .limit(1);

    // Guard: referrer must exist and must not be the same person signing up
    if (!referrer || referrer.id === newClientId) return;

    await Promise.all([
      // Points for the referrer
      db.insert(loyaltyTransactions).values({
        profileId: referrer.id,
        points: REFERRAL_REFERRER_POINTS,
        type: "referral_referrer",
        description: `Referred ${newClientFirstName || "a friend"} — welcome bonus`,
        referenceId: newClientId,
      }),
      // Points for the new client (referee)
      db.insert(loyaltyTransactions).values({
        profileId: newClientId,
        points: REFERRAL_REFEREE_POINTS,
        type: "referral_referee",
        description: `Joined via ${referrer.firstName}'s referral link`,
        referenceId: referrer.id,
      }),
      // Record the referral on the new client's profile
      db
        .update(profiles)
        .set({ referredBy: referrer.id, source: "referral" })
        .where(eq(profiles.id, newClientId)),
    ]);

    // Send a "you earned a referral bonus!" email to the referrer (non-blocking)
    if (isResendConfigured()) {
      const recipient = await getEmailRecipient(referrer.id);
      if (recipient) {
        void sendEmail({
          to: recipient.email,
          subject: `You earned ${REFERRAL_REFERRER_POINTS} points — referral bonus!`,
          react: React.createElement(ReferralBonus, {
            referrerName: referrer.firstName,
            refereeName: newClientFirstName || "a friend",
            pointsEarned: REFERRAL_REFERRER_POINTS,
          }),
          entityType: "referral_bonus",
          localId: newClientId,
        });
      }
    }
  } catch (err) {
    console.error("[referral] awardReferralBonus failed:", err);
  }
}

/**
 * Known admin email addresses. Add Trini's email here when she joins.
 * On first sign-in, these users are automatically promoted to the "admin" role.
 */
const ADMIN_EMAILS = ["alvinwquach@gmail.com"];

/**
 * Known assistant email addresses. Add team members here for dev/staging access.
 * On first sign-in, these users are automatically promoted to the "assistant" role
 * and redirected to the assistant onboarding flow.
 *
 * For production, prefer the invite-token flow (`/api/invites`) so new assistants
 * receive a scoped, expiring link rather than being allowlisted permanently.
 */
const ASSISTANT_EMAILS = ["retrobytetech@gmail.com"];

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

  // Email allowlist — promotes known assistant emails on every sign-in.
  if (!assignedAdmin && user.email && ASSISTANT_EMAILS.includes(user.email)) {
    if (profile && profile.role !== "assistant") {
      await db.update(profiles).set({ role: "assistant" }).where(eq(profiles.id, user.id));
    }
    assignedAssistant = true;
  }

  // Invite token — promotes users who arrived via an admin-generated invite link.
  if (!assignedAdmin && !assignedAssistant && invite) {
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

  // PostHog: identify user + track sign-in
  const effectiveRole = assignedAdmin
    ? "admin"
    : assignedAssistant || profile?.role === "assistant"
      ? "assistant"
      : (profile?.role ?? "client");
  const isNewUser = !isOnboardingComplete(profile ?? null);

  identifyUser(user.id, {
    email: user.email,
    firstName: profile?.firstName || undefined,
    role: effectiveRole,
    isVip: profile?.isVip ?? false,
    source: profile?.source ?? undefined,
    createdAt: profile?.createdAt?.toISOString() ?? new Date().toISOString(),
  });

  trackEvent(user.id, isNewUser ? "user_signed_up" : "user_signed_in", {
    role: effectiveRole,
    method: "oauth",
    hasInvite: !!invite,
  });

  // Zoho CRM: create/update contact on sign-up
  if (isNewUser) {
    upsertZohoContact({
      profileId: user.id,
      email: user.email!,
      firstName: profile?.firstName || user.email!.split("@")[0],
      role: effectiveRole,
      isVip: profile?.isVip ?? false,
      source: profile?.source ?? undefined,
    });
  }

  // Referral award — new clients only; fire-and-forget so it never blocks the redirect
  const cookieStore = await cookies();
  const refCode = cookieStore.get("referral_ref")?.value?.trim() ?? null;
  if (isNewUser && effectiveRole === "client" && refCode && profile) {
    void awardReferralBonus(user.id, profile.firstName, refCode);
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
    const res = NextResponse.redirect(`${origin}/onboarding?role=${role}`);
    if (refCode) res.cookies.delete("referral_ref");
    return res;
  }

  // Route each role to their home base after sign-in
  if (assignedAssistant || profile?.role === "assistant") {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
