/**
 * POST /auth/signout — Signs the user out and redirects to /login.
 */
import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/posthog";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) trackEvent(user.id, "user_signed_out");

  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/auth/signed-out`, { status: 303 });
}
