/**
 * GET /api/cron/fill-reminders — Send lash fill reminder emails.
 *
 * Runs daily via pg_cron. Finds clients whose most recent completed lash
 * booking was 18–19 days ago (i.e., their fill is due in ~3 days) and who
 * do not already have an upcoming lash booking. Deduplicates against
 * sync_log so each visit triggers at most one reminder email.
 *
 * Timeline: fills are recommended every 2–3 weeks. We send this reminder
 * at day 18 to give clients a 3-day window to book before extensions shed.
 *
 * Each reminder includes a one-click rebooking link pre-filled with the
 * client's last service, plus personalised suggestions based on their
 * booking history (preferred staff, typical day and time).
 *
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */
import { NextResponse } from "next/server";
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
} {
  if (bookingDates.length < 2) return { suggestedDay: null, suggestedTime: null };

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
  return {
    suggestedDay: topDayCount >= threshold ? DAY_NAMES[topDay] : null,
    suggestedTime: topHourCount >= threshold ? formatHour(topHour) : null,
  };
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [remindersConfig, bp] = await Promise.all([
    getPublicRemindersConfig(),
    getPublicBusinessProfile(),
  ]);
  const fillReminderDays = remindersConfig.fillReminderDays;
  const windowHours = 24; // daily job — look back over a 24h window

  const now = new Date();
  // Clients whose last lash visit was N–(N+1) days ago
  const windowEnd = new Date(now.getTime() - fillReminderDays * 24 * 60 * 60 * 1000);
  const windowStart = new Date(
    now.getTime() - (fillReminderDays * 24 + windowHours) * 60 * 60 * 1000,
  );

  // Find completed lash bookings that fall in the reminder window.
  // Also fetch the service ID, service name, and staff name for the rebooking link.
  const candidates = await db
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
  // The slug is derived from the admin's onboardingData.studioName.
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
    const fillEnabled = await isNotificationEnabled(candidate.clientId, "email", "fill_reminder");
    if (!fillEnabled) {
      skipped++;
      continue;
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
      skipped++;
      continue;
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
          gt(bookings.startsAt, now),
        ),
      )
      .limit(1);

    if (upcomingLash) {
      skipped++;
      continue;
    }

    // ── Build personalised rebooking context ──────────────────────────
    // Fetch the client's last 10 completed lash bookings to analyse patterns.
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

    const { suggestedDay, suggestedTime } = analyseBookingPattern(history.map((h) => h.startsAt));

    // Look up the preferred staff member's name (most recent booking's staff).
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

    // Build the one-click rebooking URL with the service pre-filled.
    const bookingUrl = slug
      ? `${baseUrl}/book/${slug}?service=${candidate.serviceId}`
      : `${baseUrl}/dashboard/book`;

    const lastVisitDate = format(candidate.startsAt, "MMMM d");

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
        businessName: bp.businessName,
      }),
      entityType: "fill_reminder",
      localId,
    });

    if (success) sent++;
    else failed++;
  }

  return NextResponse.json({ matched: candidates.length, sent, failed, skipped });
}
