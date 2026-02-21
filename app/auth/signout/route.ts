/**
 * POST /auth/signout — Signs the user out and redirects to /login.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/auth/signed-out`, { status: 303 });
}
