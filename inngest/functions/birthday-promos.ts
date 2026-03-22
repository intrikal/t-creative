/**
 * Inngest function — Send birthday promo codes 7 days before the birthday.
 *
 * Replaces GET /api/cron/birthday-promos. Queries active profiles whose birthday
 * falls 7 days from now, auto-generates a single-use promo code, sends email
 * and optionally SMS. Deduplicates via syncLog.
 */
import { randomBytes } from "crypto";
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
import { inngest } from "../client";

const DISCOUNT_PERCENT = 15;
const EXPIRY_DAYS_AFTER_BIRTHDAY = 30;

/** Generate a unique birthday promo code like BDAY-A3K9. */
function generateBirthdayCode(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
  return `BDAY-${suffix}`;
}

export const birthdayPromos = inngest.createFunction(
  { id: "birthday-promos", retries: 3, triggers: [{ event: "cron/birthday-promos" }] },
  async ({ step }) => {
    const { birthdayProfiles, businessName, year, expiresAt } = await step.run(
      "query-records",
      async () => {
        const now = new Date();
        const currentYear = now.getFullYear();

        // 7 days from now
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 7);
        const targetMMDD = `${String(targetDate.getMonth() + 1).padStart(2, "0")}/${String(targetDate.getDate()).padStart(2, "0")}`;

        // Promo expires 30 days after the actual birthday
        const expires = new Date(targetDate);
        expires.setDate(expires.getDate() + EXPIRY_DAYS_AFTER_BIRTHDAY);

        // Find active profiles whose birthday is 7 days from now
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
              sql`${profiles.onboardingData}->>'birthday' = ${targetMMDD}`,
            ),
          );

        const businessProfile = await getPublicBusinessProfile();

        return {
          birthdayProfiles: rows,
          businessName: businessProfile.businessName,
          year: currentYear,
          expiresAt: expires.toISOString(),
        };
      },
    );

    let sent = 0;
    let smsSent = 0;
    let failed = 0;

    for (const profile of birthdayProfiles) {
      const result = await step.run(`process-${profile.id}`, async () => {
        let localSent = 0;
        let localSmsSent = 0;
        let localFailed = 0;

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

        if (existing) return { sent: 0, smsSent: 0, failed: 0 };

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
          startsAt: new Date(),
          endsAt: new Date(expiresAt),
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

          if (emailOk) localSent++;
          else localFailed++;
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
            if (smsOk) localSmsSent++;
          }
        }

        return { sent: localSent, smsSent: localSmsSent, failed: localFailed };
      });

      sent += result.sent;
      smsSent += result.smsSent;
      failed += result.failed;
    }

    return {
      matched: birthdayProfiles.length,
      emailsSent: sent,
      smsSent,
      failed,
    };
  },
);
