/**
 * Split query functions for the admin dashboard.
 * Each function fetches data for one Suspense section so the dashboard
 * progressively streams — static shell first, then each data section
 * independently as its queries resolve.
 */
import { cache } from "react";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  sum,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  assistantProfiles,
  bookings,
  inquiries,
  invoices,
  payments,
  products,
  profiles,
  services,
  shifts,
  supplies,
  waitlist,
} from "@/db/schema";
import type {
  AdminAlert,
  AdminBooking,
  AdminClient,
  AdminInquiry,
  AdminStaff,
} from "./admin-dashboard-types";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function getInitials(first: string | null, last: string | null): string {
  return `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase();
}

function formatShiftHours(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Shared date boundaries used across queries. */
function dateBounds() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayStart);
  yesterdayEnd.setMilliseconds(-1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const fourteenDaysAgo = new Date(sevenDaysAgo);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 7);
  return { now, todayStart, todayEnd, yesterdayStart, yesterdayEnd, weekStart, monthStart, sevenDaysAgo, fourteenDaysAgo };
}

/* ------------------------------------------------------------------ */
/*  1. Stats + Alerts                                                   */
/* ------------------------------------------------------------------ */

export const getAdminStatsAndAlerts = cache(async () => {
  const {
    todayStart, todayEnd, yesterdayStart, yesterdayEnd,
    weekStart, monthStart, now,
  } = dateBounds();

  const invoiceClientP = alias(profiles, "invoiceClientP");

  // Batch 1 (9 queries — fits within max:10 pool)
  const [
    revTodayRow,
    revYesterdayRow,
    activeClientsMonthRow,
    newClientsWeekRow,
    waitlistRow,
    outstandingRow,
    openInquiriesRow,
    newInquiriesTodayRow,
    remainingTodayRow,
  ] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)` })
      .from(payments)
      .where(and(eq(payments.status, "paid"), gte(payments.paidAt, todayStart), lte(payments.paidAt, todayEnd)))
      .then((r) => r[0]),
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)` })
      .from(payments)
      .where(and(eq(payments.status, "paid"), gte(payments.paidAt, yesterdayStart), lte(payments.paidAt, yesterdayEnd)))
      .then((r) => r[0]),
    db
      .select({ count: countDistinct(bookings.clientId) })
      .from(bookings)
      .where(and(eq(bookings.status, "completed"), gte(bookings.startsAt, monthStart)))
      .then((r) => r[0]),
    db
      .select({ count: count(profiles.id) })
      .from(profiles)
      .where(and(eq(profiles.role, "client"), gte(profiles.createdAt, weekStart)))
      .then((r) => r[0]),
    // 2 waitlist queries → 1 with conditional count (no Date params inside CASE)
    db
      .select({
        total: count(waitlist.id),
        notContacted: sql<number>`count(case when ${waitlist.notifiedAt} is null then 1 end)`,
      })
      .from(waitlist)
      .where(eq(waitlist.status, "waiting"))
      .then((r) => r[0]),
    db
      .select({
        total: sql<number>`coalesce(sum(${invoices.amountInCents}), 0)`,
        cnt: count(invoices.id),
      })
      .from(invoices)
      .where(inArray(invoices.status, ["sent", "overdue"]))
      .then((r) => r[0]),
    db
      .select({ count: count(inquiries.id) })
      .from(inquiries)
      .where(inArray(inquiries.status, ["new", "read"]))
      .then((r) => r[0]),
    db
      .select({ count: count(inquiries.id) })
      .from(inquiries)
      .where(and(eq(inquiries.status, "new"), gte(inquiries.createdAt, todayStart)))
      .then((r) => r[0]),
    db
      .select({ count: count(bookings.id) })
      .from(bookings)
      .where(
        and(
          gte(bookings.startsAt, now),
          lte(bookings.startsAt, todayEnd),
          inArray(bookings.status, ["confirmed", "pending"]),
        ),
      )
      .then((r) => r[0]),
  ]);

  // Batch 2 (3 queries — alerts data)
  const [overdueInvoicesRaw, lowStockProductsRow, lowStockSuppliesRow] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        amountInCents: invoices.amountInCents,
        dueAt: invoices.dueAt,
        clientFirstName: invoiceClientP.firstName,
        clientLastName: invoiceClientP.lastName,
      })
      .from(invoices)
      .leftJoin(invoiceClientP, eq(invoices.clientId, invoiceClientP.id))
      .where(eq(invoices.status, "overdue"))
      .orderBy(asc(invoices.dueAt))
      .limit(3),
    db
      .select({ count: count(products.id) })
      .from(products)
      .where(
        or(
          eq(products.availability, "out_of_stock"),
          and(eq(products.availability, "in_stock"), gt(products.stockCount, 0), lte(products.stockCount, 5)),
        ),
      )
      .then((r) => r[0]),
    db
      .select({ count: count(supplies.id) })
      .from(supplies)
      .where(and(gt(supplies.reorderPoint, 0), sql`${supplies.stockCount} <= ${supplies.reorderPoint}`))
      .then((r) => r[0]),
  ]);

  // ── Transform stats ──
  const revToday = Number(revTodayRow?.total ?? 0);
  const revYesterday = Number(revYesterdayRow?.total ?? 0);
  const revVsPct =
    revYesterday === 0 ? null : Math.round(((revToday - revYesterday) / revYesterday) * 100);

  const lowStockProducts = Number(lowStockProductsRow?.count ?? 0);
  const lowStockSupplies = Number(lowStockSuppliesRow?.count ?? 0);
  const lowStockCount = lowStockProducts + lowStockSupplies;
  const waitlistTotal = Number(waitlistRow?.total ?? 0);
  const notContacted = Number(waitlistRow?.notContacted ?? 0);
  const appointmentsToday = Number(remainingTodayRow?.count ?? 0);

  const stats = {
    revenueTodayCents: revToday,
    revenueTodayVsYesterdayPct: revVsPct,
    appointmentsToday,
    appointmentsRemaining: appointmentsToday,
    activeClientsThisMonth: Number(activeClientsMonthRow?.count ?? 0),
    newClientsThisWeek: Number(newClientsWeekRow?.count ?? 0),
    waitlistTotal,
    waitlistNotContacted: notContacted,
    outstandingCents: Number(outstandingRow?.total ?? 0),
    unpaidInvoiceCount: Number(outstandingRow?.cnt ?? 0),
    openInquiries: Number(openInquiriesRow?.count ?? 0),
    newInquiriesToday: Number(newInquiriesTodayRow?.count ?? 0),
    lowStockProducts,
    lowStockSupplies,
  };

  // ── Build alerts ──
  const alerts: AdminAlert[] = [];
  if (overdueInvoicesRaw.length === 1) {
    const inv = overdueInvoicesRaw[0];
    const clientName =
      [inv.clientFirstName, inv.clientLastName].filter(Boolean).join(" ") || "a client";
    const amount = Math.round(inv.amountInCents / 100);
    const dueStr = inv.dueAt
      ? ` (was due ${inv.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
      : "";
    alerts.push({
      id: `overdue-${inv.id}`,
      type: "error",
      message: `${inv.number} is overdue — $${amount} owed by ${clientName}${dueStr}`,
      href: "/dashboard/financial",
      cta: "View Invoice",
    });
  } else if (overdueInvoicesRaw.length > 1) {
    const totalCents = overdueInvoicesRaw.reduce((s, i) => s + i.amountInCents, 0);
    alerts.push({
      id: "overdue-multiple",
      type: "error",
      message: `${overdueInvoicesRaw.length} invoices are overdue — $${Math.round(totalCents / 100)} outstanding`,
      href: "/dashboard/financial",
      cta: "View Invoices",
    });
  }
  if (lowStockCount > 0) {
    alerts.push({
      id: "low-stock",
      type: "warning",
      message:
        lowStockCount === 1
          ? "1 item is running low or out of stock"
          : `${lowStockCount} items are running low or out of stock`,
      href: "/dashboard/marketplace",
      cta: "View Inventory",
    });
  }
  if (waitlistTotal > 0) {
    alerts.push({
      id: "waitlist",
      type: "info",
      message:
        notContacted > 0
          ? `${waitlistTotal} client${waitlistTotal !== 1 ? "s" : ""} on the waitlist — ${notContacted} not yet contacted`
          : `${waitlistTotal} client${waitlistTotal !== 1 ? "s" : ""} on the waitlist`,
      href: "/dashboard/bookings",
      cta: "View Waitlist",
    });
  }

  return { stats, alerts, lowStockCount };
});

