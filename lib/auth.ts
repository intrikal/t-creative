/**
 * auth — Server-side helpers for reading the current user and profile.
 *
 * Uses React `cache()` to deduplicate auth checks within a single
 * server-component render. No matter how many times getCurrentUser(),
 * requireAdmin(), getUser(), etc. are called during one request,
 * only ONE Supabase auth call and ONE DB profile query are made.
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
 * Core cached auth state — at most one Supabase + one DB call per request.
 */
const getAuthState = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null as null, profile: null as null };

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  return { user, profile: profile ?? null };
});

/**
 * Require the current user to be authenticated.
 * Throws "Not authenticated" otherwise.
 * Returns the Supabase auth user object on success.
 */
export async function getUser() {
  const { user } = await getAuthState();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Read the authenticated Supabase user + their profile row.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { user, profile } = await getAuthState();
  if (!user) return null;
  return { id: user.id, email: user.email!, profile };
}

/**
 * Require the current user to be authenticated AND have role "admin".
 * Throws "Not authenticated" (→ 401) or "Forbidden" (→ 403) otherwise.
 * Returns the Supabase auth user object on success.
 */
export async function requireAdmin() {
  const { user, profile } = await getAuthState();
  if (!user) throw new Error("Not authenticated");
  if (!profile || profile.role !== "admin") throw new Error("Forbidden");
  return user;
}

/**
 * Require the current user to be authenticated AND have role "admin" or "assistant".
 * Throws "Not authenticated" (→ 401) or "Forbidden" (→ 403) otherwise.
 * Returns the Supabase auth user object on success.
 */
export async function requireStaff() {
  const { user, profile } = await getAuthState();
  if (!user) throw new Error("Not authenticated");
  if (!profile || (profile.role !== "admin" && profile.role !== "assistant"))
    throw new Error("Forbidden");
  return user;
}

/**
 * Check if a profile has completed onboarding (firstName is filled).
 */
export function isOnboardingComplete(profile: typeof profiles.$inferSelect | null): boolean {
  return !!profile?.firstName;
}
