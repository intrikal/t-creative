/**
 * Inngest function — Send lash fill reminder emails.
 *
 * Replaces GET /api/cron/fill-reminders. Finds clients whose most recent
 * completed lash booking was N days ago and who do not already have an upcoming
 * lash booking. Deduplicates against sync_log.
 */
import { format } from "date-fns";
import { and, desc, eq, gt, gte, lte, ne, sql } from "drizzle-orm";
import {
  getPublicBusinessProfile,
  getPublicRemindersConfig,
} from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { bookings, profiles, services, syncLog } from "@/db/schema";
import { FillReminder } from "@/emails/FillReminder";
import { isNotificationEnabled } from "@/lib/notification-preferences";
import { sendEmail } from "@/lib/resend";
import { inngest } from "../client";

/** Day names indexed by JS Date.getDay() (0 = Sunday). */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Format 24h hour number to "9:00 AM" style. */
function formatHour(hour: number): string {
  const h12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${h12}:00 ${ampm}`;
}

/**
 * Analyse a client's completed lash bookings to find their typical booking
 * day-of-week and time-of-day. Returns the most common day and hour.
 */
function analyseBookingPattern(bookingDates: Date[]): {
  suggestedDay: string | null;
  suggestedTime: string | null;
  /** Raw JS day-of-week (0=Sun) for URL building. */
  suggestedDayNum: number | null;
  /** Raw hour (0-23) for URL building. */
  suggestedHourNum: number | null;
} {
  if (bookingDates.length < 2)
    return {
      suggestedDay: null,
      suggestedTime: null,
      suggestedDayNum: null,
      suggestedHourNum: null,
    };

  // Count day-of-week frequency
  const dayCounts = new Map<number, number>();
  const hourCounts = new Map<number, number>();

  for (const d of bookingDates) {
    const day = d.getDay();
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    const hour = d.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  // Find the mode (most frequent)
  let topDay = 0;
  let topDayCount = 0;
  for (const [day, count] of dayCounts) {
    if (count > topDayCount) {
      topDay = day;
      topDayCount = count;
    }
  }

  let topHour = 0;
  let topHourCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > topHourCount) {
      topHour = hour;
      topHourCount = count;
    }
  }

  // Only suggest if the pattern appears in at least 40% of bookings
  const threshold = bookingDates.length * 0.4;
  const dayMatch = topDayCount >= threshold;
  const hourMatch = topHourCount >= threshold;
  return {
    suggestedDay: dayMatch ? DAY_NAMES[topDay] : null,
    suggestedTime: hourMatch ? formatHour(topHour) : null,
    suggestedDayNum: dayMatch ? topDay : null,
    suggestedHourNum: hourMatch ? topHour : null,
  };
}

export const fillReminders = inngest.createFunction(
  { id: "fill-reminders", retries: 3, triggers: [{ event: "cron/fill-reminders" }] },
  async ({ step }) => {
    const { candidates, businessName, slug, baseUrl, now } = await step.run(
      "query-records",
      async () => {
        const [remindersConfig, bp] = await Promise.all([
          getPublicRemindersConfig(),
          getPublicBusinessProfile(),
        ]);
        const fillReminderDays = remindersConfig.fillReminderDays;
        const windowHours = 24; // daily job — look back over a 24h window

        const currentNow = new Date();
        // Clients whose last lash visit was N–(N+1) days ago
        const windowEnd = new Date(currentNow.getTime() - fillReminderDays * 24 * 60 * 60 * 1000);
        const windowStart = new Date(
          currentNow.getTime() - (fillReminderDays * 24 + windowHours) * 60 * 60 * 1000,
        );

        const rows = await db
          .select({
            bookingId: bookings.id,
            clientId: bookings.clientId,
            startsAt: bookings.startsAt,
            serviceId: bookings.serviceId,
            serviceName: services.name,
            staffId: bookings.staffId,
            clientEmail: profiles.email,
            clientFirstName: profiles.firstName,
            notifyEmail: profiles.notifyEmail,
            notifyMarketing: profiles.notifyMarketing,
          })
          .from(bookings)
          .innerJoin(profiles, eq(bookings.clientId, profiles.id))
          .innerJoin(services, eq(bookings.serviceId, services.id))
          .where(
            and(
              eq(bookings.status, "completed"),
              eq(services.category, "lash"),
              gte(bookings.startsAt, windowStart),
              lte(bookings.startsAt, windowEnd),
            ),
          );

        // Look up the studio slug once — needed for rebooking URLs.
        const [adminProfile] = await db
          .select({
            onboardingData: profiles.onboardingData,
          })
          .from(profiles)
          .where(eq(profiles.role, "admin"))
          .limit(1);

        const adminData = adminProfile?.onboardingData as Record<string, unknown> | null;
        const studioName = (adminData?.studioName as string) ?? "";
        const studioSlug = studioName.toLowerCase().replace(/\s+/g, "");
        const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

        return {
          candidates: rows,
          businessName: bp.businessName,
          slug: studioSlug,
          baseUrl: siteBaseUrl,
          now: currentNow.toISOString(),
        };
      },
    );

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const currentNow = new Date(now);

    for (const candidate of candidates) {
      const result = await step.run(`process-${candidate.bookingId}`, async () => {
        if (!candidate.clientEmail || !candidate.notifyEmail) {
          return { sent: 0, failed: 0, skipped: 1 };
        }
        const fillEnabled = await isNotificationEnabled(candidate.clientId, "email", "fill_reminder");
        if (!fillEnabled) {
          return { sent: 0, failed: 0, skipped: 1 };
        }

        const localId = candidate.bookingId.toString();

        // Skip if reminder already sent for this visit
        const [existing] = await db
          .select({ id: syncLog.id })
          .from(syncLog)
          .where(
            and(
              eq(syncLog.entityType, "fill_reminder"),
              eq(syncLog.localId, localId),
              eq(syncLog.status, "success"),
            ),
          )
          .limit(1);

        if (existing) {
          return { sent: 0, failed: 0, skipped: 1 };
        }

        // Skip if client already has an upcoming lash booking
        const [upcomingLash] = await db
          .select({ id: bookings.id })
          .from(bookings)
          .innerJoin(services, eq(bookings.serviceId, services.id))
          .where(
            and(
              eq(bookings.clientId, candidate.clientId),
              eq(services.category, "lash"),
              ne(bookings.status, "cancelled"),
              gt(bookings.startsAt, currentNow),
            ),
          )
          .limit(1);

        if (upcomingLash) {
          return { sent: 0, failed: 0, skipped: 1 };
        }

        // ── Build personalised rebooking context ──────────────────────────
        const history = await db
          .select({
            startsAt: bookings.startsAt,
            staffId: bookings.staffId,
          })
          .from(bookings)
          .innerJoin(services, eq(bookings.serviceId, services.id))
          .where(
            and(
              eq(bookings.clientId, candidate.clientId),
              eq(bookings.status, "completed"),
              eq(services.category, "lash"),
            ),
          )
          .orderBy(desc(bookings.startsAt))
          .limit(10);

        const { suggestedDay, suggestedTime, suggestedDayNum, suggestedHourNum } =
          analyseBookingPattern(history.map((h) => h.startsAt));

        // Look up the preferred staff member's name
        let staffName: string | null = null;
        const preferredStaffId = candidate.staffId;
        if (preferredStaffId) {
          const [staffRow] = await db
            .select({ firstName: profiles.firstName })
            .from(profiles)
            .where(eq(profiles.id, preferredStaffId))
            .limit(1);
          staffName = staffRow?.firstName ?? null;
        }

        // Build the one-click rebooking URL
        let bookingUrl: string;
        if (slug) {
          const params = new URLSearchParams({ service: String(candidate.serviceId) });
          if (preferredStaffId) params.set("staff", preferredStaffId);
          if (suggestedDayNum !== null) {
            const nextDate = new Date();
            const daysUntil = (suggestedDayNum - nextDate.getDay() + 7) % 7 || 7;
            nextDate.setDate(nextDate.getDate() + daysUntil);
            params.set(
              "date",
              `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`,
            );
          }
          if (suggestedHourNum !== null) {
            params.set("time", `${String(suggestedHourNum).padStart(2, "0")}:00`);
          }
          bookingUrl = `${baseUrl}/book/${slug}?${params}`;
        } else {
          bookingUrl = `${baseUrl}/dashboard/book`;
        }

        const lastVisitDate = format(new Date(candidate.startsAt), "MMMM d");

        const success = await sendEmail({
          to: candidate.clientEmail,
          subject: "Time for your lash fill — book now before your extensions shed",
          react: FillReminder({
            clientName: candidate.clientFirstName,
            lastVisitDate,
            bookingUrl,
            serviceName: candidate.serviceName,
            staffName,
            suggestedDay,
            suggestedTime,
            businessName,
          }),
          entityType: "fill_reminder",
          localId,
        });

        return success ? { sent: 1, failed: 0, skipped: 0 } : { sent: 0, failed: 1, skipped: 0 };
      });

      sent += result.sent;
      failed += result.failed;
      skipped += result.skipped;
    }

    return { matched: candidates.length, sent, failed, skipped };
  },
);