/* ------------------------------------------------------------------ */
/*  2. Today's bookings                                                */
/* ------------------------------------------------------------------ */

export const getAdminTodayBookings = cache(async () => {
  const { todayStart, todayEnd } = dateBounds();
  const adminStaffP = alias(profiles, "adminStaffP");

  const todayBookingsRaw = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      durationMinutes: bookings.durationMinutes,
      status: bookings.status,
      location: bookings.location,
      clientFirstName: profiles.firstName,
      clientLastName: profiles.lastName,
      staffFirstName: adminStaffP.firstName,
      serviceName: services.name,
      serviceCategory: services.category,
    })
    .from(bookings)
    .innerJoin(profiles, eq(bookings.clientId, profiles.id))
    .leftJoin(adminStaffP, eq(bookings.staffId, adminStaffP.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(gte(bookings.startsAt, todayStart), lte(bookings.startsAt, todayEnd)))
    .orderBy(asc(bookings.startsAt))
    .limit(10);

  const todayBookings: AdminBooking[] = todayBookingsRaw.map((b) => ({
    id: b.id,
    time: b.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    service: b.serviceName,
    category: (b.serviceCategory ?? "lash") as AdminBooking["category"],
    client: [b.clientFirstName, b.clientLastName].filter(Boolean).join(" "),
    clientInitials: getInitials(b.clientFirstName, b.clientLastName),
    staff: b.staffFirstName ?? "—",
    status: b.status as AdminBooking["status"],
    durationMin: b.durationMinutes,
    location: b.location ?? undefined,
  }));

  return { todayBookings };
});

