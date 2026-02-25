import { redirect } from "next/navigation";
import { and, asc, count, countDistinct, desc, eq, gte, inArray, lte, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Metadata } from "next";
import { db } from "@/db";
import {
  assistantProfiles,
  bookings,
  enrollments,
  loyaltyTransactions,
  messages,
  profiles,
  services,
  trainingPrograms,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { AssistantHomePage } from "./AssistantHomePage";
import type { AssistantEnrollment, RecentMessage, TodayBooking } from "./AssistantHomePage";
import { ClientHomePage } from "./ClientHomePage";
import { DashboardPage } from "./DashboardPage";

export const metadata: Metadata = {
  title: "Dashboard — T Creative Studio",
  description: "Admin overview for T Creative Studio.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  // ── Client home ────────────────────────────────────────────────────
  if (currentUser.profile?.role === "client") {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const staffProfiles = alias(profiles, "staff");
    const servicesTable = services;

    const [upcomingBookings, pastBookings, stats, monthStats, loyaltyResult] = await Promise.all([
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
            eq(bookings.clientId, currentUser.id),
            gte(bookings.startsAt, now),
            inArray(bookings.status, ["pending", "confirmed"]),
          ),
        )
        .orderBy(asc(bookings.startsAt))
        .limit(3),
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
        .where(and(eq(bookings.clientId, currentUser.id), eq(bookings.status, "completed")))
        .orderBy(desc(bookings.startsAt))
        .limit(4),
      db
        .select({
          totalVisits: count(bookings.id),
          lifetimeSpendCents: sum(bookings.totalInCents),
        })
        .from(bookings)
        .where(and(eq(bookings.clientId, currentUser.id), eq(bookings.status, "completed")))
        .then((r) => r[0]),
      db
        .select({ spendCents: sum(bookings.totalInCents) })
        .from(bookings)
        .where(
          and(
            eq(bookings.clientId, currentUser.id),
            eq(bookings.status, "completed"),
            gte(bookings.startsAt, startOfMonth),
          ),
        )
        .then((r) => r[0]),
      db
        .select({ totalPoints: sum(loyaltyTransactions.points) })
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.profileId, currentUser.id))
        .then((r) => r[0]),
    ]);

    const lastLashVisit = pastBookings.find((b) => b.serviceCategory === "lash")?.startsAt ?? null;

    return (
      <ClientHomePage
        firstName={currentUser.profile?.firstName ?? ""}
        memberSince={currentUser.profile?.createdAt ?? null}
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

  // ── Admin home ────────────────────────────────────────────────────
  if (currentUser.profile?.role !== "assistant") {
    return <DashboardPage />;
  }

  // ── Assistant overview data ──────────────────────────────────────
  const userId = currentUser.id;
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    profileRow,
    assistantProfile,
    todayBookingsRaw,
    earningsRow,
    clientsRow,
    recentMessagesRaw,
    enrollmentsRaw,
  ] = await Promise.all([
    db
      .select({ firstName: profiles.firstName, avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ averageRating: assistantProfiles.averageRating })
      .from(assistantProfiles)
      .where(eq(assistantProfiles.profileId, userId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        id: bookings.id,
        status: bookings.status,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        location: bookings.location,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        serviceName: services.name,
        serviceCategory: services.category,
      })
      .from(bookings)
      .innerJoin(profiles, eq(bookings.clientId, profiles.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(
        and(
          eq(bookings.staffId, userId),
          gte(bookings.startsAt, todayStart),
          lte(bookings.startsAt, todayEnd),
        ),
      )
      .orderBy(asc(bookings.startsAt)),
    db
      .select({ total: sum(bookings.totalInCents) })
      .from(bookings)
      .where(
        and(
          eq(bookings.staffId, userId),
          eq(bookings.status, "completed"),
          gte(bookings.startsAt, weekStart),
        ),
      )
      .then((r) => r[0]),
    db
      .select({ count: countDistinct(bookings.clientId) })
      .from(bookings)
      .where(
        and(
          eq(bookings.staffId, userId),
          eq(bookings.status, "completed"),
          gte(bookings.startsAt, monthStart),
        ),
      )
      .then((r) => r[0]),
    db
      .select({
        id: messages.id,
        body: messages.body,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        senderFirstName: profiles.firstName,
        senderAvatarUrl: profiles.avatarUrl,
      })
      .from(messages)
      .innerJoin(profiles, eq(messages.senderId, profiles.id))
      .where(eq(messages.recipientId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(3),
    db
      .select({
        id: enrollments.id,
        status: enrollments.status,
        progressPercent: enrollments.progressPercent,
        programName: trainingPrograms.name,
        category: trainingPrograms.category,
      })
      .from(enrollments)
      .innerJoin(trainingPrograms, eq(enrollments.programId, trainingPrograms.id))
      .where(eq(enrollments.clientId, userId))
      .orderBy(asc(enrollments.enrolledAt))
      .limit(6),
  ]);

  const todayBookings: TodayBooking[] = todayBookingsRaw.map((b) => ({
    ...b,
    serviceCategory: b.serviceCategory as TodayBooking["serviceCategory"],
  }));

  const recentMessages: RecentMessage[] = recentMessagesRaw;

  const myEnrollments: AssistantEnrollment[] = enrollmentsRaw.map((e) => ({
    ...e,
    category: e.category as AssistantEnrollment["category"],
  }));

  return (
    <AssistantHomePage
      firstName={profileRow?.firstName ?? currentUser.email?.split("@")[0] ?? "there"}
      avatarUrl={profileRow?.avatarUrl ?? null}
      todayBookings={todayBookings}
      stats={{
        appointmentsToday: todayBookings.length,
        earningsThisWeek: Number(earningsRow?.total ?? 0),
        clientsThisMonth: Number(clientsRow?.count ?? 0),
        avgRating: assistantProfile?.averageRating ?? null,
      }}
      recentMessages={recentMessages}
      enrollments={myEnrollments}
    />
  );
}
