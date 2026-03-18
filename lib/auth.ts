/**
 * auth — Server-side helpers for reading the current user and profile.
 *
 * Uses the Supabase server client (cookie-based session) to get the
 * authenticated user, then queries the Drizzle profiles table for
 * application-level data (role, onboarding status, etc.).
 */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

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
 * Wrapped with React `cache()` so repeated calls within the same server
 * render are deduplicated to a single Supabase + DB round-trip.
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
 * Check if a profile has completed onboarding (firstName is filled).
 */
export function isOnboardingComplete(profile: typeof profiles.$inferSelect | null): boolean {
  return !!profile?.firstName;
}
