/**
 * actions.ts — Server actions for the Client Detail page (`/dashboard/clients/[id]`).
 *
 * ## Responsibility
 * Provides a single `getClientDetail` function that loads the full 360-degree
 * view of a client: profile, beauty preferences, booking history, payment
 * ledger, service records (lash maps, adhesive notes), loyalty transactions,
 * message threads, and signed form submissions.
 *
 * ## Consumer
 * - `app/dashboard/clients/[id]/page.tsx` — client detail page (all tabs)
 *
 * ## Query strategy
 * All eight data sections are fetched via `Promise.all` to run in parallel.
 * This avoids a waterfall of sequential queries — the page load time equals
 * the slowest single query rather than the sum of all eight.
 *
 * The profile query is run first (outside Promise.all) because a missing
 * profile means the client doesn't exist and we can short-circuit before
 * firing the remaining seven queries.
 *
 * ## Integration context
 * This file is read-only — no mutations. Data that originated from Square
 * payments or Zoho CRM syncs is already stored locally; this file only reads
 * from local tables. The `onboardingData` JSONB field may contain data
 * originally captured from public onboarding forms.
 *
 * ## Related files
 * - `app/dashboard/clients/actions.ts` — list-level queries and CRM mutations
 * - `db/schema/client-preferences.ts`  — `client_preferences` table definition
 * - `db/schema/service-records.ts`     — `service_records` table (lash mapping data)
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { and, eq, desc, sql, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  profiles,
  bookings,
  services,
  payments,
  serviceRecords,
  loyaltyTransactions,
  clientPreferences,
  clientNotes,
  threads,
  messages,
  formSubmissions,
  clientForms,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types — shapes returned to the client detail page tabs             */
/* ------------------------------------------------------------------ */

/** Core CRM profile data shown in the detail page header and "Overview" tab. */
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

/** Single booking row for the "Appointments" tab — includes joined service and staff names. */
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

/** Single payment row for the "Payments" tab — may originate from Square sync. */
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

/**
 * Service record for the "Service History" tab — captures lash-tech-specific
 * documentation (lash mapping, curl type, adhesive, retention notes) recorded
 * after each appointment. Critical for continuity across visits when a
 * different technician handles the client.
 */
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

/**
 * Beauty/health preferences — long-lived defaults vs. per-visit service records.
 * These represent the client's general preferences (e.g. "prefers C-curl"),
 * while service records capture what was actually applied at each appointment.
 */
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

/** Individual loyalty transaction for the "Loyalty" tab ledger view. */
export type ClientLoyaltyRow = {
  id: string;
  points: number;
  type: string;
  description: string | null;
  createdAt: Date;
};

/**
 * Message thread summary for the "Messages" tab. Includes correlated
 * subquery counts for total and unread messages per thread — done as
 * scalar subqueries rather than GROUP BY to avoid complicating the
 * outer query with aggregation.
 */
export type ClientThreadRow = {
  id: number;
  subject: string;
  threadType: string;
  status: string;
  lastMessageAt: Date;
  messageCount: number;
  unreadCount: number;
};

/** Signed form/waiver row for the "Forms" tab — joined with form metadata. */
export type ClientFormSubmissionRow = {
  id: number;
  formName: string;
  formType: string;
  formVersion: string | null;
  submittedAt: Date;
  data: Record<string, unknown> | null;
};

/**
 * Aggregate payload returned by `getClientDetail` — contains every section
 * the detail page needs. Delivered as a single server action response so
 * the page renders in one pass rather than streaming partial states.
 */
export type ClientDetailData = {
  profile: ClientProfile;
  preferences: ClientPreferencesData | null;
  bookings: ClientBookingRow[];
  payments: ClientPaymentRow[];
  serviceRecords: ClientServiceRecordRow[];
  loyaltyTransactions: ClientLoyaltyRow[];
  loyaltyBalance: number;
  threads: ClientThreadRow[];
  notes: ClientNoteRow[];
  pinnedNotes: ClientNoteRow[];
  formSubmissions: ClientFormSubmissionRow[];
};

/** Single note row for the "Notes & History" tab. */
export type ClientNoteRow = {
  id: number;
  type: string;
  content: string;
  isPinned: boolean;
  authorName: string;
  authorId: string;
  createdAt: Date;
};

/* ------------------------------------------------------------------ */
/*  Main query — full 360-degree client detail fetch                   */
/* ------------------------------------------------------------------ */

/**
 * Load everything the client detail page needs in a single call.
 *
 * Execution flow:
 *   1. Fetch the profile row (short-circuit to null if client doesn't exist).
 *   2. Fire 9 parallel queries via Promise.all: referrer name, referral count,
 *      preferences, bookings, payments, service records, loyalty transactions,
 *      message threads, and form submissions.
 *   3. Assemble and return the composite `ClientDetailData` payload.
 *
 * The bookings query filters out soft-deleted bookings (`deletedAt IS NULL`)
 * while payments and service records are kept regardless — a refunded payment
 * on a cancelled booking is still financially relevant.
 *
 * Staff name joins use LEFT JOIN (not INNER) because some bookings may be
 * unassigned (pending staff allocation) or the staff profile may have been
 * deactivated.
 */
