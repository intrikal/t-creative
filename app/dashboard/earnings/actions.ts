"use server";

import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, profiles, services, assistantProfiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
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

export type EarningEntry = {
  id: number;
  date: string;
  dayLabel: string;
  service: string;
  client: string;
  clientInitials: string;
  gross: number;
  commissionRate: number;
  net: number;
  status: "paid" | "pending";
};

export type WeeklyBar = {
  label: string;
  dayNum: string;
  amount: number;
};

export type EarningsData = {
  entries: EarningEntry[];
  weeklyBars: WeeklyBar[];
  commissionRate: number;
  stats: {
    weekNet: number;
    weekGross: number;
    pendingTotal: number;
    monthNet: number;
  };
  weekLabel: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_COMMISSION = 60;

function getInitials(first: string, last: string): string {
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Mon=0
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(d: Date, now: Date): string {
  if (formatDateKey(d) === formatDateKey(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (formatDateKey(d) === formatDateKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatShortDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getAssistantEarnings(): Promise<EarningsData> {
  const user = await getUser();
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const monthStart = startOfMonth(now);

  // Get assistant's commission rate
  let commissionRate = DEFAULT_COMMISSION;
  try {
    const [assistantProfile] = await db
      .select({ commissionRatePercent: assistantProfiles.commissionRatePercent })
      .from(assistantProfiles)
      .where(eq(assistantProfiles.profileId, user.id))
      .limit(1);
    commissionRate = assistantProfile?.commissionRatePercent ?? DEFAULT_COMMISSION;
  } catch {
    // Column may not exist yet — use default
  }

  // Get all completed bookings for this assistant
  const clientProfile = alias(profiles, "client");

  const rows = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      totalInCents: bookings.totalInCents,
      completedAt: bookings.completedAt,
      clientFirstName: clientProfile.firstName,
      clientLastName: clientProfile.lastName,
      serviceName: services.name,
    })
    .from(bookings)
    .innerJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(eq(bookings.staffId, user.id), eq(bookings.status, "completed")))
    .orderBy(desc(bookings.startsAt));

  // Map to earning entries
  const entries: EarningEntry[] = rows.map((r) => {
    const d = new Date(r.startsAt);
    const gross = r.totalInCents / 100;
    const net = Math.round(gross * (commissionRate / 100) * 100) / 100;
    const firstName = r.clientFirstName ?? "";
    const lastName = r.clientLastName ?? "";

    // "Paid" if completed more than 7 days ago (i.e. past pay cycle), else "pending"
    const completedDate = r.completedAt ? new Date(r.completedAt) : d;
    const daysSinceCompleted = Math.floor(
      (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const status: "paid" | "pending" = daysSinceCompleted >= 7 ? "paid" : "pending";

    return {
      id: r.id,
      date: formatDateKey(d),
      dayLabel: formatDayLabel(d, now),
      service: r.serviceName,
      client: `${firstName} ${lastName.charAt(0)}.`.trim(),
      clientInitials: getInitials(firstName, lastName),
      gross,
      commissionRate,
      net,
      status,
    };
  });

  // Compute stats
  const weekEntries = entries.filter((e) => {
    const d = new Date(e.date);
    return d >= weekStart && d <= weekEnd;
  });
  const monthEntries = entries.filter((e) => {
    const d = new Date(e.date);
    return d >= monthStart;
  });
  const pendingEntries = entries.filter((e) => e.status === "pending");

  const weekNet = weekEntries.reduce((s, e) => s + e.net, 0);
  const weekGross = weekEntries.reduce((s, e) => s + e.gross, 0);
  const pendingTotal = pendingEntries.reduce((s, e) => s + e.net, 0);
  const monthNet = monthEntries.reduce((s, e) => s + e.net, 0);

  // Build weekly bars (Mon–Sun)
  const weeklyBars: WeeklyBar[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const key = formatDateKey(day);
    const dayTotal = weekEntries.filter((e) => e.date === key).reduce((s, e) => s + e.net, 0);
    weeklyBars.push({
      label: formatShortDay(day),
      dayNum: String(day.getDate()),
      amount: Math.round(dayTotal * 100) / 100,
    });
  }

  const weekLabel = `${formatShortDay(weekStart)} – ${formatShortDay(weekEnd)}`;

  return {
    entries,
    weeklyBars,
    commissionRate,
    stats: {
      weekNet: Math.round(weekNet * 100) / 100,
      weekGross: Math.round(weekGross * 100) / 100,
      pendingTotal: Math.round(pendingTotal * 100) / 100,
      monthNet: Math.round(monthNet * 100) / 100,
    },
    weekLabel,
  };
}
