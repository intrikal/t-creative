/**
 * GET /api/client-export — CCPA "Right to Know" data export.
 *
 * Returns a JSON file containing ALL personal data the business holds about
 * the authenticated client. Accessible only by the client themselves (not admin).
 *
 * CCPA requires responding within 45 days; this endpoint responds immediately
 * because all data lives in the local database.
 *
 * The export includes: profile, preferences, bookings, payments, orders,
 * invoices, messages, reviews, form submissions, service records, loyalty
 * transactions, notifications, memberships, subscriptions, waitlist entries,
 * and wishlist items.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  profiles,
  clientPreferences,
  bookings,
  payments,
  orders,
  invoices,
  threads,
  messages,
  reviews,
  formSubmissions,
  serviceRecords,
  loyaltyTransactions,
  notifications,
  membershipSubscriptions,
  bookingSubscriptions,
  waitlist,
  wishlistItems,
  services,
} from "@/db/schema";
import { logAction } from "@/lib/audit";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  /* -- Auth: authenticated client only -- */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  if (!profile || profile.role !== "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  /* -- Gather all client data -- */
  try {
    const [
      prefsRows,
      bookingRows,
      paymentRows,
      orderRows,
      invoiceRows,
      threadRows,
      reviewRows,
      formRows,
      serviceRecordRows,
      loyaltyRows,
      notificationRows,
      membershipRows,
      subscriptionRows,
      waitlistRows,
      wishlistRows,
    ] = await Promise.all([
      db.select().from(clientPreferences).where(eq(clientPreferences.profileId, user.id)),
      db
        .select({
          id: bookings.id,
          status: bookings.status,
          startsAt: bookings.startsAt,
          durationMinutes: bookings.durationMinutes,
          totalInCents: bookings.totalInCents,
          discountInCents: bookings.discountInCents,
          clientNotes: bookings.clientNotes,
          location: bookings.location,
          confirmedAt: bookings.confirmedAt,
          completedAt: bookings.completedAt,
          cancelledAt: bookings.cancelledAt,
          cancellationReason: bookings.cancellationReason,
          serviceName: services.name,
          serviceCategory: services.category,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .leftJoin(services, eq(services.id, bookings.serviceId))
        .where(eq(bookings.clientId, user.id)),
      db
        .select({
          id: payments.id,
          status: payments.status,
          method: payments.method,
          amountInCents: payments.amountInCents,
          tipInCents: payments.tipInCents,
          taxAmountInCents: payments.taxAmountInCents,
          refundedInCents: payments.refundedInCents,
          paidAt: payments.paidAt,
          squareReceiptUrl: payments.squareReceiptUrl,
        })
        .from(payments)
        .where(eq(payments.clientId, user.id)),
      db
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
          completedAt: orders.completedAt,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.clientId, user.id)),
      db
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
        })
        .from(invoices)
        .where(eq(invoices.clientId, user.id)),
      db
        .select({
          id: threads.id,
          subject: threads.subject,
          threadType: threads.threadType,
          status: threads.status,
          createdAt: threads.createdAt,
        })
        .from(threads)
        .where(eq(threads.clientId, user.id)),
      db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          body: reviews.body,
          serviceName: reviews.serviceName,
          status: reviews.status,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(eq(reviews.clientId, user.id)),
      db
        .select({
          id: formSubmissions.id,
          data: formSubmissions.data,
          formVersion: formSubmissions.formVersion,
          submittedAt: formSubmissions.submittedAt,
        })
        .from(formSubmissions)
        .where(eq(formSubmissions.clientId, user.id)),
      db
        .select({
          id: serviceRecords.id,
          lashMapping: serviceRecords.lashMapping,
          curlType: serviceRecords.curlType,
          diameter: serviceRecords.diameter,
          lengths: serviceRecords.lengths,
          adhesive: serviceRecords.adhesive,
          retentionNotes: serviceRecords.retentionNotes,
          productsUsed: serviceRecords.productsUsed,
          notes: serviceRecords.notes,
          reactions: serviceRecords.reactions,
          nextVisitNotes: serviceRecords.nextVisitNotes,
          createdAt: serviceRecords.createdAt,
        })
        .from(serviceRecords)
        .where(eq(serviceRecords.clientId, user.id)),
      db
        .select({
          id: loyaltyTransactions.id,
          points: loyaltyTransactions.points,
          type: loyaltyTransactions.type,
          description: loyaltyTransactions.description,
          createdAt: loyaltyTransactions.createdAt,
        })
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.profileId, user.id)),
      db
        .select({
          id: notifications.id,
          type: notifications.type,
          channel: notifications.channel,
          title: notifications.title,
          body: notifications.body,
          sentAt: notifications.sentAt,
          readAt: notifications.readAt,
        })
        .from(notifications)
        .where(eq(notifications.profileId, user.id)),
      db
        .select()
        .from(membershipSubscriptions)
        .where(eq(membershipSubscriptions.clientId, user.id)),
      db.select().from(bookingSubscriptions).where(eq(bookingSubscriptions.clientId, user.id)),
      db.select().from(waitlist).where(eq(waitlist.clientId, user.id)),
      db.select().from(wishlistItems).where(eq(wishlistItems.clientId, user.id)),
    ]);

    // Fetch messages for the client's threads
    const threadIds = threadRows.map((t) => t.id);
    let messageRows: Array<{
      id: number;
      threadId: number;
      body: string | null;
      channel: string | null;
      createdAt: Date;
    }> = [];
    if (threadIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      messageRows = await db
        .select({
          id: messages.id,
          threadId: messages.threadId,
          body: messages.body,
          channel: messages.channel,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.threadId, threadIds));
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      description:
        "This file contains all personal data T Creative Studio holds about you, " +
        "provided in accordance with the California Consumer Privacy Act (CCPA).",
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        isVip: profile.isVip,
        lifecycleStage: profile.lifecycleStage,
        tags: profile.tags,
        source: profile.source,
        notifySms: profile.notifySms,
        notifyEmail: profile.notifyEmail,
        notifyMarketing: profile.notifyMarketing,
        referralCode: profile.referralCode,
        onboardingData: profile.onboardingData,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
      preferences: prefsRows[0] ?? null,
      bookings: bookingRows,
      payments: paymentRows,
      orders: orderRows,
      invoices: invoiceRows,
      conversations: threadRows.map((thread) => ({
        ...thread,
        messages: messageRows.filter((m) => m.threadId === thread.id),
      })),
      reviews: reviewRows,
      formSubmissions: formRows,
      serviceRecords: serviceRecordRows,
      loyaltyTransactions: loyaltyRows,
      notifications: notificationRows,
      memberships: membershipRows,
      subscriptions: subscriptionRows,
      waitlistEntries: waitlistRows,
      wishlistItems: wishlistRows,
    };

    /* -- Audit log -- */
    await logAction({
      actorId: user.id,
      action: "export",
      entityType: "client_data",
      entityId: user.id,
      description: "Client requested CCPA data export",
    });

    const json = JSON.stringify(exportData, null, 2);
    const filename = `t-creative-my-data-${new Date().toISOString().split("T")[0]}.json`;

    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err, { extra: { context: "[client-export] Failed" } });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
