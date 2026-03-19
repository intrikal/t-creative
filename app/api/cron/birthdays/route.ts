/**
 * GET /api/cron/birthdays — Send birthday greeting emails with promo codes.
 *
 * Runs daily via pg_cron. Queries profiles whose onboarding_data birthday
 * (MM/DD) matches today, respects notifyEmail preference, and sends a
 * birthday greeting via Resend.
 *
 * Auto-generates a single-use promo code per client (e.g. BDAY-A3K9)
 * with a configurable percent discount and 7-day expiry.
 *
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, promotions, syncLog } from "@/db/schema";
import { getPublicBusinessProfile, getPublicLoyaltyConfig } from "@/app/dashboard/settings/settings-actions";
import { BirthdayGreeting } from "@/emails/BirthdayGreeting";
import { sendEmail } from "@/lib/resend";

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

  const [loyaltyConfig, businessProfile] = await Promise.all([
    getPublicLoyaltyConfig(),
    getPublicBusinessProfile(),
  ]);
  const discountPercent = loyaltyConfig.birthdayDiscountPercent;
  const businessName = businessProfile.businessName;

  // Promo codes expire after configured days
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + loyaltyConfig.birthdayPromoExpiryDays);

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

    // Generate a unique single-use promo code
    let promoCode = generateBirthdayCode();

    // Ensure uniqueness (unlikely collision, but handle it)
    for (let attempt = 0; attempt < 5; attempt++) {
      const [dup] = await db
        .select({ id: promotions.id })
        .from(promotions)
        .where(eq(promotions.code, promoCode))
        .limit(1);

      if (!dup) break;
      promoCode = generateBirthdayCode();
    }

    await db.insert(promotions).values({
      code: promoCode,
      discountType: "percent",
      discountValue: discountPercent,
      description: `Birthday perk for ${profile.firstName} (${year})`,
      appliesTo: null,
      maxUses: 1,
      startsAt: now,
      endsAt: expiresAt,
    });

    const success = await sendEmail({
      to: profile.email,
      subject: `Happy Birthday, ${profile.firstName}! 🎂 Here's ${discountPercent}% off`,
      react: BirthdayGreeting({
        clientName: profile.firstName,
        promoCode,
        discountPercent,
        businessName,
      }),
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
