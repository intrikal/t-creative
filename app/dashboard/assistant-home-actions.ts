"use server";

import { and, asc, countDistinct, desc, eq, gte, lte, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  assistantProfiles,
  bookings,
  enrollments,
  messages,
  profiles,
  services,
  timeOff,
  trainingPrograms,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import type {
  AssistantEnrollment,
  RecentMessage,
  TimeOffEntry,
  TodayBooking,
} from "./AssistantHomePage";

export async function getAssistantHomeData() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const userId = user.id;
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Today's date string for upcoming time-off filter
  const todayStr = now.toISOString().split("T")[0];

  const [
    profileRow,
    assistantProfile,
    todayBookingsRaw,
    earningsRow,
    clientsRow,
    recentMessagesRaw,
    enrollmentsRaw,
    timeOffRaw,
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
    db
      .select({
        id: timeOff.id,
        startDate: timeOff.startDate,
        endDate: timeOff.endDate,
        label: timeOff.label,
        notes: timeOff.notes,
        createdAt: timeOff.createdAt,
      })
      .from(timeOff)
      .where(and(eq(timeOff.staffId, userId), gte(timeOff.endDate, todayStr)))
      .orderBy(asc(timeOff.startDate))
      .limit(10),
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

  const myTimeOff: TimeOffEntry[] = timeOffRaw.map((r) => {
    let status: "pending" | "approved" | "denied" = "pending";
    let reason = r.label ?? "";
    let isPartial = false;
    let partialStartTime: string | undefined;
    let partialEndTime: string | undefined;

    if (r.notes) {
      try {
        const meta = JSON.parse(r.notes) as {
          status?: string;
          reason?: string;
          partial?: { startTime: string; endTime: string } | false;
        };
        if (meta.status === "approved") status = "approved";
        else if (meta.status === "denied") status = "denied";
        if (meta.reason) reason = meta.reason;
        if (meta.partial) {
          isPartial = true;
          partialStartTime = (meta.partial as { startTime: string }).startTime;
          partialEndTime = (meta.partial as { endTime: string }).endTime;
        }
      } catch {
        // plain text notes
      }
    }

    return {
      id: r.id,
      startDate: r.startDate,
      endDate: r.endDate,
      reason,
      status,
      isPartial,
      partialStartTime,
      partialEndTime,
      submittedOn: new Date(r.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    };
  });

  return {
    firstName: profileRow?.firstName ?? user.email?.split("@")[0] ?? "there",
    avatarUrl: profileRow?.avatarUrl ?? null,
    todayBookings,
    stats: {
      appointmentsToday: todayBookings.length,
      earningsThisWeek: Number(earningsRow?.total ?? 0),
      clientsThisMonth: Number(clientsRow?.count ?? 0),
      avgRating: assistantProfile?.averageRating ?? null,
    },
    recentMessages,
    enrollments: myEnrollments,
    timeOffEntries: myTimeOff,
  };
}
