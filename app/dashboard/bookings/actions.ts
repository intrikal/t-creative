/**
 * app/dashboard/bookings/actions.ts — Server actions for the Bookings dashboard.
 *
 * ## Responsibility
 * Provides all data access and mutation operations needed by `BookingsPage`:
 * - `getBookings`            — Joined query: bookings + client profile + service + staff.
 * - `updateBookingStatus`    — Status machine transition (confirmed → completed, etc.).
 * - `createBooking`          — Admin-created booking with a "confirmed" initial status.
 * - `getClientsForSelect`    — Client dropdown options for the create-booking dialog.
 * - `getServicesForSelect`   — Service dropdown options (active services only).
 * - `getStaffForSelect`      — Staff dropdown options (any non-client profile).
 * - `updateBooking`          — Full update (reschedule detection + email).
 * - `deleteBooking`          — Soft-delete (sets `deletedAt`, never hard-deletes).
 * - `cancelBookingSeries`    — Cancels all future bookings in a recurring series.
 * - `getAssistantBookings`   — Staff-scoped view for the assistant dashboard.
 *
 * ## Side-effects on status change
 * Each status transition triggers a cascade of non-fatal side-effects:
 *   confirmed  → Square order, confirmation email/SMS, deposit link, Zoho deal + invoice
 *   completed  → thank-you email, next recurring booking generation, Zoho "Closed Won"
 *   cancelled  → late-cancel fee, cancellation email, waitlist notification, Zoho "Closed Lost"
 *   no_show    → no-show fee (card charge or invoice), no-show email
 *
 * All side-effects are wrapped in try/catch so they never block the status write.
 *
 * ## Integration summary
 * - **Square**: Order creation for POS payment matching, payment links for deposits,
 *   card-on-file charges for no-show/late-cancel fees. Webhooks (separate file) handle
 *   inbound payment confirmations — this file only does outbound calls.
 * - **Zoho CRM**: Deal creation/stage updates mirror the booking lifecycle.
 * - **Zoho Books**: Invoice creation on confirmation for accounting reconciliation.
 * - **Resend**: Transactional emails (confirmation, reschedule, cancellation, etc.).
 * - **Twilio**: SMS confirmation when client has `notifySms` enabled.
 *
 * ## Join pattern (alias)
 * `getBookings` joins the `profiles` table twice — once for the client and once
 * for the staff member. Drizzle requires `alias()` from `drizzle-orm/pg-core` to
 * disambiguate the two joins to the same table:
 *
 *   const clientProfile = alias(profiles, "client");
 *   const staffProfile  = alias(profiles, "staff");
 *
 * This generates `profiles AS client` and `profiles AS staff` in the SQL query.
 *
 * ## Type exports
 * - `BookingStatus` — Union of all valid booking status strings.
 * - `BookingRow`    — Flat joined row type consumed by BookingsPage.
 * - `BookingInput`  — Input shape for `createBooking`.
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, ne, and, sql, inArray, isNull, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getPolicies, getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import {
  bookings,
  bookingAddOns,
  bookingSubscriptions,
  invoices,
  notifications,
  payments,
  profiles,
  services,
  syncLog,
  timeOff,
} from "@/db/schema";
import { BookingCancellation } from "@/emails/BookingCancellation";
import { BookingCompleted } from "@/emails/BookingCompleted";
import { BookingConfirmation } from "@/emails/BookingConfirmation";
import { BookingNoShow } from "@/emails/BookingNoShow";
import { BookingReschedule } from "@/emails/BookingReschedule";
import { NoShowFeeCharged } from "@/emails/NoShowFeeCharged";
import { NoShowFeeInvoice } from "@/emails/NoShowFeeInvoice";
import { PaymentLinkEmail } from "@/emails/PaymentLinkEmail";
import { RecurringBookingConfirmation } from "@/emails/RecurringBookingConfirmation";
import { logAction } from "@/lib/audit";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { getEmailRecipient, sendEmail } from "@/lib/resend";
import {
  isSquareConfigured,
  createSquareOrder,
  createSquarePaymentLink,
  getSquareCardOnFile,
  chargeCardOnFile,
} from "@/lib/square";
import { sendSms } from "@/lib/twilio";
import { notifyWaitlistForCancelledBooking } from "@/lib/waitlist-notify";
import { createZohoDeal, updateZohoDeal } from "@/lib/zoho";
import { createZohoBooksInvoice } from "@/lib/zoho-books";
import { createAdminClient } from "@/utils/supabase/admin";

/* ------------------------------------------------------------------ */
/*  Type exports                                                       */
/* ------------------------------------------------------------------ */

/** Union of valid booking lifecycle states. Mirrors bookingStatusEnum in db/schema/enums. */
export type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";

/**
 * Flat joined row returned by `getBookings`. Consumed by `BookingsPage` and
 * its sub-components (table, calendar, detail drawer). Intentionally flat
 * (no nested objects) so it serializes cleanly across the server-action boundary.
 */
export type BookingRow = {
  id: number;
  status: string;
  startsAt: Date;
  durationMinutes: number;
  totalInCents: number;
  location: string | null;
  clientNotes: string | null;
  clientId: string;
  clientFirstName: string;
  clientLastName: string | null;
  clientPhone: string | null;
  serviceId: number;
  serviceName: string;
  serviceCategory: string;
  staffId: string | null;
  staffFirstName: string | null;
  recurrenceRule: string | null;
  parentBookingId: number | null;
};

/**
 * Input shape for `createBooking` / `updateBooking`. The admin create-booking
 * dialog and edit-booking form both produce this shape. Fields map 1:1 to
 * the bookings table columns (no transforms needed).
 */
export type BookingInput = {
  clientId: string;
  serviceId: number;
  staffId: string | null;
  startsAt: Date;
  durationMinutes: number;
  totalInCents: number;
  location?: string;
  clientNotes?: string;
  recurrenceRule?: string;
  subscriptionId?: number;
};

/** Alias for readability — all mutations in this file require admin access. */
const getUser = requireAdmin;

/**
 * Checks whether a staff member already has a confirmed/in_progress booking
 * that overlaps with the given time range. Returns true if a conflict exists.
 */
async function hasOverlappingBooking(
  staffId: string,
  startsAt: Date,
  durationMinutes: number,
  excludeBookingId?: number,
): Promise<boolean> {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  // Standard interval-overlap test: two time ranges [A, B) and [C, D) overlap
  // iff A < D AND C < B. Here A=existing.startsAt, B=existing end (computed
  // via interval arithmetic), C=proposed startsAt, D=proposed endsAt.
  const conditions = [
    eq(bookings.staffId, staffId),
    inArray(bookings.status, ["confirmed", "in_progress"]),
    sql`${bookings.startsAt} < ${endsAt}`,
    sql`${bookings.startsAt} + (${bookings.durationMinutes} || ' minutes')::interval > ${startsAt}`,
  ];

  if (excludeBookingId !== undefined) {
    conditions.push(ne(bookings.id, excludeBookingId));
  }

  conditions.push(isNull(bookings.deletedAt));

  // ─── Query: check for overlapping bookings ───────────────────────
  // SELECT: fetches only the "id" column from the "bookings" table — we don't
  //   need any other data, just proof that at least one conflicting row exists.
  // FROM: the "bookings" table (all appointments in the system).
  // WHERE (all conditions must be true simultaneously):
  //   - staffId = the staff member we're checking — only their bookings matter.
  //   - status IN ('confirmed', 'in_progress') — only active bookings can conflict;
  //     cancelled/completed/no_show bookings don't occupy a time slot.
  //   - sql`startsAt < endsAt` — the existing booking must start before the
  //     proposed booking ends (first half of the overlap test).
  //   - sql`startsAt + durationMinutes::interval > startsAt` — the existing
  //     booking must end after the proposed booking starts (second half). The
  //     sql`` template literal computes the existing booking's end time by adding
  //     its durationMinutes as a Postgres interval to its startsAt.
  //   - ne(id, excludeBookingId) — when editing, exclude the booking being edited
  //     so it doesn't conflict with itself.
  //   - isNull(deletedAt) — ignore soft-deleted bookings.
  // LIMIT 1: we only need to know if ANY conflict exists, so stop after the
  //   first match for efficiency.
  const conflicts = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...conditions))
    .limit(1);

  return conflicts.length > 0;
}

/**
 * Checks whether a staff member has approved time-off that overlaps the
 * proposed booking window.
 *
 * Full-day entries block any booking whose date overlaps the time-off range.
 * Partial-day entries (stored in notes.partial) additionally check that the
 * time ranges overlap on the same date.
 */
