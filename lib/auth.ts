/**
 * auth — Server-side helpers for reading the current user and profile.
 *
 * Uses the Supabase server client (cookie-based session) to get the
 * authenticated user, then queries the Drizzle profiles table for
 * application-level data (role, onboarding status, etc.).
 *
 * Auth checks are split into three tiers:
 * - `getCurrentUser()` — read-only, returns null if unauthenticated
 * - `getUser()` / `requireStaff()` — throws 401 if unauthenticated
 * - `requireAdmin()` — throws 403 if not admin role
 *
 * React `cache()` wraps the hot-path functions so multiple server
 * components / actions within a single RSC render share one DB query.
 *
 * @module lib/auth
 */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/**
 * Composite type returned by `getCurrentUser()`. The `profile` field
 * is null when the user exists in Supabase Auth but hasn't completed
 * onboarding (profile row not yet created or firstName is empty).
 */
export type CurrentUser = {
  id: string;
  email: string;
  profile: typeof profiles.$inferSelect | null;
};

/**
 * Read the authenticated Supabase user + their profile row.
 * Returns null if not authenticated.
 *
 * Wrapped with React `cache()` so repeated calls within the same server
 * render (e.g. multiple server actions called in Promise.all) are
 * deduplicated to a single Supabase + DB round-trip.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  return {
    id: user.id,
    email: user.email!,
    profile: profile ?? null,
  };
});

/**
 * Require the current user to be authenticated AND have role "admin".
 * Throws "Not authenticated" (→ 401) or "Forbidden" (→ 403) otherwise.
 * Returns the Supabase auth user object on success.
 *
 * Uses getSession() (local JWT decode from cookie, no network round-trip)
 * for speed in server actions. The proxy middleware already validates the
 * real token against Supabase's auth server on every request, so we can
 * safely trust the cookie here.
 *
 * Wrapped with React `cache()` so repeated calls within the same server
 * render are deduplicated to a single DB round-trip.
 */
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (!profile || profile.role !== "admin") throw new Error("Forbidden");

  return user;
});

/**
 * Require the current user to be authenticated.
 * Throws "Not authenticated" otherwise.
 * Returns the Supabase auth user object on success.
 *
 * Uses `getCurrentUser` under the hood so the Supabase call is
 * deduplicated when both are called in the same render.
 */
export async function getUser() {
  const cu = await getCurrentUser();
  if (!cu) throw new Error("Not authenticated");
  return { id: cu.id, email: cu.email };
}

/**
 * Require the current user to be authenticated AND have role "admin" or "assistant".
 * Throws "Not authenticated" (→ 401) or "Forbidden" (→ 403) otherwise.
 * Returns the Supabase auth user object on success.
 */
export async function requireStaff() {
  const cu = await getCurrentUser();
  if (!cu) throw new Error("Not authenticated");
  if (!cu.profile || (cu.profile.role !== "admin" && cu.profile.role !== "assistant"))
    throw new Error("Forbidden");
  return { id: cu.id, email: cu.email };
}

/**
 * Check if a profile has completed onboarding (firstName is filled).
 * Used by middleware and layout components to redirect to /onboarding.
 */
export function isOnboardingComplete(profile: typeof profiles.$inferSelect | null): boolean {
  return !!profile?.firstName;
}
