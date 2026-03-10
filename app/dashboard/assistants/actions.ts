"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, sql, and, gte, lte, lt } from "drizzle-orm";
import { db } from "@/db";
import { profiles, assistantProfiles, businessHours, bookings } from "@/db/schema";
import { createClient as createSupabaseClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AssistantRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  title: string | null;
  specialties: string | null;
  bio: string | null;
  averageRating: string | null;
  isAvailable: boolean;
  startDate: Date | null;
  commissionRatePercent: number | null;
  totalSessions: number;
  totalRevenue: number;
  thisMonthSessions: number;
};

export type AssistantInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  specialties?: string;
  commissionRate?: number;
};

export type AvailabilityRow = {
  staffId: string;
  staffName: string;
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getAssistants(): Promise<AssistantRow[]> {
  await getUser();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Subquery: total booking stats per staff
  const allBookingStats = db
    .select({
      staffId: bookings.staffId,
      totalSessions: sql<number>`count(*)`.as("total_sessions"),
      totalRevenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`.as("total_revenue"),
    })
    .from(bookings)
    .groupBy(bookings.staffId)
    .as("all_booking_stats");

  // Subquery: this month's sessions per staff
  const monthBookingStats = db
    .select({
      staffId: bookings.staffId,
      thisMonthSessions: sql<number>`count(*)`.as("this_month_sessions"),
    })
    .from(bookings)
    .where(gte(bookings.startsAt, startOfMonth))
    .groupBy(bookings.staffId)
    .as("month_booking_stats");

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
      averageRating: assistantProfiles.averageRating,
      isAvailable: assistantProfiles.isAvailable,
      startDate: assistantProfiles.startDate,
      commissionRatePercent: assistantProfiles.commissionRatePercent,
      totalSessions: allBookingStats.totalSessions,
      totalRevenue: allBookingStats.totalRevenue,
      thisMonthSessions: monthBookingStats.thisMonthSessions,
    })
    .from(profiles)
    .where(ne(profiles.role, "client"))
    .leftJoin(assistantProfiles, eq(profiles.id, assistantProfiles.profileId))
    .leftJoin(allBookingStats, eq(profiles.id, allBookingStats.staffId))
    .leftJoin(monthBookingStats, eq(profiles.id, monthBookingStats.staffId))
    .orderBy(profiles.firstName);

  return rows.map((r) => ({
    ...r,
    isAvailable: r.isAvailable ?? true,
    commissionRatePercent: r.commissionRatePercent ?? null,
    totalSessions: Number(r.totalSessions ?? 0),
    totalRevenue: Number(r.totalRevenue ?? 0),
    thisMonthSessions: Number(r.thisMonthSessions ?? 0),
  }));
}

export async function getAssistantAvailability(): Promise<AvailabilityRow[]> {
  await getUser();

  const rows = await db
    .select({
      staffId: businessHours.staffId,
      staffFirstName: profiles.firstName,
      staffLastName: profiles.lastName,
      dayOfWeek: businessHours.dayOfWeek,
      isOpen: businessHours.isOpen,
      opensAt: businessHours.opensAt,
      closesAt: businessHours.closesAt,
    })
    .from(businessHours)
    .innerJoin(profiles, eq(businessHours.staffId, profiles.id))
    .orderBy(profiles.firstName, businessHours.dayOfWeek);

  return rows.map((r) => ({
    staffId: r.staffId!,
    staffName: [r.staffFirstName, r.staffLastName].filter(Boolean).join(" "),
    dayOfWeek: r.dayOfWeek,
    isOpen: r.isOpen,
    opensAt: r.opensAt,
    closesAt: r.closesAt,
  }));
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function createAssistant(input: AssistantInput): Promise<void> {
  await getUser();

  const id = crypto.randomUUID();

  await db.insert(profiles).values({
    id,
    role: "assistant",
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone ?? null,
  });

  await db.insert(assistantProfiles).values({
    profileId: id,
    title: input.title ?? null,
    specialties: input.specialties ?? null,
    commissionRatePercent: input.commissionRate ?? null,
    isAvailable: true,
    startDate: new Date(),
  });

  revalidatePath("/dashboard/assistants");
}

export async function updateAssistant(id: string, input: AssistantInput): Promise<void> {
  await getUser();

  await db
    .update(profiles)
    .set({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
    })
    .where(eq(profiles.id, id));

  // Upsert assistant_profiles — may not exist for admin users
  const existing = await db
    .select({ profileId: assistantProfiles.profileId })
    .from(assistantProfiles)
    .where(eq(assistantProfiles.profileId, id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(assistantProfiles)
      .set({
        title: input.title ?? null,
        specialties: input.specialties ?? null,
        ...(input.commissionRate !== undefined && {
          commissionRatePercent: input.commissionRate,
        }),
      })
      .where(eq(assistantProfiles.profileId, id));
  } else {
    await db.insert(assistantProfiles).values({
      profileId: id,
      title: input.title ?? null,
      specialties: input.specialties ?? null,
      commissionRatePercent: input.commissionRate ?? null,
    });
  }

  revalidatePath("/dashboard/assistants");
}

export async function toggleAssistantStatus(
  id: string,
  status: "active" | "on_leave" | "inactive",
): Promise<void> {
  await getUser();

  if (status === "inactive") {
    await db.update(profiles).set({ isActive: false }).where(eq(profiles.id, id));
    // Also mark unavailable
    await db
      .update(assistantProfiles)
      .set({ isAvailable: false })
      .where(eq(assistantProfiles.profileId, id));
  } else if (status === "on_leave") {
    await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, id));
    await db
      .update(assistantProfiles)
      .set({ isAvailable: false })
      .where(eq(assistantProfiles.profileId, id));
  } else {
    // active
    await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, id));
    await db
      .update(assistantProfiles)
      .set({ isAvailable: true })
      .where(eq(assistantProfiles.profileId, id));
  }

  revalidatePath("/dashboard/assistants");
}

export async function updateCommissionRate(id: string, rate: number): Promise<void> {
  await getUser();

  const existing = await db
    .select({ profileId: assistantProfiles.profileId })
    .from(assistantProfiles)
    .where(eq(assistantProfiles.profileId, id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(assistantProfiles)
      .set({ commissionRatePercent: rate })
      .where(eq(assistantProfiles.profileId, id));
  } else {
    await db.insert(assistantProfiles).values({
      profileId: id,
      commissionRatePercent: rate,
    });
  }

  revalidatePath("/dashboard/assistants");
}

export async function deleteAssistant(id: string): Promise<void> {
  await getUser();
  await db.delete(profiles).where(eq(profiles.id, id));
  revalidatePath("/dashboard/assistants");
}

/* ------------------------------------------------------------------ */
/*  Commissions & Payroll                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_COMMISSION_RATE = 60;

export type CommissionRow = {
  id: string;
  name: string;
  initials: string;
  /** Commission rate as a whole-number percent (e.g. 60 = 60%). */
  rate: number;
  /** All-time completed session count. */
  sessions: number;
  /** All-time gross booking revenue in cents. */
  revenueInCents: number;
  /** All-time earned (revenueInCents × rate). */
  earnedInCents: number;
  /** Prior months earned — treated as already paid out. */
  paidOutInCents: number;
};

export type PayrollRow = {
  id: string;
  name: string;
  role: string | null;
  /** Completed sessions in the current calendar month. */
  sessions: number;
  /** Gross booking revenue this month in cents. */
  revenueInCents: number;
  /** Amount owed this month (revenueInCents × rate). */
  owedInCents: number;
  /** Year-to-date gross earnings in cents (for 1099 summary). */
  ytdRevenueInCents: number;
};

export type PayrollSummary = {
  /** Human-readable label for the current pay period, e.g. "Mar 1 – Mar 31, 2026". */
  periodLabel: string;
  /** Sum of owedInCents across all assistants. */
  totalOwedInCents: number;
};

export async function getCommissionsData(): Promise<CommissionRow[]> {
  await getUser();

  const startOfThisMonth = new Date();
  startOfThisMonth.setDate(1);
  startOfThisMonth.setHours(0, 0, 0, 0);

  // All-time completed booking totals per staff member
  const allTimeStats = db
    .select({
      staffId: bookings.staffId,
      totalSessions: sql<number>`count(*)`.as("total_sessions"),
      totalRevenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`.as("total_revenue"),
    })
    .from(bookings)
    .where(eq(bookings.status, "completed"))
    .groupBy(bookings.staffId)
    .as("all_time_stats");

  // Prior-month completed booking revenue per staff member (= "paid out")
  const priorStats = db
    .select({
      staffId: bookings.staffId,
      priorRevenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`.as("prior_revenue"),
    })
    .from(bookings)
    .where(and(eq(bookings.status, "completed"), lt(bookings.startsAt, startOfThisMonth)))
    .groupBy(bookings.staffId)
    .as("prior_stats");

  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      rate: assistantProfiles.commissionRatePercent,
      totalSessions: allTimeStats.totalSessions,
      totalRevenue: allTimeStats.totalRevenue,
      priorRevenue: priorStats.priorRevenue,
    })
    .from(profiles)
    .where(ne(profiles.role, "client"))
    .leftJoin(assistantProfiles, eq(profiles.id, assistantProfiles.profileId))
    .leftJoin(allTimeStats, eq(profiles.id, allTimeStats.staffId))
    .leftJoin(priorStats, eq(profiles.id, priorStats.staffId))
    .orderBy(profiles.firstName);

  return rows.map((r) => {
    const rate = r.rate ?? DEFAULT_COMMISSION_RATE;
    const totalRevenue = Number(r.totalRevenue ?? 0);
    const priorRevenue = Number(r.priorRevenue ?? 0);
    const earnedInCents = Math.round((totalRevenue * rate) / 100);
    const paidOutInCents = Math.round((priorRevenue * rate) / 100);
    const name = [r.firstName, r.lastName].filter(Boolean).join(" ");

    return {
      id: r.id,
      name,
      initials: name
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      rate,
      sessions: Number(r.totalSessions ?? 0),
      revenueInCents: totalRevenue,
      earnedInCents,
      paidOutInCents,
    };
  });
}

export async function getPayrollData(): Promise<{
  rows: PayrollRow[];
  summary: PayrollSummary;
}> {
  await getUser();

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const startOfThisYear = new Date(now.getFullYear(), 0, 1);

  // This month's completed bookings per staff
  const monthStats = db
    .select({
      staffId: bookings.staffId,
      sessions: sql<number>`count(*)`.as("sessions"),
      revenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`.as("revenue"),
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "completed"),
        gte(bookings.startsAt, startOfThisMonth),
        lte(bookings.startsAt, endOfThisMonth),
      ),
    )
    .groupBy(bookings.staffId)
    .as("month_stats");

  // YTD completed booking revenue per staff (for 1099 section)
  const ytdStats = db
    .select({
      staffId: bookings.staffId,
      ytdRevenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`.as("ytd_revenue"),
    })
    .from(bookings)
    .where(and(eq(bookings.status, "completed"), gte(bookings.startsAt, startOfThisYear)))
    .groupBy(bookings.staffId)
    .as("ytd_stats");

  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      title: assistantProfiles.title,
      rate: assistantProfiles.commissionRatePercent,
      sessions: monthStats.sessions,
      revenue: monthStats.revenue,
      ytdRevenue: ytdStats.ytdRevenue,
    })
    .from(profiles)
    .where(ne(profiles.role, "client"))
    .leftJoin(assistantProfiles, eq(profiles.id, assistantProfiles.profileId))
    .leftJoin(monthStats, eq(profiles.id, monthStats.staffId))
    .leftJoin(ytdStats, eq(profiles.id, ytdStats.staffId))
    .orderBy(profiles.firstName);

  const payrollRows: PayrollRow[] = rows.map((r) => {
    const rate = r.rate ?? DEFAULT_COMMISSION_RATE;
    const revenue = Number(r.revenue ?? 0);
    const owedInCents = Math.round((revenue * rate) / 100);

    return {
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(" "),
      role: r.title ?? null,
      sessions: Number(r.sessions ?? 0),
      revenueInCents: revenue,
      owedInCents,
      ytdRevenueInCents: Number(r.ytdRevenue ?? 0),
    };
  });

  const totalOwedInCents = payrollRows.reduce((s, r) => s + r.owedInCents, 0);

  const periodLabel = `${startOfThisMonth.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endOfThisMonth.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return { rows: payrollRows, summary: { periodLabel, totalOwedInCents } };
}
