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
 * Secured with CRON_SECRET header to prevent unauthorized access.
 */
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { and, eq, gt, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { bookings, profiles, services, syncLog } from "@/db/schema";
import { FillReminder } from "@/emails/FillReminder";
import { sendEmail } from "@/lib/resend";

const FILL_REMINDER_DAYS = 18; // send when last lash visit was this many days ago
const WINDOW_HOURS = 24; // daily job — look back over a 24h window

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Clients whose last lash visit was 18–19 days ago
  const windowEnd = new Date(now.getTime() - FILL_REMINDER_DAYS * 24 * 60 * 60 * 1000);
  const windowStart = new Date(
    now.getTime() - (FILL_REMINDER_DAYS * 24 + WINDOW_HOURS) * 60 * 60 * 1000,
  );

  // Find completed lash bookings that fall in the reminder window
  const candidates = await db
    .select({
      bookingId: bookings.id,
      clientId: bookings.clientId,
      startsAt: bookings.startsAt,
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

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (!candidate.clientEmail || !candidate.notifyEmail || !candidate.notifyMarketing) {
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

    const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/dashboard/book`;
    const lastVisitDate = format(candidate.startsAt, "MMMM d");

    const success = await sendEmail({
      to: candidate.clientEmail,
      subject: "Time for your lash fill — book now before your extensions shed",
      react: FillReminder({
        clientName: candidate.clientFirstName,
        lastVisitDate,
        bookingUrl,
      }),
      entityType: "fill_reminder",
      localId,
    });

    if (success) sent++;
    else failed++;
  }

  return NextResponse.json({ matched: candidates.length, sent, failed, skipped });
}
