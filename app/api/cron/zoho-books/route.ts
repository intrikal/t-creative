/**
 * Cron route — batch-sync unsynced invoices to Zoho Books.
 *
 * Finds confirmed bookings, accepted orders, and enrolled enrollments
 * that don't yet have a `zohoInvoiceId` and creates invoices for them.
 * Acts as a catch-all for any that failed during the real-time flow.
 *
 * Auth: requires `x-cron-secret` header matching `CRON_SECRET`.
 *
 * @module api/cron/zoho-books
 */
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookings, orders, enrollments, profiles, services, trainingPrograms } from "@/db/schema";
import { createZohoBooksInvoice, isZohoBooksConfigured } from "@/lib/zoho-books";

const BATCH_SIZE = 20;

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isZohoBooksConfigured()) {
    return NextResponse.json({ message: "Zoho Books not configured, skipping" });
  }

  let synced = 0;
  let failed = 0;

  // 1. Unsynced confirmed bookings
  const unsyncedBookings = await db
    .select({
      id: bookings.id,
      clientId: bookings.clientId,
      totalInCents: bookings.totalInCents,
      depositPaidInCents: bookings.depositPaidInCents,
      clientEmail: profiles.email,
      clientFirstName: profiles.firstName,
      clientLastName: profiles.lastName,
      clientPhone: profiles.phone,
      serviceName: services.name,
    })
    .from(bookings)
    .innerJoin(profiles, eq(bookings.clientId, profiles.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(eq(bookings.status, "confirmed"), isNull(bookings.zohoInvoiceId)))
    .limit(BATCH_SIZE);

  for (const b of unsyncedBookings) {
    try {
      await createZohoBooksInvoice({
        entityType: "booking",
        entityId: b.id,
        profileId: b.clientId,
        email: b.clientEmail,
        firstName: b.clientFirstName,
        lastName: b.clientLastName ?? undefined,
        phone: b.clientPhone,
        lineItems: [{ name: b.serviceName, rate: b.totalInCents, quantity: 1 }],
        depositInCents: b.depositPaidInCents ?? undefined,
      });
      synced++;
    } catch {
      failed++;
    }
  }

  // 2. Unsynced accepted orders
  const unsyncedOrders = await db
    .select({
      id: orders.id,
      clientId: orders.clientId,
      title: orders.title,
      finalInCents: orders.finalInCents,
      quantity: orders.quantity,
      clientEmail: profiles.email,
      clientFirstName: profiles.firstName,
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.clientId, profiles.id))
    .where(and(eq(orders.status, "accepted"), isNull(orders.zohoInvoiceId)))
    .limit(BATCH_SIZE);

  for (const o of unsyncedOrders) {
    try {
      await createZohoBooksInvoice({
        entityType: "order",
        entityId: o.id,
        profileId: o.clientId,
        email: o.clientEmail,
        firstName: o.clientFirstName,
        lineItems: [{ name: o.title, rate: o.finalInCents ?? 0, quantity: o.quantity }],
      });
      synced++;
    } catch {
      failed++;
    }
  }

  // 3. Unsynced enrollments
  const unsyncedEnrollments = await db
    .select({
      id: enrollments.id,
      clientId: enrollments.clientId,
      clientEmail: profiles.email,
      clientFirstName: profiles.firstName,
      programName: trainingPrograms.name,
      priceInCents: trainingPrograms.priceInCents,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(enrollments.clientId, profiles.id))
    .innerJoin(trainingPrograms, eq(enrollments.programId, trainingPrograms.id))
    .where(and(eq(enrollments.status, "enrolled"), isNull(enrollments.zohoInvoiceId)))
    .limit(BATCH_SIZE);

  for (const e of unsyncedEnrollments) {
    try {
      await createZohoBooksInvoice({
        entityType: "enrollment",
        entityId: e.id,
        profileId: e.clientId,
        email: e.clientEmail,
        firstName: e.clientFirstName,
        lineItems: [{ name: `Training: ${e.programName}`, rate: e.priceInCents ?? 0, quantity: 1 }],
      });
      synced++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    bookingsFound: unsyncedBookings.length,
    ordersFound: unsyncedOrders.length,
    enrollmentsFound: unsyncedEnrollments.length,
    synced,
    failed,
  });
}
