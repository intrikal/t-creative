/**
 * app/dashboard/financial/invoice-expense-actions.ts — Invoice and expense CRUD actions.
 *
 * Create and list invoices and expenses.
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { invoices, expenses, profiles } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";

const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const CreateInvoiceSchema = z.object({
  clientId: z.string().min(1),
  description: z.string().min(1),
  amountInCents: z.number().int().positive(),
  taxAmountInCents: z.number().int().nonnegative().optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceInterval: z.string().optional(),
});

const CreateExpenseSchema = z.object({
  expenseDate: z.string().min(1),
  category: z.enum(["supplies", "rent", "marketing", "equipment", "software", "travel", "other"]),
  description: z.string().min(1),
  vendor: z.string().optional(),
  amountInCents: z.number().int().positive(),
  hasReceipt: z.boolean().optional(),
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

export type ExpenseRow = {
  id: number;
  date: string;
  category: string;
  description: string;
  vendor: string | null;
  amount: number;
  hasReceipt: boolean;
};

/* ------------------------------------------------------------------ */
/*  Invoice queries                                                    */
/* ------------------------------------------------------------------ */

const invoiceClient = alias(profiles, "invoiceClient");

export async function getInvoices(): Promise<InvoiceRow[]> {
  try {
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
        r.paidAt?.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) ?? null,
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function createInvoice(input: {
  clientId: string;
  description: string;
  amountInCents: number;
  /** Sales tax in cents. Calculated by Square, not this app. */
  taxAmountInCents?: number;
  dueAt?: string;
  notes?: string;
  isRecurring?: boolean;
  recurrenceInterval?: string;
}) {
  try {
    CreateInvoiceSchema.parse(input);

    const user = await getUser();

    const [lastInvoice] = await db
      .select({ number: invoices.number })
      .from(invoices)
      .orderBy(desc(invoices.id))
      .limit(1);

    const nextNum = lastInvoice
      ? String(parseInt(lastInvoice.number.replace("INV-", ""), 10) + 1).padStart(3, "0")
      : "001";

    const dueDate = input.dueAt ? new Date(input.dueAt) : null;

    let nextDueAt: Date | null = null;
    if (input.isRecurring && dueDate) {
      nextDueAt = new Date(dueDate);
      if (input.recurrenceInterval === "weekly") nextDueAt.setDate(nextDueAt.getDate() + 7);
      else if (input.recurrenceInterval === "quarterly")
        nextDueAt.setMonth(nextDueAt.getMonth() + 3);
      else nextDueAt.setMonth(nextDueAt.getMonth() + 1);
    }

    await db.insert(invoices).values({
      clientId: input.clientId,
      number: `INV-${nextNum}`,
      description: input.description,
      amountInCents: input.amountInCents,
      taxAmountInCents: input.taxAmountInCents ?? 0,
      dueAt: dueDate,
      notes: input.notes ?? null,
      isRecurring: input.isRecurring ?? false,
      recurrenceInterval: input.recurrenceInterval ?? null,
      nextDueAt,
    });

    await logAction({
      actorId: user.id,
      action: "create",
      entityType: "invoice",
      entityId: `INV-${nextNum}`,
      description: `Invoice INV-${nextNum} created`,
      metadata: { clientId: input.clientId, amountInCents: input.amountInCents },
    });

    revalidatePath("/dashboard/financial");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Expense queries                                                    */
/* ------------------------------------------------------------------ */

export async function getExpenses(): Promise<ExpenseRow[]> {
  try {
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function createExpense(input: {
  expenseDate: string;
  category: "supplies" | "rent" | "marketing" | "equipment" | "software" | "travel" | "other";
  description: string;
  vendor?: string;
  amountInCents: number;
  hasReceipt?: boolean;
}) {
  try {
    CreateExpenseSchema.parse(input);

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

    await logAction({
      actorId: user.id,
      action: "create",
      entityType: "expense",
      entityId: "new",
      description: `Expense recorded: ${input.description}`,
      metadata: { category: input.category, amountInCents: input.amountInCents },
    });

    revalidatePath("/dashboard/financial");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
