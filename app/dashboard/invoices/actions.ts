"use server";

import { eq, desc, and, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { invoices, payments, bookings, services, profiles } from "@/db/schema";
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

export type InvoiceType = "appointment" | "shop" | "training" | "deposit" | "invoice";
export type InvoiceStatus = "paid" | "pending" | "refunded" | "overdue" | "draft";

export type ClientInvoiceRow = {
  id: string;
  date: string;
  dateKey: string;
  type: InvoiceType;
  description: string;
  amount: number;
  status: InvoiceStatus;
  receiptUrl: string | null;
  dueDate: string | null;
};

export type ClientInvoicesData = {
  invoiceRows: ClientInvoiceRow[];
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getClientInvoices(): Promise<ClientInvoicesData> {
  const user = await getUser();

  const staffProfile = alias(profiles, "staff");

  // 1. Fetch invoices for this client
  const invoiceRows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      description: invoices.description,
      amountInCents: invoices.amountInCents,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(eq(invoices.clientId, user.id))
    .orderBy(desc(invoices.createdAt));

  // 2. Fetch payments (booking-linked) for this client
  const paymentRows = await db
    .select({
      id: payments.id,
      amountInCents: payments.amountInCents,
      tipInCents: payments.tipInCents,
      refundedInCents: payments.refundedInCents,
      status: payments.status,
      squareReceiptUrl: payments.squareReceiptUrl,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      serviceName: services.name,
      serviceCategory: services.category,
      staffFirstName: staffProfile.firstName,
    })
    .from(payments)
    .leftJoin(bookings, eq(payments.bookingId, bookings.id))
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
    .where(eq(payments.clientId, user.id))
    .orderBy(desc(payments.createdAt));

  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  function fmtDate(d: Date): string {
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // Map invoices
  const invoiceList: ClientInvoiceRow[] = invoiceRows.map((r) => {
    const d = new Date(r.paidAt ?? r.issuedAt ?? r.createdAt);

    let status: InvoiceStatus = "draft";
    if (r.status === "paid") status = "paid";
    else if (r.status === "overdue") status = "overdue";
    else if (r.status === "sent") status = "pending";
    else status = "draft";

    // Try to infer type from description keywords
    const desc = (r.description ?? "").toLowerCase();
    let type: InvoiceType = "invoice";
    if (desc.includes("deposit")) type = "deposit";
    else if (desc.includes("training") || desc.includes("certification") || desc.includes("course"))
      type = "training";
    else if (
      desc.includes("kit") ||
      desc.includes("cleanser") ||
      desc.includes("product") ||
      desc.includes("spoolie") ||
      desc.includes("serum")
    )
      type = "shop";

    return {
      id: r.number,
      date: fmtDate(d),
      dateKey: d.toISOString(),
      type,
      description: r.description,
      amount: r.amountInCents / 100,
      status,
      receiptUrl: null,
      dueDate: r.dueAt ? fmtDate(new Date(r.dueAt)) : null,
    };
  });

  // Map payments to invoice-like rows
  const paymentList: ClientInvoiceRow[] = paymentRows.map((r) => {
    const d = new Date(r.paidAt ?? r.createdAt);
    const staffSuffix = r.staffFirstName ? ` · ${r.staffFirstName}` : "";
    const description = `${r.serviceName ?? "Service"}${staffSuffix}`;

    let status: InvoiceStatus = "pending";
    if (r.status === "paid") status = "paid";
    else if (r.status === "refunded") status = "refunded";
    else if (r.status === "partially_refunded") status = "refunded";
    else if (r.status === "failed") status = "pending";
    else status = "pending";

    return {
      id: `PMT-${String(r.id).padStart(4, "0")}`,
      date: fmtDate(d),
      dateKey: d.toISOString(),
      type: "appointment" as InvoiceType,
      description,
      amount: r.amountInCents / 100,
      status,
      receiptUrl: r.squareReceiptUrl,
      dueDate: null,
    };
  });

  // Combine and sort by date descending
  const all = [...invoiceList, ...paymentList].sort(
    (a, b) => new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime(),
  );

  return { invoiceRows: all };
}
