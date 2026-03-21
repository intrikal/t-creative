/**
 * Event server actions — queries and mutations for the Events feature.
 *
 * Consumed by:
 *   - app/dashboard/events/EventsPage.tsx (admin event list)
 *   - app/dashboard/events/ClientEventsPage.tsx (client-facing view)
 *   - app/dashboard/calendar/ (calendar grid and event creation)
 *
 * All exported functions are Next.js server actions ("use server").
 * Admin actions gate on requireAdmin; client actions gate on requireAuth.
 * Every mutation calls revalidatePath(PATH) so the events dashboard
 * picks up changes without a full page reload.
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, sql, and, inArray, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { events, eventGuests, eventStaff, eventVenues, profiles } from "@/db/schema";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { EventInviteEmail } from "@/emails/EventInviteEmail";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import { requireAdmin, getUser as requireAuth } from "@/lib/auth";

/** Revalidation target — Next.js busts the RSC cache for this path after every mutation. */
const PATH = "/dashboard/events";

/** Alias: all actions in this file require admin unless noted otherwise. */
const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * Narrow string-union types mirroring the DB enums.
 * These are re-exported so UI components avoid importing the schema directly.
 */
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

/** Shape returned by getVenues — flat row with no relations. */
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

/** Write payload for createVenue / updateVenue. */
export type VenueInput = {
  name: string;
  address?: string | null;
  venueType: VenueType;
  parkingInfo?: string | null;
  setupNotes?: string | null;
  defaultTravelFeeInCents?: number | null;
};

/** Staff assignment row with denormalized name from profiles. */
export type EventStaffRow = {
  id: number;
  staffId: string;
  staffName: string;
  role: string | null;
  notes: string | null;
};

/** Guest row — tracks name, chosen service, and payment status. */
export type EventGuestRow = {
  id: number;
  name: string;
  service: string | null;
  paid: boolean;
};

/**
 * Composite event row returned by getEvents / getClientEvents.
 * Includes denormalized venue name and nested guest + staff arrays
 * so the UI can render a full event card without extra fetches.
 */
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
  /**
   * Corporate event fields — admin only.
   * billingEmail and poNumber are nulled out in getClientEvents
   * to prevent leaking billing details to the client-facing view.
   */
  companyName: string | null;
  billingEmail: string | null;
  poNumber: string | null;
  guests: EventGuestRow[];
  staffAssignments: EventStaffRow[];
};

/** Write payload for createEvent / updateEvent (partial for updates). */
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

/**
 * Runtime validation schemas — mirror the DB enums and column constraints.
 * Every mutation validates input before touching the database so callers
 * get a clear Zod error rather than a Postgres constraint violation.
 */
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

