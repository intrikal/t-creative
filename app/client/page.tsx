/**
 * ClientPage — Next.js Server Component for the /client route.
 *
 * ## Responsibility
 * Runs five parallel database queries to assemble every piece of data the client
 * dashboard needs, then hands it all to ClientHomePage as props. No data fetching
 * ever reaches the browser — this component only runs on the server.
 *
 * ## Auth guard
 * Calls `getCurrentUser()` (reads the Supabase session from cookies) and redirects
 * to /login if the session is missing or expired.
 *
 * ## Queries (run in parallel via Promise.all)
 * 1. upcomingBookings  — pending/confirmed bookings starting after `now`, limit 3,
 *                        sorted ascending so the soonest appears first
 * 2. pastBookings      — completed bookings, most-recent 4, used for visit history
 *                        and to locate the last lash visit for the fill reminder
 * 3. stats             — all-time visit count + lifetime spend (completed only)
 * 4. monthStats        — spend for the current calendar month (completed only)
 * 5. loyaltyResult     — signed SUM of loyalty_transactions; negative rows are
 *                        redemptions/expirations, so the SUM is the true balance
 *
 * ## Staff alias
 * `profiles` is aliased as `staffProfiles` using Drizzle's `alias()` so we can
 * join it twice in the same query — once for the client row and once for the
 * assigned staff member's first name.
 *
 * ## Lash fill reminder
 * After fetching, we scan `pastBookings` for the first entry whose `serviceCategory`
 * is "lash". That date is passed to ClientHomePage, which computes the banner.
 *
 * ## Related files
 * - app/client/ClientHomePage.tsx — the Client Component that renders this data
 * - db/schema/bookings.ts         — bookings + services tables
 * - db/schema/loyalty.ts          — loyalty_transactions table
 */
import { redirect } from "next/navigation";
import { and, asc, count, desc, eq, gte, inArray, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, loyaltyTransactions, profiles, services as servicesTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ClientHomePage } from "./ClientHomePage";

export default async function ClientPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Alias profiles a second time so we can join staff name separately from client
  const staffProfiles = alias(profiles, "staff");

  const [upcomingBookings, pastBookings, stats, monthStats, loyaltyResult] = await Promise.all([
    // Upcoming appointments (pending or confirmed, soonest first)
    db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        status: bookings.status,
        serviceName: servicesTable.name,
        staffName: staffProfiles.firstName,
      })
      .from(bookings)
      .leftJoin(servicesTable, eq(bookings.serviceId, servicesTable.id))
      .leftJoin(staffProfiles, eq(bookings.staffId, staffProfiles.id))
      .where(
        and(
          eq(bookings.clientId, user.id),
          gte(bookings.startsAt, now),
          inArray(bookings.status, ["pending", "confirmed"]),
        ),
      )
      .orderBy(asc(bookings.startsAt))
      .limit(3),

    // Past visits (completed, most recent 4)
    db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        totalInCents: bookings.totalInCents,
        serviceName: servicesTable.name,
        serviceCategory: servicesTable.category,
        staffName: staffProfiles.firstName,
      })
      .from(bookings)
      .leftJoin(servicesTable, eq(bookings.serviceId, servicesTable.id))
      .leftJoin(staffProfiles, eq(bookings.staffId, staffProfiles.id))
      .where(and(eq(bookings.clientId, user.id), eq(bookings.status, "completed")))
      .orderBy(desc(bookings.startsAt))
      .limit(4),

    // All-time visit count + lifetime spend
    db
      .select({
        totalVisits: count(bookings.id),
        lifetimeSpendCents: sum(bookings.totalInCents),
      })
      .from(bookings)
      .where(and(eq(bookings.clientId, user.id), eq(bookings.status, "completed")))
      .then((r) => r[0]),

    // Spend this calendar month
    db
      .select({ spendCents: sum(bookings.totalInCents) })
      .from(bookings)
      .where(
        and(
          eq(bookings.clientId, user.id),
          eq(bookings.status, "completed"),
          gte(bookings.startsAt, startOfMonth),
        ),
      )
      .then((r) => r[0]),

    // Loyalty balance (signed sum — negative rows are redemptions/expirations)
    db
      .select({ totalPoints: sum(loyaltyTransactions.points) })
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.profileId, user.id))
      .then((r) => r[0]),
  ]);

  // Find the most recent lash-category completed booking for fill reminder
  const lastLashVisit = pastBookings.find((b) => b.serviceCategory === "lash")?.startsAt ?? null;

  return (
    <ClientHomePage
      firstName={user.profile?.firstName ?? ""}
      memberSince={user.profile?.createdAt ?? null}
      totalVisits={stats?.totalVisits ?? 0}
      lifetimeSpendCents={Number(stats?.lifetimeSpendCents ?? 0)}
      monthSpendCents={Number(monthStats?.spendCents ?? 0)}
      loyaltyPoints={Math.max(0, Number(loyaltyResult?.totalPoints ?? 0))}
      upcomingBookings={upcomingBookings}
      pastBookings={pastBookings}
      lastLashVisitDate={lastLashVisit}
    />
  );
}
