/**
 * GET /api/cron/daily-flash — Send morning flash report to admin.
 *
 * Runs daily at 7:00 AM PST (15:00 UTC). Assembles yesterday's revenue,
 * today's schedule, overnight cancellations, new inquiries, waitlist
 * activity, and outstanding invoices into a single email.
 *
 * Secured with CRON_SECRET header.
 */
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, services, profiles, inquiries, waitlist } from "@/db/schema";
import { DailyFlashReport } from "@/emails/DailyFlashReport";
import { sendEmail } from "@/lib/resend";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Time boundaries (use server time, PST-aware via env TZ or default)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  // "Overnight" = since 6pm yesterday (captures evening + night cancellations)
  const overnightStart = new Date(yesterdayStart.getTime() + 18 * 60 * 60 * 1000);

  // Run all queries in parallel
  const [
    revenueRow,
    todayBookings,
    cancellations,
    newInquiryCount,
    waitlistAdded,
    waitlistClaimed,
    waitlistExpired,
    unpaidInvoices,
    adminRow,
  ] = await Promise.all([
    // 1. Yesterday's revenue
    db
      .select({
        total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, "paid"),
          gte(payments.paidAt, yesterdayStart),
          lt(payments.paidAt, todayStart),
        ),
      )
      .then((r) => r[0]),

    // 2. Today's appointments
    db
      .select({
        startsAt: bookings.startsAt,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        serviceName: services.name,
      })
      .from(bookings)
      .innerJoin(profiles, eq(bookings.clientId, profiles.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(
        and(
          gte(bookings.startsAt, todayStart),
          lt(bookings.startsAt, todayEnd),
          sql`${bookings.status} in ('confirmed', 'pending')`,
        ),
      )
      .orderBy(bookings.startsAt),

    // 3. Overnight cancellations
    db
      .select({
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        serviceName: services.name,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .innerJoin(profiles, eq(bookings.clientId, profiles.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.status, "cancelled"), gte(bookings.cancelledAt, overnightStart)))
      .orderBy(bookings.cancelledAt),

    // 4. New inquiries (since yesterday start)
    db
      .select({ count: sql<number>`count(*)` })
      .from(inquiries)
      .where(and(eq(inquiries.status, "new"), gte(inquiries.createdAt, yesterdayStart)))
      .then((r) => Number(r[0].count)),

    // 5. Waitlist — added yesterday
    db
      .select({ count: sql<number>`count(*)` })
      .from(waitlist)
      .where(and(gte(waitlist.createdAt, yesterdayStart), lt(waitlist.createdAt, todayStart)))
      .then((r) => Number(r[0].count)),

    // 6. Waitlist — claimed yesterday
    db
      .select({ count: sql<number>`count(*)` })
      .from(waitlist)
      .where(
        and(
          eq(waitlist.status, "booked"),
          gte(waitlist.updatedAt, yesterdayStart),
          lt(waitlist.updatedAt, todayStart),
        ),
      )
      .then((r) => Number(r[0].count)),

    // 7. Waitlist — expired yesterday
    db
      .select({ count: sql<number>`count(*)` })
      .from(waitlist)
      .where(
        and(
          eq(waitlist.status, "expired"),
          gte(waitlist.updatedAt, yesterdayStart),
          lt(waitlist.updatedAt, todayStart),
        ),
      )
      .then((r) => Number(r[0].count)),

    // 8. Outstanding invoices (pending payments)
    db
      .select({
        count: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
      })
      .from(payments)
      .where(eq(payments.status, "pending"))
      .then((r) => r[0]),

    // 9. Admin email (owner account)
    db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.role, "admin"))
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (!adminRow?.email) {
    return NextResponse.json({ error: "No admin email found" }, { status: 500 });
  }

  const dateLabel = format(now, "EEEE, MMMM d, yyyy");
  const yesterdayRevenue = Math.round(Number(revenueRow.total) / 100);

  const todayAppointmentList = todayBookings.map((b) => ({
    time: format(b.startsAt, "h:mm a"),
    client: [b.clientFirstName, b.clientLastName].filter(Boolean).join(" ") || "Unknown",
    service: b.serviceName ?? "Unknown",
  }));

  const overnightCancellations = cancellations.map((c) => ({
    client: [c.clientFirstName, c.clientLastName].filter(Boolean).join(" ") || "Unknown",
    service: c.serviceName ?? "Unknown",
    wasScheduledFor: format(c.startsAt, "EEE, MMM d 'at' h:mm a"),
  }));

  const success = await sendEmail({
    to: adminRow.email,
    subject: `Daily Flash — ${format(now, "MMM d")} · $${yesterdayRevenue} rev · ${todayBookings.length} appts`,
    react: DailyFlashReport({
      date: dateLabel,
      yesterdayRevenue,
      todayAppointments: todayBookings.length,
      todayAppointmentList,
      overnightCancellations,
      newInquiries: newInquiryCount,
      waitlistChanges: {
        added: waitlistAdded,
        claimed: waitlistClaimed,
        expired: waitlistExpired,
      },
      outstandingInvoices: {
        count: Number(unpaidInvoices.count),
        totalDue: Math.round(Number(unpaidInvoices.total) / 100),
      },
    }),
    entityType: "daily_flash_report",
    localId: format(now, "yyyy-MM-dd"),
  });

  return NextResponse.json({
    sent: success,
    date: dateLabel,
    yesterdayRevenue,
    todayAppointments: todayBookings.length,
    cancellations: overnightCancellations.length,
    inquiries: newInquiryCount,
  });
}
