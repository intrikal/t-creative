/**
 * GET /api/cron/birthday-promos — Send birthday promo codes 7 days before the birthday.
 *
 * Runs daily at 9 AM. Queries active profiles whose birthday (stored as MM/DD
 * in onboarding_data JSONB) falls 7 days from now. For each match:
 *   1. Auto-generate a single-use 15% promo code (BDAY-XXXX)
 *   2. Send birthday promo email via Resend
 *   3. If SMS enabled for birthday_promo channel: send Twilio SMS
 *   4. Deduplication via syncLog — one promo per client per year
 *
 * Separate from /api/cron/birthdays which sends the greeting on the actual day.
 * This route sends the *promo code* a week early so clients can use it.
 *
 * Secured with CRON_SECRET header.
 */
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, promotions, syncLog } from "@/db/schema";
import {
  getPublicBusinessProfile,
  getPublicLoyaltyConfig,
} from "@/app/dashboard/settings/settings-actions";
import { BirthdayGreeting } from "@/emails/BirthdayGreeting";
import { isNotificationEnabled } from "@/lib/notification-preferences";
import { sendEmail } from "@/lib/resend";
import { isTwilioConfigured, getSmsRecipient, sendSms } from "@/lib/twilio";

const DISCOUNT_PERCENT = 15;
const EXPIRY_DAYS_AFTER_BIRTHDAY = 30;

/** Generate a unique birthday promo code like BDAY-A3K9. */
function generateBirthdayCode(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
  return `BDAY-${suffix}`;
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const year = now.getFullYear();

  // 7 days from now
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + 7);
  const targetMMDD = `${String(targetDate.getMonth() + 1).padStart(2, "0")}/${String(targetDate.getDate()).padStart(2, "0")}`;

  // Promo expires 30 days after the actual birthday
  const expiresAt = new Date(targetDate);
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS_AFTER_BIRTHDAY);

  // Find active profiles whose birthday is 7 days from now
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
        sql`${profiles.onboardingData}->>'birthday' = ${targetMMDD}`,
      ),
    );

  const businessProfile = await getPublicBusinessProfile();
  const businessName = businessProfile.businessName;

  let sent = 0;
  let smsSent = 0;
  let failed = 0;

  for (const profile of birthdayProfiles) {
    // Check if we already sent a birthday promo this year (dedup via syncLog)
    const [existing] = await db
      .select({ id: syncLog.id })
      .from(syncLog)
      .where(
        and(
          eq(syncLog.entityType, "birthday_promo"),
          eq(syncLog.localId, profile.id),
          eq(syncLog.status, "success"),
          sql`EXTRACT(YEAR FROM ${syncLog.createdAt}) = ${year}`,
        ),
      )
      .limit(1);

    if (existing) continue;

    // Generate a unique single-use promo code
    let promoCode = generateBirthdayCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const [dup] = await db
        .select({ id: promotions.id })
        .from(promotions)
        .where(eq(promotions.code, promoCode))
        .limit(1);
      if (!dup) break;
      promoCode = generateBirthdayCode();
    }

    // Insert the promo code
    await db.insert(promotions).values({
      code: promoCode,
      discountType: "percent",
      discountValue: DISCOUNT_PERCENT,
      description: `Birthday promo for ${profile.firstName} (${year})`,
      appliesTo: null,
      maxUses: 1,
      startsAt: now,
      endsAt: expiresAt,
    });

    // Send email if enabled
    const emailEnabled =
      !!profile.email &&
      (await isNotificationEnabled(profile.id, "email", "birthday_promo"));

    if (emailEnabled && profile.email) {
      const emailOk = await sendEmail({
        to: profile.email,
        subject: `Your birthday is coming, ${profile.firstName}! Here's ${DISCOUNT_PERCENT}% off 🎂`,
        react: BirthdayGreeting({
          clientName: profile.firstName,
          promoCode,
          discountPercent: DISCOUNT_PERCENT,
          businessName,
        }),
        entityType: "birthday_promo",
        localId: profile.id,
      });

      if (emailOk) sent++;
      else failed++;
    }

    // Send SMS if enabled and Twilio is configured
    const smsEnabled =
      isTwilioConfigured() &&
      (await isNotificationEnabled(profile.id, "sms", "birthday_promo"));

    if (smsEnabled) {
      const recipient = await getSmsRecipient(profile.id);
      if (recipient) {
        const smsOk = await sendSms({
          to: recipient.phone,
          body: `Happy early birthday, ${recipient.firstName}! 🎂 Use code ${promoCode} for ${DISCOUNT_PERCENT}% off your next visit at ${businessName}. Valid for 30 days after your birthday. Reply STOP to opt out.`,
          entityType: "birthday_promo_sms",
          localId: profile.id,
        });
        if (smsOk) smsSent++;
      }
    }
  }

  return NextResponse.json({
    matched: birthdayProfiles.length,
    emailsSent: sent,
    smsSent,
    failed,
  });
}
