"use server";

import * as Sentry from "@sentry/nextjs";
import { and, eq, desc, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  profiles,
  bookings,
  services,
  payments,
  serviceRecords,
  loyaltyTransactions,
  clientPreferences,
  threads,
  messages,
  formSubmissions,
  clientForms,
} from "@/db/schema";
import { createClient as createSupabaseClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ClientProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: string | null;
  isVip: boolean;
  lifecycleStage: string | null;
  internalNotes: string | null;
  tags: string | null;
  referredByName: string | null;
  referralCount: number;
  createdAt: Date;
  onboardingData: Record<string, unknown> | null;
};

export type ClientBookingRow = {
  id: number;
  serviceName: string;
  serviceCategory: string;
  status: string;
  startsAt: Date;
  durationMinutes: number;
  totalInCents: number;
  discountInCents: number;
  clientNotes: string | null;
  staffNotes: string | null;
  staffName: string | null;
  location: string | null;
};

export type ClientPaymentRow = {
  id: number;
  bookingId: number;
  status: string;
  method: string | null;
  amountInCents: number;
  tipInCents: number;
  refundedInCents: number;
  paidAt: Date | null;
  createdAt: Date;
};

export type ClientServiceRecordRow = {
  id: number;
  bookingId: number;
  serviceName: string;
  serviceCategory: string;
  bookingDate: Date;
  staffName: string | null;
  lashMapping: string | null;
  curlType: string | null;
  diameter: string | null;
  lengths: string | null;
  adhesive: string | null;
  retentionNotes: string | null;
  productsUsed: string | null;
  notes: string | null;
  reactions: string | null;
  nextVisitNotes: string | null;
  createdAt: Date;
};

export type ClientPreferencesData = {
  preferredLashStyle: string | null;
  preferredCurlType: string | null;
  preferredLengths: string | null;
  preferredDiameter: string | null;
  naturalLashNotes: string | null;
  retentionProfile: string | null;
  allergies: string | null;
  skinType: string | null;
  adhesiveSensitivity: boolean;
  healthNotes: string | null;
  birthday: string | null;
  preferredContactMethod: string | null;
  preferredServiceTypes: string | null;
  generalNotes: string | null;
  preferredRebookIntervalDays: number | null;
};

export type ClientLoyaltyRow = {
  id: string;
  points: number;
  type: string;
  description: string | null;
  createdAt: Date;
};

export type ClientThreadRow = {
  id: number;
  subject: string;
  threadType: string;
  status: string;
  lastMessageAt: Date;
  messageCount: number;
  unreadCount: number;
};

export type ClientFormSubmissionRow = {
  id: number;
  formName: string;
  formType: string;
  formVersion: string | null;
  submittedAt: Date;
  data: Record<string, unknown> | null;
};

export type ClientDetailData = {
  profile: ClientProfile;
  preferences: ClientPreferencesData | null;
  bookings: ClientBookingRow[];
  payments: ClientPaymentRow[];
  serviceRecords: ClientServiceRecordRow[];
  loyaltyTransactions: ClientLoyaltyRow[];
  loyaltyBalance: number;
  threads: ClientThreadRow[];
  formSubmissions: ClientFormSubmissionRow[];
};

/* ------------------------------------------------------------------ */
/*  Main query                                                         */
/* ------------------------------------------------------------------ */

