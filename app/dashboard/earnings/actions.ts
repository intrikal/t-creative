/**
 * earnings/actions — Server actions for the Assistant Earnings page.
 *
 * Calculates an assistant's take-home pay from completed bookings.
 * Supports two commission models:
 * - **percentage** (default 60%) — assistant gets `commissionRate%` of the booking total
 * - **flat_fee** — assistant gets a fixed dollar amount per completed session
 *
 * Tips are split separately via `tipSplitPercent` (default 100% = assistant keeps all).
 *
 * The query uses `alias()` to self-join the `profiles` table — once for the
 * assistant (via auth) and once for the client name. It LEFT JOINs `payments`
 * and aggregates tips via `sum(payments.tipInCents)`, with GROUP BY on all
 * non-aggregate columns so Postgres knows how to collapse the rows.
 *
 * "Paid" vs "pending" is a heuristic: bookings completed >7 days ago are
 * considered paid. This will be replaced by actual payout tracking later.
 *
 * @see {@link ./EarningsPage.tsx} — assistant dashboard view
 * @see {@link db/schema/assistants.ts} — commission fields on assistant_profiles
 */
"use server";

import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, profiles, services, assistantProfiles, payments } from "@/db/schema";
import { getUser } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** One completed booking with commission and tip calculations applied. */
export type EarningEntry = {
  id: number;
  date: string;
  dayLabel: string;
  service: string;
  client: string;
  clientInitials: string;
  gross: number;
  tip: number;
  commissionRate: number;
  tipSplitPercent: number;
  net: number;
  tipNet: number;
  totalNet: number;
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
  commissionType: "percentage" | "flat_fee";
  commissionRate: number;
  flatFeeInCents: number;
  tipSplitPercent: number;
  stats: {
    weekNet: number;
    weekGross: number;
    weekTips: number;
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
  // .filter(Boolean) drops undefined from optional-chained empty names so
  // initials degrade gracefully ("?" fallback for fully anonymous clients).
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

  // Get assistant's commission settings
  let commissionType: "percentage" | "flat_fee" = "percentage";
  let commissionRate = DEFAULT_COMMISSION;
  let flatFeeInCents = 0;
  let tipSplitPercent = 100;

  try {
    const [assistantProfile] = await db
      .select({
        commissionType: assistantProfiles.commissionType,
        commissionRatePercent: assistantProfiles.commissionRatePercent,
        commissionFlatFeeInCents: assistantProfiles.commissionFlatFeeInCents,
        tipSplitPercent: assistantProfiles.tipSplitPercent,
      })
      .from(assistantProfiles)
      .where(eq(assistantProfiles.profileId, user.id))
      .limit(1);

    commissionType =
      (assistantProfile?.commissionType as "percentage" | "flat_fee") ?? "percentage";
    commissionRate = assistantProfile?.commissionRatePercent ?? DEFAULT_COMMISSION;
    flatFeeInCents = assistantProfile?.commissionFlatFeeInCents ?? 0;
    tipSplitPercent = assistantProfile?.tipSplitPercent ?? 100;
  } catch {
    // Column may not exist yet — use defaults
  }

  // `alias(profiles, "client")` creates a second reference to the profiles table
  // so we can join it as the client without conflicting with the assistant's profile.
  // This generates SQL: `profiles AS "client"` in the FROM clause.
  const clientProfile = alias(profiles, "client");

  // Query: all completed bookings for this assistant, with tip totals.
  //
  // LEFT JOIN payments (not INNER) because a booking can be completed without
  // a recorded payment row (e.g. cash, or Square webhook hasn't arrived yet).
  //
  // `coalesce(sum(payments.tipInCents), 0)` sums all tip amounts across
  // multiple payment records for a booking, defaulting to 0 if no payments.
  //
  // GROUP BY lists every non-aggregate column — required by Postgres when
  // using aggregate functions like sum(). This collapses multiple payment
  // rows per booking into a single row with the aggregated tip total.
  const rows = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      totalInCents: bookings.totalInCents,
      completedAt: bookings.completedAt,
      clientFirstName: clientProfile.firstName,
      clientLastName: clientProfile.lastName,
      serviceName: services.name,
      tipInCents: sql<number>`coalesce(sum(${payments.tipInCents}), 0)`.as("tip_in_cents"),
    })
    .from(bookings)
    .innerJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .where(and(eq(bookings.staffId, user.id), eq(bookings.status, "completed")))
    .groupBy(
      bookings.id,
      bookings.startsAt,
      bookings.totalInCents,
      bookings.completedAt,
      clientProfile.firstName,
      clientProfile.lastName,
      services.name,
    )
    .orderBy(desc(bookings.startsAt));

  // Transform each completed booking row into an EarningEntry by applying the
  // assistant's commission model (percentage or flat_fee) and tip split percentage.
  // Cents are converted to dollars. "Paid" vs "pending" is a 7-day heuristic
  // based on completion date — bookings older than 7 days are assumed paid out.
  const entries: EarningEntry[] = rows.map((r) => {
    const d = new Date(r.startsAt);
    const gross = r.totalInCents / 100;
    const tip = Number(r.tipInCents ?? 0) / 100;

    let net: number;
    if (commissionType === "flat_fee") {
      net = flatFeeInCents / 100;
    } else {
      net = Math.round(gross * (commissionRate / 100) * 100) / 100;
    }
    const tipNet = Math.round(tip * (tipSplitPercent / 100) * 100) / 100;
    const totalNet = Math.round((net + tipNet) * 100) / 100;

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
      tip,
      commissionRate,
      tipSplitPercent,
      net,
      tipNet,
      totalNet,
      status,
    };
  });

  // .filter() partitions entries by time window and status for stat aggregation.
  // Three separate .filter() calls are clearer than one .reduce() with 3 accumulators,
  // and the entry array is small (one assistant's bookings).
  const weekEntries = entries.filter((e) => {
    const d = new Date(e.date);
    return d >= weekStart && d <= weekEnd;
  });
  const monthEntries = entries.filter((e) => {
    const d = new Date(e.date);
    return d >= monthStart;
  });
  const pendingEntries = entries.filter((e) => e.status === "pending");

  // .reduce() sums earnings across each partition for the stats cards.
  // Separate reduces per stat is simpler to read and maintain than a single
  // combined reduce with a multi-field accumulator.
  const weekNet = weekEntries.reduce((s, e) => s + e.totalNet, 0);
  const weekGross = weekEntries.reduce((s, e) => s + e.gross, 0);
  const weekTips = weekEntries.reduce((s, e) => s + e.tip, 0);
  const pendingTotal = pendingEntries.reduce((s, e) => s + e.totalNet, 0);
  const monthNet = monthEntries.reduce((s, e) => s + e.totalNet, 0);

  // Build weekly bars (Mon–Sun)
  const weeklyBars: WeeklyBar[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const key = formatDateKey(day);
    // Chain .filter() → .reduce() to sum earnings for this specific day.
    // Filter first narrows to matching entries, then reduce sums them.
    const dayTotal = weekEntries.filter((e) => e.date === key).reduce((s, e) => s + e.totalNet, 0);
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
    commissionType,
    commissionRate,
    flatFeeInCents,
    tipSplitPercent,
    stats: {
      weekNet: Math.round(weekNet * 100) / 100,
      weekGross: Math.round(weekGross * 100) / 100,
      weekTips: Math.round(weekTips * 100) / 100,
      pendingTotal: Math.round(pendingTotal * 100) / 100,
      monthNet: Math.round(monthNet * 100) / 100,
    },
    weekLabel,
  };
}
