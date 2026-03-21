"use server";

import * as Sentry from "@sentry/nextjs";
import { and, eq, gte, lte, sql, desc, asc, count } from "drizzle-orm";
import { db } from "@/db";
import { profiles, assistantProfiles, shifts, bookings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type StaffRow = {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  phone: string;
  specialties: string[];
  activeBookingsToday: number;
  totalShiftsMonth: number;
  status: "active" | "off_today" | "inactive";
  joinedDate: string;
  bio: string | null;
};

export type ShiftRow = {
  id: number;
  staffId: string;
  staffName: string;
  staffInitials: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  bookedSlots: number;
  notes: string | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatShiftDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const shiftDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (shiftDay.getTime() === today.getTime()) return "Today";
  if (shiftDay.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/* ------------------------------------------------------------------ */
/*  getStaff                                                           */
/* ------------------------------------------------------------------ */

export async function getStaff(): Promise<StaffRow[]> {
  await requireAdmin();

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        phone: profiles.phone,
        isActive: profiles.isActive,
        title: assistantProfiles.title,
        specialties: assistantProfiles.specialties,
        bio: assistantProfiles.bio,
        isAvailable: assistantProfiles.isAvailable,
        startDate: assistantProfiles.startDate,
      })
      .from(profiles)
      .innerJoin(assistantProfiles, eq(assistantProfiles.profileId, profiles.id))
      .where(eq(profiles.role, "assistant"));

    const staffIds = rows.map((r) => r.id);
    if (staffIds.length === 0) return [];

    // Batch-fetch today's booking counts and this month's shift counts
    const [bookingCounts, shiftCounts, todayShifts] = await Promise.all([
      db
        .select({
          staffId: bookings.staffId,
          count: count(),
        })
        .from(bookings)
        .where(
          and(
            sql`${bookings.staffId} = ANY(${staffIds})`,
            gte(bookings.startsAt, todayStart),
            lte(bookings.startsAt, todayEnd),
          ),
        )
        .groupBy(bookings.staffId),
      db
        .select({
          assistantId: shifts.assistantId,
          count: count(),
        })
        .from(shifts)
        .where(
          and(
            sql`${shifts.assistantId} = ANY(${staffIds})`,
            gte(shifts.startsAt, monthStart),
            lte(shifts.startsAt, monthEnd),
          ),
        )
        .groupBy(shifts.assistantId),
      db
        .select({
          assistantId: shifts.assistantId,
        })
        .from(shifts)
        .where(
          and(
            sql`${shifts.assistantId} = ANY(${staffIds})`,
            gte(shifts.startsAt, todayStart),
            lte(shifts.endsAt, todayEnd),
            sql`${shifts.status} IN ('scheduled', 'in_progress')`,
          ),
        ),
    ]);

    const bookingMap = new Map(bookingCounts.map((r) => [r.staffId, Number(r.count)]));
    const shiftMap = new Map(shiftCounts.map((r) => [r.assistantId, Number(r.count)]));
    const todayShiftSet = new Set(todayShifts.map((r) => r.assistantId));

    return rows.map((r) => {
      const specialtiesArr = r.specialties
        ? r.specialties.split(",").map((s) => s.trim().toLowerCase())
        : [];

      let status: StaffRow["status"] = "inactive";
      if (r.isActive && r.isAvailable) {
        status = todayShiftSet.has(r.id) ? "active" : "off_today";
      }

      let joinedDate = "—";
      if (r.startDate) {
        joinedDate = r.startDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      }

      return {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        initials: initials(r.firstName, r.lastName),
        role: r.title ?? "Assistant",
        email: r.email,
        phone: r.phone ?? "",
        specialties: specialtiesArr,
        activeBookingsToday: bookingMap.get(r.id) ?? 0,
        totalShiftsMonth: shiftMap.get(r.id) ?? 0,
        status,
        joinedDate,
        bio: r.bio,
      };
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  getShifts                                                          */
/* ------------------------------------------------------------------ */

export async function getShifts(): Promise<ShiftRow[]> {
  await requireAdmin();

  try {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksOut = new Date(now);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

    const rows = await db
      .select({
        id: shifts.id,
        assistantId: shifts.assistantId,
        status: shifts.status,
        startsAt: shifts.startsAt,
        endsAt: shifts.endsAt,
        notes: shifts.notes,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(shifts)
      .innerJoin(profiles, eq(profiles.id, shifts.assistantId))
      .where(and(gte(shifts.startsAt, weekAgo), lte(shifts.startsAt, twoWeeksOut)))
      .orderBy(desc(shifts.startsAt));

    // Count bookings that fall within each shift's time window
    const shiftBookingCounts = await Promise.all(
      rows.map((row) =>
        db
          .select({ count: count() })
          .from(bookings)
          .where(
            and(
              eq(bookings.staffId, row.assistantId),
              gte(bookings.startsAt, row.startsAt),
              lte(bookings.startsAt, row.endsAt),
            ),
          )
          .then((r) => Number(r[0].count)),
      ),
    );

    return rows.map((r, i) => ({
      id: r.id,
      staffId: r.assistantId,
      staffName: r.firstName,
      staffInitials: initials(r.firstName, r.lastName),
      date: formatShiftDate(r.startsAt),
      startTime: formatTime(r.startsAt),
      endTime: formatTime(r.endsAt),
      status: r.status,
      bookedSlots: shiftBookingCounts[i],
      notes: r.notes,
    }));
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}
