"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, ne, and, sql, inArray, isNull, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  getPublicBusinessProfile,
  getPublicLoyaltyConfig,
} from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import {
  bookings,
  bookingAddOns,
  bookingServices,
  notifications,
  payments,
  profiles,
  services,
  referrals,
  syncLog,
  timeOff,
} from "@/db/schema";
import { BookingCancellation } from "@/emails/BookingCancellation";
import { BookingCompleted } from "@/emails/BookingCompleted";
import { BookingConfirmation } from "@/emails/BookingConfirmation";
import { BookingNoShow } from "@/emails/BookingNoShow";
import { BookingReschedule } from "@/emails/BookingReschedule";
import { PaymentLinkEmail } from "@/emails/PaymentLinkEmail";
import { RecurringBookingConfirmation } from "@/emails/RecurringBookingConfirmation";
import { logAction } from "@/lib/audit";
import { requireAdmin, requireStaff } from "@/lib/auth";
import logger from "@/lib/logger";
import { createActionLimiter } from "@/lib/middleware/action-rate-limit";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import { isSquareConfigured, createSquareOrder, createSquarePaymentLink } from "@/lib/square";
import { sendSms } from "@/lib/twilio";
import type { ActionResult } from "@/lib/types/action-result";
import type {
  BookingStatus,
  BookingRow,
  BookingInput,
  PaginatedBookings,
  CancellationRefundResult,
  AssistantBookingRow,
  AssistantBookingStats,
} from "@/lib/types/booking.types";
import { createZohoDeal } from "@/lib/zoho";
import { createZohoBooksInvoice } from "@/lib/zoho-books";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkBookingWaivers } from "../waiver-actions";
import { bookingInputSchema, updateBookingInputSchema } from "./booking-schemas";

export type {
  BookingStatus,
  BookingRow,
  BookingInput,
  PaginatedBookings,
  CancellationRefundResult,
  AssistantBookingRow,
  AssistantBookingStats,
} from "@/lib/types/booking.types";

/** Alias for readability — all mutations in this file require admin access. */
const getUser = requireAdmin;

const createBookingLimiter = createActionLimiter("booking-create", {
  requests: 10,
  window: "60 s",
});
const updateBookingLimiter = createActionLimiter("booking-update", {
  requests: 20,
  window: "60 s",
});
const deleteBookingLimiter = createActionLimiter("booking-delete", {
  requests: 10,
  window: "60 s",
});

/* ------------------------------------------------------------------ */
/*  Conflict helpers (shared)                                          */
/* ------------------------------------------------------------------ */

/**
 * Checks whether a staff member already has a confirmed/in_progress booking
 * that overlaps with the given time range. Returns true if a conflict exists.
 */
