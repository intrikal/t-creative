/**
 * POST /api/invites — Admin-only endpoint to generate assistant invite links.
 *
 * Accepts { email } in the body, returns { inviteUrl }.
 * Only users with role="admin" can call this.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createInviteToken } from "@/lib/invite";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user?.profile || user.profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const email = body?.email;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const token = await createInviteToken(email);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const inviteUrl = `${siteUrl}/login?invite=${token}`;

  return NextResponse.json({ inviteUrl });
}
