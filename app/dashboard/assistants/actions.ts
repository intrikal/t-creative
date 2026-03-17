"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, ne, sql, and, gte, lte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import {
  profiles,
  assistantProfiles,
  businessHours,
  bookings,
  payments,
  services,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CommissionType = "percentage" | "flat_fee";

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
  commissionType: CommissionType;
  commissionRatePercent: number | null;
  commissionFlatFeeInCents: number | null;
  tipSplitPercent: number;
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
  commissionType?: CommissionType;
  commissionRate?: number;
  commissionFlatFee?: number;
  tipSplitPercent?: number;
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
  try {
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
        commissionType: assistantProfiles.commissionType,
        commissionRatePercent: assistantProfiles.commissionRatePercent,
        commissionFlatFeeInCents: assistantProfiles.commissionFlatFeeInCents,
        tipSplitPercent: assistantProfiles.tipSplitPercent,
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
      commissionType: (r.commissionType as CommissionType) ?? "percentage",
      commissionRatePercent: r.commissionRatePercent ?? null,
      commissionFlatFeeInCents: r.commissionFlatFeeInCents ?? null,
      tipSplitPercent: r.tipSplitPercent ?? 100,
      totalSessions: Number(r.totalSessions ?? 0),
      totalRevenue: Number(r.totalRevenue ?? 0),
      thisMonthSessions: Number(r.thisMonthSessions ?? 0),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getAssistantAvailability(): Promise<AvailabilityRow[]> {
  try {
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const assistantInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  title: z.string().optional(),
  specialties: z.string().optional(),
  commissionType: z.enum(["percentage", "flat_fee"]).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  commissionFlatFee: z.number().int().nonnegative().optional(),
  tipSplitPercent: z.number().min(0).max(100).optional(),
});

const commissionSettingsSchema = z.object({
  commissionType: z.enum(["percentage", "flat_fee"]),
  commissionRate: z.number().min(0).max(100).optional(),
  commissionFlatFee: z.number().int().nonnegative().optional(),
  tipSplitPercent: z.number().min(0).max(100).optional(),
});

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function createAssistant(input: AssistantInput): Promise<void> {
  try {
    assistantInputSchema.parse(input);
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
      commissionType: input.commissionType ?? "percentage",
      commissionRatePercent: input.commissionRate ?? null,
      commissionFlatFeeInCents: input.commissionFlatFee ?? null,
      tipSplitPercent: input.tipSplitPercent ?? 100,
      isAvailable: true,
      startDate: new Date(),
    });

    revalidatePath("/dashboard/assistants");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateAssistant(id: string, input: AssistantInput): Promise<void> {
  try {
    z.string().min(1).parse(id);
    assistantInputSchema.parse(input);
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
          ...(input.commissionType !== undefined && { commissionType: input.commissionType }),
          ...(input.commissionRate !== undefined && {
            commissionRatePercent: input.commissionRate,
          }),
          ...(input.commissionFlatFee !== undefined && {
            commissionFlatFeeInCents: input.commissionFlatFee,
          }),
          ...(input.tipSplitPercent !== undefined && { tipSplitPercent: input.tipSplitPercent }),
        })
        .where(eq(assistantProfiles.profileId, id));
    } else {
      await db.insert(assistantProfiles).values({
        profileId: id,
        title: input.title ?? null,
        specialties: input.specialties ?? null,
        commissionType: input.commissionType ?? "percentage",
        commissionRatePercent: input.commissionRate ?? null,
        commissionFlatFeeInCents: input.commissionFlatFee ?? null,
        tipSplitPercent: input.tipSplitPercent ?? 100,
      });
    }

    revalidatePath("/dashboard/assistants");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function toggleAssistantStatus(
  id: string,
  status: "active" | "on_leave" | "inactive",
): Promise<void> {
  try {
    z.string().min(1).parse(id);
    z.enum(["active", "on_leave", "inactive"]).parse(status);
    await getUser();

    if (status === "inactive") {
      await db.update(profiles).set({ isActive: false }).where(eq(profiles.id, id));
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
      await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, id));
      await db
        .update(assistantProfiles)
        .set({ isAvailable: true })
        .where(eq(assistantProfiles.profileId, id));
    }

    revalidatePath("/dashboard/assistants");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateCommissionSettings(
  id: string,
  settings: {
    commissionType: CommissionType;
    commissionRate?: number;
    commissionFlatFee?: number;
    tipSplitPercent?: number;
  },
): Promise<void> {
  try {
    z.string().min(1).parse(id);
    commissionSettingsSchema.parse(settings);
    await getUser();

    const existing = await db
      .select({ profileId: assistantProfiles.profileId })
      .from(assistantProfiles)
      .where(eq(assistantProfiles.profileId, id))
      .limit(1);

    const values = {
      commissionType: settings.commissionType,
      commissionRatePercent:
        settings.commissionType === "percentage" ? (settings.commissionRate ?? null) : null,
      commissionFlatFeeInCents:
        settings.commissionType === "flat_fee" ? (settings.commissionFlatFee ?? null) : null,
      ...(settings.tipSplitPercent !== undefined && { tipSplitPercent: settings.tipSplitPercent }),
    };

    if (existing.length > 0) {
      await db.update(assistantProfiles).set(values).where(eq(assistantProfiles.profileId, id));
    } else {
      await db.insert(assistantProfiles).values({ profileId: id, ...values });
    }

    revalidatePath("/dashboard/assistants");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateCommissionRate(id: string, rate: number): Promise<void> {
  try {
    z.string().min(1).parse(id);
    z.number().nonnegative().parse(rate);
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function deleteAssistant(id: string): Promise<void> {
  try {
    z.string().min(1).parse(id);
    await getUser();
    await db.delete(profiles).where(eq(profiles.id, id));
    revalidatePath("/dashboard/assistants");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Commissions & Payroll                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_COMMISSION_RATE = 60;

export type CommissionRow = {
  id: string;
  name: string;
  initials: string;
  commissionType: CommissionType;
  /** Commission rate as a whole-number percent (e.g. 60 = 60%). */
  rate: number;
  /** Flat fee per session in cents. */
  flatFeeInCents: number;
  /** Tip split percentage the assistant keeps (0–100). */
  tipSplitPercent: number;
  /** All-time completed session count. */
  sessions: number;
  /** All-time gross booking revenue in cents. */
  revenueInCents: number;
  /** All-time tips received in cents (before split). */
  totalTipsInCents: number;
  /** All-time earned from service commission (revenueInCents × rate or sessions × flatFee). */
  earnedInCents: number;
  /** All-time earned from tips (totalTipsInCents × tipSplitPercent / 100). */
  tipEarnedInCents: number;
  /** Prior months earned — treated as already paid out. */
  paidOutInCents: number;
};

export type PayrollRow = {
  id: string;
  name: string;
  role: string | null;
  commissionType: CommissionType;
  rate: number;
  flatFeeInCents: number;
  tipSplitPercent: number;
  /** Completed sessions in the current calendar month. */
  sessions: number;
  /** Gross booking revenue this month in cents. */
  revenueInCents: number;
  /** Tips this month in cents (before split). */
  tipsInCents: number;
  /** Amount owed from services this month. */
  serviceOwedInCents: number;
  /** Amount owed from tips this month. */
  tipOwedInCents: number;
  /** Total owed this month (service + tips). */
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

function calcServiceEarned(
  commissionType: CommissionType,
  rate: number,
  flatFeeInCents: number,
  revenueInCents: number,
  sessions: number,
): number {
  if (commissionType === "flat_fee") {
    return flatFeeInCents * sessions;
  }
  return Math.round((revenueInCents * rate) / 100);
}

export async function getCommissionsData(): Promise<CommissionRow[]> {
  try {
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

    // All-time tips per staff member (via bookings → payments join)
    const allTimeTips = db
      .select({
        staffId: bookings.staffId,
        totalTips: sql<number>`coalesce(sum(${payments.tipInCents}), 0)`.as("total_tips"),
      })
      .from(bookings)
      .innerJoin(payments, eq(payments.bookingId, bookings.id))
      .where(eq(bookings.status, "completed"))
      .groupBy(bookings.staffId)
      .as("all_time_tips");

    // Prior-month completed booking revenue per staff member (= "paid out")
    const priorStats = db
      .select({
        staffId: bookings.staffId,
        priorRevenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`.as("prior_revenue"),
        priorSessions: sql<number>`count(*)`.as("prior_sessions"),
      })
      .from(bookings)
      .where(and(eq(bookings.status, "completed"), lt(bookings.startsAt, startOfThisMonth)))
      .groupBy(bookings.staffId)
      .as("prior_stats");

    // Prior-month tips
    const priorTips = db
      .select({
        staffId: bookings.staffId,
        priorTips: sql<number>`coalesce(sum(${payments.tipInCents}), 0)`.as("prior_tips"),
      })
      .from(bookings)
      .innerJoin(payments, eq(payments.bookingId, bookings.id))
      .where(and(eq(bookings.status, "completed"), lt(bookings.startsAt, startOfThisMonth)))
      .groupBy(bookings.staffId)
      .as("prior_tips");

    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        commissionType: assistantProfiles.commissionType,
        rate: assistantProfiles.commissionRatePercent,
        flatFeeInCents: assistantProfiles.commissionFlatFeeInCents,
        tipSplitPercent: assistantProfiles.tipSplitPercent,
        totalSessions: allTimeStats.totalSessions,
        totalRevenue: allTimeStats.totalRevenue,
        totalTips: allTimeTips.totalTips,
        priorRevenue: priorStats.priorRevenue,
        priorSessions: priorStats.priorSessions,
        priorTips: priorTips.priorTips,
      })
      .from(profiles)
      .where(ne(profiles.role, "client"))
      .leftJoin(assistantProfiles, eq(profiles.id, assistantProfiles.profileId))
      .leftJoin(allTimeStats, eq(profiles.id, allTimeStats.staffId))
      .leftJoin(allTimeTips, eq(profiles.id, allTimeTips.staffId))
      .leftJoin(priorStats, eq(profiles.id, priorStats.staffId))
      .leftJoin(priorTips, eq(profiles.id, priorTips.staffId))
      .orderBy(profiles.firstName);

    return rows.map((r) => {
      const commissionType = (r.commissionType as CommissionType) ?? "percentage";
      const rate = r.rate ?? DEFAULT_COMMISSION_RATE;
      const flatFeeInCents = r.flatFeeInCents ?? 0;
      const tipSplitPercent = r.tipSplitPercent ?? 100;

      const totalRevenue = Number(r.totalRevenue ?? 0);
      const totalSessions = Number(r.totalSessions ?? 0);
      const totalTips = Number(r.totalTips ?? 0);
      const priorRevenue = Number(r.priorRevenue ?? 0);
      const priorSessions = Number(r.priorSessions ?? 0);
      const priorTips = Number(r.priorTips ?? 0);

      const earnedInCents = calcServiceEarned(
        commissionType,
        rate,
        flatFeeInCents,
        totalRevenue,
        totalSessions,
      );
      const paidOutInCents =
        calcServiceEarned(commissionType, rate, flatFeeInCents, priorRevenue, priorSessions) +
        Math.round((priorTips * tipSplitPercent) / 100);
      const tipEarnedInCents = Math.round((totalTips * tipSplitPercent) / 100);

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
        commissionType,
        rate,
        flatFeeInCents,
        tipSplitPercent,
        sessions: totalSessions,
        revenueInCents: totalRevenue,
        totalTipsInCents: totalTips,
        earnedInCents,
        tipEarnedInCents,
        paidOutInCents,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getPayrollData(): Promise<{
  rows: PayrollRow[];
  summary: PayrollSummary;
}> {
  try {
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

    // This month's tips per staff
    const monthTips = db
      .select({
        staffId: bookings.staffId,
        tips: sql<number>`coalesce(sum(${payments.tipInCents}), 0)`.as("tips"),
      })
      .from(bookings)
      .innerJoin(payments, eq(payments.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.status, "completed"),
          gte(bookings.startsAt, startOfThisMonth),
          lte(bookings.startsAt, endOfThisMonth),
        ),
      )
      .groupBy(bookings.staffId)
      .as("month_tips");

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
        commissionType: assistantProfiles.commissionType,
        rate: assistantProfiles.commissionRatePercent,
        flatFeeInCents: assistantProfiles.commissionFlatFeeInCents,
        tipSplitPercent: assistantProfiles.tipSplitPercent,
        sessions: monthStats.sessions,
        revenue: monthStats.revenue,
        tips: monthTips.tips,
        ytdRevenue: ytdStats.ytdRevenue,
      })
      .from(profiles)
      .where(ne(profiles.role, "client"))
      .leftJoin(assistantProfiles, eq(profiles.id, assistantProfiles.profileId))
      .leftJoin(monthStats, eq(profiles.id, monthStats.staffId))
      .leftJoin(monthTips, eq(profiles.id, monthTips.staffId))
      .leftJoin(ytdStats, eq(profiles.id, ytdStats.staffId))
      .orderBy(profiles.firstName);

    const payrollRows: PayrollRow[] = rows.map((r) => {
      const commissionType = (r.commissionType as CommissionType) ?? "percentage";
      const rate = r.rate ?? DEFAULT_COMMISSION_RATE;
      const flatFeeInCents = r.flatFeeInCents ?? 0;
      const tipSplitPercent = r.tipSplitPercent ?? 100;
      const sessions = Number(r.sessions ?? 0);
      const revenue = Number(r.revenue ?? 0);
      const tips = Number(r.tips ?? 0);
      const serviceOwedInCents = calcServiceEarned(
        commissionType,
        rate,
        flatFeeInCents,
        revenue,
        sessions,
      );
      const tipOwedInCents = Math.round((tips * tipSplitPercent) / 100);

      return {
        id: r.id,
        name: [r.firstName, r.lastName].filter(Boolean).join(" "),
        role: r.title ?? null,
        commissionType,
        rate,
        flatFeeInCents,
        tipSplitPercent,
        sessions,
        revenueInCents: revenue,
        tipsInCents: tips,
        serviceOwedInCents,
        tipOwedInCents,
        owedInCents: serviceOwedInCents + tipOwedInCents,
        ytdRevenueInCents: Number(r.ytdRevenue ?? 0),
      };
    });

    const totalOwedInCents = payrollRows.reduce((s, r) => s + r.owedInCents, 0);

    const periodLabel = `${startOfThisMonth.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endOfThisMonth.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    return { rows: payrollRows, summary: { periodLabel, totalOwedInCents } };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Pay Stub                                                           */
/* ------------------------------------------------------------------ */

export type PayStubEntry = {
  bookingId: number;
  date: string;
  service: string;
  client: string;
  grossInCents: number;
  tipInCents: number;
  serviceEarnedInCents: number;
  tipEarnedInCents: number;
  totalEarnedInCents: number;
};

export type PayStubData = {
  assistantName: string;
  role: string | null;
  periodLabel: string;
  commissionType: CommissionType;
  rate: number;
  flatFeeInCents: number;
  tipSplitPercent: number;
  entries: PayStubEntry[];
  totals: {
    sessions: number;
    grossInCents: number;
    tipsInCents: number;
    serviceEarnedInCents: number;
    tipEarnedInCents: number;
    totalEarnedInCents: number;
  };
};

export async function generatePayStub(
  assistantId: string,
  month: number,
  year: number,
): Promise<PayStubData> {
  try {
    await getUser();

    const startOfPeriod = new Date(year, month - 1, 1);
    const endOfPeriod = new Date(year, month, 0, 23, 59, 59, 999);

    // Get assistant info + commission settings
    const [profileRow] = await db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        title: assistantProfiles.title,
        commissionType: assistantProfiles.commissionType,
        rate: assistantProfiles.commissionRatePercent,
        flatFeeInCents: assistantProfiles.commissionFlatFeeInCents,
        tipSplitPercent: assistantProfiles.tipSplitPercent,
      })
      .from(profiles)
      .leftJoin(assistantProfiles, eq(profiles.id, assistantProfiles.profileId))
      .where(eq(profiles.id, assistantId))
      .limit(1);

    if (!profileRow) throw new Error("Assistant not found");

    const commissionType = (profileRow.commissionType as CommissionType) ?? "percentage";
    const rate = profileRow.rate ?? DEFAULT_COMMISSION_RATE;
    const flatFeeInCents = profileRow.flatFeeInCents ?? 0;
    const tipSplitPercent = profileRow.tipSplitPercent ?? 100;

    // Get all completed bookings in the period for this assistant
    const clientProfile = alias(profiles, "client");

    const bookingRows = await db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        totalInCents: bookings.totalInCents,
        serviceName: services.name,
        clientFirstName: clientProfile.firstName,
        clientLastName: clientProfile.lastName,
        tipInCents: sql<number>`coalesce(sum(${payments.tipInCents}), 0)`.as("tip_in_cents"),
      })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .innerJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
      .leftJoin(payments, eq(payments.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.staffId, assistantId),
          eq(bookings.status, "completed"),
          gte(bookings.startsAt, startOfPeriod),
          lte(bookings.startsAt, endOfPeriod),
        ),
      )
      .groupBy(
        bookings.id,
        bookings.startsAt,
        bookings.totalInCents,
        services.name,
        clientProfile.firstName,
        clientProfile.lastName,
      )
      .orderBy(bookings.startsAt);

    const entries: PayStubEntry[] = bookingRows.map((r, i) => {
      const gross = r.totalInCents;
      const tip = Number(r.tipInCents ?? 0);
      const serviceEarned = calcServiceEarned(commissionType, rate, flatFeeInCents, gross, 1);
      const tipEarned = Math.round((tip * tipSplitPercent) / 100);
      const first = r.clientFirstName ?? "";
      const last = r.clientLastName ?? "";

      return {
        bookingId: r.id,
        date: new Date(r.startsAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        service: r.serviceName,
        client: `${first} ${last.charAt(0)}.`.trim(),
        grossInCents: gross,
        tipInCents: tip,
        serviceEarnedInCents: serviceEarned,
        tipEarnedInCents: tipEarned,
        totalEarnedInCents: serviceEarned + tipEarned,
      };
    });

    const totals = entries.reduce(
      (acc, e) => ({
        sessions: acc.sessions + 1,
        grossInCents: acc.grossInCents + e.grossInCents,
        tipsInCents: acc.tipsInCents + e.tipInCents,
        serviceEarnedInCents: acc.serviceEarnedInCents + e.serviceEarnedInCents,
        tipEarnedInCents: acc.tipEarnedInCents + e.tipEarnedInCents,
        totalEarnedInCents: acc.totalEarnedInCents + e.totalEarnedInCents,
      }),
      {
        sessions: 0,
        grossInCents: 0,
        tipsInCents: 0,
        serviceEarnedInCents: 0,
        tipEarnedInCents: 0,
        totalEarnedInCents: 0,
      },
    );

    const periodLabel = `${startOfPeriod.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

    return {
      assistantName: [profileRow.firstName, profileRow.lastName].filter(Boolean).join(" "),
      role: profileRow.title ?? null,
      periodLabel,
      commissionType,
      rate,
      flatFeeInCents,
      tipSplitPercent,
      entries,
      totals,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