export async function getClientDetail(clientId: string): Promise<ClientDetailData | null> {
  try {
    await getUser();

    const referrer = db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
      })
      .from(profiles)
      .as("referrer");

    // 1. Profile
    const [profileRow] = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        phone: profiles.phone,
        source: profiles.source,
        isVip: profiles.isVip,
        lifecycleStage: profiles.lifecycleStage,
        internalNotes: profiles.internalNotes,
        tags: profiles.tags,
        createdAt: profiles.createdAt,
        referredBy: profiles.referredBy,
        onboardingData: profiles.onboardingData,
      })
      .from(profiles)
      .where(and(eq(profiles.id, clientId), eq(profiles.role, "client")))
      .limit(1);

    if (!profileRow) return null;

    // Fetch referrer name and referral count in parallel with other queries
    const staffAlias = db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .as("staff_alias");

    const [
      referrerResult,
      referralCountResult,
      prefsResult,
      bookingsResult,
      paymentsResult,
      serviceRecordsResult,
      loyaltyResult,
      threadsResult,
      formSubsResult,
    ] = await Promise.all([
      // Referrer name
      profileRow.referredBy
        ? db
            .select({ firstName: profiles.firstName })
            .from(profiles)
            .where(eq(profiles.id, profileRow.referredBy))
            .limit(1)
        : Promise.resolve([]),

      // Referral count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(profiles)
        .where(eq(profiles.referredBy, clientId)),

      // 2. Preferences
      db
        .select()
        .from(clientPreferences)
        .where(eq(clientPreferences.profileId, clientId))
        .limit(1),

      // 3. Bookings (with service name + staff name)
      db
        .select({
          id: bookings.id,
          serviceName: services.name,
          serviceCategory: services.category,
          status: bookings.status,
          startsAt: bookings.startsAt,
          durationMinutes: bookings.durationMinutes,
          totalInCents: bookings.totalInCents,
          discountInCents: bookings.discountInCents,
          clientNotes: bookings.clientNotes,
          staffNotes: bookings.staffNotes,
          staffFirstName: profiles.firstName,
          staffLastName: profiles.lastName,
          location: bookings.location,
        })
        .from(bookings)
        .innerJoin(services, eq(bookings.serviceId, services.id))
        .leftJoin(profiles, eq(bookings.staffId, profiles.id))
        .where(and(eq(bookings.clientId, clientId), isNull(bookings.deletedAt)))
        .orderBy(desc(bookings.startsAt)),

      // 4. Payments
      db
        .select({
          id: payments.id,
          bookingId: payments.bookingId,
          status: payments.status,
          method: payments.method,
          amountInCents: payments.amountInCents,
          tipInCents: payments.tipInCents,
          refundedInCents: payments.refundedInCents,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.clientId, clientId))
        .orderBy(desc(payments.createdAt)),

      // 5. Service records (with booking service name)
      db
        .select({
          id: serviceRecords.id,
          bookingId: serviceRecords.bookingId,
          serviceName: services.name,
          serviceCategory: services.category,
          bookingDate: bookings.startsAt,
          staffFirstName: profiles.firstName,
          staffLastName: profiles.lastName,
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
        .innerJoin(bookings, eq(serviceRecords.bookingId, bookings.id))
        .innerJoin(services, eq(bookings.serviceId, services.id))
        .leftJoin(profiles, eq(serviceRecords.staffId, profiles.id))
        .where(eq(serviceRecords.clientId, clientId))
        .orderBy(desc(serviceRecords.createdAt)),

      // 6. Loyalty transactions
      db
        .select({
          id: loyaltyTransactions.id,
          points: loyaltyTransactions.points,
          type: loyaltyTransactions.type,
          description: loyaltyTransactions.description,
          createdAt: loyaltyTransactions.createdAt,
        })
        .from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.profileId, clientId))
        .orderBy(desc(loyaltyTransactions.createdAt)),

      // 7. Message threads
      db
        .select({
          id: threads.id,
          subject: threads.subject,
          threadType: threads.threadType,
          status: threads.status,
          lastMessageAt: threads.lastMessageAt,
          messageCount: sql<number>`(
            select count(*)::int from messages m where m.thread_id = ${threads.id}
          )`,
          unreadCount: sql<number>`(
            select count(*)::int from messages m where m.thread_id = ${threads.id} and m.is_read = false
          )`,
        })
        .from(threads)
        .where(eq(threads.clientId, clientId))
        .orderBy(desc(threads.lastMessageAt)),

      // 8. Form submissions
      db
        .select({
          id: formSubmissions.id,
          formName: clientForms.name,
          formType: clientForms.type,
          formVersion: formSubmissions.formVersion,
          submittedAt: formSubmissions.submittedAt,
          data: formSubmissions.data,
        })
        .from(formSubmissions)
        .innerJoin(clientForms, eq(formSubmissions.formId, clientForms.id))
        .where(eq(formSubmissions.clientId, clientId))
        .orderBy(desc(formSubmissions.submittedAt)),
    ]);

    const referredByName = referrerResult[0]?.firstName ?? null;
    const referralCount = referralCountResult[0]?.count ?? 0;

    const profile: ClientProfile = {
      id: profileRow.id,
      firstName: profileRow.firstName ?? "",
      lastName: profileRow.lastName ?? "",
      email: profileRow.email,
      phone: profileRow.phone,
      source: profileRow.source,
      isVip: profileRow.isVip,
      lifecycleStage: profileRow.lifecycleStage,
      internalNotes: profileRow.internalNotes,
      tags: profileRow.tags,
      referredByName,
      referralCount,
      createdAt: profileRow.createdAt,
      onboardingData: profileRow.onboardingData as Record<string, unknown> | null,
    };

    const prefs = prefsResult[0] ?? null;
    const preferences: ClientPreferencesData | null = prefs
      ? {
          preferredLashStyle: prefs.preferredLashStyle,
          preferredCurlType: prefs.preferredCurlType,
          preferredLengths: prefs.preferredLengths,
          preferredDiameter: prefs.preferredDiameter,
          naturalLashNotes: prefs.naturalLashNotes,
          retentionProfile: prefs.retentionProfile,
          allergies: prefs.allergies,
          skinType: prefs.skinType,
          adhesiveSensitivity: prefs.adhesiveSensitivity,
          healthNotes: prefs.healthNotes,
          birthday: prefs.birthday,
          preferredContactMethod: prefs.preferredContactMethod,
          preferredServiceTypes: prefs.preferredServiceTypes,
          generalNotes: prefs.generalNotes,
          preferredRebookIntervalDays: prefs.preferredRebookIntervalDays,
        }
      : null;

    const loyaltyBalance = loyaltyResult.reduce((sum, r) => sum + r.points, 0);

    return {
      profile,
      preferences,
      bookings: bookingsResult.map((b) => ({
        id: b.id,
        serviceName: b.serviceName,
        serviceCategory: b.serviceCategory,
        status: b.status,
        startsAt: b.startsAt,
        durationMinutes: b.durationMinutes,
        totalInCents: b.totalInCents,
        discountInCents: b.discountInCents,
        clientNotes: b.clientNotes,
        staffNotes: b.staffNotes,
        staffName: [b.staffFirstName, b.staffLastName].filter(Boolean).join(" ") || null,
        location: b.location,
      })),
      payments: paymentsResult,
      serviceRecords: serviceRecordsResult.map((sr) => ({
        id: sr.id,
        bookingId: sr.bookingId,
        serviceName: sr.serviceName,
        serviceCategory: sr.serviceCategory,
        bookingDate: sr.bookingDate,
        staffName: [sr.staffFirstName, sr.staffLastName].filter(Boolean).join(" ") || null,
        lashMapping: sr.lashMapping,
        curlType: sr.curlType,
        diameter: sr.diameter,
        lengths: sr.lengths,
        adhesive: sr.adhesive,
        retentionNotes: sr.retentionNotes,
        productsUsed: sr.productsUsed,
        notes: sr.notes,
        reactions: sr.reactions,
        nextVisitNotes: sr.nextVisitNotes,
        createdAt: sr.createdAt,
      })),
      loyaltyTransactions: loyaltyResult,
      loyaltyBalance,
      threads: threadsResult.map((t) => ({
        ...t,
        messageCount: Number(t.messageCount),
        unreadCount: Number(t.unreadCount),
      })),
      formSubmissions: formSubsResult,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
