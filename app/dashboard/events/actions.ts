"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { events, eventGuests, eventVenues } from "@/db/schema";
import { EventInviteEmail } from "@/emails/EventInviteEmail";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
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

export type VenueType =
  | "studio"
  | "client_home"
  | "external_venue"
  | "pop_up_venue"
  | "corporate_venue";

export type VenueRow = {
  id: number;
  name: string;
  address: string | null;
  venueType: VenueType;
  parkingInfo: string | null;
  setupNotes: string | null;
  defaultTravelFeeInCents: number | null;
  isActive: boolean;
};

export type VenueInput = {
  name: string;
  address?: string | null;
  venueType: VenueType;
  parkingInfo?: string | null;
  setupNotes?: string | null;
  defaultTravelFeeInCents?: number | null;
};

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
  venueId: number | null;
  venueName: string | null;
  location: string | null;
  address: string | null;
  equipmentNotes: string | null;
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
  /** Corporate event fields — admin only (billingEmail/poNumber hidden from clients). */
  companyName: string | null;
  billingEmail: string | null;
  poNumber: string | null;
  guests: EventGuestRow[];
};

export type EventInput = {
  title: string;
  eventType: EventType;
  status: EventStatus;
  startsAt: string;
  endsAt?: string | null;
  venueId?: number | null;
  location?: string | null;
  address?: string | null;
  equipmentNotes?: string | null;
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
  companyName?: string | null;
  billingEmail?: string | null;
  poNumber?: string | null;
};

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const venueTypeEnum = z.enum([
  "studio",
  "client_home",
  "external_venue",
  "pop_up_venue",
  "corporate_venue",
]);

const eventTypeEnum = z.enum([
  "bridal",
  "pop_up",
  "private_party",
  "travel",
  "workshop",
  "birthday",
  "corporate",
]);

const eventStatusEnum = z.enum(["draft", "upcoming", "confirmed", "completed", "cancelled"]);

const venueInputSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  venueType: venueTypeEnum,
  parkingInfo: z.string().nullable().optional(),
  setupNotes: z.string().nullable().optional(),
  defaultTravelFeeInCents: z.number().int().nonnegative().nullable().optional(),
});

const eventInputSchema = z.object({
  title: z.string().min(1),
  eventType: eventTypeEnum,
  status: eventStatusEnum,
  startsAt: z.string().min(1),
  endsAt: z.string().nullable().optional(),
  venueId: z.number().int().positive().nullable().optional(),
  location: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  equipmentNotes: z.string().nullable().optional(),
  maxAttendees: z.number().int().positive().nullable().optional(),
  expectedRevenueInCents: z.number().int().nonnegative().nullable().optional(),
  depositInCents: z.number().int().nonnegative().nullable().optional(),
  travelFeeInCents: z.number().int().nonnegative().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  services: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  billingEmail: z.string().email().nullable().optional(),
  poNumber: z.string().nullable().optional(),
});

const guestInputSchema = z.object({
  name: z.string().min(1),
  service: z.string().optional(),
  paid: z.boolean().optional(),
});

/* ------------------------------------------------------------------ */
/*  Venue queries                                                      */
/* ------------------------------------------------------------------ */

