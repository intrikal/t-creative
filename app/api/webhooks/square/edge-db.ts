/**
 * Edge-compatible Supabase client for the Square webhook route.
 *
 * The main @/db module uses postgres.js (raw TCP) which is unavailable on
 * Edge Runtime. This client uses Supabase's HTTPS PostgREST API instead.
 * Only used by the thin edge webhook route — all Drizzle code stays in
 * the Inngest function (Node.js runtime).
 */
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
