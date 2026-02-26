/**
 * GET /api/cron/birthdays — Send birthday greeting emails.
 *
 * Runs daily via pg_cron. Queries profiles whose onboarding_data birthday
 * (MM/DD) matches today, respects notifyEmail preference, and sends a
 * birthday greeting via Resend.
 *
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, syncLog } from "@/db/schema";
import { BirthdayGreeting } from "@/emails/BirthdayGreeting";
import { sendEmail } from "@/lib/resend";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayMMDD = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;

  // Find active profiles whose birthday matches today
  const birthdayProfiles = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      firstName: profiles.firstName,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.isActive, true),
        eq(profiles.notifyEmail, true),
        sql`${profiles.onboardingData}->>'birthday' = ${todayMMDD}`,
      ),
    );

  let sent = 0;
  let failed = 0;

  for (const profile of birthdayProfiles) {
    if (!profile.email) continue;

    // Check if we already sent a birthday email this year
    const year = now.getFullYear();
    const [existing] = await db
      .select({ id: syncLog.id })
      .from(syncLog)
      .where(
        and(
          eq(syncLog.entityType, "birthday_greeting"),
          eq(syncLog.localId, profile.id),
          eq(syncLog.status, "success"),
          sql`EXTRACT(YEAR FROM ${syncLog.createdAt}) = ${year}`,
        ),
      )
      .limit(1);

    if (existing) continue;

    const success = await sendEmail({
      to: profile.email,
      subject: `Happy Birthday, ${profile.firstName}!`,
      react: BirthdayGreeting({ clientName: profile.firstName }),
      entityType: "birthday_greeting",
      localId: profile.id,
    });

    if (success) sent++;
    else failed++;
  }

  return NextResponse.json({
    matched: birthdayProfiles.length,
    sent,
    failed,
  });
}
