/**
 * app/dashboard/financial/payment-queries.ts — Payment and revenue query actions.
 *
 * Read-only queries for payments, revenue stats, category breakdowns,
 * deposit tracking, tip trends, product sales, tax estimates, P&L,
 * and expense analytics.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, desc, sql, and, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { payments, bookings, services, profiles, expenses, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PaymentRow = {
  id: number;
  date: string;
  client: string;
  service: string;
  category: string | null;
  amount: number;
  tip: number;
  method: string | null;
  status: string;
  refundedAmount: number;
  squarePaymentId: string | null;
};

export type RevenueStats = {
  totalRevenue: number;
  totalTips: number;
  /** Sales tax collected in dollars (reported by Square, not app revenue). */
  taxCollected: number;
  transactionCount: number;
  avgTicket: number;
  revenueVsPriorPeriodPct: number | null;
};

export type ProfitLossRow = {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
};

export type TaxEstimate = {
  quarterLabel: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  taxRate: number;
  estimatedTax: number;
};

export type CategoryRevenue = {
  category: string;
  amount: number;
  pct: number;
};

export type DailyRevenue = {
  day: string;
  amount: number;
};

export type ProductSalesStats = {
  productRevenue: number;
  productOrderCount: number;
  avgOrderValue: number;
};

export type PendingDeposit = {
  bookingId: number;
  clientName: string;
  serviceName: string;
  depositRequiredInCents: number;
  depositPaidInCents: number;
  date: string;
};

export type DepositStats = {
  totalExpected: number;
  totalCollected: number;
  collectionRate: number;
  bookingsNeedingDeposit: number;
  bookingsWithDeposit: number;
  pendingDeposits: PendingDeposit[];
};

export type TipTrendItem = {
  week: string;
  avgTipPct: number;
};

export type TipStats = {
  overallAvgPct: number;
  weeklyTrend: TipTrendItem[];
  byCategory: { category: string; avgTipPct: number }[];
};

export type ExpenseCategoryBreakdown = {
  category: string;
  amount: number;
  pct: number;
};

export type ExpenseStats = {
  totalExpenses: number;
  thisMonthExpenses: number;
  expenseVsPriorMonthPct: number | null;
  expenseCount: number;
  avgMonthlyExpenses: number;
};

