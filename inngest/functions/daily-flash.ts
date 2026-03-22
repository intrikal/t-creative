/**
 * Inngest function — Send morning flash report to admin.
 *
 * Replaces GET /api/cron/daily-flash. Assembles yesterday's revenue,
 * today's schedule, overnight cancellations, new inquiries, waitlist
 * activity, and outstanding invoices into a single email.
 */
import { format } from "date-fns";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { bookings, payments, services, profiles, inquiries, waitlist } from "@/db/schema";
import { DailyFlashReport } from "@/emails/DailyFlashReport";
import { sendEmail } from "@/lib/resend";
import { inngest } from "../client";

export const dailyFlash = inngest.createFunction(
  { id: "daily-flash", retries: 3, triggers: [{ event: "cron/daily-flash" }] },
  async ({ step }) => {
    const data = await step.run("query-records", async () => {
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

      return {
        revenueRow,
        todayBookings,
        cancellations,
        newInquiryCount,
        waitlistAdded,
        waitlistClaimed,
        waitlistExpired,
        unpaidInvoices,
        adminRow,
        now: now.toISOString(),
      };
    });

    if (!data.adminRow?.email) {
      return { error: "No admin email found" };
    }

    const result = await step.run("send-flash-report", async () => {
      const now = new Date(data.now);
      const bp = await getPublicBusinessProfile();

      const dateLabel = format(now, "EEEE, MMMM d, yyyy");
      const yesterdayRevenue = Math.round(Number(data.revenueRow.total) / 100);

      const todayAppointmentList = data.todayBookings.map((b) => ({
        time: format(new Date(b.startsAt), "h:mm a"),
        client: [b.clientFirstName, b.clientLastName].filter(Boolean).join(" ") || "Unknown",
        service: b.serviceName ?? "Unknown",
      }));

      const overnightCancellations = data.cancellations.map((c) => ({
        client: [c.clientFirstName, c.clientLastName].filter(Boolean).join(" ") || "Unknown",
        service: c.serviceName ?? "Unknown",
        wasScheduledFor: format(new Date(c.startsAt), "EEE, MMM d 'at' h:mm a"),
      }));

      const success = await sendEmail({
        to: data.adminRow!.email,
        subject: `Daily Flash — ${format(now, "MMM d")} · $${yesterdayRevenue} rev · ${data.todayBookings.length} appts`,
        react: DailyFlashReport({
          date: dateLabel,
          yesterdayRevenue,
          todayAppointments: data.todayBookings.length,
          todayAppointmentList,
          overnightCancellations,
          newInquiries: data.newInquiryCount,
          waitlistChanges: {
            added: data.waitlistAdded,
            claimed: data.waitlistClaimed,
            expired: data.waitlistExpired,
          },
          outstandingInvoices: {
            count: Number(data.unpaidInvoices.count),
            totalDue: Math.round(Number(data.unpaidInvoices.total) / 100),
          },
          businessName: bp.businessName,
        }),
        entityType: "daily_flash_report",
        localId: format(now, "yyyy-MM-dd"),
      });

      return {
        sent: success,
        date: dateLabel,
        yesterdayRevenue,
        todayAppointments: data.todayBookings.length,
        cancellations: overnightCancellations.length,
        inquiries: data.newInquiryCount,
      };
    });

    return result;
  },
);
