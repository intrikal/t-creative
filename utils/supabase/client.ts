/**
 * Supabase browser client — creates a client-side Supabase instance.
 *
 * Used in Client Components for real-time subscriptions and auth.
 */
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
