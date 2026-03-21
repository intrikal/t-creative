/**
 * app/dashboard/invoices/actions.ts — Server actions for the client Invoices page.
 *
 * Builds a unified list of everything the logged-in client has been charged for:
 *   - Manual invoices (the `invoices` table — created by the admin for deposits,
 *     training fees, product orders, etc.)
 *   - Appointment payments (the `payments` table — auto-created when a booking
 *     is paid via Square)
 *
 * Both sources are merged into a single chronological feed so the client sees
 * one combined "billing history" view.
 *
 * @module dashboard/invoices/actions
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, desc, and, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { invoices, payments, bookings, services, profiles } from "@/db/schema";
import { getUser } from "@/lib/auth";

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

/**
 * Fetches every invoice and payment for the currently logged-in client, then
 * merges them into one chronologically-sorted list.
 *
 * Two separate queries run:
 *   1. Manual invoices — rows the admin created directly in the `invoices` table.
 *   2. Appointment payments — rows auto-created when Square processes a charge.
 *
 * The results are mapped into a common `ClientInvoiceRow` shape and combined.
 */
export async function getClientInvoices(): Promise<ClientInvoicesData> {
  try {
    const user = await getUser();

    // Alias the profiles table so we can reference it as "staff" later
    // (profiles is used for both clients and staff).
    const staffProfile = alias(profiles, "staff");

    // ── Query 1: Manual invoices ──────────────────────────────────────
    // SELECT  id, number, description, amount, status, dates
    // FROM    invoices
    // WHERE   clientId = <current user>              ← only this client's invoices
    // ORDER BY createdAt DESC                        ← newest first
    //
    // No JOINs needed — the invoices table has all the data inline.
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

    // ── Query 2: Appointment payments ─────────────────────────────────
    // SELECT  payments.*, services.name, services.category, staff.firstName
    // FROM    payments
    // LEFT JOIN bookings  ON payments.bookingId = bookings.id
    //   → connects a payment to the appointment it paid for
    // LEFT JOIN services  ON bookings.serviceId = services.id
    //   → pulls the service name/category for the description
    // LEFT JOIN profiles AS staff ON bookings.staffId = staff.id
    //   → pulls the staff member's first name (e.g. "Trini")
    // WHERE   payments.clientId = <current user>     ← only this client
    // ORDER BY payments.createdAt DESC               ← newest first
    //
    // LEFT JOINs (not INNER) because a payment might not have a booking
    // (e.g. a standalone charge), and a booking might not have a staff member.
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

    // ── Transform: map raw invoice rows into the common ClientInvoiceRow shape ──
    // Infers the invoice "type" from keywords in the description (deposit, training, shop, etc.)
    // and normalises the DB status into the UI-friendly InvoiceStatus enum.
    // Map each raw invoice row into the common ClientInvoiceRow shape. Infers
    // the invoice "type" from keywords in the description (deposit, training,
    // shop) and normalises the DB status into the UI-friendly InvoiceStatus enum.
    // Keyword-based inference is a pragmatic trade-off: it avoids adding a "type"
    // column to the invoices table while still enabling per-type icons in the UI.
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
      else if (
        desc.includes("training") ||
        desc.includes("certification") ||
        desc.includes("course")
      )
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

    // ── Transform: map raw payment rows into the same ClientInvoiceRow shape ──
    // Every payment becomes type "appointment". The description is built from
    // the service name + staff first name (e.g. "Classic Full Set · Trini").
    // Map each raw payment row into the same ClientInvoiceRow shape so invoices
    // and payments can be merged into a single chronological feed. Every payment
    // gets type "appointment". The description is built from service name + staff
    // first name (e.g. "Classic Full Set · Trini").
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

    // Merge both sources into one array and sort by date descending so the
    // client sees a single unified timeline. Using .sort() on the combined array
    // is simpler than maintaining two sorted cursors, and the total row count
    // per client is small enough that the O(n log n) sort is negligible.
    const all = [...invoiceList, ...paymentList].sort(
      (a, b) => new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime(),
    );

    return { invoiceRows: all };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