/* ------------------------------------------------------------------ */
/*  3. Inquiries                                                        */
/* ------------------------------------------------------------------ */

export const getAdminInquiries = cache(async () => {
  const recentInquiriesRaw = await db
    .select({
      id: inquiries.id,
      name: inquiries.name,
      interest: inquiries.interest,
      message: inquiries.message,
      status: inquiries.status,
      createdAt: inquiries.createdAt,
    })
    .from(inquiries)
    .where(inArray(inquiries.status, ["new", "read", "replied"]))
    .orderBy(desc(inquiries.createdAt))
    .limit(5);

  const adminInquiries: AdminInquiry[] = recentInquiriesRaw.map((q) => ({
    id: q.id,
    name: q.name,
    initials: q.name
      .split(" ")
      .map((w) => w.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    interest: (q.interest ?? null) as AdminInquiry["interest"],
    message: q.message,
    time: formatRelativeTime(q.createdAt),
    status: q.status as AdminInquiry["status"],
  }));

  return { inquiries: adminInquiries };
});

/* ------------------------------------------------------------------ */
/*  4. Weekly revenue chart                                             */
/* ------------------------------------------------------------------ */

export const getAdminWeeklyRevenue = cache(async () => {
  const { todayEnd, sevenDaysAgo, fourteenDaysAgo } = dateBounds();

  // Two queries: daily breakdown for chart + prior week total for comparison
  const [weeklyRevDailyRaw, priorWeekRevRow] = await Promise.all([
    db
      .select({
        dateStr:
          sql<string>`to_char(date_trunc('day', coalesce(${payments.paidAt}, ${payments.createdAt})), 'YYYY-MM-DD')`,
        total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
      })
      .from(payments)
      .where(and(eq(payments.status, "paid"), gte(payments.paidAt, sevenDaysAgo), lte(payments.paidAt, todayEnd)))
      .groupBy(sql`date_trunc('day', coalesce(${payments.paidAt}, ${payments.createdAt}))`)
      .orderBy(sql`date_trunc('day', coalesce(${payments.paidAt}, ${payments.createdAt})) asc`),
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)` })
      .from(payments)
      .where(and(eq(payments.status, "paid"), gte(payments.paidAt, fourteenDaysAgo), lt(payments.paidAt, sevenDaysAgo)))
      .then((r) => r[0]),
  ]);

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const revByDate = new Map(
    weeklyRevDailyRaw.map((r) => [r.dateStr, Math.round(Number(r.total) / 100)]),
  );
  const weeklyRevenue = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      day: i === 6 ? "Today" : DAY_NAMES[d.getDay()],
      amount: revByDate.get(dateStr) ?? 0,
    };
  });

  const priorWeekRev = Math.round(Number(priorWeekRevRow?.total ?? 0) / 100);
  const thisWeekRev = weeklyRevDailyRaw.reduce(
    (s, r) => s + Math.round(Number(r.total) / 100),
    0,
  );
  const weeklyVsPct =
    priorWeekRev === 0 ? null : Math.round(((thisWeekRev - priorWeekRev) / priorWeekRev) * 100);

  return {
    weeklyRevenue,
    weeklyRevenueTotal: thisWeekRev,
    weeklyRevenueVsPriorPct: weeklyVsPct,
  };
});

/* ------------------------------------------------------------------ */
/*  5. Recent clients + team today                                      */
/* ------------------------------------------------------------------ */

export const getAdminRecentClientsAndTeam = cache(async () => {
  const { todayStart, todayEnd, monthStart } = dateBounds();

  const [recentClientsRaw, teamShiftsRaw, clientCategoriesRaw] = await Promise.all([
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        source: profiles.source,
        isVip: profiles.isVip,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(and(eq(profiles.role, "client"), eq(profiles.isActive, true)))
      .orderBy(desc(profiles.createdAt))
      .limit(5),
    db
      .select({
        assistantId: shifts.assistantId,
        shiftStart: shifts.startsAt,
        shiftEnd: shifts.endsAt,
        shiftStatus: shifts.status,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        title: assistantProfiles.title,
      })
      .from(shifts)
      .innerJoin(profiles, eq(shifts.assistantId, profiles.id))
      .innerJoin(assistantProfiles, eq(shifts.assistantId, assistantProfiles.profileId))
      .where(and(gte(shifts.startsAt, todayStart), lte(shifts.startsAt, todayEnd)))
      .orderBy(asc(shifts.startsAt))
      .limit(8),
    db
      .select({ clientId: bookings.clientId, category: services.category })
      .from(bookings)
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.status, "completed"), gte(bookings.startsAt, monthStart)))
      .orderBy(desc(bookings.startsAt)),
  ]);

  // Recent clients with service categories
  const catsByClient = new Map<string, string[]>();
  for (const r of clientCategoriesRaw) {
    const list = catsByClient.get(r.clientId) ?? [];
    if (r.category && !list.includes(r.category)) list.push(r.category);
    catsByClient.set(r.clientId, list);
  }
  const recentClients: AdminClient[] = recentClientsRaw.map((c) => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(" "),
    initials: getInitials(c.firstName, c.lastName),
    source: c.source ?? null,
    joinedAgo: formatRelativeTime(c.createdAt),
    vip: c.isVip,
    services: catsByClient.get(c.id) ?? [],
  }));

  // Team today
  const seenAssistants = new Set<string>();
  const teamToday: AdminStaff[] = teamShiftsRaw.reduce<AdminStaff[]>((acc, s) => {
    if (seenAssistants.has(s.assistantId)) return acc;
    seenAssistants.add(s.assistantId);
    acc.push({
      initials: getInitials(s.firstName, s.lastName),
      name: [s.firstName, s.lastName].filter(Boolean).join(" "),
      role: s.title ?? null,
      hours:
        s.shiftStart && s.shiftEnd ? formatShiftHours(s.shiftStart, s.shiftEnd) : "—",
      status: s.shiftStatus === "cancelled" ? "on_leave" : "active",
    });
    return acc;
  }, []);

  return { recentClients, teamToday };
});
