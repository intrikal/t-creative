/**
 * Server actions for the Financial dashboard (`/dashboard/financial`).
 *
 * Queries the `payments`, `invoices`, `expenses`, `gift_cards`, and
 * `promotions` tables to produce data for each financial tab.
 *
 * All monetary values are stored in cents in the DB and converted to dollars
 * before crossing the server → client boundary.
 *
 * @module financial/actions
 * @see {@link ./FinancialPage.tsx} — client component consuming this data
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, sql, and, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  payments,
  bookings,
  services,
  profiles,
  invoices,
  expenses,
  giftCards,
  promotions,
  orders,
} from "@/db/schema";
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
};

export type RevenueStats = {
  totalRevenue: number;
  totalTips: number;
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

export type DepositStats = {
  totalExpected: number;
  totalCollected: number;
  collectionRate: number;
  bookingsNeedingDeposit: number;
  bookingsWithDeposit: number;
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

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

const clientProfile = alias(profiles, "client");

export async function getPayments(): Promise<PaymentRow[]> {
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
      method: payments.method,
      status: payments.status,
    })
    .from(payments)
    .leftJoin(bookings, eq(payments.bookingId, bookings.id))
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(clientProfile, eq(payments.clientId, clientProfile.id))
    .orderBy(desc(payments.createdAt));

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
    };
  });
}

export async function getRevenueStats(): Promise<RevenueStats> {
  await getUser();

  const [row] = await db
    .select({
      totalRevenue: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
      totalTips: sql<number>`coalesce(sum(${payments.tipInCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(payments)
    .where(eq(payments.status, "paid"));

  const totalRevenue = Math.round(Number(row.totalRevenue) / 100);
  const totalTips = Math.round(Number(row.totalTips) / 100);
  const count = Number(row.count);

  // Period-over-period comparison (current month vs prior month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [currentMonth] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)` })
    .from(payments)
    .where(and(eq(payments.status, "paid"), gte(payments.paidAt, monthStart)));

  const [priorMonth] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)` })
    .from(payments)
    .where(
      and(
        eq(payments.status, "paid"),
        gte(payments.paidAt, priorMonthStart),
        lt(payments.paidAt, monthStart),
      ),
    );

  const currentRev = Number(currentMonth.total);
  const priorRev = Number(priorMonth.total);
  const revenueVsPriorPeriodPct =
    priorRev === 0 ? null : Math.round(((currentRev - priorRev) / priorRev) * 100);

  return {
    totalRevenue,
    totalTips,
    transactionCount: count,
    avgTicket: count > 0 ? Math.round(totalRevenue / count) : 0,
    revenueVsPriorPeriodPct,
  };
}

export async function getCategoryRevenue(): Promise<CategoryRevenue[]> {
  await getUser();

  const rows = await db
    .select({
      category: services.category,
      total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
    })
    .from(payments)
    .leftJoin(bookings, eq(payments.bookingId, bookings.id))
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(payments.status, "paid"))
    .groupBy(services.category)
    .orderBy(sql`sum(${payments.amountInCents}) desc`);

  const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);

  const CATEGORY_LABELS: Record<string, string> = {
    lash: "Lash Services",
    jewelry: "Jewelry",
    consulting: "Consulting",
    crochet: "Crochet",
  };

  return rows
    .filter((r) => r.category)
    .map((r) => ({
      category: CATEGORY_LABELS[r.category!] ?? r.category!,
      amount: Math.round(Number(r.total) / 100),
      pct: grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 100) : 0,
    }));
}

export async function getWeeklyRevenue(): Promise<DailyRevenue[]> {
  await getUser();

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const rows = await db
    .select({
      dow: sql<number>`extract(dow from coalesce(${payments.paidAt}, ${payments.createdAt}))`,
      total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
    })
    .from(payments)
    .where(eq(payments.status, "paid"))
    .groupBy(sql`extract(dow from coalesce(${payments.paidAt}, ${payments.createdAt}))`)
    .orderBy(sql`extract(dow from coalesce(${payments.paidAt}, ${payments.createdAt}))`);

  // Build a full 7-day array
  const byDow = new Map(rows.map((r) => [Number(r.dow), Math.round(Number(r.total) / 100)]));
  return DAY_NAMES.map((day, i) => ({
    day,
    amount: byDow.get(i) ?? 0,
  }));
}

/* ================================================================== */
/*  Invoices                                                           */
/* ================================================================== */

