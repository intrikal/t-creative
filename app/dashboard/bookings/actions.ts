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
import { eq, desc, ne, and, sql, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { MediaCategory } from "@/app/dashboard/media/actions";
import { getPolicies } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import {
  bookings,
  bookingSubscriptions,
  clientPreferences,
  invoices,
  mediaItems,
  notifications,
  payments,
  profiles,
  services,
  serviceRecords,
  syncLog,
  waitlist,
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
import { WaitlistNotification } from "@/emails/WaitlistNotification";
import { logAction } from "@/lib/audit";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
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
import { createClient } from "@/utils/supabase/server";

export type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";

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

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

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

  const conflicts = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...conditions))
    .limit(1);

  return conflicts.length > 0;
}

export type PaginatedBookings = {
  rows: BookingRow[];
  hasMore: boolean;
};

const DEFAULT_BOOKINGS_LIMIT = 100;

export async function getBookings(opts?: {
  offset?: number;
  limit?: number;
}): Promise<PaginatedBookings> {
  try {
    await getUser();

    const limit = opts?.limit ?? DEFAULT_BOOKINGS_LIMIT;
    const offset = opts?.offset ?? 0;

    const clientProfile = alias(profiles, "client");
    const staffProfile = alias(profiles, "staff");

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
      .where(isNull(bookings.deletedAt))
      .leftJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
      .orderBy(desc(bookings.startsAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
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

export async function updateBookingStatus(
  id: number,
  status: BookingStatus,
  cancellationReason?: string,
): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    z.enum(["completed", "in_progress", "confirmed", "pending", "cancelled", "no_show"]).parse(
      status,
    );
    const user = await getUser();

    const updates: Record<string, unknown> = { status };

    if (status === "confirmed") updates.confirmedAt = new Date();
    if (status === "completed") updates.completedAt = new Date();
    if (status === "cancelled") {
      updates.cancelledAt = new Date();
      if (cancellationReason) updates.cancellationReason = cancellationReason;
    }

    await db.update(bookings).set(updates).where(eq(bookings.id, id));

    // Create Square order when confirming (if not already created)
    if (status === "confirmed") {
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

    // Zoho CRM: update deal stage
    if (status === "completed") {
      updateZohoDeal(id, "Closed Won");
    } else if (status === "cancelled") {
      updateZohoDeal(id, "Closed Lost");
    } else if (status === "confirmed") {
      updateZohoDeal(id, "Confirmed");
      // Zoho Books: create invoice for newly confirmed booking
      tryCreateZohoBooksInvoice(id);
    }

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

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

    // Zoho CRM: create deal for admin-created booking
    const [clientForZoho] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, input.clientId))
      .limit(1);

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

const updateBookingInputSchema = bookingInputSchema.extend({
  status: z.enum(["completed", "in_progress", "confirmed", "pending", "cancelled", "no_show"]),
});

export async function updateBooking(
  id: number,
  input: BookingInput & { status: BookingStatus },
): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    updateBookingInputSchema.parse(input);
    const user = await getUser();

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
    }

    // Fetch old booking time to detect reschedule
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

export async function getClientsForSelect(): Promise<
  { id: string; name: string; phone: string | null; preferredRebookIntervalDays: number | null }[]
> {
  try {
    await getUser();
    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        phone: profiles.phone,
        preferredRebookIntervalDays: clientPreferences.preferredRebookIntervalDays,
      })
      .from(profiles)
      .leftJoin(clientPreferences, eq(clientPreferences.profileId, profiles.id))
      .where(and(eq(profiles.role, "client"), eq(profiles.isActive, true)))
      .orderBy(profiles.firstName);

    return rows.map((r) => ({
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(" "),
      phone: r.phone,
      preferredRebookIntervalDays: r.preferredRebookIntervalDays ?? null,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getServicesForSelect(): Promise<
  {
    id: number;
    name: string;
    category: string;
    durationMinutes: number;
    priceInCents: number;
    depositInCents: number;
  }[]
> {
  try {
    await getUser();
    const rows = await db
      .select({
        id: services.id,
        name: services.name,
        category: services.category,
        durationMinutes: services.durationMinutes,
        priceInCents: services.priceInCents,
        depositInCents: services.depositInCents,
      })
      .from(services)
      .where(eq(services.isActive, true))
      .orderBy(services.category, services.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      durationMinutes: r.durationMinutes ?? 60,
      priceInCents: r.priceInCents ?? 0,
      depositInCents: r.depositInCents ?? 0,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getStaffForSelect(): Promise<{ id: string; name: string }[]> {
  try {
    await getUser();
    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(ne(profiles.role, "client"))
      .orderBy(profiles.firstName);

    return rows.map((r) => ({
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(" "),
    }));
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
    if (booking.subscriptionId) {
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
        const recurClient = alias(profiles, "recurClient");
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
          await sendEmail({
            to: row.clientEmail,
            subject: `Next appointment scheduled — ${row.serviceName} — T Creative`,
            react: RecurringBookingConfirmation({
              clientName: row.clientFirstName,
              serviceName: row.serviceName,
              startsAt: dateFormatted,
              durationMinutes: booking.durationMinutes,
              totalInCents: booking.totalInCents,
            }),
            entityType: "recurring_booking_confirmation",
            localId: String(newBooking.id),
          });
        }
      } catch {
        // Non-fatal
      }
      return;
    }

    // ── RRULE path (no subscription) ────────────────────────────────
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
      const recurClient = alias(profiles, "recurClient");
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

        await sendEmail({
          to: row.clientEmail,
          subject: `Next appointment scheduled — ${row.serviceName} — T Creative`,
          react: RecurringBookingConfirmation({
            clientName: row.clientFirstName,
            serviceName: row.serviceName,
            startsAt: dateFormatted,
            durationMinutes: booking.durationMinutes,
            totalInCents: booking.totalInCents,
          }),
          entityType: "recurring_booking_confirmation",
          localId: String(newBooking.id),
        });
      }
    } catch {
      // Non-fatal — email failure shouldn't break recurrence
    }
  } catch {
    // Non-fatal — don't break the completion flow
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
    const invoiceClient = alias(profiles, "invoiceClient");
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

    if (!row || row.zohoInvoiceId) return; // Already has invoice or not found

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
    const depositClient = alias(profiles, "depositClient");
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

    await sendEmail({
      to: row.clientEmail,
      subject: `Deposit required — ${row.serviceName} — T Creative`,
      react: PaymentLinkEmail({
        clientName: row.clientFirstName,
        serviceName: row.serviceName,
        amountInCents: row.depositInCents,
        type: "deposit",
        paymentUrl: url,
      }),
      entityType: "payment_link_delivery",
      localId: String(bookingId),
    });
  } catch {
    // Non-fatal — deposit link failure shouldn't block the confirmation flow
  }
}

/*  Booking confirmation email (non-fatal)                             */
/* ------------------------------------------------------------------ */

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

async function trySendBookingConfirmation(bookingId: number): Promise<void> {
  try {
    const confirmClient = alias(profiles, "confirmClient");
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

    const startsAtFormatted = row.startsAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    if (row.clientEmail && row.notifyEmail) {
      await sendEmail({
        to: row.clientEmail,
        subject: `Booking confirmed — ${row.serviceName} — T Creative`,
        react: BookingConfirmation({
          clientName: row.clientFirstName,
          serviceName: row.serviceName,
          startsAt: startsAtFormatted,
          durationMinutes: row.durationMinutes,
          totalInCents: row.totalInCents,
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
    const statusClient = alias(profiles, "statusClient");
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

    if (status === "cancelled") {
      await sendEmail({
        to: row.clientEmail,
        subject: `Booking cancelled — ${row.serviceName} — T Creative`,
        react: BookingCancellation({
          clientName: row.clientFirstName,
          serviceName: row.serviceName,
          bookingDate: dateFormatted,
          cancellationReason,
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
        subject: `Thanks for visiting — ${row.serviceName} — T Creative`,
        react: BookingCompleted({
          clientName: row.clientFirstName,
          serviceName: row.serviceName,
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
        subject: `Missed appointment — ${row.serviceName} — T Creative`,
        react: BookingNoShow({
          clientName: row.clientFirstName,
          serviceName: row.serviceName,
          bookingDate: dateFormatted,
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

    const feeClient = alias(profiles, "feeClient");
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
            await sendEmail({
              to: row.clientEmail,
              subject: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee charged — ${row.serviceName} — T Creative`,
              react: NoShowFeeCharged({
                clientName: row.clientFirstName,
                serviceName: row.serviceName,
                bookingDate: dateFormatted,
                feeAmountInCents,
                feeType,
                receiptUrl: result.receiptUrl ?? undefined,
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

    // Fallback: create an invoice if card charge failed or no card on file
    if (!charged) {
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
        await sendEmail({
          to: row.clientEmail,
          subject: `${feeType === "no_show" ? "No-show" : "Late cancellation"} fee invoice — ${row.serviceName} — T Creative`,
          react: NoShowFeeInvoice({
            clientName: row.clientFirstName,
            serviceName: row.serviceName,
            bookingDate: dateFormatted,
            feeAmountInCents,
            feeType,
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

    const [booking] = await db
      .select({ startsAt: bookings.startsAt })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!booking) return;

    const hoursUntilStart = (booking.startsAt.getTime() - Date.now()) / (1000 * 60 * 60);

    // Only charge if cancelled within the cancellation window
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
    const reschedClient = alias(profiles, "reschedClient");
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

    await sendEmail({
      to: row.clientEmail,
      subject: `Booking rescheduled — ${row.serviceName} — T Creative`,
      react: BookingReschedule({
        clientName: row.clientFirstName,
        serviceName: row.serviceName,
        oldDateTime: fmt(oldStartsAt),
        newDateTime: fmt(row.startsAt),
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

export type AssistantBookingRow = {
  id: number;
  date: string;
  dayLabel: string;
  time: string;
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

export type AssistantBookingStats = {
  upcomingCount: number;
  completedCount: number;
  completedRevenue: number;
};

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

export async function getAssistantBookings(): Promise<{
  bookings: AssistantBookingRow[];
  stats: AssistantBookingStats;
}> {
  try {
    const user = await getUser();

    const clientProfile = alias(profiles, "client");

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

    const mapped: AssistantBookingRow[] = rows.map((r) => {
      const start = new Date(r.startsAt);
      const firstName = r.clientFirstName ?? "";
      const lastName = r.clientLastName ?? "";
      return {
        id: r.id,
        date: formatDateKey(start),
        dayLabel: formatDayLabel(start),
        time: formatTime(start),
        service: r.serviceName,
        category: r.serviceCategory ?? "lash",
        client: `${firstName} ${lastName.charAt(0)}.`.trim(),
        clientInitials: getInitials(firstName, lastName),
        clientPhone: r.clientPhone,
        status: r.status,
        durationMin: r.durationMinutes,
        price: r.totalInCents / 100,
        notes: r.staffNotes ?? r.clientNotes ?? null,
      };
    });

    const upcomingCount = mapped.filter((b) =>
      ["confirmed", "pending", "in_progress"].includes(b.status),
    ).length;
    const completedBookings = mapped.filter((b) => b.status === "completed");

    return {
      bookings: mapped,
      stats: {
        upcomingCount,
        completedCount: completedBookings.length,
        completedRevenue: completedBookings.reduce((s, b) => s + b.price, 0),
      },
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Service Records (post-appointment notes)                           */
/* ------------------------------------------------------------------ */

export type ServiceRecordRow = {
  id: number;
  bookingId: number;
  clientId: string;
  staffId: string | null;
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
  beforePhotoPath: string | null;
  afterPhotoPath: string | null;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  createdAt: string;
};

export type ServiceRecordInput = {
  bookingId: number;
  clientId: string;
  lashMapping?: string;
  curlType?: string;
  diameter?: string;
  lengths?: string;
  adhesive?: string;
  retentionNotes?: string;
  productsUsed?: string;
  notes?: string;
  reactions?: string;
  nextVisitNotes?: string;
  beforePhotoPath?: string;
  afterPhotoPath?: string;
};

export async function getServiceRecord(bookingId: number): Promise<ServiceRecordRow | null> {
  try {
    await getUser();
    const supabase = await createClient();

    const staffProfile = alias(profiles, "recordStaff");

    const rows = await db
      .select({
        id: serviceRecords.id,
        bookingId: serviceRecords.bookingId,
        clientId: serviceRecords.clientId,
        staffId: serviceRecords.staffId,
        staffName: staffProfile.firstName,
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
        beforePhotoPath: serviceRecords.beforePhotoPath,
        afterPhotoPath: serviceRecords.afterPhotoPath,
        createdAt: serviceRecords.createdAt,
      })
      .from(serviceRecords)
      .leftJoin(staffProfile, eq(serviceRecords.staffId, staffProfile.id))
      .where(eq(serviceRecords.bookingId, bookingId))
      .limit(1);

    if (rows.length === 0) return null;

    const r = rows[0];
    const getUrl = (path: string | null) =>
      path ? supabase.storage.from("media").getPublicUrl(path).data.publicUrl : null;

    return {
      ...r,
      beforePhotoUrl: getUrl(r.beforePhotoPath),
      afterPhotoUrl: getUrl(r.afterPhotoPath),
      createdAt: r.createdAt.toISOString(),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const serviceRecordInputSchema = z.object({
  bookingId: z.number().int().positive(),
  clientId: z.string().min(1),
  lashMapping: z.string().optional(),
  curlType: z.string().optional(),
  diameter: z.string().optional(),
  lengths: z.string().optional(),
  adhesive: z.string().optional(),
  retentionNotes: z.string().optional(),
  productsUsed: z.string().optional(),
  notes: z.string().optional(),
  reactions: z.string().optional(),
  nextVisitNotes: z.string().optional(),
  beforePhotoPath: z.string().optional(),
  afterPhotoPath: z.string().optional(),
});

export async function upsertServiceRecord(input: ServiceRecordInput): Promise<void> {
  try {
    serviceRecordInputSchema.parse(input);
    const user = await getUser();

    // Check if a record already exists for this booking
    const existing = await db
      .select({ id: serviceRecords.id })
      .from(serviceRecords)
      .where(eq(serviceRecords.bookingId, input.bookingId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(serviceRecords)
        .set({
          lashMapping: input.lashMapping ?? null,
          curlType: input.curlType ?? null,
          diameter: input.diameter ?? null,
          lengths: input.lengths ?? null,
          adhesive: input.adhesive ?? null,
          retentionNotes: input.retentionNotes ?? null,
          productsUsed: input.productsUsed ?? null,
          notes: input.notes ?? null,
          reactions: input.reactions ?? null,
          nextVisitNotes: input.nextVisitNotes ?? null,
          ...(input.beforePhotoPath !== undefined
            ? { beforePhotoPath: input.beforePhotoPath }
            : {}),
          ...(input.afterPhotoPath !== undefined ? { afterPhotoPath: input.afterPhotoPath } : {}),
        })
        .where(eq(serviceRecords.id, existing[0].id));
    } else {
      await db.insert(serviceRecords).values({
        bookingId: input.bookingId,
        clientId: input.clientId,
        staffId: user.id,
        lashMapping: input.lashMapping ?? null,
        curlType: input.curlType ?? null,
        diameter: input.diameter ?? null,
        lengths: input.lengths ?? null,
        adhesive: input.adhesive ?? null,
        retentionNotes: input.retentionNotes ?? null,
        productsUsed: input.productsUsed ?? null,
        notes: input.notes ?? null,
        reactions: input.reactions ?? null,
        nextVisitNotes: input.nextVisitNotes ?? null,
        beforePhotoPath: input.beforePhotoPath ?? null,
        afterPhotoPath: input.afterPhotoPath ?? null,
      });
    }

    trackEvent(user.id, "service_record_saved", {
      bookingId: input.bookingId,
      clientId: input.clientId,
    });

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Waitlist                                                           */
/* ------------------------------------------------------------------ */

export type WaitlistRow = {
  id: number;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  serviceId: number;
  serviceName: string;
  serviceCategory: string;
  status: "waiting" | "notified" | "booked" | "expired" | "cancelled";
  preferredDateStart: string | null;
  preferredDateEnd: string | null;
  timePreference: string | null;
  notes: string | null;
  notifiedAt: string | null;
  createdAt: string;
};

export type WaitlistInput = {
  clientId: string;
  serviceId: number;
  preferredDateStart?: string;
  preferredDateEnd?: string;
  timePreference?: string;
  notes?: string;
};

export async function getWaitlist(): Promise<WaitlistRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: waitlist.id,
        clientId: waitlist.clientId,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        clientPhone: profiles.phone,
        serviceId: waitlist.serviceId,
        serviceName: services.name,
        serviceCategory: services.category,
        status: waitlist.status,
        preferredDateStart: waitlist.preferredDateStart,
        preferredDateEnd: waitlist.preferredDateEnd,
        timePreference: waitlist.timePreference,
        notes: waitlist.notes,
        notifiedAt: waitlist.notifiedAt,
        createdAt: waitlist.createdAt,
      })
      .from(waitlist)
      .innerJoin(profiles, eq(waitlist.clientId, profiles.id))
      .innerJoin(services, eq(waitlist.serviceId, services.id))
      .orderBy(desc(waitlist.createdAt));

    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" "),
      clientPhone: r.clientPhone,
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      serviceCategory: r.serviceCategory,
      status: r.status,
      preferredDateStart: r.preferredDateStart,
      preferredDateEnd: r.preferredDateEnd,
      timePreference: r.timePreference,
      notes: r.notes,
      notifiedAt: r.notifiedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const waitlistInputSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.number().int().positive(),
  preferredDateStart: z.string().optional(),
  preferredDateEnd: z.string().optional(),
  timePreference: z.string().optional(),
  notes: z.string().optional(),
});

export async function addToWaitlist(input: WaitlistInput): Promise<void> {
  try {
    waitlistInputSchema.parse(input);
    const user = await getUser();

    await db.insert(waitlist).values({
      clientId: input.clientId,
      serviceId: input.serviceId,
      preferredDateStart: input.preferredDateStart ?? null,
      preferredDateEnd: input.preferredDateEnd ?? null,
      timePreference: input.timePreference ?? null,
      notes: input.notes ?? null,
    });

    trackEvent(user.id, "waitlist_added", {
      clientId: input.clientId,
      serviceId: input.serviceId,
    });

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateWaitlistStatus(
  id: number,
  status: "waiting" | "notified" | "booked" | "expired" | "cancelled",
): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    z.enum(["waiting", "notified", "booked", "expired", "cancelled"]).parse(status);
    await getUser();

    const updates: Record<string, unknown> = { status };
    if (status === "notified") {
      updates.notifiedAt = new Date();
    }

    await db.update(waitlist).set(updates).where(eq(waitlist.id, id));

    // Send notification email when marking as notified
    if (status === "notified") {
      try {
        const waitlistClient = alias(profiles, "waitlistClient");
        const [row] = await db
          .select({
            clientEmail: waitlistClient.email,
            clientFirstName: waitlistClient.firstName,
            notifyEmail: waitlistClient.notifyEmail,
            serviceName: services.name,
          })
          .from(waitlist)
          .innerJoin(waitlistClient, eq(waitlist.clientId, waitlistClient.id))
          .innerJoin(services, eq(waitlist.serviceId, services.id))
          .where(eq(waitlist.id, id));

        if (row?.clientEmail && row.notifyEmail) {
          await sendEmail({
            to: row.clientEmail,
            subject: `A spot opened up — ${row.serviceName} — T Creative`,
            react: WaitlistNotification({
              clientName: row.clientFirstName,
              serviceName: row.serviceName,
            }),
            entityType: "waitlist_notification",
            localId: String(id),
          });
        }
      } catch {
        // Non-fatal
      }
    }

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function removeFromWaitlistById(id: number): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    await getUser();
    await db.delete(waitlist).where(eq(waitlist.id, id));
    revalidatePath("/dashboard/bookings");
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

    const [booking] = await db
      .select({ parentBookingId: bookings.parentBookingId })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)));

    if (!booking) throw new Error("Booking not found");

    const seriesRoot = booking.parentBookingId ?? bookingId;
    const now = new Date();

    // Find all future non-completed bookings in the series (root + children)
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

    await db
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(
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

/* ------------------------------------------------------------------ */
/*  Before / After photo upload                                        */
/* ------------------------------------------------------------------ */

/**
 * Uploads a single before or after photo to Supabase Storage and returns
 * the storage path + public URL. Called from the service record dialog
 * immediately on file selection so the tech sees a preview before saving.
 */
export async function uploadServicePhoto(
  formData: FormData,
): Promise<{ path: string; publicUrl: string }> {
  try {
    await getUser();
    const supabase = await createClient();

    const file = formData.get("file") as File | null;
    const bookingId = formData.get("bookingId") as string | null;
    const slot = (formData.get("slot") as string) ?? "photo";

    if (!file) throw new Error("No file provided");

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const timestamp = Date.now();
    const path = `service-records/${bookingId ?? "unknown"}/${slot}-${timestamp}.${ext}`;

    const { error } = await supabase.storage.from("media").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(path);
    return { path, publicUrl };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Promote service record photos to portfolio                         */
/* ------------------------------------------------------------------ */

/**
 * Creates a media_items row from a service record's before/after photos
 * and queues a consent notification for the client.
 * The item is unpublished until the client approves.
 */
const promoteToPortfolioSchema = z.object({
  bookingId: z.number().int().positive(),
  category: z.enum(["lash", "jewelry", "crochet", "consulting"]),
  caption: z.string().optional(),
});

export async function promoteToPortfolio(input: {
  bookingId: number;
  category: MediaCategory;
  caption?: string;
}): Promise<void> {
  try {
    promoteToPortfolioSchema.parse(input);
    await getUser();
    const supabase = await createClient();

    const [record] = await db
      .select({
        clientId: serviceRecords.clientId,
        beforePhotoPath: serviceRecords.beforePhotoPath,
        afterPhotoPath: serviceRecords.afterPhotoPath,
      })
      .from(serviceRecords)
      .where(eq(serviceRecords.bookingId, input.bookingId))
      .limit(1);

    if (!record) throw new Error("Service record not found");
    if (!record.beforePhotoPath || !record.afterPhotoPath) {
      throw new Error("Both before and after photos are required");
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(record.afterPhotoPath);

    const [inserted] = await db
      .insert(mediaItems)
      .values({
        type: "before_after",
        category: input.category,
        clientId: record.clientId,
        caption: input.caption?.trim() || null,
        storagePath: record.afterPhotoPath,
        beforeStoragePath: record.beforePhotoPath,
        publicUrl,
        clientConsentGiven: false,
        isPublished: false,
      })
      .returning({ id: mediaItems.id });

    // Notify the client so they see the pending approval in their gallery
    await db.insert(notifications).values({
      profileId: record.clientId,
      type: "general",
      channel: "internal",
      status: "sent",
      title: "Your photos are ready for the portfolio",
      body: "T Creative would like to feature your before & after photos in the portfolio. Open your gallery to approve.",
      relatedEntityType: "media_item",
      relatedEntityId: inserted.id,
      sentAt: new Date(),
    });

    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/gallery");
    revalidatePath("/dashboard/media");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
