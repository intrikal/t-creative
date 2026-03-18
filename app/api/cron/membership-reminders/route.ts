/**
 * GET /api/cron/membership-reminders — Send membership cycle renewal reminders.
 *
 * Runs daily via pg_cron. Finds active memberships whose cycle ends in 3–4
 * days and sends a reminder email. If the member still has unused fills,
 * the email highlights that ("You have 1 fill remaining — book now before
 * your cycle resets on April 1"). If all fills are used, it simply reminds
 * them about the upcoming renewal.
 *
 * Deduplicates via sync_log so each cycle triggers at most one reminder.
 *
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { membershipPlans, membershipSubscriptions, profiles, syncLog } from "@/db/schema";
import { MembershipReminder } from "@/emails/MembershipReminder";
import { sendEmail } from "@/lib/resend";

/** Send reminder this many days before the cycle resets. */
const REMINDER_DAYS_BEFORE = 3;
/** Daily job — look across a 24h window. */
const WINDOW_HOURS = 24;

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find memberships whose cycleEndsAt is 3–4 days from now.
  const windowStart = new Date(
    now.getTime() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000,
  );
  const windowEnd = new Date(
    windowStart.getTime() + WINDOW_HOURS * 60 * 60 * 1000,
  );

  const candidates = await db
    .select({
      subscriptionId: membershipSubscriptions.id,
      clientId: membershipSubscriptions.clientId,
      fillsRemainingThisCycle: membershipSubscriptions.fillsRemainingThisCycle,
      cycleEndsAt: membershipSubscriptions.cycleEndsAt,
      planName: membershipPlans.name,
      fillsPerCycle: membershipPlans.fillsPerCycle,
      clientEmail: profiles.email,
      clientFirstName: profiles.firstName,
      notifyEmail: profiles.notifyEmail,
    })
    .from(membershipSubscriptions)
    .innerJoin(membershipPlans, eq(membershipSubscriptions.planId, membershipPlans.id))
    .innerJoin(profiles, eq(membershipSubscriptions.clientId, profiles.id))
    .where(
      and(
        eq(membershipSubscriptions.status, "active"),
        gte(membershipSubscriptions.cycleEndsAt, windowStart),
        lte(membershipSubscriptions.cycleEndsAt, windowEnd),
      ),
    );

  // Look up the studio slug for booking URLs.
  const [adminProfile] = await db
    .select({
      onboardingData: profiles.onboardingData,
    })
    .from(profiles)
    .where(eq(profiles.role, "admin"))
    .limit(1);

  const adminData = adminProfile?.onboardingData as Record<string, unknown> | null;
  const studioName = (adminData?.studioName as string) ?? "";
  const slug = studioName.toLowerCase().replace(/\s+/g, "");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (!candidate.clientEmail || !candidate.notifyEmail) {
      skipped++;
      continue;
    }

    // Deduplicate: one reminder per subscription per cycle (keyed by cycle end date).
    const localId = `${candidate.subscriptionId}:${candidate.cycleEndsAt.toISOString()}`;

    const [existing] = await db
      .select({ id: syncLog.id })
      .from(syncLog)
      .where(
        and(
          eq(syncLog.entityType, "membership_cycle_reminder"),
          eq(syncLog.localId, localId),
          eq(syncLog.status, "success"),
        ),
      )
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    const daysUntilReset = Math.ceil(
      (candidate.cycleEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
    const cycleEndsFormatted = format(candidate.cycleEndsAt, "MMMM d");
    const bookingUrl = slug
      ? `${baseUrl}/book/${slug}`
      : `${baseUrl}/dashboard/book`;

    const hasUnusedFills = candidate.fillsRemainingThisCycle > 0;
    const subject = hasUnusedFills
      ? `You have ${candidate.fillsRemainingThisCycle} ${candidate.fillsRemainingThisCycle === 1 ? "fill" : "fills"} remaining — use ${candidate.fillsRemainingThisCycle === 1 ? "it" : "them"} before ${cycleEndsFormatted}`
      : `Your ${candidate.planName} cycle renews on ${cycleEndsFormatted}`;

    const success = await sendEmail({
      to: candidate.clientEmail,
      subject,
      react: MembershipReminder({
        clientName: candidate.clientFirstName,
        planName: candidate.planName,
        fillsRemaining: candidate.fillsRemainingThisCycle,
        fillsPerCycle: candidate.fillsPerCycle,
        cycleEndsAt: cycleEndsFormatted,
        daysUntilReset,
        bookingUrl,
      }),
      entityType: "membership_cycle_reminder",
      localId,
    });

    if (success) sent++;
    else failed++;
  }

  return NextResponse.json({ matched: candidates.length, sent, failed, skipped });
}