export type InvoiceRow = {
  id: number;
  number: string;
  client: string;
  description: string;
  amount: number;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  nextDueAt: string | null;
};

const invoiceClient = alias(profiles, "invoiceClient");

export async function getInvoices(): Promise<InvoiceRow[]> {
  await getUser();

  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientFirstName: invoiceClient.firstName,
      clientLastName: invoiceClient.lastName,
      description: invoices.description,
      amountInCents: invoices.amountInCents,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
      isRecurring: invoices.isRecurring,
      recurrenceInterval: invoices.recurrenceInterval,
      nextDueAt: invoices.nextDueAt,
    })
    .from(invoices)
    .leftJoin(invoiceClient, eq(invoices.clientId, invoiceClient.id))
    .orderBy(desc(invoices.createdAt));

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    client: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" ") || "Unknown",
    description: r.description,
    amount: Math.round(r.amountInCents / 100),
    status: r.status,
    issuedAt:
      r.issuedAt?.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) ?? null,
    dueAt:
      r.dueAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ??
      null,
    paidAt:
      r.paidAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ??
      null,
    createdAt: r.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    isRecurring: r.isRecurring,
    recurrenceInterval: r.recurrenceInterval,
    nextDueAt:
      r.nextDueAt?.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) ?? null,
  }));
}

export async function createInvoice(input: {
  clientId: string;
  description: string;
  amountInCents: number;
  dueAt?: string;
  notes?: string;
  isRecurring?: boolean;
  recurrenceInterval?: string;
}) {
  await getUser();

  // Auto-generate next invoice number
  const [lastInvoice] = await db
    .select({ number: invoices.number })
    .from(invoices)
    .orderBy(desc(invoices.id))
    .limit(1);

  const nextNum = lastInvoice
    ? String(parseInt(lastInvoice.number.replace("INV-", ""), 10) + 1).padStart(3, "0")
    : "001";

  const dueDate = input.dueAt ? new Date(input.dueAt) : null;

  // For recurring invoices, compute the next due date from the current due date
  let nextDueAt: Date | null = null;
  if (input.isRecurring && dueDate) {
    nextDueAt = new Date(dueDate);
    if (input.recurrenceInterval === "weekly") nextDueAt.setDate(nextDueAt.getDate() + 7);
    else if (input.recurrenceInterval === "quarterly") nextDueAt.setMonth(nextDueAt.getMonth() + 3);
    else nextDueAt.setMonth(nextDueAt.getMonth() + 1); // default monthly
  }

  await db.insert(invoices).values({
    clientId: input.clientId,
    number: `INV-${nextNum}`,
    description: input.description,
    amountInCents: input.amountInCents,
    dueAt: dueDate,
    notes: input.notes ?? null,
    isRecurring: input.isRecurring ?? false,
    recurrenceInterval: input.recurrenceInterval ?? null,
    nextDueAt,
  });

  revalidatePath("/dashboard/financial");
}

/* ================================================================== */
/*  Expenses                                                           */
/* ================================================================== */

export type ExpenseRow = {
  id: number;
  date: string;
  category: string;
  description: string;
  vendor: string | null;
  amount: number;
  hasReceipt: boolean;
};

