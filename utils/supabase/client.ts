/**
 * Supabase browser client — creates a client-side Supabase instance.
 *
 * Used in Client Components for real-time subscriptions and auth.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
