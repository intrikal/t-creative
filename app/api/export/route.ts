/**
 * GET /api/export — Admin CSV data export.
 *
 * Exports business data to CSV for bookkeeping, tax prep, and client management.
 * Admin-only. All exports are recorded in the audit log.
 *
 * Query params:
 *   type    — "clients" | "bookings" | "payments" | "expenses" | "invoices" | "orders"
 *   from    — ISO date string (inclusive lower bound, defaults to 1 year ago)
 *   to      — ISO date string (inclusive upper bound, defaults to today)
 *
 * @example
 *   GET /api/export?type=payments&from=2024-01-01&to=2024-12-31
 */
import { NextResponse } from "next/server";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, expenses, invoices, orders, payments, profiles, services } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  CSV helpers                                                         */
/* ------------------------------------------------------------------ */

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in quotes if it contains commas, quotes, or newlines
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(csvCell).join(",");
  const dataLines = rows.map((row) => row.map(csvCell).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function cents(n: number | null | undefined): string {
  if (n === null || n === undefined) return "0.00";
  return (n / 100).toFixed(2);
}

function isoDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                       */
/* ------------------------------------------------------------------ */

const EXPORT_TYPES = ["clients", "bookings", "payments", "expenses", "invoices", "orders"] as const;
type ExportType = (typeof EXPORT_TYPES)[number];

export async function GET(request: Request) {
  /* -- Auth: admin only -- */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [adminProfile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  /* -- Parse params -- */
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "") as ExportType;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!EXPORT_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${EXPORT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const now = new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  // "to" is exclusive upper bound — add 1 day so the selected date is included
  const toExclusive = toParam
    ? new Date(new Date(toParam).getTime() + 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (isNaN(from.getTime()) || isNaN(toExclusive.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  /* -- Build CSV -- */
  let csv = "";
  let filename = "";

  try {
    switch (type) {
      case "clients": {
        const rows = await db
          .select({
            id: profiles.id,
            firstName: profiles.firstName,
            lastName: profiles.lastName,
            email: profiles.email,
            phone: profiles.phone,
            source: profiles.source,
            isVip: profiles.isVip,
            lifecycleStage: profiles.lifecycleStage,
            tags: profiles.tags,
            isActive: profiles.isActive,
            notifyEmail: profiles.notifyEmail,
            notifySms: profiles.notifySms,
            createdAt: profiles.createdAt,
          })
          .from(profiles)
          .where(
            and(
              eq(profiles.role, "client"),
              gte(profiles.createdAt, from),
              lt(profiles.createdAt, toExclusive),
            ),
          )
          .orderBy(asc(profiles.createdAt));

        csv = toCsv(
          [
            "ID",
            "First Name",
            "Last Name",
            "Email",
            "Phone",
            "Source",
            "VIP",
            "Lifecycle Stage",
            "Tags",
            "Active",
            "Email Notifications",
            "SMS Notifications",
            "Joined",
          ],
          rows.map((r) => [
            r.id,
            r.firstName,
            r.lastName,
            r.email,
            r.phone,
            r.source,
            r.isVip ? "Yes" : "No",
            r.lifecycleStage,
            r.tags,
            r.isActive ? "Yes" : "No",
            r.notifyEmail ? "Yes" : "No",
            r.notifySms ? "Yes" : "No",
            isoDate(r.createdAt),
          ]),
        );
        filename = `clients-${isoDate(from)}-to-${isoDate(toParam ?? now)}.csv`;
        break;
      }

      case "bookings": {
        const clientProfile = alias(profiles, "client_profile");
        const staffProfile = alias(profiles, "staff_profile");

        const rows = await db
          .select({
            id: bookings.id,
            status: bookings.status,
            startsAt: bookings.startsAt,
            durationMinutes: bookings.durationMinutes,
            totalInCents: bookings.totalInCents,
            depositPaidInCents: bookings.depositPaidInCents,
            location: bookings.location,
            clientNotes: bookings.clientNotes,
            staffNotes: bookings.staffNotes,
            cancellationReason: bookings.cancellationReason,
            confirmedAt: bookings.confirmedAt,
            completedAt: bookings.completedAt,
            cancelledAt: bookings.cancelledAt,
            serviceName: services.name,
            serviceCategory: services.category,
            clientFirst: clientProfile.firstName,
            clientLast: clientProfile.lastName,
            clientEmail: clientProfile.email,
            staffFirst: staffProfile.firstName,
            staffLast: staffProfile.lastName,
          })
          .from(bookings)
          .innerJoin(services, eq(services.id, bookings.serviceId))
          .innerJoin(clientProfile, eq(clientProfile.id, bookings.clientId))
          .leftJoin(staffProfile, eq(staffProfile.id, bookings.staffId))
          .where(and(gte(bookings.startsAt, from), lt(bookings.startsAt, toExclusive)))
          .orderBy(asc(bookings.startsAt));

        csv = toCsv(
          [
            "Booking ID",
            "Status",
            "Date",
            "Duration (min)",
            "Total ($)",
            "Deposit Paid ($)",
            "Service",
            "Category",
            "Client Name",
            "Client Email",
            "Staff",
            "Location",
            "Client Notes",
            "Staff Notes",
            "Cancellation Reason",
            "Confirmed At",
            "Completed At",
            "Cancelled At",
          ],
          rows.map((r) => [
            r.id,
            r.status,
            isoDate(r.startsAt),
            r.durationMinutes,
            cents(r.totalInCents),
            cents(r.depositPaidInCents),
            r.serviceName,
            r.serviceCategory,
            `${r.clientFirst} ${r.clientLast}`.trim(),
            r.clientEmail,
            r.staffFirst ? `${r.staffFirst} ${r.staffLast ?? ""}`.trim() : "",
            r.location,
            r.clientNotes,
            r.staffNotes,
            r.cancellationReason,
            isoDate(r.confirmedAt),
            isoDate(r.completedAt),
            isoDate(r.cancelledAt),
          ]),
        );
        filename = `bookings-${isoDate(from)}-to-${isoDate(toParam ?? now)}.csv`;
        break;
      }

      case "payments": {
        const clientProfile = alias(profiles, "client_profile");

        const rows = await db
          .select({
            id: payments.id,
            status: payments.status,
            method: payments.method,
            amountInCents: payments.amountInCents,
            tipInCents: payments.tipInCents,
            taxAmountInCents: payments.taxAmountInCents,
            refundedInCents: payments.refundedInCents,
            paidAt: payments.paidAt,
            squarePaymentId: payments.squarePaymentId,
            squareReceiptUrl: payments.squareReceiptUrl,
            bookingId: payments.bookingId,
            serviceName: services.name,
            serviceCategory: services.category,
            clientFirst: clientProfile.firstName,
            clientLast: clientProfile.lastName,
            clientEmail: clientProfile.email,
          })
          .from(payments)
          .leftJoin(bookings, eq(bookings.id, payments.bookingId))
          .leftJoin(services, eq(services.id, bookings.serviceId))
          .innerJoin(clientProfile, eq(clientProfile.id, payments.clientId))
          .where(and(gte(payments.paidAt, from), lt(payments.paidAt, toExclusive)))
          .orderBy(asc(payments.paidAt));

        csv = toCsv(
          [
            "Payment ID",
            "Date",
            "Status",
            "Method",
            "Amount ($)",
            "Tip ($)",
            "Tax ($)",
            "Refunded ($)",
            "Net ($)",
            "Booking ID",
            "Service",
            "Category",
            "Client Name",
            "Client Email",
            "Square Payment ID",
            "Receipt URL",
          ],
          rows.map((r) => {
            const net = r.amountInCents + r.tipInCents + r.taxAmountInCents - r.refundedInCents;
            return [
              r.id,
              isoDate(r.paidAt),
              r.status,
              r.method,
              cents(r.amountInCents),
              cents(r.tipInCents),
              cents(r.taxAmountInCents),
              cents(r.refundedInCents),
              cents(net),
              r.bookingId,
              r.serviceName,
              r.serviceCategory,
              `${r.clientFirst} ${r.clientLast}`.trim(),
              r.clientEmail,
              r.squarePaymentId,
              r.squareReceiptUrl,
            ];
          }),
        );
        filename = `payments-${isoDate(from)}-to-${isoDate(toParam ?? now)}.csv`;
        break;
      }

      case "expenses": {
        const rows = await db
          .select({
            id: expenses.id,
            expenseDate: expenses.expenseDate,
            category: expenses.category,
            description: expenses.description,
            vendor: expenses.vendor,
            amountInCents: expenses.amountInCents,
            hasReceipt: expenses.hasReceipt,
            notes: expenses.notes,
          })
          .from(expenses)
          .where(and(gte(expenses.expenseDate, from), lt(expenses.expenseDate, toExclusive)))
          .orderBy(asc(expenses.expenseDate));

        csv = toCsv(
          [
            "Expense ID",
            "Date",
            "Category",
            "Description",
            "Vendor",
            "Amount ($)",
            "Receipt on File",
            "Notes",
          ],
          rows.map((r) => [
            r.id,
            isoDate(r.expenseDate),
            r.category,
            r.description,
            r.vendor,
            cents(r.amountInCents),
            r.hasReceipt ? "Yes" : "No",
            r.notes,
          ]),
        );
        filename = `expenses-${isoDate(from)}-to-${isoDate(toParam ?? now)}.csv`;
        break;
      }

      case "invoices": {
        const rows = await db
          .select({
            id: invoices.id,
            number: invoices.number,
            description: invoices.description,
            amountInCents: invoices.amountInCents,
            taxAmountInCents: invoices.taxAmountInCents,
            status: invoices.status,
            issuedAt: invoices.issuedAt,
            dueAt: invoices.dueAt,
            paidAt: invoices.paidAt,
            isRecurring: invoices.isRecurring,
            clientFirst: profiles.firstName,
            clientLast: profiles.lastName,
            clientEmail: profiles.email,
          })
          .from(invoices)
          .innerJoin(profiles, eq(profiles.id, invoices.clientId))
          .where(and(gte(invoices.issuedAt, from), lt(invoices.issuedAt, toExclusive)))
          .orderBy(asc(invoices.issuedAt));

        csv = toCsv(
          [
            "Invoice ID",
            "Invoice #",
            "Client Name",
            "Client Email",
            "Description",
            "Amount ($)",
            "Tax ($)",
            "Total ($)",
            "Status",
            "Issued",
            "Due",
            "Paid",
            "Recurring",
          ],
          rows.map((r) => [
            r.id,
            r.number,
            `${r.clientFirst} ${r.clientLast}`.trim(),
            r.clientEmail,
            r.description,
            cents(r.amountInCents),
            cents(r.taxAmountInCents),
            cents((r.amountInCents ?? 0) + (r.taxAmountInCents ?? 0)),
            r.status,
            isoDate(r.issuedAt),
            isoDate(r.dueAt),
            isoDate(r.paidAt),
            r.isRecurring ? "Yes" : "No",
          ]),
        );
        filename = `invoices-${isoDate(from)}-to-${isoDate(toParam ?? now)}.csv`;
        break;
      }

      case "orders": {
        const rows = await db
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            title: orders.title,
            description: orders.description,
            status: orders.status,
            quantity: orders.quantity,
            quotedInCents: orders.quotedInCents,
            finalInCents: orders.finalInCents,
            taxAmountInCents: orders.taxAmountInCents,
            fulfillmentMethod: orders.fulfillmentMethod,
            estimatedCompletionAt: orders.estimatedCompletionAt,
            completedAt: orders.completedAt,
            internalNotes: orders.internalNotes,
            createdAt: orders.createdAt,
            clientFirst: profiles.firstName,
            clientLast: profiles.lastName,
            clientEmail: profiles.email,
          })
          .from(orders)
          .innerJoin(profiles, eq(profiles.id, orders.clientId))
          .where(and(gte(orders.createdAt, from), lt(orders.createdAt, toExclusive)))
          .orderBy(asc(orders.createdAt));

        csv = toCsv(
          [
            "Order ID",
            "Order #",
            "Client Name",
            "Client Email",
            "Title",
            "Description",
            "Status",
            "Qty",
            "Quoted ($)",
            "Final ($)",
            "Tax ($)",
            "Fulfillment",
            "Est. Completion",
            "Completed",
            "Created",
            "Internal Notes",
          ],
          rows.map((r) => [
            r.id,
            r.orderNumber,
            `${r.clientFirst} ${r.clientLast}`.trim(),
            r.clientEmail,
            r.title,
            r.description,
            r.status,
            r.quantity,
            cents(r.quotedInCents),
            cents(r.finalInCents),
            cents(r.taxAmountInCents),
            r.fulfillmentMethod,
            isoDate(r.estimatedCompletionAt),
            isoDate(r.completedAt),
            isoDate(r.createdAt),
            r.internalNotes,
          ]),
        );
        filename = `orders-${isoDate(from)}-to-${isoDate(toParam ?? now)}.csv`;
        break;
      }
    }
  } catch (err) {
    console.error("[export] Query failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  /* -- Audit log -- */
  await logAction({
    actorId: user.id,
    action: "export",
    entityType: type,
    entityId: "csv",
    description: `Exported ${type} CSV (${isoDate(from)} – ${isoDate(toParam ?? now)})`,
    metadata: { from: from.toISOString(), to: toExclusive.toISOString() },
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