export async function hasOverlappingBooking(
  staffId: string,
  startsAt: Date,
  durationMinutes: number,
  excludeBookingId?: number,
  locationId?: number,
): Promise<boolean> {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const conditions = [
    eq(bookings.staffId, staffId),
    inArray(bookings.status, ["confirmed", "in_progress"]),
    sql`${bookings.startsAt} < ${endsAt}`,
    sql`${bookings.startsAt} + (${bookings.durationMinutes} || ' minutes')::interval > ${startsAt}`,
  ];

  if (locationId !== undefined) {
    conditions.push(eq(bookings.locationId, locationId));
  }

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

/**
 * Checks whether a staff member has approved time-off that overlaps the
 * proposed booking window.
 */
export async function hasApprovedTimeOffConflict(
  staffId: string,
  startsAt: Date,
  durationMinutes: number,
): Promise<boolean> {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const bookingStartDate = startsAt.toISOString().split("T")[0];
  const bookingEndDate = endsAt.toISOString().split("T")[0];

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
      return true;
    }

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

const DEFAULT_BOOKINGS_LIMIT = 100;

export async function getBookings(opts?: {
  offset?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  locationId?: number;
}): Promise<PaginatedBookings> {
  try {
    await getUser();

    const limit = opts?.limit ?? DEFAULT_BOOKINGS_LIMIT;
    const offset = opts?.offset ?? 0;

    const conditions = [isNull(bookings.deletedAt)];
    if (opts?.startDate) conditions.push(gte(bookings.startsAt, opts.startDate));
    if (opts?.endDate) conditions.push(lte(bookings.startsAt, opts.endDate));
    if (opts?.locationId) conditions.push(eq(bookings.locationId, opts.locationId));

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
        recurrenceGroupId: bookings.recurrenceGroupId,
        tosAcceptedAt: bookings.tosAcceptedAt,
        tosVersion: bookings.tosVersion,
        locationId: bookings.locationId,
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

    const bookingIds = page.map((r) => r.id);
    const bsRows =
      bookingIds.length > 0
        ? await db
            .select({
              bookingId: bookingServices.bookingId,
              serviceId: bookingServices.serviceId,
              orderIndex: bookingServices.orderIndex,
              priceInCents: bookingServices.priceInCents,
              durationMinutes: bookingServices.durationMinutes,
              depositInCents: bookingServices.depositInCents,
              serviceName: services.name,
              serviceCategory: services.category,
            })
            .from(bookingServices)
            .leftJoin(services, eq(bookingServices.serviceId, services.id))
            .where(inArray(bookingServices.bookingId, bookingIds))
            .orderBy(bookingServices.orderIndex)
        : [];

    const bsMap = new Map<
      number,
      {
        serviceId: number;
        serviceName: string;
        serviceCategory: string;
        priceInCents: number;
        durationMinutes: number;
        depositInCents: number;
        orderIndex: number;
      }[]
    >();
    for (const row of bsRows) {
      const list = bsMap.get(row.bookingId) ?? [];
      list.push({
        serviceId: row.serviceId,
        serviceName: row.serviceName ?? "",
        serviceCategory: row.serviceCategory ?? "lash",
        priceInCents: row.priceInCents,
        durationMinutes: row.durationMinutes,
        depositInCents: row.depositInCents,
        orderIndex: row.orderIndex,
      });
      bsMap.set(row.bookingId, list);
    }

    return {
      rows: page.map((r) => ({
        ...r,
        clientFirstName: r.clientFirstName ?? "",
        serviceName: r.serviceName ?? "",
        serviceCategory: r.serviceCategory ?? "lash",
        services: bsMap.get(r.id) ?? [],
      })),
      hasMore,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function getBookingById(id: number): Promise<BookingRow | null> {
  try {
    await getUser();

    const clientProfile = alias(profiles, "client");
    const staffProfile = alias(profiles, "staff");

    const [row] = await db
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
        recurrenceGroupId: bookings.recurrenceGroupId,
        tosAcceptedAt: bookings.tosAcceptedAt,
        tosVersion: bookings.tosVersion,
        locationId: bookings.locationId,
      })
      .from(bookings)
      .where(and(eq(bookings.id, id), isNull(bookings.deletedAt)))
      .leftJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
      .limit(1);

    if (!row) return null;

    const bsRows = await db
      .select({
        serviceId: bookingServices.serviceId,
        orderIndex: bookingServices.orderIndex,
        priceInCents: bookingServices.priceInCents,
        durationMinutes: bookingServices.durationMinutes,
        depositInCents: bookingServices.depositInCents,
        serviceName: services.name,
        serviceCategory: services.category,
      })
      .from(bookingServices)
      .leftJoin(services, eq(bookingServices.serviceId, services.id))
      .where(eq(bookingServices.bookingId, id))
      .orderBy(bookingServices.orderIndex);

    return {
      ...row,
      clientFirstName: row.clientFirstName ?? "",
      serviceName: row.serviceName ?? "",
      serviceCategory: row.serviceCategory ?? "lash",
      services: bsRows.map((bs) => ({
        serviceId: bs.serviceId,
        serviceName: bs.serviceName ?? "",
        serviceCategory: bs.serviceCategory ?? "lash",
        priceInCents: bs.priceInCents,
        durationMinutes: bs.durationMinutes,
        depositInCents: bs.depositInCents,
        orderIndex: bs.orderIndex,
      })),
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function createBooking(input: BookingInput): Promise<ActionResult<void>> {
  try {
    bookingInputSchema.parse(input);
    await createBookingLimiter();
    const user = await getUser();

    const [newBooking] = await db.transaction(async (tx) => {
      if (input.staffId) {
        const lockKey = input.locationId ? `${input.staffId}:${input.locationId}` : input.staffId;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

        const conflict = await hasOverlappingBooking(
          input.staffId,
          input.startsAt,
          input.durationMinutes,
          undefined,
          input.locationId,
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

      const [newRow] = await tx
        .insert(bookings)
        .values({
          clientId: input.clientId,
          serviceId: input.serviceId,
          staffId: input.staffId ?? undefined,
          startsAt: input.startsAt,
          durationMinutes: input.durationMinutes,
          totalInCents: input.totalInCents,
          location: input.location ?? undefined,
          locationId: input.locationId ?? undefined,
          clientNotes: input.clientNotes ?? undefined,
          recurrenceRule: input.recurrenceRule ?? undefined,
          subscriptionId: input.subscriptionId ?? undefined,
          status: "confirmed",
          confirmedAt: new Date(),
        })
        .returning({ id: bookings.id });

      const serviceItems = input.services ?? [
        {
          serviceId: input.serviceId,
          priceInCents: input.totalInCents,
          durationMinutes: input.durationMinutes,
          depositInCents: 0,
        },
      ];
      await tx.insert(bookingServices).values(
        serviceItems.map((s, i) => ({
          bookingId: newRow.id,
          serviceId: s.serviceId,
          orderIndex: i,
          priceInCents: s.priceInCents,
          durationMinutes: s.durationMinutes,
          depositInCents: s.depositInCents,
        })),
      );

      return [newRow];
    });

    await tryCreateSquareOrder(newBooking.id, input.serviceId, input.totalInCents, input.services);
    await trySendBookingConfirmation(newBooking.id);
    await tryAutoSendDepositLink(newBooking.id);

    logger.info(
      {
        action: "createBooking",
        bookingId: newBooking.id,
        clientId: input.clientId,
        serviceId: input.serviceId,
        staffId: input.staffId ?? null,
      },
      "booking created",
    );

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

    trackEvent(input.clientId, "booking_requested", {
      bookingId: newBooking.id,
      serviceId: input.serviceId,
      serviceName: serviceForZoho?.name ?? null,
      staffId: input.staffId ?? null,
      totalInCents: input.totalInCents,
      source: "dashboard",
      isRecurring: !!input.recurrenceRule,
      isMultiService: (input.services?.length ?? 1) > 1,
    });

    if (clientForZoho) {
      createZohoDeal({
        contactEmail: clientForZoho.email,
        dealName: `${serviceForZoho?.name ?? "Appointment"} — ${clientForZoho.firstName}`,
        stage: "Confirmed",
        amountInCents: input.totalInCents,
        bookingId: newBooking.id,
      });

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
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to create booking";
    return { success: false, error: message };
  }
}

export async function updateBooking(
  id: number,
  input: BookingInput & { status: BookingStatus },
): Promise<ActionResult<void>> {
  try {
    z.number().int().positive().parse(id);
    updateBookingInputSchema.parse(input);
    await updateBookingLimiter();
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

      const timeOffConflict = await hasApprovedTimeOffConflict(
        input.staffId,
        input.startsAt,
        input.durationMinutes,
      );
      if (timeOffConflict) {
        throw new Error("This staff member has approved time off during that time slot");
      }
    }

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

    if (input.services && input.services.length > 0) {
      await db.delete(bookingServices).where(eq(bookingServices.bookingId, id));
      await db.insert(bookingServices).values(
        input.services.map((s, i) => ({
          bookingId: id,
          serviceId: s.serviceId,
          orderIndex: i,
          priceInCents: s.priceInCents,
          durationMinutes: s.durationMinutes,
          depositInCents: s.depositInCents,
        })),
      );
    }

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
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to update booking";
    return { success: false, error: message };
  }
}

export async function deleteBooking(id: number): Promise<ActionResult<void>> {
  try {
    z.number().int().positive().parse(id);
    await deleteBookingLimiter();
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
    return { success: true, data: undefined };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : "Failed to delete booking";
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Assistant-scoped bookings                                          */
/* ------------------------------------------------------------------ */

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
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

export async function getAssistantBookings(): Promise<{
  bookings: AssistantBookingRow[];
  stats: AssistantBookingStats;
}> {
  try {
    const user = await requireStaff();

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
/*  Internal helpers (non-exported)                                    */
/* ------------------------------------------------------------------ */

export async function tryCreateSquareOrder(
  bookingId: number,
  serviceId: number,
  totalInCents: number,
  serviceItems?: { serviceId: number; priceInCents: number }[],
): Promise<void> {
  if (!isSquareConfigured()) return;

  try {
    if (serviceItems && serviceItems.length > 1) {
      const serviceRows = await db
        .select({ id: services.id, name: services.name })
        .from(services)
        .where(
          inArray(
            services.id,
            serviceItems.map((s) => s.serviceId),
          ),
        );

      const nameMap = new Map(serviceRows.map((r) => [r.id, r.name]));
      const primaryName = nameMap.get(serviceItems[0].serviceId) ?? "Appointment";
      const squareOrderId = await createSquareOrder({
        bookingId,
        serviceName: `${primaryName} (+${serviceItems.length - 1} more)`,
        amountInCents: totalInCents,
      });

      await db.update(bookings).set({ squareOrderId }).where(eq(bookings.id, bookingId));
    } else {
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
    }
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

export async function tryAutoSendDepositLink(bookingId: number): Promise<void> {
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
    // Non-fatal
  }
}

export async function tryFireInternalNotification(params: {
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

export async function tryCreditReferrer(bookingId: number): Promise<void> {
  try {
    const [booking] = await db
      .select({
        referrerCode: bookings.referrerCode,
        clientId: bookings.clientId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking?.referrerCode) return;

    const [referrer] = await db
      .select({ id: profiles.id, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.referralCode, booking.referrerCode.toUpperCase()))
      .limit(1);

    if (!referrer || referrer.id === booking.clientId) return;

    const [existing] = await db
      .select({ id: referrals.id })
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerId, referrer.id),
          eq(referrals.referredId, booking.clientId),
          eq(referrals.status, "completed"),
        ),
      )
      .limit(1);

    if (existing) return;

    const loyaltyConfig = await getPublicLoyaltyConfig();
    const rewardCents = loyaltyConfig.referralRewardCents ?? 1000;

    await db.insert(referrals).values({
      referrerId: referrer.id,
      referredId: booking.clientId,
      bookingId,
      status: "completed",
      rewardAmountInCents: rewardCents,
    });

    const [referred] = await db
      .select({ firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, booking.clientId))
      .limit(1);

    const referredName = referred?.firstName ?? "A friend";

    await tryFireInternalNotification({
      profileId: referrer.id,
      type: "general",
      title: "Referral reward earned!",
      body: `${referredName} completed their booking — you earned a $${(rewardCents / 100).toFixed(0)} credit. Thank you for spreading the word!`,
      relatedEntityId: bookingId,
    });
  } catch {
    // Non-fatal
  }
}

export async function trySendBookingConfirmation(bookingId: number): Promise<void> {
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
          // Non-fatal
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
    // Non-fatal
  }
}

export async function trySendBookingStatusEmail(
  bookingId: number,
  status: "cancelled" | "completed" | "no_show",
  cancellationReason?: string,
  refundResult?: CancellationRefundResult | null,
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
          refundDecision: refundResult?.decision,
          refundAmountInCents: refundResult?.refundAmountInCents,
          depositAmountInCents: refundResult?.depositAmountInCents,
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
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      await sendEmail({
        to: row.clientEmail,
        subject: `Thanks for visiting — ${row.serviceName} — ${bp.businessName}`,
        react: BookingCompleted({
          clientName: row.clientFirstName,
          serviceName: row.serviceName,
          businessName: bp.businessName,
          receiptUrl: `${siteUrl}/api/receipts/${bookingId}`,
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

export async function trySendBookingReschedule(
  bookingId: number,
  oldStartsAt: Date,
): Promise<void> {
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
