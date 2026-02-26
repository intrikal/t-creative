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
import { eq, desc, ne, and, gte, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, profiles, services, syncLog } from "@/db/schema";
import { BookingCancellation } from "@/emails/BookingCancellation";
import { BookingCompleted } from "@/emails/BookingCompleted";
import { BookingConfirmation } from "@/emails/BookingConfirmation";
import { BookingNoShow } from "@/emails/BookingNoShow";
import { BookingReschedule } from "@/emails/BookingReschedule";
import { sendEmail } from "@/lib/resend";
import { isSquareConfigured, createSquareOrder } from "@/lib/square";
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
};

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function getBookings(): Promise<BookingRow[]> {
  await getUser();

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
    })
    .from(bookings)
    .leftJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
    .orderBy(desc(bookings.startsAt));

  return rows.map((r) => ({
    ...r,
    clientFirstName: r.clientFirstName ?? "",
    serviceName: r.serviceName ?? "",
    serviceCategory: r.serviceCategory ?? "lash",
  }));
}

export async function updateBookingStatus(
  id: number,
  status: BookingStatus,
  cancellationReason?: string,
): Promise<void> {
  await getUser();

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
      .where(eq(bookings.id, id));

    if (booking && !booking.squareOrderId) {
      await tryCreateSquareOrder(id, booking.serviceId, booking.totalInCents);
    }

    // Send booking confirmation email
    await trySendBookingConfirmation(id);
  }

  if (status === "cancelled") {
    await trySendBookingStatusEmail(id, "cancelled", cancellationReason);
  }

  if (status === "completed") {
    await trySendBookingStatusEmail(id, "completed");
  }

  if (status === "no_show") {
    await trySendBookingStatusEmail(id, "no_show");
  }

  revalidatePath("/dashboard/bookings");
}

export async function createBooking(input: BookingInput): Promise<void> {
  await getUser();

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
      status: "confirmed",
      confirmedAt: new Date(),
    })
    .returning({ id: bookings.id });

  // Create Square order for POS payment matching
  await tryCreateSquareOrder(newBooking.id, input.serviceId, input.totalInCents);

  // Send booking confirmation email
  await trySendBookingConfirmation(newBooking.id);

  revalidatePath("/dashboard/bookings");
}

export async function updateBooking(
  id: number,
  input: BookingInput & { status: BookingStatus },
): Promise<void> {
  await getUser();

  // Fetch old booking time to detect reschedule
  const [oldBooking] = await db
    .select({ startsAt: bookings.startsAt })
    .from(bookings)
    .where(eq(bookings.id, id));

  const updates: Record<string, unknown> = {
    clientId: input.clientId,
    serviceId: input.serviceId,
    staffId: input.staffId ?? undefined,
    startsAt: input.startsAt,
    durationMinutes: input.durationMinutes,
    totalInCents: input.totalInCents,
    location: input.location ?? undefined,
    clientNotes: input.clientNotes ?? undefined,
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

  revalidatePath("/dashboard/bookings");
}

export async function deleteBooking(id: number): Promise<void> {
  await getUser();
  await db.delete(bookings).where(eq(bookings.id, id));
  revalidatePath("/dashboard/bookings");
}

export async function getClientsForSelect(): Promise<
  { id: string; name: string; phone: string | null }[]
> {
  await getUser();
  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      phone: profiles.phone,
    })
    .from(profiles)
    .where(eq(profiles.role, "client"))
    .orderBy(profiles.firstName);

  return rows.map((r) => ({
    id: r.id,
    name: [r.firstName, r.lastName].filter(Boolean).join(" "),
    phone: r.phone,
  }));
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
}

export async function getStaffForSelect(): Promise<{ id: string; name: string }[]> {
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
/*  Booking confirmation email (non-fatal)                             */
/* ------------------------------------------------------------------ */

async function trySendBookingConfirmation(bookingId: number): Promise<void> {
  try {
    const confirmClient = alias(profiles, "confirmClient");
    const [row] = await db
      .select({
        clientEmail: confirmClient.email,
        clientFirstName: confirmClient.firstName,
        serviceName: services.name,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
      })
      .from(bookings)
      .innerJoin(confirmClient, eq(bookings.clientId, confirmClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(eq(bookings.id, bookingId));

    if (!row?.clientEmail) return;

    const startsAtFormatted = row.startsAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

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
  } catch {
    // Non-fatal — booking confirmation email failure shouldn't break the flow
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
        clientEmail: statusClient.email,
        clientFirstName: statusClient.firstName,
        notifyEmail: statusClient.notifyEmail,
        serviceName: services.name,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .innerJoin(statusClient, eq(bookings.clientId, statusClient.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(eq(bookings.id, bookingId));

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
      .where(eq(bookings.id, bookingId));

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
    .where(eq(bookings.staffId, user.id))
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
}
