/**
 * auth — Server-side helpers for reading the current user and profile.
 *
 * Uses the Supabase server client (cookie-based session) to get the
 * authenticated user, then queries the Drizzle profiles table for
 * application-level data (role, onboarding status, etc.).
 */
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
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
}

/**
 * Check if a profile has completed onboarding (firstName is filled).
 */
export function isOnboardingComplete(profile: typeof profiles.$inferSelect | null): boolean {
  return !!profile?.firstName;
}