export async function getExpenses(): Promise<ExpenseRow[]> {
  await getUser();

  const rows = await db.select().from(expenses).orderBy(desc(expenses.expenseDate));

  return rows.map((r) => ({
    id: r.id,
    date: r.expenseDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    category: r.category,
    description: r.description,
    vendor: r.vendor,
    amount: Math.round(r.amountInCents / 100),
    hasReceipt: r.hasReceipt,
  }));
}

export async function createExpense(input: {
  expenseDate: string;
  category: "supplies" | "rent" | "marketing" | "equipment" | "software" | "travel" | "other";
  description: string;
  vendor?: string;
  amountInCents: number;
  hasReceipt?: boolean;
}) {
  const user = await getUser();

  await db.insert(expenses).values({
    expenseDate: new Date(input.expenseDate),
    category: input.category,
    description: input.description,
    vendor: input.vendor ?? null,
    amountInCents: input.amountInCents,
    hasReceipt: input.hasReceipt ?? false,
    createdBy: user.id,
  });

  revalidatePath("/dashboard/financial");
}

/* ================================================================== */
/*  Gift Cards                                                         */
/* ================================================================== */

export type GiftCardRow = {
  id: number;
  code: string;
  purchasedBy: string | null;
  recipientName: string | null;
  originalAmount: number;
  balance: number;
  status: string;
  purchasedAt: string;
  expiresAt: string | null;
};

const gcClient = alias(profiles, "gcClient");

export async function getGiftCards(): Promise<GiftCardRow[]> {
  await getUser();

  const rows = await db
    .select({
      id: giftCards.id,
      code: giftCards.code,
      clientFirstName: gcClient.firstName,
      clientLastName: gcClient.lastName,
      recipientName: giftCards.recipientName,
      originalAmountInCents: giftCards.originalAmountInCents,
      balanceInCents: giftCards.balanceInCents,
      status: giftCards.status,
      purchasedAt: giftCards.purchasedAt,
      expiresAt: giftCards.expiresAt,
    })
    .from(giftCards)
    .leftJoin(gcClient, eq(giftCards.purchasedByClientId, gcClient.id))
    .orderBy(desc(giftCards.purchasedAt));

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    purchasedBy: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" ") || null,
    recipientName: r.recipientName,
    originalAmount: Math.round(r.originalAmountInCents / 100),
    balance: Math.round(r.balanceInCents / 100),
    status: r.status,
    purchasedAt: r.purchasedAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    expiresAt:
      r.expiresAt?.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) ?? null,
  }));
}

export async function createGiftCard(input: {
  purchasedByClientId?: string;
  recipientName?: string;
  amountInCents: number;
  expiresAt?: string;
  notes?: string;
}) {
  await getUser();

  // Auto-generate next gift card code
  const [lastCard] = await db
    .select({ code: giftCards.code })
    .from(giftCards)
    .orderBy(desc(giftCards.id))
    .limit(1);

  const nextNum = lastCard
    ? String(parseInt(lastCard.code.replace("TC-GC-", ""), 10) + 1).padStart(3, "0")
    : "001";

  await db.insert(giftCards).values({
    code: `TC-GC-${nextNum}`,
    purchasedByClientId: input.purchasedByClientId ?? null,
    recipientName: input.recipientName ?? null,
    originalAmountInCents: input.amountInCents,
    balanceInCents: input.amountInCents,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    notes: input.notes ?? null,
  });

  revalidatePath("/dashboard/financial");
}

/* ================================================================== */
/*  Promotions                                                         */
/* ================================================================== */

export type PromotionRow = {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  description: string | null;
  appliesTo: string | null;
  maxUses: number | null;
  redemptionCount: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export async function getPromotions(): Promise<PromotionRow[]> {
  await getUser();

  const rows = await db.select().from(promotions).orderBy(desc(promotions.createdAt));

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    discountType: r.discountType,
    discountValue: r.discountValue,
    description: r.description,
    appliesTo: r.appliesTo,
    maxUses: r.maxUses,
    redemptionCount: r.redemptionCount,
    isActive: r.isActive,
    startsAt:
      r.startsAt?.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) ?? null,
    endsAt:
      r.endsAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ??
      null,
  }));
}

