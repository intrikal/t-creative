"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, eventGuests, profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

const PATH = "/dashboard/events";

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

export type EventType =
  | "bridal"
  | "pop_up"
  | "private_party"
  | "travel"
  | "workshop"
  | "birthday"
  | "corporate";

export type EventStatus = "draft" | "upcoming" | "confirmed" | "completed" | "cancelled";

export type EventGuestRow = {
  id: number;
  name: string;
  service: string | null;
  paid: boolean;
};

export type EventRow = {
  id: number;
  title: string;
  eventType: EventType;
  status: EventStatus;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  address: string | null;
  maxAttendees: number | null;
  expectedRevenueInCents: number | null;
  depositInCents: number | null;
  travelFeeInCents: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  services: string | null;
  internalNotes: string | null;
  description: string | null;
  guests: EventGuestRow[];
};

export type EventInput = {
  title: string;
  eventType: EventType;
  status: EventStatus;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  address?: string | null;
  maxAttendees?: number | null;
  expectedRevenueInCents?: number | null;
  depositInCents?: number | null;
  travelFeeInCents?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  services?: string | null;
  internalNotes?: string | null;
  description?: string | null;
};

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getEvents(): Promise<EventRow[]> {
  await getUser();

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      eventType: events.eventType,
      status: events.status,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      address: events.address,
      maxAttendees: events.maxAttendees,
      expectedRevenueInCents: events.expectedRevenueInCents,
      depositInCents: events.depositInCents,
      travelFeeInCents: events.travelFeeInCents,
      contactName: events.contactName,
      contactEmail: events.contactEmail,
      contactPhone: events.contactPhone,
      services: events.services,
      internalNotes: events.internalNotes,
      description: events.description,
    })
    .from(events)
    .orderBy(desc(events.startsAt));

  // Fetch guests for all events in one query
  const allGuests = await db
    .select({
      id: eventGuests.id,
      eventId: eventGuests.eventId,
      name: eventGuests.name,
      service: eventGuests.service,
      paid: eventGuests.paid,
    })
    .from(eventGuests);

  const guestsByEvent = new Map<number, EventGuestRow[]>();
  for (const g of allGuests) {
    const list = guestsByEvent.get(g.eventId) ?? [];
    list.push({ id: g.id, name: g.name, service: g.service, paid: g.paid });
    guestsByEvent.set(g.eventId, list);
  }

  return rows.map((r) => ({
    ...r,
    eventType: r.eventType as EventType,
    status: r.status as EventStatus,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt?.toISOString() ?? null,
    guests: guestsByEvent.get(r.id) ?? [],
  }));
}

/* ------------------------------------------------------------------ */
/*  Client query — events where the client is the host                 */
/* ------------------------------------------------------------------ */

