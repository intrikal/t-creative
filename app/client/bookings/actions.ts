"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, and, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, bookingAddOns, services, profiles, reviews } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

const PATH = "/client/bookings";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ClientBookingRow = {
  id: number;
  dateISO: string;
  date: string;
  time: string;
  service: string;
  category: "lash" | "jewelry" | "crochet" | "consulting";
  assistant: string;
  durationMin: number;
  price: number;
  status: "confirmed" | "pending" | "completed" | "cancelled";
  notes: string | null;
  location: string | null;
  addOns: { name: string; priceInCents: number }[];
  reviewLeft: boolean;
};

export type ClientBookingsData = {
  bookings: ClientBookingRow[];
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getClientBookings(): Promise<ClientBookingsData> {
  const user = await getUser();

  const staffProfile = alias(profiles, "staff");

  // Fetch bookings with service + staff info
  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      startsAt: bookings.startsAt,
      durationMinutes: bookings.durationMinutes,
      totalInCents: bookings.totalInCents,
      clientNotes: bookings.clientNotes,
      location: bookings.location,
      serviceName: services.name,
      serviceCategory: services.category,
      staffFirstName: staffProfile.firstName,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
    .where(eq(bookings.clientId, user.id))
    .orderBy(desc(bookings.startsAt));

  // Fetch add-ons for all bookings in one query
  const bookingIds = rows.map((r) => r.id);
  const addOnMap = new Map<number, { name: string; priceInCents: number }[]>();

  if (bookingIds.length > 0) {
    const addOnRows = await db
      .select({
        bookingId: bookingAddOns.bookingId,
        name: bookingAddOns.addOnName,
        priceInCents: bookingAddOns.priceInCents,
      })
      .from(bookingAddOns)
      .where(sql`${bookingAddOns.bookingId} = ANY(${bookingIds})`);

    for (const a of addOnRows) {
      if (!addOnMap.has(a.bookingId)) addOnMap.set(a.bookingId, []);
      addOnMap.get(a.bookingId)!.push({ name: a.name, priceInCents: a.priceInCents });
    }
  }

  // Check which bookings already have a review from this client
  const reviewedBookingIds = new Set<number>();
  if (bookingIds.length > 0) {
    const reviewRows = await db
      .select({ bookingId: reviews.bookingId })
      .from(reviews)
      .where(and(eq(reviews.clientId, user.id), sql`${reviews.bookingId} = ANY(${bookingIds})`));
    for (const r of reviewRows) {
      if (r.bookingId) reviewedBookingIds.add(r.bookingId);
    }
  }

  const DAY_NAMES_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const bookingList: ClientBookingRow[] = rows.map((r) => {
    const d = new Date(r.startsAt);
    const category = (r.serviceCategory as ClientBookingRow["category"]) ?? "lash";

    // Filter to statuses the UI supports
    let status: ClientBookingRow["status"] = "pending";
    if (r.status === "confirmed") status = "confirmed";
    else if (r.status === "completed") status = "completed";
    else if (r.status === "cancelled" || r.status === "no_show") status = "cancelled";
    else status = "pending";

    return {
      id: r.id,
      dateISO: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      date: `${DAY_NAMES_FULL[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      service: r.serviceName ?? "Service",
      category,
      assistant: r.staffFirstName ?? "Staff",
      durationMin: r.durationMinutes,
      price: r.totalInCents / 100,
      status,
      notes: r.clientNotes,
      location: r.location,
      addOns: addOnMap.get(r.id) ?? [],
      reviewLeft: reviewedBookingIds.has(r.id),
    };
  });

  return { bookings: bookingList };
}

/* ------------------------------------------------------------------ */
/*  Submit review                                                      */
/* ------------------------------------------------------------------ */

export async function submitClientReview(data: {
  bookingId: number;
  rating: number;
  comment: string;
}) {
  const user = await getUser();

  // Verify the booking belongs to this client
  const [booking] = await db
    .select({
      clientId: bookings.clientId,
      serviceId: bookings.serviceId,
    })
    .from(bookings)
    .where(eq(bookings.id, data.bookingId))
    .limit(1);

  if (!booking || booking.clientId !== user.id) {
    throw new Error("Booking not found");
  }

  // Get service name for the review
  const [service] = await db
    .select({ name: services.name })
    .from(services)
    .where(eq(services.id, booking.serviceId))
    .limit(1);

  // Check if review already exists for this booking
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.clientId, user.id), eq(reviews.bookingId, data.bookingId)))
    .limit(1);

  if (existing) throw new Error("Review already submitted");

  await db.insert(reviews).values({
    bookingId: data.bookingId,
    clientId: user.id,
    source: "website",
    rating: data.rating,
    body: data.comment || null,
    serviceName: service?.name ?? "Service",
    status: "pending",
  });

  revalidatePath(PATH);
}

/* ------------------------------------------------------------------ */
/*  Cancel booking                                                     */
/* ------------------------------------------------------------------ */

export async function cancelClientBooking(bookingId: number) {
  const user = await getUser();

  // Verify the booking belongs to this client and is cancellable
  const [booking] = await db
    .select({ clientId: bookings.clientId, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking || booking.clientId !== user.id) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "pending" && booking.status !== "confirmed") {
    throw new Error("This booking cannot be cancelled");
  }

  await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: "Cancelled by client",
    })
    .where(eq(bookings.id, bookingId));

  revalidatePath(PATH);
}