async function hasApprovedTimeOffConflict(
  staffId: string,
  startsAt: Date,
  durationMinutes: number,
): Promise<boolean> {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  // Represent the booking span as date strings for comparison with date columns.
  // Using UTC split is consistent with how dates are stored (YYYY-MM-DD).
  const bookingStartDate = startsAt.toISOString().split("T")[0];
  const bookingEndDate = endsAt.toISOString().split("T")[0];

  // Fetch approved time-off entries whose date range overlaps the booking dates.
  // Two ranges [A,B] and [C,D] overlap iff A <= D and C <= B.
  const entries = await db
    .select({
      id: timeOff.id,
      startDate: timeOff.startDate,
      endDate: timeOff.endDate,
      notes: timeOff.notes,
    })
    .from(timeOff)
    .where(
      and(
        eq(timeOff.staffId, staffId),
        lte(timeOff.startDate, bookingEndDate),
        gte(timeOff.endDate, bookingStartDate),
      ),
    );

  for (const entry of entries) {
    let status = "pending";
    let partial: { startTime: string; endTime: string } | false = false;

    if (entry.notes) {
      try {
        const meta = JSON.parse(entry.notes) as {
          status?: string;
          partial?: { startTime: string; endTime: string } | false;
        };
        status = meta.status ?? "pending";
        partial = meta.partial ?? false;
      } catch {
        // plain text notes — treat as pending
      }
    }

    if (status !== "approved") continue;

    if (!partial) {
      // Full-day time-off: date range overlap is sufficient to block
      return true;
    }

    // Partial-day: verify the time ranges also overlap
    const [startHour, startMin] = partial.startTime.split(":").map(Number);
    const [endHour, endMin] = partial.endTime.split(":").map(Number);

    const bookingDateOnly = new Date(startsAt);
    bookingDateOnly.setHours(0, 0, 0, 0);

    const timeOffStart = new Date(bookingDateOnly);
    timeOffStart.setHours(startHour, startMin, 0, 0);

    const timeOffEnd = new Date(bookingDateOnly);
    timeOffEnd.setHours(endHour, endMin, 0, 0);

    if (startsAt < timeOffEnd && endsAt > timeOffStart) {
      return true;
    }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export type PaginatedBookings = {
  rows: BookingRow[];
  hasMore: boolean;
};

const DEFAULT_BOOKINGS_LIMIT = 100;

/**
 * Fetches paginated bookings for the admin BookingsPage.
 *
 * Uses limit+1 pattern: fetches one extra row to determine `hasMore`
 * without a separate COUNT query, then slices it off before returning.
 *
 * Joins profiles twice (client + staff) via alias() — see file-level doc.
 * Soft-deleted bookings (deletedAt != null) are always excluded.
 */
export async function getBookings(opts?: {
  offset?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<PaginatedBookings> {
  try {
    await getUser();

    const limit = opts?.limit ?? DEFAULT_BOOKINGS_LIMIT;
    const offset = opts?.offset ?? 0;

    const conditions = [isNull(bookings.deletedAt)];
    if (opts?.startDate) conditions.push(gte(bookings.startsAt, opts.startDate));
    if (opts?.endDate) conditions.push(lte(bookings.startsAt, opts.endDate));

    // alias() creates a second reference to the same "profiles" table under a
    // different name. We need two aliases because a booking references profiles
    // twice: once for the client and once for the staff member. Without aliases,
    // Postgres wouldn't know which profiles row to use for each join.
    // In SQL this generates: "profiles AS client" and "profiles AS staff".
    const clientProfile = alias(profiles, "client");
    const staffProfile = alias(profiles, "staff");

    // ─── Query: fetch paginated bookings with client, service, and staff ───
    // SELECT: fetches booking fields (id, status, startsAt, durationMinutes,
    //   totalInCents, location, clientNotes, clientId, serviceId, staffId,
    //   recurrenceRule, parentBookingId) from the "bookings" table, plus the
    //   client's name and phone from the client alias of "profiles", the
    //   service name and category from the "services" table, and the staff
    //   member's first name from the staff alias of "profiles".
    // FROM: the "bookings" table (all appointments).
    // LEFT JOIN clientProfile: connects each booking to the client's profile
    //   row by matching bookings.clientId → profiles.id. LEFT JOIN (not INNER)
    //   because we still want to show the booking even if the client profile
    //   was deleted or is missing.
    // LEFT JOIN services: connects each booking to its service row by matching
    //   bookings.serviceId → services.id. LEFT JOIN so bookings still appear
    //   even if a service was deactivated/deleted.
    // LEFT JOIN staffProfile: connects each booking to the assigned staff
    //   member's profile by matching bookings.staffId → profiles.id. LEFT JOIN
    //   because staffId is nullable (some bookings have no assigned staff).
    // WHERE:
    //   - isNull(deletedAt) — excludes soft-deleted bookings.
    //   - gte(startsAt, startDate) — if provided, only bookings on or after
    //     this date (for date-range filtering).
    //   - lte(startsAt, endDate) — if provided, only bookings on or before
    //     this date (for date-range filtering).
    // ORDER BY startsAt DESC: newest bookings appear first.
    // LIMIT (limit + 1): fetches one extra row beyond the requested page size.
    //   If we get that extra row back, we know there are more pages. The extra
    //   row is sliced off before returning to the caller.
    // OFFSET: skips rows for pagination (e.g. offset=100 skips the first 100).
    const rows = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        location: bookings.location,
        clientNotes: bookings.clientNotes,
        clientId: bookings.clientId,
        clientFirstName: clientProfile.firstName,
        clientLastName: clientProfile.lastName,
        clientPhone: clientProfile.phone,
        serviceId: bookings.serviceId,
        serviceName: services.name,
        serviceCategory: services.category,
        staffId: bookings.staffId,
        staffFirstName: staffProfile.firstName,
        recurrenceRule: bookings.recurrenceRule,
        parentBookingId: bookings.parentBookingId,
      })
      .from(bookings)
      .where(and(...conditions))
      .leftJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
      .orderBy(desc(bookings.startsAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      // Spread each row and override nullable join fields with fallback defaults.
      // Spread is preferred over manual field listing because the row has 15+
      // fields — spread copies them all, then the 3 overrides replace just the
      // nullable ones. This avoids a fragile, long-form object literal.
      rows: page.map((r) => ({
        ...r,
        clientFirstName: r.clientFirstName ?? "",
        serviceName: r.serviceName ?? "",
        serviceCategory: r.serviceCategory ?? "lash",
      })),
      hasMore,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

import { checkBookingWaivers } from "./waiver-actions";

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Transitions a booking to a new status and fires all associated side-effects.
 *
 * Status-specific side-effects (all non-fatal):
 *   confirmed  → waiver gate, Square order, email/SMS, deposit link, Zoho sync
 *   completed  → email, recurring-booking generation, Zoho "Closed Won"
 *   cancelled  → late-cancel fee, email, waitlist notify, Zoho "Closed Lost"
 *   no_show    → no-show fee (card or invoice), email
 *
 * Called by the status dropdown in the BookingsPage detail drawer.
 * `revalidatePath` at the end tells Next.js to re-fetch the bookings list.
 */
export async function updateBookingStatus(
  id: number,
  status: BookingStatus,
  cancellationReason?: string,
  skipWaiverCheck?: boolean,
): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    z.enum(["completed", "in_progress", "confirmed", "pending", "cancelled", "no_show"]).parse(
      status,
    );
    const user = await getUser();

    // Gate: waivers must be signed before moving to "confirmed".
    // skipWaiverCheck is true when the waiver dialog already confirmed completion.
    if (status === "confirmed" && !skipWaiverCheck) {
      const waiverResult = await checkBookingWaivers(id);
      if (!waiverResult.passed) {
        // Extract just the form names from the missing-waiver objects for display.
        // .map() → .join() is the standard pattern for building a comma-separated
        // label from an array of objects.
        const names = waiverResult.missing.map((w) => w.formName).join(", ");
        // Structured error string: the UI parses the WAIVER_REQUIRED prefix
        // to show the waiver completion dialog instead of a generic error toast.
        throw new Error(
          `WAIVER_REQUIRED:${JSON.stringify(waiverResult.missing)}:Client must complete required waivers before confirmation: ${names}`,
        );
      }
    }

    // Stamp lifecycle timestamps alongside the status change so the
    // timeline view can show exactly when each transition occurred.
    const updates: Record<string, unknown> = { status };

    if (status === "confirmed") updates.confirmedAt = new Date();
    if (status === "completed") updates.completedAt = new Date();
    if (status === "cancelled") {
      updates.cancelledAt = new Date();
      if (cancellationReason) updates.cancellationReason = cancellationReason;
    }

    // ─── Mutation: update the booking's status (and lifecycle timestamp) ───
    // UPDATE: writes the new status and any associated timestamp (confirmedAt,
    //   completedAt, or cancelledAt) to the "bookings" table.
    // WHERE: id = the booking being transitioned — targets this exact row.
    await db.update(bookings).set(updates).where(eq(bookings.id, id));

    // Create Square order when confirming (if not already created)
    if (status === "confirmed") {
      // ─── Query: fetch booking details needed for Square order creation ───
      // SELECT: fetches squareOrderId (to check if an order already exists),
      //   serviceId (to look up the service name for the order line item),
      //   and totalInCents (the charge amount) from the "bookings" table.
      // FROM: the "bookings" table.
      // WHERE:
      //   - id = the booking being confirmed — targets this exact booking.
      //   - isNull(deletedAt) — ensures we don't process soft-deleted bookings.
      const [booking] = await db
        .select({
          squareOrderId: bookings.squareOrderId,
          serviceId: bookings.serviceId,
          totalInCents: bookings.totalInCents,
        })
        .from(bookings)
        .where(and(eq(bookings.id, id), isNull(bookings.deletedAt)));

      if (booking && !booking.squareOrderId) {
        await tryCreateSquareOrder(id, booking.serviceId, booking.totalInCents);
      }

      // Send booking confirmation email
      await trySendBookingConfirmation(id);

      // Auto-send deposit payment link if the service requires one
      await tryAutoSendDepositLink(id);
    }

    if (status === "cancelled") {
      await tryEnforceLateCancelFee(id);
      await trySendBookingStatusEmail(id, "cancelled", cancellationReason);
      await tryNotifyWaitlist(id);
    }

    if (status === "completed") {
      await trySendBookingStatusEmail(id, "completed");
      await generateNextRecurringBooking(id);
    }

    if (status === "no_show") {
      await tryEnforceNoShowFee(id);
      await trySendBookingStatusEmail(id, "no_show");
    }

    trackEvent(id.toString(), "booking_status_changed", {
      bookingId: id,
      newStatus: status,
      ...(cancellationReason ? { cancellationReason } : {}),
    });

    await logAction({
      actorId: user.id,
      action: "status_change",
      entityType: "booking",
      entityId: String(id),
      description: `Booking status changed to ${status}`,
      metadata: { newStatus: status, ...(cancellationReason ? { cancellationReason } : {}) },
    });

    // Zoho CRM: mirror booking lifecycle as deal stages.
    // These calls are fire-and-forget (not awaited) — Zoho sync failures
    // are logged in syncLog but never block the user-facing status change.
    if (status === "completed") {
      updateZohoDeal(id, "Closed Won");
    } else if (status === "cancelled") {
      updateZohoDeal(id, "Closed Lost");
    } else if (status === "confirmed") {
      updateZohoDeal(id, "Confirmed");
      // Zoho Books: create invoice so accounting has the line item immediately
      tryCreateZohoBooksInvoice(id);
    }

    // Bust the Next.js cache so the bookings list reflects the new status
    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Zod schema for createBooking input — validates before any DB writes. */
const bookingInputSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.number().int().positive(),
  staffId: z.string().min(1).nullable(),
  startsAt: z.date(),
  durationMinutes: z.number().int().positive(),
  totalInCents: z.number().int().nonnegative(),
  location: z.string().optional(),
  clientNotes: z.string().optional(),
  recurrenceRule: z.string().optional(),
  subscriptionId: z.number().int().positive().optional(),
});

/**
 * Creates a new booking as "confirmed" (admin-created bookings skip "pending").
 *
 * After insert: creates Square order, sends confirmation email, auto-sends
 * deposit link if the service requires one, and creates a Zoho deal + invoice.
 * Called by the "New Booking" dialog on BookingsPage.
 */
export async function createBooking(input: BookingInput): Promise<void> {
  try {
    bookingInputSchema.parse(input);
    const user = await getUser();

    if (input.staffId) {
      const conflict = await hasOverlappingBooking(
        input.staffId,
        input.startsAt,
        input.durationMinutes,
      );
      if (conflict) {
        throw new Error("This staff member already has a booking during that time slot");
      }

      const timeOffConflict = await hasApprovedTimeOffConflict(
        input.staffId,
        input.startsAt,
        input.durationMinutes,
      );
      if (timeOffConflict) {
        throw new Error("This staff member has approved time off during that time slot");
      }
    }

    const [newBooking] = await db
      .insert(bookings)
      .values({
        clientId: input.clientId,
        serviceId: input.serviceId,
        staffId: input.staffId ?? undefined,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        totalInCents: input.totalInCents,
        location: input.location ?? undefined,
        clientNotes: input.clientNotes ?? undefined,
        recurrenceRule: input.recurrenceRule ?? undefined,
        subscriptionId: input.subscriptionId ?? undefined,
        // Admin-created bookings start as "confirmed" — the pending→confirmed
        // flow only applies to client self-booking (handled by a separate action).
        status: "confirmed",
        confirmedAt: new Date(),
      })
      .returning({ id: bookings.id });

    // Create Square order for POS payment matching
    await tryCreateSquareOrder(newBooking.id, input.serviceId, input.totalInCents);

    // Send booking confirmation email
    await trySendBookingConfirmation(newBooking.id);

    // Auto-send deposit payment link if the service requires one
    await tryAutoSendDepositLink(newBooking.id);

    trackEvent(input.clientId, "booking_created", {
      bookingId: newBooking.id,
      serviceId: input.serviceId,
      totalInCents: input.totalInCents,
      location: input.location ?? null,
    });

    await logAction({
      actorId: user.id,
      action: "create",
      entityType: "booking",
      entityId: String(newBooking.id),
      description: "Booking created",
      metadata: {
        clientId: input.clientId,
        serviceId: input.serviceId,
        totalInCents: input.totalInCents,
      },
    });

    // Zoho CRM: create a deal so the sales pipeline reflects this booking.
    // Requires a separate client + service lookup because createZohoDeal needs
    // the contact email and a human-readable deal name.

    // ─── Query: fetch client email and name for the Zoho deal ───────────
    // SELECT: fetches "email" (for the Zoho contact lookup) and "firstName"
    //   (for building the deal name like "Lash Fill — Sarah") from "profiles".
    // FROM: the "profiles" table (all user accounts — clients, staff, admins).
    // WHERE: id = the client who booked — targets this specific client's row.
    // LIMIT 1: only one profile can match this id (it's a primary key), but
    //   limit 1 makes the intent explicit and helps Postgres optimize.
    const [clientForZoho] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, input.clientId))
      .limit(1);

    // ─── Query: fetch service name for the Zoho deal title ──────────────
    // SELECT: fetches only the "name" column (e.g. "Classic Full Set") from
    //   the "services" table, used to build the Zoho deal name.
    // FROM: the "services" table (the catalog of offered services).
    // WHERE: id = the service booked — targets this specific service.
    // LIMIT 1: same rationale as above — primary key lookup.
    const [serviceForZoho] = await db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.id, input.serviceId))
      .limit(1);

    if (clientForZoho) {
      createZohoDeal({
        contactEmail: clientForZoho.email,
        dealName: `${serviceForZoho?.name ?? "Appointment"} — ${clientForZoho.firstName}`,
        stage: "Confirmed",
        amountInCents: input.totalInCents,
        bookingId: newBooking.id,
      });

      // Zoho Books: create invoice for admin-created booking
      createZohoBooksInvoice({
        entityType: "booking",
        entityId: newBooking.id,
        profileId: input.clientId,
        email: clientForZoho.email,
        firstName: clientForZoho.firstName,
        lineItems: [
          {
            name: serviceForZoho?.name ?? "Appointment",
            rate: input.totalInCents,
            quantity: 1,
          },
        ],
      });
    }

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Extends the create schema with status — updateBooking can also change status. */
const updateBookingInputSchema = bookingInputSchema.extend({
  status: z.enum(["completed", "in_progress", "confirmed", "pending", "cancelled", "no_show"]),
});

/**
 * Full update of a booking's fields (reschedule, reassign staff, change price, etc.).
 *
 * Detects reschedules by comparing old vs new startsAt and sends a reschedule
 * email when the time changes. Called by the edit-booking form in the detail drawer.
 * Overlap checking is skipped for cancelled/no_show bookings since those don't
 * occupy a time slot.
 */
export async function updateBooking(
  id: number,
  input: BookingInput & { status: BookingStatus },
): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    updateBookingInputSchema.parse(input);
    const user = await getUser();

    // Skip overlap check for terminal statuses — cancelled/no_show bookings
    // don't occupy a time slot and shouldn't block scheduling.
    if (input.staffId && input.status !== "cancelled" && input.status !== "no_show") {
      const conflict = await hasOverlappingBooking(
        input.staffId,
        input.startsAt,
        input.durationMinutes,
        id,
      );
      if (conflict) {
        throw new Error("This staff member already has a booking during that time slot");
      }

      const timeOffConflict = await hasApprovedTimeOffConflict(
        input.staffId,
        input.startsAt,
        input.durationMinutes,
      );
      if (timeOffConflict) {
        throw new Error("This staff member has approved time off during that time slot");
      }
    }

    // ─── Query: fetch the booking's current start time to detect reschedule ───
    // SELECT: fetches only "startsAt" from the "bookings" table — the current
    //   appointment time, so we can compare it to the new time and know whether
    //   to send a reschedule notification email.
    // FROM: the "bookings" table.
    // WHERE:
    //   - id = the booking being updated — targets this exact row.
    //   - isNull(deletedAt) — ensures we don't update a soft-deleted booking.
    const [oldBooking] = await db
      .select({ startsAt: bookings.startsAt })
      .from(bookings)
      .where(and(eq(bookings.id, id), isNull(bookings.deletedAt)));

    const updates: Record<string, unknown> = {
      clientId: input.clientId,
      serviceId: input.serviceId,
      staffId: input.staffId ?? undefined,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      totalInCents: input.totalInCents,
      location: input.location ?? undefined,
      clientNotes: input.clientNotes ?? undefined,
      recurrenceRule: input.recurrenceRule ?? null,
      status: input.status,
    };

    if (input.status === "confirmed") updates.confirmedAt = new Date();
    if (input.status === "completed") updates.completedAt = new Date();
    if (input.status === "cancelled") updates.cancelledAt = new Date();

    await db.update(bookings).set(updates).where(eq(bookings.id, id));

    // Send reschedule email if time changed
    if (oldBooking && oldBooking.startsAt.getTime() !== input.startsAt.getTime()) {
      await trySendBookingReschedule(id, oldBooking.startsAt);
    }

    await logAction({
      actorId: user.id,
      action: "update",
      entityType: "booking",
      entityId: String(id),
      description: "Booking updated",
      metadata: {
        clientId: input.clientId,
        serviceId: input.serviceId,
        status: input.status,
        ...(oldBooking && oldBooking.startsAt.getTime() !== input.startsAt.getTime()
          ? {
              rescheduled: {
                old: oldBooking.startsAt.toISOString(),
                new: input.startsAt.toISOString(),
              },
            }
          : {}),
      },
    });

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Soft-deletes a booking by setting `deletedAt`. All queries in this file
 * filter on `isNull(bookings.deletedAt)`, so the row becomes invisible
 * without losing data for audit/reporting. Called by the delete action in
 * the booking detail drawer.
 */
export async function deleteBooking(id: number): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    const user = await getUser();
    await db.update(bookings).set({ deletedAt: new Date() }).where(eq(bookings.id, id));

    await logAction({
      actorId: user.id,
      action: "delete",
      entityType: "booking",
      entityId: String(id),
      description: "Booking soft-deleted",
    });

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Recurring bookings — auto-generate next appointment                */
/* ------------------------------------------------------------------ */

/**
 * Parses a simple iCal RRULE. Supports FREQ=WEEKLY/MONTHLY with INTERVAL, UNTIL, and COUNT.
 */
function parseRRule(rule: string): {
  days?: number;
  months?: number;
  until?: Date;
  count?: number;
} | null {
  // Parse the iCal RRULE string into a key-value record.
  // Object.fromEntries converts [key, value] tuples into an object — cleaner
  // than a reduce for building a simple string→string lookup. The split→map→split
  // chain handles "FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231T000000Z" in one expression.
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=")));
  const freq = parts.FREQ;
  const interval = Number(parts.INTERVAL ?? 1);
  if (!freq || isNaN(interval)) return null;

  let days: number | undefined;
  let months: number | undefined;
  if (freq === "WEEKLY") days = interval * 7;
  else if (freq === "MONTHLY") months = interval;
  else return null;

  // Parse UNTIL=YYYYMMDDTHHMMSSZ
  let until: Date | undefined;
  if (parts.UNTIL) {
    const u = parts.UNTIL;
    until = new Date(
      Date.UTC(parseInt(u.slice(0, 4)), parseInt(u.slice(4, 6)) - 1, parseInt(u.slice(6, 8))),
    );
  }

  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : undefined;
  return { days, months, until, count };
}

/**
 * After a recurring booking is completed, generates the next booking
 * in the series with the same service, client, staff, duration, price,
 * and recurrence rule. The new booking links back via parentBookingId.
 */
async function generateNextRecurringBooking(bookingId: number): Promise<void> {
  try {
    // ─── Query: fetch the just-completed booking to clone it for the next occurrence ───
    // SELECT: fetches all fields needed to create a copy of this booking —
    //   clientId (who the appointment is for), serviceId (what service),
    //   staffId (which staff member), startsAt (current time, to calculate
    //   the next date), durationMinutes and totalInCents (copied as-is),
    //   location (where the appointment happens), recurrenceRule (the iCal
    //   RRULE string that defines the repeat pattern), parentBookingId (the
    //   series root, so the new booking links to the same series), and
    //   subscriptionId (if this is part of a pre-paid session package).
    // FROM: the "bookings" table.
    // WHERE:
    //   - id = the booking that was just completed — we clone its details.
    //   - isNull(deletedAt) — skip if the booking was soft-deleted.
    const [booking] = await db
      .select({
        clientId: bookings.clientId,
        serviceId: bookings.serviceId,
        staffId: bookings.staffId,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        location: bookings.location,
        recurrenceRule: bookings.recurrenceRule,
        parentBookingId: bookings.parentBookingId,
        subscriptionId: bookings.subscriptionId,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!booking) return;

    const nextStart = new Date(booking.startsAt);

    // ── Subscription path ───────────────────────────────────────────
    // Pre-paid session packages (e.g. "6-pack lash fills") track sessionsUsed.
    // When all sessions are consumed, the subscription is marked "completed"
    // and no further bookings are generated.
    if (booking.subscriptionId) {
      // ─── Query: fetch the subscription to check remaining sessions ────
      // SELECT *: fetches all columns from "bookingSubscriptions" — we need
      //   sessionsUsed, totalSessions (to check if the package is exhausted),
      //   intervalDays (to calculate the next booking date), status (to verify
      //   the subscription is still active), and id (to update it).
      // FROM: the "bookingSubscriptions" table (pre-paid session packages).
      // WHERE: id = the subscription linked to this booking — targets this
      //   specific package.
      // LIMIT 1: primary key lookup, but makes intent explicit.
      const [sub] = await db
        .select()
        .from(bookingSubscriptions)
        .where(eq(bookingSubscriptions.id, booking.subscriptionId))
        .limit(1);

      if (!sub || sub.status !== "active") return;

      const newSessionsUsed = sub.sessionsUsed + 1;

      // Package exhausted — mark complete, don't schedule next
      if (newSessionsUsed >= sub.totalSessions) {
        await db
          .update(bookingSubscriptions)
          .set({ sessionsUsed: newSessionsUsed, status: "completed" })
          .where(eq(bookingSubscriptions.id, sub.id));
        return;
      }

      // Increment sessions used
      await db
        .update(bookingSubscriptions)
        .set({ sessionsUsed: newSessionsUsed })
        .where(eq(bookingSubscriptions.id, sub.id));

      nextStart.setDate(nextStart.getDate() + sub.intervalDays);

      // parentBookingId always points at the first booking in the series,
      // creating a flat fan-out (root → child, root → child) rather than a chain.
      const seriesRoot = booking.parentBookingId ?? bookingId;
      const [newBooking] = await db
        .insert(bookings)
        .values({
          clientId: booking.clientId,
          serviceId: booking.serviceId,
          staffId: booking.staffId ?? undefined,
          startsAt: nextStart,
          durationMinutes: booking.durationMinutes,
          totalInCents: booking.totalInCents,
          location: booking.location ?? undefined,
          recurrenceRule: booking.recurrenceRule ?? undefined,
          parentBookingId: seriesRoot,
          subscriptionId: sub.id,
          status: "confirmed",
          confirmedAt: new Date(),
        })
        .returning({ id: bookings.id });

      // Send confirmation email for the subscription's next booking
      try {
        // alias() creates a reference to the "profiles" table under the name
        // "recurClient" so it doesn't collide with any other profiles reference
        // in the same scope. In SQL: "profiles AS recurClient".
        const recurClient = alias(profiles, "recurClient");

        // ─── Query: fetch client email + service name for the confirmation email ───
        // SELECT: fetches the client's email (where to send), firstName (for
        //   the greeting), notifyEmail (whether they opted in to emails), and
        //   the service name (for the email subject line and body).
        // FROM: the "bookings" table (starting point for the joins).
        // INNER JOIN recurClient (profiles AS recurClient): connects the booking
        //   to the client's profile by matching bookings.clientId → profiles.id.
        //   INNER JOIN (not LEFT) because we need the email — if the profile
        //   doesn't exist, there's nobody to email, so we skip the row entirely.
        // INNER JOIN services: connects the booking to its service by matching
        //   bookings.serviceId → services.id. INNER because we need the service
        //   name for the email — missing service means we can't send a useful email.
        // WHERE:
        //   - id = the newly created booking — targets the just-inserted row.
        //   - isNull(deletedAt) — safety check against soft-deleted rows.
        const [row] = await db
          .select({
            clientEmail: recurClient.email,
            clientFirstName: recurClient.firstName,
            notifyEmail: recurClient.notifyEmail,
            serviceName: services.name,
          })
          .from(bookings)
          .innerJoin(recurClient, eq(bookings.clientId, recurClient.id))
          .innerJoin(services, eq(bookings.serviceId, services.id))
          .where(and(eq(bookings.id, newBooking.id), isNull(bookings.deletedAt)));

        // Only email clients who have notifications enabled — respect opt-out.
        if (row?.clientEmail && row.notifyEmail) {
          const dateFormatted = nextStart.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          const bp = await getPublicBusinessProfile();
          await sendEmail({
            to: row.clientEmail,
            subject: `Next appointment scheduled — ${row.serviceName} — ${bp.businessName}`,
            react: RecurringBookingConfirmation({
              clientName: row.clientFirstName,
              serviceName: row.serviceName,
              startsAt: dateFormatted,
              durationMinutes: booking.durationMinutes,
              totalInCents: booking.totalInCents,
              businessName: bp.businessName,
            }),
            entityType: "recurring_booking_confirmation",
            localId: String(newBooking.id),
          });
        }
      } catch {
        // Non-fatal — email failure shouldn't prevent the next booking from being created
      }
      return;
    }

    // ── RRULE path (no subscription) ────────────────────────────────
    // For non-subscription recurring bookings, the recurrenceRule is an iCal
    // RRULE string stored on every booking in the series. Each completion
    // generates exactly one next booking (lazy generation, not batch).
    if (!booking.recurrenceRule) return;

    const interval = parseRRule(booking.recurrenceRule);
    if (!interval) return;

    if (interval.days) {
      nextStart.setDate(nextStart.getDate() + interval.days);
    } else if (interval.months) {
      nextStart.setMonth(nextStart.getMonth() + interval.months);
    }

    // Respect UNTIL — don't create a booking past the series end date
    if (interval.until && nextStart > interval.until) return;

    // Respect COUNT — don't create beyond the max number of occurrences
    if (interval.count) {
      const seriesRoot = booking.parentBookingId ?? bookingId;

      // ─── Query: count how many bookings already exist in this recurring series ───
      // SELECT: sql`count(*)` is an aggregate function that counts every row
      //   that matches the WHERE clause. Returns a single number: the total
      //   number of child bookings in this series.
      // FROM: the "bookings" table.
      // WHERE:
      //   - parentBookingId = seriesRoot — only bookings that belong to this
      //     recurring series (all children point to the same root).
      //   - isNull(deletedAt) — excludes soft-deleted bookings from the count.
      // Note: the root booking itself is not counted here (it has no
      //   parentBookingId pointing to itself), so we add +1 below.
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.parentBookingId, seriesRoot), isNull(bookings.deletedAt)));
      // +1 for the root booking itself
      if (Number(total) + 1 >= interval.count) return;
    }

    // The series root is either this booking's parent or this booking itself
    const seriesRoot = booking.parentBookingId ?? bookingId;

    const [newBooking] = await db
      .insert(bookings)
      .values({
        clientId: booking.clientId,
        serviceId: booking.serviceId,
        staffId: booking.staffId ?? undefined,
        startsAt: nextStart,
        durationMinutes: booking.durationMinutes,
        totalInCents: booking.totalInCents,
        location: booking.location ?? undefined,
        recurrenceRule: booking.recurrenceRule,
        parentBookingId: seriesRoot,
        status: "confirmed",
        confirmedAt: new Date(),
      })
      .returning({ id: bookings.id });

    // Send confirmation email for the new recurring booking
    try {
      // alias() creates a reference to "profiles" under the name "recurClient"
      // to avoid collisions. In SQL: "profiles AS recurClient".
      const recurClient = alias(profiles, "recurClient");

      // ─── Query: fetch client contact info + service name for the confirmation email ───
      // SELECT: fetches the client's email, firstName, notifyEmail preference,
      //   and the service name — everything needed to compose and send the
      //   recurring booking confirmation email.
      // FROM: the "bookings" table.
      // INNER JOIN recurClient (profiles AS recurClient): connects the booking
      //   to the client's profile by matching bookings.clientId → profiles.id.
      //   INNER JOIN because we need the email — no profile means no email to send.
      // INNER JOIN services: connects the booking to its service by matching
      //   bookings.serviceId → services.id. INNER because we need the service
      //   name for the email content.
      // WHERE:
      //   - id = the newly created recurring booking.
      //   - isNull(deletedAt) — safety check for soft-deleted rows.
      const [row] = await db
        .select({
          clientEmail: recurClient.email,
          clientFirstName: recurClient.firstName,
          notifyEmail: recurClient.notifyEmail,
          serviceName: services.name,
        })
        .from(bookings)
        .innerJoin(recurClient, eq(bookings.clientId, recurClient.id))
        .innerJoin(services, eq(bookings.serviceId, services.id))
        .where(and(eq(bookings.id, newBooking.id), isNull(bookings.deletedAt)));

      if (row?.clientEmail && row.notifyEmail) {
        const dateFormatted = nextStart.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        const bp = await getPublicBusinessProfile();
        await sendEmail({
          to: row.clientEmail,
          subject: `Next appointment scheduled — ${row.serviceName} — ${bp.businessName}`,
          react: RecurringBookingConfirmation({
            clientName: row.clientFirstName,
            serviceName: row.serviceName,
            startsAt: dateFormatted,
            durationMinutes: booking.durationMinutes,
            totalInCents: booking.totalInCents,
            businessName: bp.businessName,
          }),
          entityType: "recurring_booking_confirmation",
          localId: String(newBooking.id),
        });
      }
    } catch {
      // Non-fatal — email failure shouldn't break recurrence
    }
  } catch {
    // Non-fatal — recurrence generation failure must never block the
    // completion status write that already happened in the caller.
  }
}

