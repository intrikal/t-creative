"use server";

import { and, asc, count, desc, eq, gte, inArray, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, loyaltyTransactions, profiles, services } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function getClientHomeData() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

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
          eq(bookings.clientId, user.id),
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
      .where(and(eq(bookings.clientId, user.id), eq(bookings.status, "completed")))
      .orderBy(desc(bookings.startsAt))
      .limit(4),
    db
      .select({
        totalVisits: count(bookings.id),
        lifetimeSpendCents: sum(bookings.totalInCents),
      })
      .from(bookings)
      .where(and(eq(bookings.clientId, user.id), eq(bookings.status, "completed")))
      .then((r) => r[0]),
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
    db
      .select({ totalPoints: sum(loyaltyTransactions.points) })
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.profileId, user.id))
      .then((r) => r[0]),
  ]);

  const lastLashVisit = pastBookings.find((b) => b.serviceCategory === "lash")?.startsAt ?? null;

  return {
    firstName: user.profile?.firstName ?? "",
    memberSince: user.profile?.createdAt ?? null,
    totalVisits: stats?.totalVisits ?? 0,
    lifetimeSpendCents: Number(stats?.lifetimeSpendCents ?? 0),
    monthSpendCents: Number(monthStats?.spendCents ?? 0),
    loyaltyPoints: Math.max(0, Number(loyaltyResult?.totalPoints ?? 0)),
    upcomingBookings,
    pastBookings,
    lastLashVisitDate: lastLashVisit,
  };
}
