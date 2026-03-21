/**
 * POST /api/invites — Admin-only endpoint to generate assistant invite links.
 *
 * Accepts { email } in the body, returns { inviteUrl }.
 * Only users with role="admin" can call this.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { InviteEmail } from "@/emails/InviteEmail";
import { getCurrentUser } from "@/lib/auth";
import { createInviteToken } from "@/lib/invite";
import { sendEmail } from "@/lib/resend";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user?.profile || user.profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email } = parsed.data;

  const token = await createInviteToken(email);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const inviteUrl = `${siteUrl}/login?invite=${token}`;

  // Send invite email (non-fatal — URL is still returned)
  const bp = await getPublicBusinessProfile();
  await sendEmail({
    to: email,
    subject: `You're invited to join ${bp.businessName}`,
    react: InviteEmail({ inviteUrl, businessName: bp.businessName }),
    entityType: "invite",
    localId: email,
  });

  return NextResponse.json({ inviteUrl });
}
