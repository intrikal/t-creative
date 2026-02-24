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
import { eq, desc, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, profiles, services } from "@/db/schema";
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

export async function updateBookingStatus(id: number, status: BookingStatus): Promise<void> {
  await getUser();
  await db.update(bookings).set({ status }).where(eq(bookings.id, id));
  revalidatePath("/dashboard/bookings");
}

export async function createBooking(input: BookingInput): Promise<void> {
  await getUser();
  await db.insert(bookings).values({
    clientId: input.clientId,
    serviceId: input.serviceId,
    staffId: input.staffId ?? undefined,
    startsAt: input.startsAt,
    durationMinutes: input.durationMinutes,
    totalInCents: input.totalInCents,
    location: input.location ?? undefined,
    clientNotes: input.clientNotes ?? undefined,
    status: "confirmed",
  });
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