export async function getClientEvents(): Promise<EventRow[]> {
  const user = await getUser();

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      eventType: events.eventType,
      status: events.status,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      address: events.address,
      maxAttendees: events.maxAttendees,
      expectedRevenueInCents: events.expectedRevenueInCents,
      depositInCents: events.depositInCents,
      travelFeeInCents: events.travelFeeInCents,
      contactName: events.contactName,
      contactEmail: events.contactEmail,
      contactPhone: events.contactPhone,
      services: events.services,
      description: events.description,
    })
    .from(events)
    .where(eq(events.hostId, user.id))
    .orderBy(desc(events.startsAt));

  const eventIds = rows.map((r) => r.id);
  const allGuests =
    eventIds.length > 0
      ? await db
          .select({
            id: eventGuests.id,
            eventId: eventGuests.eventId,
            name: eventGuests.name,
            service: eventGuests.service,
            paid: eventGuests.paid,
          })
          .from(eventGuests)
      : [];

  const guestsByEvent = new Map<number, EventGuestRow[]>();
  for (const g of allGuests) {
    if (!eventIds.includes(g.eventId)) continue;
    const list = guestsByEvent.get(g.eventId) ?? [];
    list.push({ id: g.id, name: g.name, service: g.service, paid: g.paid });
    guestsByEvent.set(g.eventId, list);
  }

  return rows.map((r) => ({
    ...r,
    eventType: r.eventType as EventType,
    status: r.status as EventStatus,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt?.toISOString() ?? null,
    internalNotes: null, // Don't expose internal notes to clients
    guests: guestsByEvent.get(r.id) ?? [],
  }));
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function createEvent(data: EventInput): Promise<number> {
  const user = await getUser();

  const [row] = await db
    .insert(events)
    .values({
      hostId: user.id,
      title: data.title,
      eventType: data.eventType,
      status: data.status,
      startsAt: new Date(data.startsAt),
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      location: data.location ?? null,
      address: data.address ?? null,
      maxAttendees: data.maxAttendees ?? null,
      expectedRevenueInCents: data.expectedRevenueInCents ?? null,
      depositInCents: data.depositInCents ?? null,
      travelFeeInCents: data.travelFeeInCents ?? null,
      contactName: data.contactName ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      services: data.services ?? null,
      internalNotes: data.internalNotes ?? null,
      description: data.description ?? null,
    })
    .returning({ id: events.id });

  revalidatePath(PATH);
  return row.id;
}

export async function updateEvent(id: number, data: Partial<EventInput>) {
  await getUser();

  const set: Record<string, unknown> = {};
  if (data.title !== undefined) set.title = data.title;
  if (data.eventType !== undefined) set.eventType = data.eventType;
  if (data.status !== undefined) set.status = data.status;
  if (data.startsAt !== undefined) set.startsAt = new Date(data.startsAt);
  if (data.endsAt !== undefined) set.endsAt = data.endsAt ? new Date(data.endsAt) : null;
  if (data.location !== undefined) set.location = data.location;
  if (data.address !== undefined) set.address = data.address;
  if (data.maxAttendees !== undefined) set.maxAttendees = data.maxAttendees;
  if (data.expectedRevenueInCents !== undefined)
    set.expectedRevenueInCents = data.expectedRevenueInCents;
  if (data.depositInCents !== undefined) set.depositInCents = data.depositInCents;
  if (data.travelFeeInCents !== undefined) set.travelFeeInCents = data.travelFeeInCents;
  if (data.contactName !== undefined) set.contactName = data.contactName;
  if (data.contactEmail !== undefined) set.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) set.contactPhone = data.contactPhone;
  if (data.services !== undefined) set.services = data.services;
  if (data.internalNotes !== undefined) set.internalNotes = data.internalNotes;
  if (data.description !== undefined) set.description = data.description;

  if (data.status === "completed") set.completedAt = new Date();
  if (data.status === "cancelled") set.cancelledAt = new Date();

  await db.update(events).set(set).where(eq(events.id, id));
  revalidatePath(PATH);
}

export async function deleteEvent(id: number) {
  await getUser();
  await db.delete(events).where(eq(events.id, id));
  revalidatePath(PATH);
}

/* ------------------------------------------------------------------ */
/*  Guest mutations                                                    */
/* ------------------------------------------------------------------ */

export async function addGuest(
  eventId: number,
  guest: { name: string; service?: string; paid?: boolean },
) {
  await getUser();

  const [row] = await db
    .insert(eventGuests)
    .values({
      eventId,
      name: guest.name,
      service: guest.service ?? null,
      paid: guest.paid ?? false,
    })
    .returning({ id: eventGuests.id });

  revalidatePath(PATH);
  return row.id;
}

export async function removeGuest(guestId: number) {
  await getUser();
  await db.delete(eventGuests).where(eq(eventGuests.id, guestId));
  revalidatePath(PATH);
}

export async function toggleGuestPaid(guestId: number) {
  await getUser();
  await db
    .update(eventGuests)
    .set({ paid: sql`NOT ${eventGuests.paid}` })
    .where(eq(eventGuests.id, guestId));
  revalidatePath(PATH);
}
