/**
 * Inngest function — Send birthday greeting emails with promo codes.
 *
 * Replaces GET /api/cron/birthdays. Queries profiles whose birthday (MM/DD)
 * matches today, generates a single-use promo code, and sends a birthday
 * greeting via Resend. Deduplicates via sync_log (one per client per year).
 */
import { randomBytes } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, promotions, syncLog } from "@/db/schema";
import { getPublicBusinessProfile, getPublicLoyaltyConfig } from "@/app/dashboard/settings/settings-actions";
import { BirthdayGreeting } from "@/emails/BirthdayGreeting";
import { isNotificationEnabled } from "@/lib/notification-preferences";
import { sendEmail } from "@/lib/resend";
import { inngest } from "../client";

/** Generate a unique birthday promo code like BDAY-A3K9. */
function generateBirthdayCode(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
  return `BDAY-${suffix}`;
}

export const birthdays = inngest.createFunction(
  { id: "birthdays", retries: 3, triggers: [{ event: "cron/birthdays" }] },
  async ({ step }) => {
    const { birthdayProfiles, discountPercent, businessName, expiresAt, year } = await step.run(
      "query-records",
      async () => {
        const now = new Date();
        const todayMMDD = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;

        // Find active profiles whose birthday matches today
        const rows = await db
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
        const discountPct = loyaltyConfig.birthdayDiscountPercent;
        const bName = businessProfile.businessName;

        // Promo codes expire after configured days
        const expires = new Date(now);
        expires.setDate(expires.getDate() + loyaltyConfig.birthdayPromoExpiryDays);

        return {
          birthdayProfiles: rows,
          discountPercent: discountPct,
          businessName: bName,
          expiresAt: expires.toISOString(),
          year: now.getFullYear(),
        };
      },
    );

    let sent = 0;
    let failed = 0;

    for (const profile of birthdayProfiles) {
      const result = await step.run(`process-${profile.id}`, async () => {
        if (!profile.email) return { sent: 0, failed: 0 };
        const bdayEnabled = await isNotificationEnabled(profile.id, "email", "birthday_promo");
        if (!bdayEnabled) return { sent: 0, failed: 0 };

        // Check if we already sent a birthday email this year
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

        if (existing) return { sent: 0, failed: 0 };

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
          startsAt: new Date(),
          endsAt: new Date(expiresAt),
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

        return success ? { sent: 1, failed: 0 } : { sent: 0, failed: 1 };
      });

      sent += result.sent;
      failed += result.failed;
    }

    return { matched: birthdayProfiles.length, sent, failed };
  },
);
