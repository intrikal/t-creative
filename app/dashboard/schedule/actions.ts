/**
 * Server actions for the Assistant Schedule page (`/assistant/schedule`).
 *
 * Fetches bookings assigned to the logged-in assistant for the current
 * month (plus overflow for the calendar grid), with summary stats.
 *
 * @module assistant/schedule/actions
 */
"use server";

import { eq, and, gte, lte, asc } from "drizzle-orm";
import { db } from "@/db";
import { bookings, services, profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";
export type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

export type AppointmentRow = {
  id: number;
  date: string;
  dayLabel: string;
  time: string;
  startTime24: string;
  endTime: string;
  service: string;
  category: ServiceCategory;
  client: string;
  clientInitials: string;
  status: BookingStatus;
  durationMin: number;
  price: number;
  location?: string;
  notes?: string;
};

export type ScheduleStats = {
  todayCount: number;
  todayRevenue: number;
  weekCount: number;
  weekRevenue: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTime24(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getInitials(first: string, last: string): string {
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

function getWeekBounds(referenceDate: Date): { weekStart: Date; weekEnd: Date } {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getScheduleData(): Promise<{
  appointments: AppointmentRow[];
  stats: ScheduleStats;
  todayKey: string;
}> {
  const user = await getUser();

  const now = new Date();
  const todayKey = formatDateKey(now);

  // Fetch a wide window: current month ± 1 week for calendar grid overflow
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  rangeStart.setDate(rangeStart.getDate() - 7);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  rangeEnd.setDate(rangeEnd.getDate() + 7);
  rangeEnd.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      durationMinutes: bookings.durationMinutes,
      totalInCents: bookings.totalInCents,
      status: bookings.status,
      location: bookings.location,
      clientNotes: bookings.clientNotes,
      staffNotes: bookings.staffNotes,
      serviceName: services.name,
      serviceCategory: services.category,
      clientFirstName: profiles.firstName,
      clientLastName: profiles.lastName,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .innerJoin(profiles, eq(bookings.clientId, profiles.id))
    .where(
      and(
        eq(bookings.staffId, user.id),
        gte(bookings.startsAt, rangeStart),
        lte(bookings.startsAt, rangeEnd),
      ),
    )
    .orderBy(asc(bookings.startsAt));

  const appointments: AppointmentRow[] = rows.map((r) => {
    const start = new Date(r.startsAt);
    const end = new Date(start.getTime() + r.durationMinutes * 60 * 1000);
    const firstName = r.clientFirstName ?? "";
    const lastName = r.clientLastName ?? "";

    return {
      id: r.id,
      date: formatDateKey(start),
      dayLabel: formatDayLabel(start),
      time: formatTime(start),
      startTime24: formatTime24(start),
      endTime: formatTime(end),
      service: r.serviceName,
      category: (r.serviceCategory ?? "lash") as ServiceCategory,
      client: `${firstName} ${lastName.charAt(0)}.`.trim(),
      clientInitials: getInitials(firstName, lastName),
      status: r.status as BookingStatus,
      durationMin: r.durationMinutes,
      price: r.totalInCents / 100,
      location: r.location ?? undefined,
      notes: r.staffNotes ?? r.clientNotes ?? undefined,
    };
  });

  // Stats: today + current week
  const { weekStart, weekEnd } = getWeekBounds(now);
  const weekStartKey = formatDateKey(weekStart);
  const weekEndKey = formatDateKey(weekEnd);

  const todayAppts = appointments.filter((a) => a.date === todayKey);
  const weekAppts = appointments.filter((a) => a.date >= weekStartKey && a.date <= weekEndKey);

  const stats: ScheduleStats = {
    todayCount: todayAppts.length,
    todayRevenue: todayAppts.reduce((s, a) => s + a.price, 0),
    weekCount: weekAppts.length,
    weekRevenue: weekAppts.reduce((s, a) => s + a.price, 0),
  };

  return { appointments, stats, todayKey };
}