/** Returns all saved venues (active and inactive) for the venue management dialog. */
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

    // Narrow Drizzle's wide string type for venueType back to the strict
    // VenueType union. Spread copies all fields, overriding just the one
    // that needs the type assertion.
    return rows.map((r) => ({ ...r, venueType: r.venueType as VenueType }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Venue mutations                                                    */
/* ------------------------------------------------------------------ */

/** Creates a reusable venue record. Returns the new venue id. */
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

/**
 * Partial-updates a venue. Also handles soft-delete via the isActive flag
 * so historical events still reference the venue name.
 */
export async function updateVenue(id: number, data: Partial<VenueInput> & { isActive?: boolean }) {
  try {
    z.number().int().positive().parse(id);
    venueInputSchema.partial().extend({ isActive: z.boolean().optional() }).parse(data);
    await getUser();

    /* Build a sparse SET clause — only touch columns the caller supplied,
       so an update to parkingInfo alone won't null out the address. */
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
/*  Event queries                                                      */
/* ------------------------------------------------------------------ */

/**
 * Returns all events (admin view) with optional date-range filtering.
 *
 * Uses a two-phase query strategy:
 *   1. Fetch event rows with a LEFT JOIN to eventVenues for the venue name.
 *   2. Batch-fetch guests and staff for the returned event ids via inArray.
 *
 * This avoids an N+1 problem — instead of querying guests per event,
 * we pull them all in one shot and group in memory.
 */
export async function getEvents(opts?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<EventRow[]> {
  try {
    await getUser();

    const conditions = [];
    if (opts?.startDate) conditions.push(gte(events.startsAt, opts.startDate));
    if (opts?.endDate) conditions.push(lte(events.startsAt, opts.endDate));

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
      /* LEFT JOIN: events may have a saved venue or a free-text location. */
      .leftJoin(eventVenues, eq(events.venueId, eventVenues.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(events.startsAt));

    /* Phase 2: batch-load guests and staff for all returned events.
       Guard against empty eventIds — Postgres inArray([]) would error. */
    // Extract event IDs for the batch guest/staff fetch below.
    const eventIds = rows.map((r) => r.id);
    // Promise.all fetches guests and staff assignments concurrently for all
    // events in one shot — avoids an N+1 query problem (one query per event).
    // Ternary guards against empty eventIds: Postgres inArray([]) would error.
    const [allGuests, allStaffRows] =
      eventIds.length > 0
        ? await Promise.all([
            db
              .select({
                id: eventGuests.id,
                eventId: eventGuests.eventId,
                name: eventGuests.name,
                service: eventGuests.service,
                paid: eventGuests.paid,
              })
              .from(eventGuests)
              .where(inArray(eventGuests.eventId, eventIds)),
            db
              .select({
                id: eventStaff.id,
                eventId: eventStaff.eventId,
                staffId: eventStaff.staffId,
                firstName: profiles.firstName,
                lastName: profiles.lastName,
                role: eventStaff.role,
                notes: eventStaff.notes,
              })
              .from(eventStaff)
              /* INNER JOIN profiles to denormalize the staff display name.
                 If a profile is deleted, the cascade on eventStaff removes
                 the row, so an inner join is safe (no orphans). */
              .innerJoin(profiles, eq(eventStaff.staffId, profiles.id))
              .where(inArray(eventStaff.eventId, eventIds)),
          ])
        : [[], []];

    /* Group guests and staff into Maps keyed by eventId for O(1) lookup. */
    const guestsByEvent = new Map<number, EventGuestRow[]>();
    for (const g of allGuests) {
      const list = guestsByEvent.get(g.eventId) ?? [];
      list.push({ id: g.id, name: g.name, service: g.service, paid: g.paid });
      guestsByEvent.set(g.eventId, list);
    }

    const staffByEvent = new Map<number, EventStaffRow[]>();
    for (const s of allStaffRows) {
      const list = staffByEvent.get(s.eventId) ?? [];
      list.push({
        id: s.id,
        staffId: s.staffId,
        // Build display name from first + last, filtering out null/empty parts.
        // filter(Boolean) handles cases where lastName is null (single-name staff).
        staffName: [s.firstName, s.lastName].filter(Boolean).join(" "),
        role: s.role,
        notes: s.notes,
      });
      staffByEvent.set(s.eventId, list);
    }

    /* Serialize dates to ISO strings and narrow Drizzle's wide string
       types back to our strict union types for the UI layer. */
    // Spread each row to copy all 20+ fields, then override dates (to ISO strings),
    // enum types (to strict unions), and attach the pre-grouped guests/staff arrays.
    // Map lookups are O(1) per event thanks to the Maps built above.
    return rows.map((r) => ({
      ...r,
      eventType: r.eventType as EventType,
      status: r.status as EventStatus,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt?.toISOString() ?? null,
      venueName: r.venueName ?? null,
      guests: guestsByEvent.get(r.id) ?? [],
      staffAssignments: staffByEvent.get(r.id) ?? [],
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Client query — events where the client is the host                 */
/* ------------------------------------------------------------------ */

/**
 * Client-facing variant of getEvents — scoped to events.hostId = user.id.
 *
 * Uses requireAuth (not requireAdmin) so any logged-in client can view
 * their own events. Sensitive admin fields (internalNotes, billingEmail,
 * poNumber) are explicitly nulled out before returning.
 */
export async function getClientEvents(): Promise<EventRow[]> {
  try {
    const user = await requireAuth();

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

    // Extract event IDs for batch-fetching guests and staff below.
    const eventIds = rows.map((r) => r.id);
    // Ternary: guard against empty eventIds — Postgres inArray([]) would error.
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
            .where(inArray(eventGuests.eventId, eventIds))
        : [];

    const guestsByEvent = new Map<number, EventGuestRow[]>();
    for (const g of allGuests) {
      const list = guestsByEvent.get(g.eventId) ?? [];
      list.push({ id: g.id, name: g.name, service: g.service, paid: g.paid });
      guestsByEvent.set(g.eventId, list);
    }

    // Fetch staff assignments for client's events
    const allStaffRows =
      eventIds.length > 0
        ? await db
            .select({
              id: eventStaff.id,
              eventId: eventStaff.eventId,
              staffId: eventStaff.staffId,
              firstName: profiles.firstName,
              lastName: profiles.lastName,
              role: eventStaff.role,
              notes: eventStaff.notes,
            })
            .from(eventStaff)
            .innerJoin(profiles, eq(eventStaff.staffId, profiles.id))
            .where(inArray(eventStaff.eventId, eventIds))
        : [];

    const staffByEvent = new Map<number, EventStaffRow[]>();
    for (const s of allStaffRows) {
      const list = staffByEvent.get(s.eventId) ?? [];
      list.push({
        id: s.id,
        staffId: s.staffId,
        // Build display name, filtering out null/empty name parts.
        staffName: [s.firstName, s.lastName].filter(Boolean).join(" "),
        role: s.role,
        notes: s.notes,
      });
      staffByEvent.set(s.eventId, list);
    }

    // Spread each event row, override dates/types, null out admin-only fields,
    // and attach guest/staff arrays. Spread copies all shared fields, then
    // explicit nulls for internalNotes/billingEmail/poNumber prevent leaking
    // sensitive admin data to the client-facing view.
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
      staffAssignments: staffByEvent.get(r.id) ?? [],
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Event mutations                                                    */
/* ------------------------------------------------------------------ */

/**
 * Resolves location/address from a saved venue when venueId is provided.
 * Returns the denormalized values to store on the event row.
 *
 * Why denormalize? The event card and email templates need a display
 * name and address without joining through eventVenues every time.
 * When venueId is null the caller's free-text fallbacks are used instead.
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

/** Creates a new event. The authenticated admin becomes the host. Returns the new event id. */
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

/**
 * Partial-updates an event. Only supplied fields are written.
 *
 * Status transitions: when status changes to "completed" or "cancelled",
 * the corresponding timestamp (completedAt / cancelledAt) is set
 * so the dashboard can show when the transition happened.
 */
export async function updateEvent(id: number, data: Partial<EventInput>) {
  try {
    z.number().int().positive().parse(id);
    eventInputSchema.partial().parse(data);
    const user = await getUser();

    /* Sparse SET — same pattern as updateVenue to avoid clobbering untouched fields. */
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

    /* Re-resolve denormalized location when any location-related field changes,
       so the event card stays in sync with the venue record. */
    if (data.venueId !== undefined || data.location !== undefined || data.address !== undefined) {
      const { location, address } = await resolveVenueLocation(
        data.venueId,
        data.location,
        data.address,
      );
      set.location = location;
      set.address = address;
    }

    /* Record terminal-state timestamps for audit / reporting. */
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

/** Hard-deletes an event. Guests and staff assignments cascade via FK. */
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

/** Adds a guest to an event's attendee list. Returns the new guest id. */
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

/** Removes a guest by id. */
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

/** Flips a guest's paid flag in-place using a SQL NOT expression to avoid a read-then-write. */
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
        // Spread existing metadata to preserve any other keys, then add/overwrite
        // just the rsvpToken. This is non-destructive — other metadata fields survive.
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

    const bp = await getPublicBusinessProfile();
    await sendEmail({
      to: event.contactEmail,
      subject: `You're invited — ${event.title} — ${bp.businessName}`,
      react: EventInviteEmail({
        eventTitle: event.title,
        eventDate,
        eventLocation: event.location,
        services: event.services,
        rsvpUrl,
        businessName: bp.businessName,
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

/* ------------------------------------------------------------------ */
/*  Staff queries                                                      */
/* ------------------------------------------------------------------ */

/**
 * Returns all non-client profiles for the staff assignment selector.
 * Delegates to the shared getStaffForSelect to avoid a duplicate query.
 */
export async function getStaffForEvents(): Promise<{ id: string; name: string }[]> {
  const { getStaffForSelect } = await import("../bookings/select-actions");
  return getStaffForSelect();
}

/* ------------------------------------------------------------------ */
/*  Staff assignment mutations                                         */
/* ------------------------------------------------------------------ */

const staffAssignmentSchema = z.object({
  staffId: z.string().uuid(),
  role: z.string().optional(),
  notes: z.string().optional(),
});

/** Assigns a staff member to an event. Returns the new assignment id. */
export async function assignStaff(
  eventId: number,
  data: { staffId: string; role?: string; notes?: string },
): Promise<number> {
  try {
    z.number().int().positive().parse(eventId);
    staffAssignmentSchema.parse(data);
    await getUser();

    const [row] = await db
      .insert(eventStaff)
      .values({
        eventId,
        staffId: data.staffId,
        role: data.role ?? null,
        notes: data.notes ?? null,
      })
      .returning({ id: eventStaff.id });

    revalidatePath(PATH);
    return row.id;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Updates the role or notes on an existing staff assignment. */
export async function updateStaffAssignment(
  assignmentId: number,
  data: { role?: string; notes?: string },
) {
  try {
    z.number().int().positive().parse(assignmentId);
    await getUser();

    const set: Record<string, unknown> = {};
    if (data.role !== undefined) set.role = data.role || null;
    if (data.notes !== undefined) set.notes = data.notes || null;

    await db.update(eventStaff).set(set).where(eq(eventStaff.id, assignmentId));
    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Removes a staff assignment by id. */
export async function removeStaffAssignment(assignmentId: number) {
  try {
    z.number().int().positive().parse(assignmentId);
    await getUser();
    await db.delete(eventStaff).where(eq(eventStaff.id, assignmentId));
    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
