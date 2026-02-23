/**
 * AssistantPage — /assistant home (Server Component).
 *
 * Reads the authenticated user's profile, today's assigned bookings, weekly
 * earnings, monthly client count, recent direct messages, and training
 * enrollments — then passes them all to AssistantHomePage for rendering.
 *
 * All sections degrade gracefully to empty states when there's no data yet
 * (a freshly onboarded assistant will see empty states everywhere until
 * Trini starts assigning bookings and training).
 *
 * ## Why a Server Component
 * Reading the auth session and querying the database requires server-side
 * execution. Running these queries here means AssistantHomePage receives
 * fully hydrated data with no client-side loading states.
 */
import { redirect } from "next/navigation";
import { and, asc, countDistinct, desc, eq, gte, lte, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  assistantProfiles,
  bookings,
  enrollments,
  messages,
  profiles,
  services,
  trainingPrograms,
} from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { AssistantHomePage } from "./AssistantHomePage";
import type { AssistantEnrollment, RecentMessage, TodayBooking } from "./AssistantHomePage";

export default async function AssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  /* ── Date ranges ──────────────────────────────────────────────────── */
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Start of the current calendar week (Sunday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // Start of the current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  /* ── Profile ──────────────────────────────────────────────────────── */
  const [profile] = await db
    .select({ firstName: profiles.firstName, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  /* ── Assistant profile (avg rating) ──────────────────────────────── */
  const [assistantProfile] = await db
    .select({ averageRating: assistantProfiles.averageRating })
    .from(assistantProfiles)
    .where(eq(assistantProfiles.profileId, user.id))
    .limit(1);

  /* ── Today's assigned bookings ────────────────────────────────────── */
  const todayBookingsRaw = await db
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
        eq(bookings.staffId, user.id),
        gte(bookings.startsAt, todayStart),
        lte(bookings.startsAt, todayEnd),
      ),
    )
    .orderBy(asc(bookings.startsAt));

  const todayBookings: TodayBooking[] = todayBookingsRaw.map((b) => ({
    ...b,
    // services.category is typed as the DB enum — cast to our local type alias
    serviceCategory: b.serviceCategory as TodayBooking["serviceCategory"],
  }));

  /* ── Weekly earnings (completed bookings only) ────────────────────── */
  const [earningsRow] = await db
    .select({ total: sum(bookings.totalInCents) })
    .from(bookings)
    .where(
      and(
        eq(bookings.staffId, user.id),
        eq(bookings.status, "completed"),
        gte(bookings.startsAt, weekStart),
      ),
    );

  /* ── Monthly unique clients served ───────────────────────────────── */
  const [clientsRow] = await db
    .select({ count: countDistinct(bookings.clientId) })
    .from(bookings)
    .where(
      and(
        eq(bookings.staffId, user.id),
        eq(bookings.status, "completed"),
        gte(bookings.startsAt, monthStart),
      ),
    );

  /* ── Recent direct messages to this assistant ─────────────────────── */
  // Re-alias profiles table to avoid conflict with the bookings join above.
  // In separate queries Drizzle handles this fine, but we name the select
  // columns explicitly to keep the shape clear.
  const recentMessagesRaw = await db
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
    .where(eq(messages.recipientId, user.id))
    .orderBy(desc(messages.createdAt))
    .limit(3);

  const recentMessages: RecentMessage[] = recentMessagesRaw;

  /* ── Training enrollments ─────────────────────────────────────────── */
  const enrollmentsRaw = await db
    .select({
      id: enrollments.id,
      status: enrollments.status,
      progressPercent: enrollments.progressPercent,
      programName: trainingPrograms.name,
      category: trainingPrograms.category,
    })
    .from(enrollments)
    .innerJoin(trainingPrograms, eq(enrollments.programId, trainingPrograms.id))
    .where(eq(enrollments.clientId, user.id))
    .orderBy(asc(enrollments.enrolledAt))
    .limit(6);

  const myEnrollments: AssistantEnrollment[] = enrollmentsRaw.map((e) => ({
    ...e,
    category: e.category as AssistantEnrollment["category"],
  }));

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <AssistantHomePage
      firstName={profile?.firstName ?? user.email?.split("@")[0] ?? "there"}
      avatarUrl={profile?.avatarUrl ?? null}
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
