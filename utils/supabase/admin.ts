/**
 * Supabase admin client — uses the service role key to bypass Row Level Security.
 *
 * ONLY use this on the server (Server Components, Route Handlers, Server Actions).
 * NEVER import this in client components — it would expose the service role key.
 *
 * Capabilities unique to the admin client:
 * - auth.admin.generateLink() — create magic links without sending emails
 * - auth.admin.listUsers() / deleteUser() — user management
 * - Bypasses RLS for DB queries (use sparingly; prefer the regular server client)
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