/* ------------------------------------------------------------------ */
/*  Square order creation (non-fatal)                                  */
/* ------------------------------------------------------------------ */

/**
 * Creates a Square Order for a confirmed booking so the POS tablet can
 * take payment against it and the webhook handler can auto-link it.
 * Failures are non-fatal — logged to sync_log, booking still works.
 */
async function tryCreateSquareOrder(
  bookingId: number,
  serviceId: number,
  totalInCents: number,
): Promise<void> {
  if (!isSquareConfigured()) return;

  try {
    // ─── Query: fetch the service name for the Square order line item ───
    // SELECT: fetches only "name" (e.g. "Lash Fill") from the "services" table,
    //   used as the line item description in the Square order.
    // FROM: the "services" table.
    // WHERE: id = the service associated with this booking.
    const [service] = await db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.id, serviceId));

    const squareOrderId = await createSquareOrder({
      bookingId,
      serviceName: service?.name ?? "Appointment",
      amountInCents: totalInCents,
    });

    await db.update(bookings).set({ squareOrderId }).where(eq(bookings.id, bookingId));
  } catch (err) {
    await db.insert(syncLog).values({
      provider: "square",
      direction: "outbound",
      status: "failed",
      entityType: "order",
      localId: String(bookingId),
      message: "Failed to create Square order for booking",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Zoho Books invoice creation (non-fatal)                            */
/* ------------------------------------------------------------------ */

/**
 * Creates a Zoho Books invoice for a confirmed booking. Fetches client
 * and service data, then fires off the invoice creation asynchronously.
 */
async function tryCreateZohoBooksInvoice(bookingId: number): Promise<void> {
  try {
    // alias() creates a reference to "profiles" under the name "invoiceClient"
    // to avoid table name collisions. In SQL: "profiles AS invoiceClient".
    const invoiceClient = alias(profiles, "invoiceClient");

    // ─── Query: fetch booking, client, and service data for the Zoho invoice ───
    // SELECT: fetches the client's id, email, first name, last name, and phone
    //   (all needed by the Zoho Books API to create/match a contact), the
    //   service name (for the invoice line item description), totalInCents (the
    //   invoice amount), depositPaidInCents (to subtract any deposit already
    //   collected), and zohoInvoiceId (to check if an invoice was already created
    //   for this booking — idempotency guard).
    // FROM: the "bookings" table.
    // INNER JOIN invoiceClient (profiles AS invoiceClient): connects the booking
    //   to the client's profile by matching bookings.clientId → profiles.id.
    //   INNER JOIN because the Zoho invoice requires client contact info — if
    //   the profile is missing, we can't create the invoice.
    // INNER JOIN services: connects the booking to its service by matching
    //   bookings.serviceId → services.id. INNER because we need the service
    //   name for the invoice line item.
    // WHERE:
    //   - id = the booking being invoiced.
    //   - isNull(deletedAt) — skip soft-deleted bookings.
    const [row] = await db
      .select({
        clientId: bookings.clientId,
        clientEmail: invoiceClient.email,
        clientFirstName: invoiceClient.firstName,
        clientLastName: invoiceClient.lastName,
        clientPhone: invoiceClient.phone,
        serviceName: services.name,
        totalInCents: bookings.totalInCents,
        depositPaidInCents: bookings.depositPaidInCents,
        zohoInvoiceId: bookings.zohoInvoiceId,
      })
      .from(bookings)
      .innerJoin(invoiceClient, eq(bookings.clientId, invoiceClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    // Guard: skip if the booking already has an invoice (idempotency) or not found
    if (!row || row.zohoInvoiceId) return;

    createZohoBooksInvoice({
      entityType: "booking",
      entityId: bookingId,
      profileId: row.clientId,
      email: row.clientEmail,
      firstName: row.clientFirstName,
      lastName: row.clientLastName ?? undefined,
      phone: row.clientPhone,
      lineItems: [{ name: row.serviceName, rate: row.totalInCents, quantity: 1 }],
      depositInCents: row.depositPaidInCents ?? undefined,
    });
  } catch {
    // Non-fatal
  }
}

/* ------------------------------------------------------------------ */
/*  Auto-send deposit payment link on confirmation (non-fatal)        */
/* ------------------------------------------------------------------ */

/**
 * Automatically creates a Square deposit payment link and emails it to the
 * client when their booking is confirmed. Skips silently if:
 *   - The service has no deposit requirement
 *   - A deposit has already been collected
 *   - Square is not configured
 *   - The client has no email or has opted out of email notifications
 */
async function tryAutoSendDepositLink(bookingId: number): Promise<void> {
  if (!isSquareConfigured()) return;

  try {
    // alias() creates a reference to "profiles" under the name "depositClient".
    // In SQL: "profiles AS depositClient".
    const depositClient = alias(profiles, "depositClient");

    // ─── Query: fetch booking, client, and service data for the deposit link ───
    // SELECT: fetches the client's email and firstName (for the payment link
    //   email), notifyEmail (to check if the client opted in to emails), the
    //   service name (for the email subject), depositInCents from the services
    //   table (how much deposit this service requires — null/0 means no deposit),
    //   depositPaidInCents from bookings (how much deposit was already paid —
    //   if > 0, we skip sending another link), and squareOrderId (to avoid
    //   creating a duplicate Square order).
    // FROM: the "bookings" table.
    // INNER JOIN depositClient (profiles AS depositClient): connects the booking
    //   to the client's profile by matching bookings.clientId → profiles.id.
    //   INNER JOIN because we need the client's email to send the payment link.
    // INNER JOIN services: connects the booking to its service by matching
    //   bookings.serviceId → services.id. INNER because we need to check the
    //   service's depositInCents to know if a deposit is required at all.
    // WHERE:
    //   - id = the booking being confirmed.
    //   - isNull(deletedAt) — skip soft-deleted bookings.
    const [row] = await db
      .select({
        clientEmail: depositClient.email,
        clientFirstName: depositClient.firstName,
        notifyEmail: depositClient.notifyEmail,
        serviceName: services.name,
        depositInCents: services.depositInCents,
        depositPaidInCents: bookings.depositPaidInCents,
        squareOrderId: bookings.squareOrderId,
      })
      .from(bookings)
      .innerJoin(depositClient, eq(bookings.clientId, depositClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (
      !row?.depositInCents ||
      (row.depositPaidInCents && row.depositPaidInCents > 0) ||
      !row.clientEmail ||
      !row.notifyEmail
    ) {
      return;
    }

    const { url, orderId } = await createSquarePaymentLink({
      bookingId,
      serviceName: row.serviceName,
      amountInCents: row.depositInCents,
      type: "deposit",
    });

    // Store the Square order ID for webhook matching (only if not already set)
    if (!row.squareOrderId) {
      await db.update(bookings).set({ squareOrderId: orderId }).where(eq(bookings.id, bookingId));
    }

    await db.insert(syncLog).values({
      provider: "square",
      direction: "outbound",
      status: "success",
      entityType: "payment_link",
      localId: String(bookingId),
      remoteId: orderId,
      message: `Auto-sent deposit payment link for booking #${bookingId}`,
      payload: { url, orderId, amountInCents: row.depositInCents },
    });

    const bp = await getPublicBusinessProfile();
    await sendEmail({
      to: row.clientEmail,
      subject: `Deposit required — ${row.serviceName} — ${bp.businessName}`,
      react: PaymentLinkEmail({
        clientName: row.clientFirstName,
        serviceName: row.serviceName,
        amountInCents: row.depositInCents,
        type: "deposit",
        paymentUrl: url,
        businessName: bp.businessName,
      }),
      entityType: "payment_link_delivery",
      localId: String(bookingId),
    });
  } catch {
    // Non-fatal — deposit link failure shouldn't block the confirmation flow
  }
}

/* ------------------------------------------------------------------ */
/*  Booking notification emails & in-app alerts (all non-fatal)        */
/* ------------------------------------------------------------------ */

/**
 * Inserts an in-app notification row (the bell icon in the client portal).
 * Separate from email/SMS — this is the internal channel only.
 */
async function tryFireInternalNotification(params: {
  profileId: string;
  type: string;
  title: string;
  body?: string;
  relatedEntityId?: number;
}): Promise<void> {
  try {
    await db.insert(notifications).values({
      profileId: params.profileId,
      type: params.type as (typeof notifications.type)["_"]["data"],
      channel: "internal",
      status: "delivered",
      title: params.title,
      body: params.body ?? null,
      relatedEntityType: "booking",
      relatedEntityId: params.relatedEntityId ?? null,
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Sends booking confirmation via email + SMS + in-app notification.
 *
 * Each channel is gated on the client's notification preferences
 * (notifyEmail / notifySms). Uses alias() for the profiles join because
 * other queries in the same scope may already reference profiles.
 */
async function trySendBookingConfirmation(bookingId: number): Promise<void> {
  try {
    // alias() creates a reference to "profiles" under the name "confirmClient".
    // In SQL: "profiles AS confirmClient".
    const confirmClient = alias(profiles, "confirmClient");

    // ─── Query: fetch all data needed for the confirmation email, SMS, and notification ───
    // SELECT: fetches the client's id (for the in-app notification), email
    //   (email recipient), phone (SMS recipient), firstName (greeting),
    //   notifyEmail and notifySms (opt-in flags — we only send if true),
    //   the service name (for email subject/body), and booking details
    //   (startsAt, durationMinutes, totalInCents) for the email template.
    // FROM: the "bookings" table.
    // INNER JOIN confirmClient (profiles AS confirmClient): connects the booking
    //   to the client's profile by matching bookings.clientId → profiles.id.
    //   INNER JOIN because without a client profile, there's no one to notify.
    // INNER JOIN services: connects the booking to its service by matching
    //   bookings.serviceId → services.id. INNER because the service name is
    //   required for the email content.
    // WHERE:
    //   - id = the booking being confirmed.
    //   - isNull(deletedAt) — skip soft-deleted bookings.
    const [row] = await db
      .select({
        clientId: bookings.clientId,
        clientEmail: confirmClient.email,
        clientPhone: confirmClient.phone,
        clientFirstName: confirmClient.firstName,
        notifyEmail: confirmClient.notifyEmail,
        notifySms: confirmClient.notifySms,
        serviceName: services.name,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
      })
      .from(bookings)
      .innerJoin(confirmClient, eq(bookings.clientId, confirmClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!row) return;

    // ─── Query: fetch any add-on extras attached to this booking ────────
    // SELECT: fetches the add-on name (e.g. "Bottom lashes") and priceInCents
    //   (e.g. 1500 = $15.00) from the "bookingAddOns" table, so they can be
    //   listed in the confirmation email.
    // FROM: the "bookingAddOns" table (extra services added to a booking).
    // WHERE: bookingId = the booking being confirmed — gets only this booking's
    //   add-ons. Returns multiple rows if there are multiple add-ons, or an
    //   empty array if none.
    const addOnRows = await db
      .select({
        name: bookingAddOns.addOnName,
        priceInCents: bookingAddOns.priceInCents,
      })
      .from(bookingAddOns)
      .where(eq(bookingAddOns.bookingId, bookingId));

    const startsAtFormatted = row.startsAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    if (row.clientEmail && row.notifyEmail) {
      const bp = await getPublicBusinessProfile();

      // Generate a magic link so the client can access their portal with one click.
      // Requires SUPABASE_SERVICE_ROLE_KEY — silently omitted if not configured.
      let portalUrl: string | undefined;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (siteUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const adminClient = createAdminClient();
          const { data: linkData } = await adminClient.auth.admin.generateLink({
            type: "magiclink",
            email: row.clientEmail,
            options: { redirectTo: `${siteUrl}/dashboard` },
          });
          portalUrl = linkData?.properties?.action_link ?? undefined;
        } catch {
          // Non-fatal — booking confirmation still sends without portal link
        }
      }

      await sendEmail({
        to: row.clientEmail,
        subject: `Booking confirmed — ${row.serviceName} — ${bp.businessName}`,
        react: BookingConfirmation({
          clientName: row.clientFirstName,
          serviceName: row.serviceName,
          startsAt: startsAtFormatted,
          durationMinutes: row.durationMinutes,
          totalInCents: row.totalInCents,
          addOns: addOnRows.length > 0 ? addOnRows : undefined,
          businessName: bp.businessName,
          portalUrl,
        }),
        entityType: "booking_confirmation",
        localId: String(bookingId),
      });
    }

    if (row.clientPhone && row.notifySms) {
      await sendSms({
        to: row.clientPhone,
        body: `Hi ${row.clientFirstName}! Your ${row.serviceName} appt at T Creative is confirmed for ${startsAtFormatted}. See you then! Reply STOP to opt out.`,
        entityType: "booking_confirmation_sms",
        localId: String(bookingId),
      });
    }

    await tryFireInternalNotification({
      profileId: row.clientId,
      type: "booking_confirmation",
      title: `${row.serviceName} confirmed`,
      body: `Your appointment is confirmed for ${startsAtFormatted}.`,
      relatedEntityId: bookingId,
    });
  } catch {
    // Non-fatal — booking confirmation notifications shouldn't break the flow
  }
}

/**
 * Sends status-change emails for cancelled, completed, and no-show bookings.
 * Uses the same join pattern as trySendBookingConfirmation.
 */
async function trySendBookingStatusEmail(
  bookingId: number,
  status: "cancelled" | "completed" | "no_show",
  cancellationReason?: string,
): Promise<void> {
  try {
    // alias() creates a reference to "profiles" under the name "statusClient".
    // In SQL: "profiles AS statusClient".
    const statusClient = alias(profiles, "statusClient");

    // ─── Query: fetch client + service data for the status-change email ──
    // SELECT: fetches the client's id (for in-app notifications), email (where
    //   to send), firstName (for the greeting), notifyEmail (opt-in check),
    //   the service name (for the email subject/body), and startsAt (the
    //   appointment date, shown in cancellation/no-show emails).
    // FROM: the "bookings" table.
    // INNER JOIN statusClient (profiles AS statusClient): connects the booking
    //   to the client's profile by matching bookings.clientId → profiles.id.
    //   INNER JOIN because we need the email address — no profile means no email.
    // INNER JOIN services: connects the booking to its service by matching
    //   bookings.serviceId → services.id. INNER because the service name goes
    //   in the email.
    // WHERE:
    //   - id = the booking whose status changed.
    //   - isNull(deletedAt) — skip soft-deleted bookings.
    const [row] = await db
      .select({
        clientId: bookings.clientId,
        clientEmail: statusClient.email,
        clientFirstName: statusClient.firstName,
        notifyEmail: statusClient.notifyEmail,
        serviceName: services.name,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .innerJoin(statusClient, eq(bookings.clientId, statusClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!row?.clientEmail || !row.notifyEmail) return;

    const dateFormatted = row.startsAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const bp = await getPublicBusinessProfile();

    if (status === "cancelled") {
      await sendEmail({
        to: row.clientEmail,
        subject: `Booking cancelled — ${row.serviceName} — ${bp.businessName}`,
        react: BookingCancellation({
          clientName: row.clientFirstName,
          serviceName: row.serviceName,
          bookingDate: dateFormatted,
          cancellationReason,
          businessName: bp.businessName,
        }),
        entityType: "booking_cancellation",
        localId: String(bookingId),
      });
      await tryFireInternalNotification({
        profileId: row.clientId,
        type: "booking_cancellation",
        title: `${row.serviceName} booking cancelled`,
        body: cancellationReason ? `Reason: ${cancellationReason}` : undefined,
        relatedEntityId: bookingId,
      });
    } else if (status === "completed") {
      await sendEmail({
        to: row.clientEmail,
        subject: `Thanks for visiting — ${row.serviceName} — ${bp.businessName}`,
        react: BookingCompleted({
          clientName: row.clientFirstName,
          serviceName: row.serviceName,
          businessName: bp.businessName,
        }),
        entityType: "booking_completed",
        localId: String(bookingId),
      });
      await tryFireInternalNotification({
        profileId: row.clientId,
        type: "general",
        title: `Thanks for visiting — ${row.serviceName}`,
        body: `We hope to see you again soon!`,
        relatedEntityId: bookingId,
      });
    } else if (status === "no_show") {
      await sendEmail({
        to: row.clientEmail,
        subject: `Missed appointment — ${row.serviceName} — ${bp.businessName}`,
        react: BookingNoShow({
          clientName: row.clientFirstName,
          serviceName: row.serviceName,
          bookingDate: dateFormatted,
          businessName: bp.businessName,
        }),
        entityType: "booking_no_show",
        localId: String(bookingId),
      });
    }
  } catch {
    // Non-fatal
  }
}

/* ------------------------------------------------------------------ */
/*  No-show / late-cancellation fee enforcement                        */
/* ------------------------------------------------------------------ */

/**
 * Core fee enforcement logic shared by no-show and late-cancel flows.
 *
 * 1. Looks up the booking, client, service, and fee settings.
 * 2. Calculates the fee amount (percentage of booking total).
 * 3. If the client has a card on file via Square, charges it immediately
 *    and records a payment + sends a receipt email.
 * 4. If no card on file, creates an invoice for the fee amount and sends
 *    the client an invoice email.
 *
 * Errors are caught and logged — fee enforcement is non-fatal so it never
 * blocks the status change.
 */
async function tryEnforceFee(
  bookingId: number,
  feeType: "no_show" | "late_cancellation",
): Promise<void> {
  try {
    const policies = await getPolicies();
    const feePercent =
      feeType === "no_show" ? policies.noShowFeePercent : policies.lateCancelFeePercent;

    if (feePercent <= 0) return;

    // alias() creates a reference to "profiles" under the name "feeClient".
    // In SQL: "profiles AS feeClient".
    const feeClient = alias(profiles, "feeClient");

    // ─── Query: fetch booking, client, and service data for fee enforcement ───
    // SELECT: fetches the client's id (for the invoice/payment record), email
    //   and firstName (for the fee notification email), notifyEmail (opt-in
    //   check), squareCustomerId (to look up their card on file for auto-charge),
    //   the service name (for email/invoice descriptions), totalInCents (the
    //   booking price — the fee is a percentage of this), and startsAt (the
    //   appointment date, shown in fee notification emails).
    // FROM: the "bookings" table.
    // INNER JOIN feeClient (profiles AS feeClient): connects the booking to the
    //   client's profile by matching bookings.clientId → profiles.id. INNER JOIN
    //   because we need the client's Square customer ID to attempt a card charge,
    //   and their email for the fee notification.
    // INNER JOIN services: connects the booking to its service by matching
    //   bookings.serviceId → services.id. INNER because the service name
    //   appears in the fee invoice/email.
    // WHERE:
    //   - id = the booking that was no-showed or late-cancelled.
    //   - isNull(deletedAt) — skip soft-deleted bookings.
    const [row] = await db
      .select({
        clientId: bookings.clientId,
        clientEmail: feeClient.email,
        clientFirstName: feeClient.firstName,
        notifyEmail: feeClient.notifyEmail,
        squareCustomerId: feeClient.squareCustomerId,
        serviceName: services.name,
        totalInCents: bookings.totalInCents,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .innerJoin(feeClient, eq(bookings.clientId, feeClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!row) return;

    const feeAmountInCents = Math.round((row.totalInCents * feePercent) / 100);
    if (feeAmountInCents <= 0) return;

    const dateFormatted = row.startsAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const feeLabel = feeType === "no_show" ? "no-show" : "late cancellation";

    // Try to charge card on file
    let charged = false;
    if (isSquareConfigured() && row.squareCustomerId) {
      const cardId = await getSquareCardOnFile(row.squareCustomerId);
      if (cardId) {
        const result = await chargeCardOnFile({
          bookingId,
          squareCustomerId: row.squareCustomerId,
          cardId,
          amountInCents: feeAmountInCents,
          feeType,
          serviceName: row.serviceName,
        });

        if (result) {
          charged = true;

          // Record the payment locally
          await db.insert(payments).values({
            bookingId,
            clientId: row.clientId,
            status: "paid",
            method: "square_card",
            amountInCents: feeAmountInCents,
            squarePaymentId: result.paymentId,
            squareOrderId: result.orderId,
            squareReceiptUrl: result.receiptUrl,
            notes: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee (${feePercent}% of ${row.totalInCents}¢)`,
            paidAt: new Date(),
          });

          // Send receipt email
          if (row.clientEmail && row.notifyEmail) {
            const bp = await getPublicBusinessProfile();
            await sendEmail({
              to: row.clientEmail,
              subject: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee charged — ${row.serviceName} — ${bp.businessName}`,
              react: NoShowFeeCharged({
                clientName: row.clientFirstName,
                serviceName: row.serviceName,
                bookingDate: dateFormatted,
                feeAmountInCents,
                feeType,
                receiptUrl: result.receiptUrl ?? undefined,
                businessName: bp.businessName,
              }),
              entityType: `${feeType}_fee_charged`,
              localId: String(bookingId),
            });
          }

          await logAction({
            actorId: "system",
            action: "create",
            entityType: "payment",
            entityId: String(bookingId),
            description: `Charged ${feeLabel} fee of ${feeAmountInCents}¢ to card on file`,
            metadata: {
              feeType,
              feePercent,
              feeAmountInCents,
              squarePaymentId: result.paymentId,
            },
          });
        }
      }
    }

    // Fallback: create an invoice if card charge failed or no card on file.
    // The invoice uses a sequential INV-XXX numbering scheme derived from
    // the highest existing invoice number.
    if (!charged) {
      // ─── Query: fetch the most recent invoice number for sequential numbering ───
      // SELECT: fetches only the "number" column (e.g. "INV-042") from the
      //   "invoices" table — we parse the numeric part and increment it.
      // FROM: the "invoices" table.
      // ORDER BY id DESC: sorts by the auto-incrementing primary key in
      //   descending order, so the most recently created invoice is first.
      // LIMIT 1: we only need the latest invoice's number to calculate the next
      //   sequential number (e.g. INV-042 → INV-043).
      const [lastInvoice] = await db
        .select({ number: invoices.number })
        .from(invoices)
        .orderBy(desc(invoices.id))
        .limit(1);

      const nextNum = lastInvoice
        ? String(parseInt(lastInvoice.number.replace("INV-", ""), 10) + 1).padStart(3, "0")
        : "001";

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      await db.insert(invoices).values({
        clientId: row.clientId,
        number: `INV-${nextNum}`,
        description: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee — ${row.serviceName} (${dateFormatted})`,
        amountInCents: feeAmountInCents,
        status: "sent",
        issuedAt: new Date(),
        dueAt: dueDate,
        notes: `Auto-generated: ${feeLabel} fee (${feePercent}% of booking total) for booking #${bookingId}`,
      });

      // Send invoice email
      if (row.clientEmail && row.notifyEmail) {
        const bp = await getPublicBusinessProfile();
        await sendEmail({
          to: row.clientEmail,
          subject: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee invoice — ${row.serviceName} — ${bp.businessName}`,
          react: NoShowFeeInvoice({
            clientName: row.clientFirstName,
            serviceName: row.serviceName,
            bookingDate: dateFormatted,
            feeAmountInCents,
            feeType,
            businessName: bp.businessName,
          }),
          entityType: `${feeType}_fee_invoice`,
          localId: String(bookingId),
        });
      }

      await logAction({
        actorId: "system",
        action: "create",
        entityType: "invoice",
        entityId: String(bookingId),
        description: `Created ${feeLabel} fee invoice for ${feeAmountInCents}¢ (no card on file)`,
        metadata: { feeType, feePercent, feeAmountInCents },
      });
    }

    trackEvent(bookingId.toString(), `${feeType}_fee_enforced`, {
      bookingId,
      feeAmountInCents,
      feePercent,
      charged,
    });
  } catch (err) {
    Sentry.captureException(err);
    // Non-fatal — fee enforcement failure should not block status change
  }
}

/** Charges the configured no-show fee when a booking is marked as no_show. */
async function tryEnforceNoShowFee(bookingId: number): Promise<void> {
  await tryEnforceFee(bookingId, "no_show");
}

/**
 * Charges the configured late cancellation fee when a booking is cancelled
 * within the cancellation window. Skips if the cancellation is outside the
 * window (client cancelled with enough notice).
 */
async function tryEnforceLateCancelFee(bookingId: number): Promise<void> {
  try {
    const policies = await getPolicies();
    if (policies.lateCancelFeePercent <= 0 || policies.cancelWindowHours <= 0) return;

    // ─── Query: fetch the booking's start time to check the cancellation window ───
    // SELECT: fetches only "startsAt" from the "bookings" table — the
    //   appointment time, so we can calculate how many hours away it is and
    //   decide whether this counts as a "late" cancellation.
    // FROM: the "bookings" table.
    // WHERE:
    //   - id = the booking being cancelled.
    //   - isNull(deletedAt) — skip soft-deleted bookings.
    const [booking] = await db
      .select({ startsAt: bookings.startsAt })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!booking) return;

    const hoursUntilStart = (booking.startsAt.getTime() - Date.now()) / (1000 * 60 * 60);

    // Only charge if cancelled within the policy-configured window (e.g. 24h).
    // Cancellations with enough notice are free — no fee assessed.
    if (hoursUntilStart > policies.cancelWindowHours) return;

    await tryEnforceFee(bookingId, "late_cancellation");
  } catch (err) {
    Sentry.captureException(err);
  }
}

/**
 * Notifies the next waiting client when a booking is cancelled and a slot
 * opens up. Delegates to lib/waitlist-notify for the core logic so the same
 * path is reused by client-side cancellations.
 */
async function tryNotifyWaitlist(cancelledBookingId: number): Promise<void> {
  await notifyWaitlistForCancelledBooking(cancelledBookingId);
}

/**
 * Sends a reschedule notification email when a booking's time changes.
 */
async function trySendBookingReschedule(bookingId: number, oldStartsAt: Date): Promise<void> {
  try {
    // alias() creates a reference to "profiles" under the name "reschedClient".
    // In SQL: "profiles AS reschedClient".
    const reschedClient = alias(profiles, "reschedClient");

    // ─── Query: fetch client + service data for the reschedule email ─────
    // SELECT: fetches the client's email (recipient), firstName (greeting),
    //   notifyEmail (opt-in check), the service name (for the email subject),
    //   and startsAt (the NEW appointment time — the old time is passed in as
    //   a parameter to this function).
    // FROM: the "bookings" table.
    // INNER JOIN reschedClient (profiles AS reschedClient): connects the booking
    //   to the client's profile by matching bookings.clientId → profiles.id.
    //   INNER JOIN because we need the email — no profile means no one to notify.
    // INNER JOIN services: connects the booking to its service by matching
    //   bookings.serviceId → services.id. INNER because the service name goes
    //   in the reschedule email.
    // WHERE:
    //   - id = the rescheduled booking.
    //   - isNull(deletedAt) — skip soft-deleted bookings.
    const [row] = await db
      .select({
        clientEmail: reschedClient.email,
        clientFirstName: reschedClient.firstName,
        notifyEmail: reschedClient.notifyEmail,
        serviceName: services.name,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .innerJoin(reschedClient, eq(bookings.clientId, reschedClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!row?.clientEmail || !row.notifyEmail) return;

    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

    const bp = await getPublicBusinessProfile();
    await sendEmail({
      to: row.clientEmail,
      subject: `Booking rescheduled — ${row.serviceName} — ${bp.businessName}`,
      react: BookingReschedule({
        clientName: row.clientFirstName,
        serviceName: row.serviceName,
        oldDateTime: fmt(oldStartsAt),
        newDateTime: fmt(row.startsAt),
        businessName: bp.businessName,
      }),
      entityType: "booking_reschedule",
      localId: String(bookingId),
    });
  } catch {
    // Non-fatal
  }
}

/* ------------------------------------------------------------------ */
/*  Assistant-scoped bookings                                          */
/* ------------------------------------------------------------------ */

/**
 * Presentation-ready booking row for the assistant dashboard.
 * Pre-formats dates, times, initials, and price (dollars not cents)
 * so the React component can render without transforms.
 */
export type AssistantBookingRow = {
  id: number;
  date: string;
  dayLabel: string;
  time: string;
  startTime24: string;
  endTime: string;
  service: string;
  category: string;
  client: string;
  clientInitials: string;
  clientPhone: string | null;
  status: string;
  durationMin: number;
  price: number;
  notes: string | null;
};

/** Summary metrics shown in the assistant dashboard header cards. */
export type AssistantBookingStats = {
  upcomingCount: number;
  completedCount: number;
  completedRevenue: number;
};

/* ---- Date/time formatting helpers for AssistantBookingRow ---- */

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatTime24(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(d: Date): string {
  const now = new Date();
  if (formatDateKey(d) === formatDateKey(now)) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (formatDateKey(d) === formatDateKey(tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(first: string, last: string): string {
  // Build a 2-element array of first chars, filter(Boolean) removes undefined/empty
  // entries, then join. Falls back to "?" if both names are empty.
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

/**
 * Fetches all bookings assigned to the logged-in staff member.
 *
 * Uses `requireStaff` (not `requireAdmin`) because assistants need access.
 * Only joins profiles once (client) — staff is implicit from the auth context.
 * Returns pre-formatted rows + aggregate stats for the dashboard header.
 */
export async function getAssistantBookings(): Promise<{
  bookings: AssistantBookingRow[];
  stats: AssistantBookingStats;
}> {
  try {
    const user = await requireStaff();

    // alias() creates a reference to "profiles" under the name "client". Only
    // one alias is needed here (unlike getBookings which needs two) because the
    // staff member is identified from the auth session, not from a join.
    // In SQL: "profiles AS client".
    const clientProfile = alias(profiles, "client");

    // ─── Query: fetch all bookings assigned to this staff member ─────────
    // SELECT: fetches booking fields (id, status, startsAt, durationMinutes,
    //   totalInCents, location, clientNotes, staffNotes) from the "bookings"
    //   table, plus the client's firstName, lastName, and phone from the
    //   "client" alias of "profiles", and the service name and category from
    //   the "services" table. All of these are needed to populate the
    //   assistant dashboard cards.
    // FROM: the "bookings" table.
    // INNER JOIN clientProfile (profiles AS client): connects each booking to
    //   the client's profile by matching bookings.clientId → profiles.id.
    //   INNER JOIN (not LEFT) because the assistant dashboard always shows the
    //   client name — bookings with missing clients should not appear.
    // INNER JOIN services: connects each booking to its service by matching
    //   bookings.serviceId → services.id. INNER because the service name and
    //   category are required for display.
    // WHERE:
    //   - staffId = user.id — only bookings assigned to the logged-in staff
    //     member. This is the security boundary that scopes the assistant view.
    //   - isNull(deletedAt) — excludes soft-deleted bookings.
    // ORDER BY startsAt DESC: newest bookings first, so the assistant sees
    //   their most recent/upcoming appointments at the top.
    const rows = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        location: bookings.location,
        clientNotes: bookings.clientNotes,
        staffNotes: bookings.staffNotes,
        clientFirstName: clientProfile.firstName,
        clientLastName: clientProfile.lastName,
        clientPhone: clientProfile.phone,
        serviceName: services.name,
        serviceCategory: services.category,
      })
      .from(bookings)
      .innerJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(and(eq(bookings.staffId, user.id), isNull(bookings.deletedAt)))
      .orderBy(desc(bookings.startsAt));

    // Transform each raw DB row into a presentation-ready AssistantBookingRow.
    // .map() gives a 1:1 conversion: every booking becomes one row with
    // pre-computed display fields (formatted times, privacy-truncated client
    // name, cents→dollars) so the React component renders without transforms.
    const mapped: AssistantBookingRow[] = rows.map((r) => {
      const start = new Date(r.startsAt);
      const end = new Date(start.getTime() + r.durationMinutes * 60 * 1000);
      const firstName = r.clientFirstName ?? "";
      const lastName = r.clientLastName ?? "";
      return {
        id: r.id,
        date: formatDateKey(start),
        dayLabel: formatDayLabel(start),
        time: formatTime(start),
        startTime24: formatTime24(start),
        endTime: formatTime(end),
        service: r.serviceName,
        category: r.serviceCategory ?? "lash",
        client: `${firstName} ${lastName.charAt(0)}.`.trim(),
        clientInitials: getInitials(firstName, lastName),
        clientPhone: r.clientPhone,
        status: r.status,
        durationMin: r.durationMinutes,
        price: r.totalInCents / 100,
        // Prefer staff notes (internal) over client notes for the assistant view
        notes: r.staffNotes ?? r.clientNotes ?? null,
      };
    });

    // Filter into status subsets for the dashboard stat cards.
    // Two .filter() calls are clearer than a single-pass reduce with multiple
    // accumulators, and the dataset is small (one assistant's bookings).
    const upcomingCount = mapped.filter((b) =>
      ["confirmed", "pending", "in_progress"].includes(b.status),
    ).length;
    const completedBookings = mapped.filter((b) => b.status === "completed");

    return {
      bookings: mapped,
      stats: {
        upcomingCount,
        completedCount: completedBookings.length,
        // Sum completed booking prices via reduce — accumulates a running total.
        completedRevenue: completedBookings.reduce((s, b) => s + b.price, 0),
      },
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Cancel recurring series                                            */
/* ------------------------------------------------------------------ */

/**
 * Cancels all future non-completed bookings in the same recurring series.
 * Finds the series root (parentBookingId ?? the booking itself), then cancels
 * every confirmed/pending booking in the series that hasn't started yet.
 */
export async function cancelBookingSeries(bookingId: number): Promise<void> {
  try {
    z.number().int().positive().parse(bookingId);
    const user = await getUser();

    // ─── Query: fetch the booking's series root to identify the full series ───
    // SELECT: fetches only "parentBookingId" from the "bookings" table — this
    //   tells us which booking is the root of the recurring series. If null,
    //   this booking IS the root.
    // FROM: the "bookings" table.
    // WHERE:
    //   - id = the booking the user clicked "cancel series" on.
    //   - isNull(deletedAt) — skip soft-deleted bookings.
    const [booking] = await db
      .select({ parentBookingId: bookings.parentBookingId })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!booking) throw new Error("Booking not found");

    const seriesRoot = booking.parentBookingId ?? bookingId;
    const now = new Date();

    // ─── Query: find all future cancellable bookings in the recurring series ───
    // SELECT: fetches "id" and "status" from the "bookings" table for each
    //   booking that will be cancelled. We need the IDs for the bulk UPDATE
    //   and the count for the audit log.
    // FROM: the "bookings" table.
    // WHERE (all conditions combined with AND):
    //   - sql`(id = seriesRoot OR parentBookingId = seriesRoot)` — matches both
    //     the root booking and all its children. The sql`` template literal is
    //     used here because Drizzle's or() helper doesn't compose cleanly with
    //     other raw SQL fragments in the same and() call.
    //   - sql`startsAt >= now` — only future bookings (past ones are already done).
    //   - sql`status NOT IN ('cancelled', 'completed', 'no_show')` — only
    //     bookings that are still active (pending, confirmed, in_progress).
    //     Already-terminal bookings should not be re-cancelled.
    //   - isNull(deletedAt) — skip soft-deleted bookings.
    // Raw SQL for the OR because Drizzle's `or()` doesn't compose well inside
    // `and()` with other raw SQL fragments.
    const seriesBookings = await db
      .select({ id: bookings.id, status: bookings.status })
      .from(bookings)
      .where(
        and(
          sql`(${bookings.id} = ${seriesRoot} OR ${bookings.parentBookingId} = ${seriesRoot})`,
          sql`${bookings.startsAt} >= ${now.toISOString()}`,
          sql`${bookings.status} NOT IN ('cancelled', 'completed', 'no_show')`,
          isNull(bookings.deletedAt),
        ),
      );

    if (seriesBookings.length === 0) return;

    // ─── Mutation: bulk-cancel all identified series bookings at once ────
    // UPDATE: sets status to "cancelled" and stamps cancelledAt with the
    //   current timestamp on every matching row.
    // WHERE: id IN (...) — targets only the specific booking IDs found by the
    //   query above. sql.join() builds a comma-separated list of IDs from the
    //   array (e.g. "1, 5, 12"). This is more efficient than running N
    //   individual UPDATE statements.
    await db
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(
        // Map booking objects to SQL-safe id literals for the IN clause.
        // sql.join() concatenates them with commas to build the IN(...) list.
        // This is more efficient than N individual UPDATE statements.
        sql`${bookings.id} IN (${sql.join(
          seriesBookings.map((b) => sql`${b.id}`),
          sql`, `,
        )})`,
      );

    await logAction({
      actorId: user.id,
      action: "status_change",
      entityType: "booking",
      entityId: String(bookingId),
      description: `Recurring series cancelled — ${seriesBookings.length} future booking(s) cancelled`,
      metadata: { seriesRoot, cancelledCount: seriesBookings.length },
    });

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