export async function getClientDetail(clientId: string): Promise<ClientDetailData | null> {
  try {
    await requireAdmin();

    // Referrer subquery alias — prepared but only used if profile has a referredBy value
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

    // Staff alias for booking/service-record joins — reused across multiple queries
    const staffAlias = db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .as("staff_alias");

    // Promise.all fires 9 independent queries in parallel — referrer name,
    // referral count, preferences, bookings, payments, service records, loyalty,
    // threads, and form submissions share no data dependency. This reduces the
    // detail page load time from the sum of all queries to the slowest single one.
    // Destructuring assigns each result to a named variable for readability.
    const noteAuthor = alias(profiles, "noteAuthor");

    const [
      referrerResult,
      referralCountResult,
      prefsResult,
      bookingsResult,
      paymentsResult,
      serviceRecordsResult,
      loyaltyResult,
      threadsResult,
      notesResult,
      pinnedNotesResult,
      formSubsResult,
    ] = await Promise.all([
      // Referrer name
      // Ternary: only query the referrer's name if referredBy is set — otherwise
      // resolve to an empty array to avoid a wasted DB round-trip. This keeps
      // the referrer query inside Promise.all so it runs in parallel with the rest.
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
      db.select().from(clientPreferences).where(eq(clientPreferences.profileId, clientId)).limit(1),

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

      // 8. Client notes (all)
      db
        .select({
          id: clientNotes.id,
          type: clientNotes.type,
          content: clientNotes.content,
          isPinned: clientNotes.isPinned,
          authorId: clientNotes.authorId,
          authorFirstName: noteAuthor.firstName,
          authorLastName: noteAuthor.lastName,
          createdAt: clientNotes.createdAt,
        })
        .from(clientNotes)
        .leftJoin(noteAuthor, eq(clientNotes.authorId, noteAuthor.id))
        .where(eq(clientNotes.profileId, clientId))
        .orderBy(desc(clientNotes.createdAt)),

      // 9. Pinned notes only (for profile header banner)
      db
        .select({
          id: clientNotes.id,
          type: clientNotes.type,
          content: clientNotes.content,
          isPinned: clientNotes.isPinned,
          authorId: clientNotes.authorId,
          authorFirstName: noteAuthor.firstName,
          authorLastName: noteAuthor.lastName,
          createdAt: clientNotes.createdAt,
        })
        .from(clientNotes)
        .leftJoin(noteAuthor, eq(clientNotes.authorId, noteAuthor.id))
        .where(and(eq(clientNotes.profileId, clientId), eq(clientNotes.isPinned, true)))
        .orderBy(desc(clientNotes.createdAt)),

      // 10. Form submissions
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
    // Ternary: if a preferences row exists, map it into the ClientPreferencesData
    // shape; otherwise return null. The 1:1 table may not have a row yet if the
    // client hasn't saved beauty preferences.
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

    // Compute balance client-side by summing all transaction points (credits are
    // positive, redemptions are negative) — avoids a separate aggregate query.
    // .reduce() sums all loyalty transaction points (credits positive, redemptions
    // negative) to compute the current balance — avoids a separate SQL aggregate query.
    const loyaltyBalance = loyaltyResult.reduce((sum, r) => sum + r.points, 0);

    return {
      profile,
      preferences,
      // .map() transforms each booking DB row into a ClientBookingRow, building
      // the staff display name from separate first/last columns via .filter(Boolean)
      // to handle null names from the LEFT JOIN (unassigned or deactivated staff).
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
      // .map() transforms each service record DB row into a ClientServiceRecordRow,
      // building staff name the same way as bookings above — .filter(Boolean)
      // handles null name parts from the LEFT JOIN on the staff profile.
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
      // .map() with spread copies all thread fields, then overrides messageCount
      // and unreadCount with Number() — the scalar subqueries return string types
      // from Postgres that need coercion to numbers for the TypeScript interface.
      threads: threadsResult.map((t) => ({
        ...t,
        messageCount: Number(t.messageCount),
        unreadCount: Number(t.unreadCount),
      })),
      notes: notesResult.map((n) => ({
        id: n.id,
        type: n.type,
        content: n.content,
        isPinned: n.isPinned,
        authorId: n.authorId,
        authorName: [n.authorFirstName, n.authorLastName].filter(Boolean).join(" ") || "System",
        createdAt: n.createdAt,
      })),
      pinnedNotes: pinnedNotesResult.map((n) => ({
        id: n.id,
        type: n.type,
        content: n.content,
        isPinned: n.isPinned,
        authorId: n.authorId,
        authorName: [n.authorFirstName, n.authorLastName].filter(Boolean).join(" ") || "System",
        createdAt: n.createdAt,
      })),
      formSubmissions: formSubsResult,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