export type MonthlyExpense = {
  month: string;
  amount: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  lash: "Lash Services",
  jewelry: "Jewelry",
  consulting: "Consulting",
  crochet: "Crochet",
};

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const EXPENSE_LABELS: Record<string, string> = {
  supplies: "Supplies",
  rent: "Rent",
  marketing: "Marketing",
  equipment: "Equipment",
  software: "Software",
  travel: "Travel",
  other: "Other",
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

const clientProfile = alias(profiles, "client");

export async function getPayments(): Promise<PaymentRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: payments.id,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        clientFirstName: clientProfile.firstName,
        clientLastName: clientProfile.lastName,
        serviceName: services.name,
        serviceCategory: services.category,
        amountInCents: payments.amountInCents,
        tipInCents: payments.tipInCents,
        refundedInCents: payments.refundedInCents,
        method: payments.method,
        status: payments.status,
        squarePaymentId: payments.squarePaymentId,
      })
      .from(payments)
      .leftJoin(bookings, eq(payments.bookingId, bookings.id))
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(clientProfile, eq(payments.clientId, clientProfile.id))
      .orderBy(desc(payments.createdAt))
      .limit(500);

    return rows.map((r) => {
      const dateObj = r.paidAt ?? r.createdAt;
      return {
        id: r.id,
        date: dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        client: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" ") || "Unknown",
        service: r.serviceName ?? "Unknown Service",
        category: r.serviceCategory ?? null,
        amount: Math.round(r.amountInCents / 100),
        tip: Math.round((r.tipInCents ?? 0) / 100),
        method: r.method,
        status: r.status,
        refundedAmount: Math.round((r.refundedInCents ?? 0) / 100),
        squarePaymentId: r.squarePaymentId ?? null,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getRevenueStats(): Promise<RevenueStats> {
  try {
    await getUser();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Single query with conditional aggregation instead of 4 parallel queries
    const [row] = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
        totalTips: sql<number>`coalesce(sum(${payments.tipInCents}), 0)`,
        count: sql<number>`count(*)`,
        currentMonthRevenue: sql<number>`coalesce(sum(case when ${payments.paidAt} >= ${monthStart} then ${payments.amountInCents} else 0 end), 0)`,
        priorMonthRevenue: sql<number>`coalesce(sum(case when ${payments.paidAt} >= ${priorMonthStart} and ${payments.paidAt} < ${monthStart} then ${payments.amountInCents} else 0 end), 0)`,
        currentMonthTax: sql<number>`coalesce(sum(case when ${payments.paidAt} >= ${monthStart} then ${payments.taxAmountInCents} else 0 end), 0)`,
      })
      .from(payments)
      .where(eq(payments.status, "paid"));

    const totalRevenue = Math.round(Number(row.totalRevenue) / 100);
    const totalTips = Math.round(Number(row.totalTips) / 100);
    const count = Number(row.count);
    const currentRev = Number(row.currentMonthRevenue);
    const priorRev = Number(row.priorMonthRevenue);
    const revenueVsPriorPeriodPct =
      priorRev === 0 ? null : Math.round(((currentRev - priorRev) / priorRev) * 100);

    const taxCollected = Math.round(Number(row.currentMonthTax) / 100);

    return {
      totalRevenue,
      totalTips,
      taxCollected,
      transactionCount: count,
      avgTicket: count > 0 ? Math.round(totalRevenue / count) : 0,
      revenueVsPriorPeriodPct,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getCategoryRevenue(): Promise<CategoryRevenue[]> {
  try {
    await getUser();

    // Reads from revenue_by_service_daily materialized view (refreshed every 4h)
    // instead of joining payments → bookings → services on the full table scan.
    const rows = await db.execute<{ service_category: string; total: string }>(sql`
      SELECT service_category, sum(revenue_cents) AS total
      FROM revenue_by_service_daily
      GROUP BY service_category
      ORDER BY sum(revenue_cents) DESC
    `);

    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);

    return rows
      .filter((r) => r.service_category)
      .map((r) => ({
        category: CATEGORY_LABELS[r.service_category] ?? r.service_category,
        amount: Math.round(Number(r.total) / 100),
        pct: grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 100) : 0,
      }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getWeeklyRevenue(): Promise<DailyRevenue[]> {
  try {
    await getUser();

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // dow 0=Sun … 6=Sat, sourced from revenue_by_service_daily (refreshed every 4h).
    const rows = await db.execute<{ dow: string; total: string }>(sql`
      SELECT extract(dow from day)::int AS dow, sum(revenue_cents) AS total
      FROM revenue_by_service_daily
      GROUP BY extract(dow from day)
      ORDER BY extract(dow from day)
    `);

    const byDow = new Map(rows.map((r) => [Number(r.dow), Math.round(Number(r.total) / 100)]));
    return DAY_NAMES.map((day, i) => ({
      day,
      amount: byDow.get(i) ?? 0,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getDepositStats(): Promise<DepositStats> {
  try {
    await getUser();

    const depositClient = alias(profiles, "depositClient");

    const [[row], pendingRows] = await Promise.all([
      db
        .select({
          expectedCents: sql<number>`coalesce(sum(${services.depositInCents}), 0)`,
          collectedCents: sql<number>`coalesce(sum(${bookings.depositPaidInCents}), 0)`,
          needingDeposit: sql<number>`count(*)`,
          withDeposit: sql<number>`count(*) filter (where ${bookings.depositPaidInCents} > 0)`,
        })
        .from(bookings)
        .innerJoin(services, eq(bookings.serviceId, services.id))
        .where(
          and(
            sql`${services.depositInCents} > 0`,
            gte(bookings.startsAt, sql`now() - interval '90 days'`),
          ),
        ),
      db
        .select({
          bookingId: bookings.id,
          clientFirstName: depositClient.firstName,
          clientLastName: depositClient.lastName,
          serviceName: services.name,
          depositRequired: services.depositInCents,
          depositPaid: bookings.depositPaidInCents,
          startsAt: bookings.startsAt,
        })
        .from(bookings)
        .innerJoin(services, eq(bookings.serviceId, services.id))
        .innerJoin(depositClient, eq(bookings.clientId, depositClient.id))
        .where(
          and(
            sql`${services.depositInCents} > 0`,
            sql`coalesce(${bookings.depositPaidInCents}, 0) < ${services.depositInCents}`,
            sql`${bookings.status} in ('pending', 'confirmed')`,
          ),
        )
        .orderBy(bookings.startsAt)
        .limit(10),
    ]);

    const expected = Math.round(Number(row.expectedCents) / 100);
    const collected = Math.round(Number(row.collectedCents) / 100);
    const needing = Number(row.needingDeposit);
    const withDep = Number(row.withDeposit);

    const pendingDeposits: PendingDeposit[] = pendingRows.map((r) => ({
      bookingId: r.bookingId,
      clientName: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" ") || "Unknown",
      serviceName: r.serviceName,
      depositRequiredInCents: r.depositRequired ?? 0,
      depositPaidInCents: r.depositPaid ?? 0,
      date: r.startsAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }));

    return {
      totalExpected: expected,
      totalCollected: collected,
      collectionRate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
      bookingsNeedingDeposit: needing,
      bookingsWithDeposit: withDep,
      pendingDeposits,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getTipTrends(): Promise<TipStats> {
  try {
    await getUser();

    const [overallRows, weeklyRows, categoryRows] = await Promise.all([
      db
        .select({
          avgPct: sql<number>`round(avg(${payments.tipInCents}::numeric / nullif(${payments.amountInCents}, 0) * 100), 1)`,
        })
        .from(payments)
        .where(and(eq(payments.status, "paid"), sql`${payments.amountInCents} > 0`)),
      db
        .select({
          weekStart: sql<Date>`date_trunc('week', coalesce(${payments.paidAt}, ${payments.createdAt}))`,
          avgPct: sql<number>`round(avg(${payments.tipInCents}::numeric / nullif(${payments.amountInCents}, 0) * 100), 1)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.status, "paid"),
            sql`${payments.amountInCents} > 0`,
            gte(payments.paidAt, sql`now() - interval '8 weeks'`),
          ),
        )
        .groupBy(sql`date_trunc('week', coalesce(${payments.paidAt}, ${payments.createdAt}))`)
        .orderBy(sql`date_trunc('week', coalesce(${payments.paidAt}, ${payments.createdAt}))`),
      db
        .select({
          category: services.category,
          avgPct: sql<number>`round(avg(${payments.tipInCents}::numeric / nullif(${payments.amountInCents}, 0) * 100), 1)`,
        })
        .from(payments)
        .innerJoin(bookings, eq(payments.bookingId, bookings.id))
        .innerJoin(services, eq(bookings.serviceId, services.id))
        .where(and(eq(payments.status, "paid"), sql`${payments.amountInCents} > 0`))
        .groupBy(services.category)
        .orderBy(
          sql`avg(${payments.tipInCents}::numeric / nullif(${payments.amountInCents}, 0) * 100) desc`,
        ),
    ]);

    return {
      overallAvgPct: Number(overallRows[0]?.avgPct ?? 0),
      weeklyTrend: weeklyRows.map((r) => ({
        week: weekLabel(new Date(r.weekStart)),
        avgTipPct: Number(r.avgPct ?? 0),
      })),
      byCategory: categoryRows
        .filter((r) => r.category)
        .map((r) => ({
          category: CATEGORY_LABELS[r.category!] ?? r.category!,
          avgTipPct: Number(r.avgPct ?? 0),
        })),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getProductSales(): Promise<ProductSalesStats> {
  try {
    await getUser();

    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${orders.finalInCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(eq(orders.status, "completed"));

    const revenue = Math.round(Number(row.total) / 100);
    const count = Number(row.count);

    return {
      productRevenue: revenue,
      productOrderCount: count,
      avgOrderValue: count > 0 ? Math.round(revenue / count) : 0,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getTaxEstimate(): Promise<TaxEstimate> {
  try {
    await getUser();

    const { settings: settingsTable } = await import("@/db/schema");

    const now = new Date();
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
    const quarterLabels = ["Q1", "Q2", "Q3", "Q4"];
    const quarterLabel = `${quarterLabels[Math.floor(now.getMonth() / 3)]} ${now.getFullYear()}`;

    const [[settingsRow], [revRow], [expRow]] = await Promise.all([
      db.select().from(settingsTable).where(eq(settingsTable.key, "financial_config")),
      db
        .select({ total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)` })
        .from(payments)
        .where(and(eq(payments.status, "paid"), gte(payments.paidAt, quarterStart))),
      db
        .select({ total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)` })
        .from(expenses)
        .where(gte(expenses.expenseDate, quarterStart)),
    ]);

    const config = (settingsRow?.value as { estimatedTaxRate?: number }) ?? {};
    const taxRate = config.estimatedTaxRate ?? 25;

    const revenue = Math.round(Number(revRow.total) / 100);
    const expenseTotal = Math.round(Number(expRow.total) / 100);
    const netIncome = revenue - expenseTotal;
    const estimatedTax = Math.round(netIncome * (taxRate / 100));

    return {
      quarterLabel,
      revenue,
      expenses: expenseTotal,
      netIncome,
      taxRate,
      estimatedTax: Math.max(0, estimatedTax),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getProfitLoss(): Promise<ProfitLossRow[]> {
  try {
    await getUser();

    const [revenueRows, expenseRows] = await Promise.all([
      db
        .select({
          month: sql<string>`to_char(coalesce(${payments.paidAt}, ${payments.createdAt}), 'YYYY-MM')`,
          total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
        })
        .from(payments)
        .where(
          and(eq(payments.status, "paid"), gte(payments.paidAt, sql`now() - interval '6 months'`)),
        )
        .groupBy(sql`to_char(coalesce(${payments.paidAt}, ${payments.createdAt}), 'YYYY-MM')`)
        .orderBy(sql`to_char(coalesce(${payments.paidAt}, ${payments.createdAt}), 'YYYY-MM')`),
      db
        .select({
          month: sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`,
          total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)`,
        })
        .from(expenses)
        .where(gte(expenses.expenseDate, sql`now() - interval '6 months'`))
        .groupBy(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`),
    ]);

    const months = new Map<string, { revenue: number; expenses: number }>();

    for (const r of revenueRows) {
      months.set(r.month, { revenue: Math.round(Number(r.total) / 100), expenses: 0 });
    }
    for (const r of expenseRows) {
      const existing = months.get(r.month) ?? { revenue: 0, expenses: 0 };
      existing.expenses = Math.round(Number(r.total) / 100);
      months.set(r.month, existing);
    }

    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const [y, m] = month.split("-");
        const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
        return {
          month: label,
          revenue: data.revenue,
          expenses: data.expenses,
          profit: data.revenue - data.expenses,
        };
      });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getExpenseStats(): Promise<ExpenseStats> {
  try {
    await getUser();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const [[totalRow], [thisMonthRow], [priorMonthRow], [avgRow]] = await Promise.all([
      db
        .select({
          total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(expenses),
      db
        .select({ total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)` })
        .from(expenses)
        .where(gte(expenses.expenseDate, monthStart)),
      db
        .select({ total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)` })
        .from(expenses)
        .where(
          and(gte(expenses.expenseDate, priorMonthStart), lt(expenses.expenseDate, monthStart)),
        ),
      db
        .select({ total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)` })
        .from(expenses)
        .where(gte(expenses.expenseDate, sixMonthsAgo)),
    ]);

    const total = Math.round(Number(totalRow.total) / 100);
    const thisMonth = Math.round(Number(thisMonthRow.total) / 100);
    const priorMonth = Math.round(Number(priorMonthRow.total) / 100);
    const count = Number(totalRow.count);
    const sixMonthTotal = Math.round(Number(avgRow.total) / 100);

    return {
      totalExpenses: total,
      thisMonthExpenses: thisMonth,
      expenseVsPriorMonthPct:
        priorMonth === 0 ? null : Math.round(((thisMonth - priorMonth) / priorMonth) * 100),
      expenseCount: count,
      avgMonthlyExpenses: Math.round(sixMonthTotal / 6),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getMonthlyExpenses(): Promise<MonthlyExpense[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        month: sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`,
        total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)`,
      })
      .from(expenses)
      .where(gte(expenses.expenseDate, sql`now() - interval '6 months'`))
      .groupBy(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`);

    const now = new Date();
    const result: MonthlyExpense[] = [];
    const byMonth = new Map(rows.map((r) => [r.month, Math.round(Number(r.total) / 100)]));

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      result.push({ month: label, amount: byMonth.get(key) ?? 0 });
    }

    return result;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getExpenseCategoryBreakdown(): Promise<ExpenseCategoryBreakdown[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        category: expenses.category,
        total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)`,
      })
      .from(expenses)
      .groupBy(expenses.category)
      .orderBy(sql`sum(${expenses.amountInCents}) desc`);

    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);

    return rows.map((r) => ({
      category: EXPENSE_LABELS[r.category] ?? r.category,
      amount: Math.round(Number(r.total) / 100),
      pct: grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 100) : 0,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