export async function createPromotion(input: {
  code: string;
  discountType: "percent" | "fixed" | "bogo";
  discountValue: number;
  description?: string;
  appliesTo?: "lash" | "jewelry" | "crochet" | "consulting";
  maxUses?: number;
  startsAt?: string;
  endsAt?: string;
}) {
  await getUser();

  await db.insert(promotions).values({
    code: input.code.toUpperCase(),
    discountType: input.discountType,
    discountValue: input.discountValue,
    description: input.description ?? null,
    appliesTo: input.appliesTo ?? null,
    maxUses: input.maxUses ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
  });

  revalidatePath("/dashboard/financial");
}

/* ================================================================== */
/*  Gift Card Redemption                                               */
/* ================================================================== */

export async function redeemGiftCard(input: {
  bookingId: number;
  giftCardId: number;
  amountInCents: number;
}) {
  await getUser();

  const [card] = await db.select().from(giftCards).where(eq(giftCards.id, input.giftCardId));
  if (!card) throw new Error("Gift card not found");
  if (card.status !== "active") throw new Error("Gift card is not active");
  if (card.balanceInCents < input.amountInCents) throw new Error("Insufficient gift card balance");

  const newBalance = card.balanceInCents - input.amountInCents;

  await db
    .update(giftCards)
    .set({
      balanceInCents: newBalance,
      status: newBalance === 0 ? "redeemed" : "active",
    })
    .where(eq(giftCards.id, input.giftCardId));

  await db
    .update(bookings)
    .set({
      giftCardId: input.giftCardId,
      discountInCents: input.amountInCents,
    })
    .where(eq(bookings.id, input.bookingId));

  revalidatePath("/dashboard/financial");
}

/* ================================================================== */
/*  Promo Code Validation & Application                                */
/* ================================================================== */

export async function validatePromoCode(
  code: string,
  serviceCategory?: string,
): Promise<{ valid: boolean; message: string; discountType?: string; discountValue?: number }> {
  await getUser();

  const [promo] = await db.select().from(promotions).where(eq(promotions.code, code.toUpperCase()));
  if (!promo) return { valid: false, message: "Promo code not found" };
  if (!promo.isActive) return { valid: false, message: "Promo code is no longer active" };
  if (promo.endsAt && promo.endsAt < new Date())
    return { valid: false, message: "Promo code has expired" };
  if (promo.startsAt && promo.startsAt > new Date())
    return { valid: false, message: "Promo code is not yet active" };
  if (promo.maxUses && promo.redemptionCount >= promo.maxUses)
    return { valid: false, message: "Promo code has reached max uses" };
  if (promo.appliesTo && serviceCategory && promo.appliesTo !== serviceCategory) {
    return { valid: false, message: `This promo only applies to ${promo.appliesTo} services` };
  }

  return {
    valid: true,
    message: "Promo code is valid",
    discountType: promo.discountType,
    discountValue: promo.discountValue,
  };
}

export async function applyPromoCode(bookingId: number, promoCode: string) {
  await getUser();

  const [promo] = await db
    .select()
    .from(promotions)
    .where(eq(promotions.code, promoCode.toUpperCase()));
  if (!promo) throw new Error("Promo code not found");

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new Error("Booking not found");

  let discountCents = 0;
  if (promo.discountType === "percent") {
    discountCents = Math.round(booking.totalInCents * (promo.discountValue / 100));
  } else if (promo.discountType === "fixed") {
    discountCents = Math.min(promo.discountValue, booking.totalInCents);
  } else if (promo.discountType === "bogo") {
    discountCents = Math.round(booking.totalInCents / 2);
  }

  await db
    .update(bookings)
    .set({
      promotionId: promo.id,
      discountInCents: discountCents,
    })
    .where(eq(bookings.id, bookingId));

  await db
    .update(promotions)
    .set({
      redemptionCount: promo.redemptionCount + 1,
    })
    .where(eq(promotions.id, promo.id));

  revalidatePath("/dashboard/financial");
}

