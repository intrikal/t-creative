/**
 * AdminLayout — the server-side route guard for all /admin pages.
 *
 * ## Why this exists alongside the middleware guard
 * `proxy.ts` (Next.js middleware) performs a first-pass role check using the
 * Supabase REST client, which is subject to RLS. Immediately after a Drizzle
 * upsert (which bypasses RLS), the Supabase REST read may return null for the
 * profile row — causing the middleware to pass through rather than redirect.
 *
 * This layout is the authoritative, server-side guard. It calls `getCurrentUser()`,
 * which uses Drizzle directly (bypassing RLS) to read the profile. If the user
 * is unauthenticated or their `role` is not "admin", they are redirected to "/".
 *
 * ## Design decision: Drizzle, not Supabase REST
 * `getCurrentUser()` queries via Drizzle because:
 * 1. Drizzle bypasses RLS — it always sees the canonical database state.
 * 2. It runs in the Node.js runtime (layout.tsx is a Server Component, not Edge),
 *    so the Drizzle Node.js driver is available.
 *
 * ## Logging
 * A `console.error` fires on access denial to make it easy to debug unexpected
 * redirects in server logs (e.g. a newly onboarded admin bouncing before their
 * session refreshes).
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin | T Creative Studio",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user || user.profile?.role !== "admin") {
    console.error(
      "[AdminLayout] access denied — id:",
      user?.id,
      "role:",
      user?.profile?.role ?? "no profile",
    );
    redirect("/");
  }

  return <>{children}</>;
}