export async function getVenues(): Promise<VenueRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: eventVenues.id,
        name: eventVenues.name,
        address: eventVenues.address,
        venueType: eventVenues.venueType,
        parkingInfo: eventVenues.parkingInfo,
        setupNotes: eventVenues.setupNotes,
        defaultTravelFeeInCents: eventVenues.defaultTravelFeeInCents,
        isActive: eventVenues.isActive,
      })
      .from(eventVenues)
      .orderBy(eventVenues.name);

    return rows.map((r) => ({ ...r, venueType: r.venueType as VenueType }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Venue mutations                                                    */
/* ------------------------------------------------------------------ */

export async function createVenue(data: VenueInput): Promise<number> {
  try {
    venueInputSchema.parse(data);
    await getUser();

    const [row] = await db
      .insert(eventVenues)
      .values({
        name: data.name,
        address: data.address ?? null,
        venueType: data.venueType,
        parkingInfo: data.parkingInfo ?? null,
        setupNotes: data.setupNotes ?? null,
        defaultTravelFeeInCents: data.defaultTravelFeeInCents ?? null,
      })
      .returning({ id: eventVenues.id });

    revalidatePath(PATH);
    return row.id;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateVenue(id: number, data: Partial<VenueInput> & { isActive?: boolean }) {
  try {
    z.number().int().positive().parse(id);
    venueInputSchema.partial().extend({ isActive: z.boolean().optional() }).parse(data);
    await getUser();

    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set.name = data.name;
    if (data.address !== undefined) set.address = data.address;
    if (data.venueType !== undefined) set.venueType = data.venueType;
    if (data.parkingInfo !== undefined) set.parkingInfo = data.parkingInfo;
    if (data.setupNotes !== undefined) set.setupNotes = data.setupNotes;
    if (data.defaultTravelFeeInCents !== undefined)
      set.defaultTravelFeeInCents = data.defaultTravelFeeInCents;
    if (data.isActive !== undefined) set.isActive = data.isActive;

    await db.update(eventVenues).set(set).where(eq(eventVenues.id, id));
    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

export async function getEvents(): Promise<EventRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        eventType: events.eventType,
        status: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        venueId: events.venueId,
        venueName: eventVenues.name,
        location: events.location,
        address: events.address,
        equipmentNotes: events.equipmentNotes,
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
        companyName: events.companyName,
        billingEmail: events.billingEmail,
        poNumber: events.poNumber,
      })
      .from(events)
      .leftJoin(eventVenues, eq(events.venueId, eventVenues.id))
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
      venueName: r.venueName ?? null,
      guests: guestsByEvent.get(r.id) ?? [],
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Client query — events where the client is the host                 */
/* ------------------------------------------------------------------ */

export async function getClientEvents(): Promise<EventRow[]> {
  try {
    const user = await getUser();

    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        eventType: events.eventType,
        status: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        venueId: events.venueId,
        venueName: eventVenues.name,
        location: events.location,
        address: events.address,
        equipmentNotes: events.equipmentNotes,
        maxAttendees: events.maxAttendees,
        expectedRevenueInCents: events.expectedRevenueInCents,
        depositInCents: events.depositInCents,
        travelFeeInCents: events.travelFeeInCents,
        contactName: events.contactName,
        contactEmail: events.contactEmail,
        contactPhone: events.contactPhone,
        services: events.services,
        description: events.description,
        companyName: events.companyName,
      })
      .from(events)
      .leftJoin(eventVenues, eq(events.venueId, eventVenues.id))
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
      venueName: r.venueName ?? null,
      internalNotes: null, // Don't expose internal notes to clients
      billingEmail: null, // Don't expose billing details to clients
      poNumber: null, // Don't expose billing details to clients
      guests: guestsByEvent.get(r.id) ?? [],
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Resolves location/address from a saved venue when venueId is provided.
 * Returns the denormalized values to store on the event row.
 */
async function resolveVenueLocation(
  venueId: number | null | undefined,
  fallbackLocation: string | null | undefined,
  fallbackAddress: string | null | undefined,
): Promise<{ location: string | null; address: string | null }> {
  if (!venueId) {
    return { location: fallbackLocation ?? null, address: fallbackAddress ?? null };
  }
  const [venue] = await db
    .select({ name: eventVenues.name, address: eventVenues.address })
    .from(eventVenues)
    .where(eq(eventVenues.id, venueId));
  if (!venue) return { location: fallbackLocation ?? null, address: fallbackAddress ?? null };
  return { location: venue.name, address: venue.address };
}

export async function createEvent(data: EventInput): Promise<number> {
  try {
    eventInputSchema.parse(data);
    const user = await getUser();

    const { location, address } = await resolveVenueLocation(
      data.venueId,
      data.location,
      data.address,
    );

    const [row] = await db
      .insert(events)
      .values({
        hostId: user.id,
        title: data.title,
        eventType: data.eventType,
        status: data.status,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        venueId: data.venueId ?? null,
        location,
        address,
        equipmentNotes: data.equipmentNotes ?? null,
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
        companyName: data.companyName ?? null,
        billingEmail: data.billingEmail ?? null,
        poNumber: data.poNumber ?? null,
      })
      .returning({ id: events.id });

    trackEvent(user.id, "event_created", { title: data.title, eventType: data.eventType });
    revalidatePath(PATH);
    return row.id;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateEvent(id: number, data: Partial<EventInput>) {
  try {
    z.number().int().positive().parse(id);
    eventInputSchema.partial().parse(data);
    const user = await getUser();

    const set: Record<string, unknown> = {};
    if (data.title !== undefined) set.title = data.title;
    if (data.eventType !== undefined) set.eventType = data.eventType;
    if (data.status !== undefined) set.status = data.status;
    if (data.startsAt !== undefined) set.startsAt = new Date(data.startsAt);
    if (data.endsAt !== undefined) set.endsAt = data.endsAt ? new Date(data.endsAt) : null;
    if (data.venueId !== undefined) set.venueId = data.venueId;
    if (data.equipmentNotes !== undefined) set.equipmentNotes = data.equipmentNotes;
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
    if (data.companyName !== undefined) set.companyName = data.companyName;
    if (data.billingEmail !== undefined) set.billingEmail = data.billingEmail;
    if (data.poNumber !== undefined) set.poNumber = data.poNumber;

    // Resolve location from venue if venueId is being updated
    if (data.venueId !== undefined || data.location !== undefined || data.address !== undefined) {
      const { location, address } = await resolveVenueLocation(
        data.venueId,
        data.location,
        data.address,
      );
      set.location = location;
      set.address = address;
    }

    if (data.status === "completed") set.completedAt = new Date();
    if (data.status === "cancelled") set.cancelledAt = new Date();

    await db.update(events).set(set).where(eq(events.id, id));
    trackEvent(user.id, "event_updated", { eventId: id, status: data.status });
    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function deleteEvent(id: number) {
  try {
    z.number().int().positive().parse(id);
    const user = await getUser();
    await db.delete(events).where(eq(events.id, id));
    trackEvent(user.id, "event_deleted", { eventId: id });
    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Guest mutations                                                    */
/* ------------------------------------------------------------------ */

export async function addGuest(
  eventId: number,
  guest: { name: string; service?: string; paid?: boolean },
) {
  try {
    z.number().int().positive().parse(eventId);
    guestInputSchema.parse(guest);
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
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function removeGuest(guestId: number) {
  try {
    z.number().int().positive().parse(guestId);
    await getUser();
    await db.delete(eventGuests).where(eq(eventGuests.id, guestId));
    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function toggleGuestPaid(guestId: number) {
  try {
    z.number().int().positive().parse(guestId);
    await getUser();
    await db
      .update(eventGuests)
      .set({ paid: sql`NOT ${eventGuests.paid}` })
      .where(eq(eventGuests.id, guestId));
    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  RSVP invite                                                        */
/* ------------------------------------------------------------------ */

/**
 * Generates a unique RSVP token for an event, saves it to events.metadata,
 * and emails the invite link to the event's contact email.
 * Returns the public RSVP URL.
 */
export async function sendEventRsvpInvite(eventId: number): Promise<{ url: string }> {
  try {
    z.number().int().positive().parse(eventId);
    await getUser();

    const [event] = await db
      .select({
        id: events.id,
        title: events.title,
        startsAt: events.startsAt,
        location: events.location,
        services: events.services,
        contactEmail: events.contactEmail,
        contactName: events.contactName,
        metadata: events.metadata,
      })
      .from(events)
      .where(eq(events.id, eventId));

    if (!event) throw new Error("Event not found");
    if (!event.contactEmail) throw new Error("Event has no contact email");

    // Generate or reuse existing RSVP token
    const existing = (event.metadata as Record<string, unknown> | null)?.rsvpToken as
      | string
      | undefined;
    const token = existing ?? crypto.randomUUID();

    if (!existing) {
      await db
        .update(events)
        .set({ metadata: { ...(event.metadata ?? {}), rsvpToken: token } })
        .where(eq(events.id, eventId));
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tcreativestudio.com";
    const rsvpUrl = `${baseUrl}/rsvp/${token}`;

    const eventDate = new Date(event.startsAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    await sendEmail({
      to: event.contactEmail,
      subject: `You're invited — ${event.title} — T Creative Studio`,
      react: EventInviteEmail({
        eventTitle: event.title,
        eventDate,
        eventLocation: event.location,
        services: event.services,
        rsvpUrl,
      }),
      entityType: "event_invite",
      localId: String(eventId),
    });

    revalidatePath(PATH);
    return { url: rsvpUrl };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