/* ================================================================== */
/*  Profit & Loss (last 6 months)                                      */
/* ================================================================== */

export async function getProfitLoss(): Promise<ProfitLossRow[]> {
  await getUser();

  const revenueRows = await db
    .select({
      month: sql<string>`to_char(coalesce(${payments.paidAt}, ${payments.createdAt}), 'YYYY-MM')`,
      total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)`,
    })
    .from(payments)
    .where(and(eq(payments.status, "paid"), gte(payments.paidAt, sql`now() - interval '6 months'`)))
    .groupBy(sql`to_char(coalesce(${payments.paidAt}, ${payments.createdAt}), 'YYYY-MM')`)
    .orderBy(sql`to_char(coalesce(${payments.paidAt}, ${payments.createdAt}), 'YYYY-MM')`);

  const expenseRows = await db
    .select({
      month: sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`,
      total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)`,
    })
    .from(expenses)
    .where(gte(expenses.expenseDate, sql`now() - interval '6 months'`))
    .groupBy(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`);

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
}

/* ================================================================== */
/*  Tax Estimate (current quarter)                                     */
/* ================================================================== */

export async function getTaxEstimate(): Promise<TaxEstimate> {
  await getUser();

  const { settings: settingsTable } = await import("@/db/schema");
  const [settingsRow] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "financial_config"));
  const config = (settingsRow?.value as { estimatedTaxRate?: number }) ?? {};
  const taxRate = config.estimatedTaxRate ?? 25;

  const now = new Date();
  const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
  const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
  const quarterLabels = ["Q1", "Q2", "Q3", "Q4"];
  const quarterLabel = `${quarterLabels[Math.floor(now.getMonth() / 3)]} ${now.getFullYear()}`;

  const [revRow] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountInCents}), 0)` })
    .from(payments)
    .where(and(eq(payments.status, "paid"), gte(payments.paidAt, quarterStart)));

  const [expRow] = await db
    .select({ total: sql<number>`coalesce(sum(${expenses.amountInCents}), 0)` })
    .from(expenses)
    .where(gte(expenses.expenseDate, quarterStart));

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
}

/* ------------------------------------------------------------------ */
/*  Product Sales                                                      */
/* ------------------------------------------------------------------ */

export async function getProductSales(): Promise<ProductSalesStats> {
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
}

/* ------------------------------------------------------------------ */
/*  Deposit Tracking                                                   */
/* ------------------------------------------------------------------ */

export async function getDepositStats(): Promise<DepositStats> {
  await getUser();

  const [row] = await db
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
    );

  const expected = Math.round(Number(row.expectedCents) / 100);
  const collected = Math.round(Number(row.collectedCents) / 100);
  const needing = Number(row.needingDeposit);
  const withDep = Number(row.withDeposit);

  return {
    totalExpected: expected,
    totalCollected: collected,
    collectionRate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
    bookingsNeedingDeposit: needing,
    bookingsWithDeposit: withDep,
  };
}

/* ------------------------------------------------------------------ */
/*  Tip Trends                                                         */
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

export async function getTipTrends(): Promise<TipStats> {
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
}

/* ------------------------------------------------------------------ */
/*  Expense Category Breakdown                                         */
/* ------------------------------------------------------------------ */

const EXPENSE_LABELS: Record<string, string> = {
  supplies: "Supplies",
  rent: "Rent",
  marketing: "Marketing",
  equipment: "Equipment",
  software: "Software",
  travel: "Travel",
  other: "Other",
};

export async function getExpenseCategoryBreakdown(): Promise<ExpenseCategoryBreakdown[]> {
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
}
