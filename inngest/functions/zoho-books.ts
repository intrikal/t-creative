/**
 * Inngest function — Batch-sync unsynced invoices to Zoho Books.
 *
 * Replaces GET /api/cron/zoho-books. Finds confirmed bookings, accepted orders,
 * and enrolled enrollments that don't yet have a zohoInvoiceId and creates
 * invoices for them. Acts as a catch-all for any that failed during real-time flow.
 */
import * as Sentry from "@sentry/nextjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookings, orders, enrollments, profiles, services, trainingPrograms } from "@/db/schema";
import { createZohoBooksInvoice, isZohoBooksConfigured } from "@/lib/zoho-books";
import { inngest } from "../client";

const BATCH_SIZE = 20;

export const zohoBooks = inngest.createFunction(
  { id: "zoho-books", retries: 3, triggers: [{ event: "cron/zoho-books" }] },
  async ({ step }) => {
    const configured = await step.run("check-config", async () => {
      return isZohoBooksConfigured();
    });

    if (!configured) {
      return { message: "Zoho Books not configured, skipping" };
    }

    let synced = 0;
    let failed = 0;

    // 1. Unsynced confirmed bookings
    const unsyncedBookings = await step.run("query-bookings", async () => {
      return db
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
    });

    for (const b of unsyncedBookings) {
      const result = await step.run(`process-booking-${b.id}`, async () => {
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
          return { synced: 1, failed: 0 };
        } catch (err) {
          Sentry.captureException(err);
          return { synced: 0, failed: 1 };
        }
      });

      synced += result.synced;
      failed += result.failed;
    }

    // 2. Unsynced accepted orders
    const unsyncedOrders = await step.run("query-orders", async () => {
      return db
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
    });

    for (const o of unsyncedOrders) {
      const result = await step.run(`process-order-${o.id}`, async () => {
        try {
          await createZohoBooksInvoice({
            entityType: "order",
            entityId: o.id,
            profileId: o.clientId ?? "",
            email: o.clientEmail ?? "",
            firstName: o.clientFirstName ?? "",
            lineItems: [{ name: o.title, rate: o.finalInCents ?? 0, quantity: o.quantity }],
          });
          return { synced: 1, failed: 0 };
        } catch (err) {
          Sentry.captureException(err);
          return { synced: 0, failed: 1 };
        }
      });

      synced += result.synced;
      failed += result.failed;
    }

    // 3. Unsynced enrollments
    const unsyncedEnrollments = await step.run("query-enrollments", async () => {
      return db
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
    });

    for (const e of unsyncedEnrollments) {
      const result = await step.run(`process-enrollment-${e.id}`, async () => {
        try {
          await createZohoBooksInvoice({
            entityType: "enrollment",
            entityId: e.id,
            profileId: e.clientId,
            email: e.clientEmail,
            firstName: e.clientFirstName,
            lineItems: [
              { name: `Training: ${e.programName}`, rate: e.priceInCents ?? 0, quantity: 1 },
            ],
          });
          return { synced: 1, failed: 0 };
        } catch (err) {
          Sentry.captureException(err);
          return { synced: 0, failed: 1 };
        }
      });

      synced += result.synced;
      failed += result.failed;
    }

    return {
      bookingsFound: unsyncedBookings.length,
      ordersFound: unsyncedOrders.length,
      enrollmentsFound: unsyncedEnrollments.length,
      synced,
      failed,
    };
  },
);
