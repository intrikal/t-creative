/**
 * @file actions.test.ts
 * @description Unit tests for events/actions (CRUD for events, guests,
 * venue resolution, RSVP invites, corporate event fields).
 *
 * Testing utilities: describe, it, expect, vi, vi.doMock, vi.resetModules,
 * vi.clearAllMocks, beforeEach.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a chainable mock that mimics Drizzle's query-builder API.
 */
function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    groupBy: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

/** Stub for supabase auth.getUser. */
const mockGetUser = vi.fn();
/** Captures PostHog trackEvent calls. */
const mockTrackEvent = vi.fn();
/** Captures Resend sendEmail calls; resolves to true by default. */
const mockSendEmail = vi.fn().mockResolvedValue(true);
/** Captures revalidatePath calls. */
const mockRevalidatePath = vi.fn();

/** Registers all module mocks; accepts optional custom db object. */
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    events: {
      id: "id",
      title: "title",
      eventType: "eventType",
      status: "status",
      startsAt: "startsAt",
      endsAt: "endsAt",
      venueId: "venueId",
      location: "location",
      address: "address",
      equipmentNotes: "equipmentNotes",
      maxAttendees: "maxAttendees",
      expectedRevenueInCents: "expectedRevenueInCents",
      depositInCents: "depositInCents",
      travelFeeInCents: "travelFeeInCents",
      contactName: "contactName",
      contactEmail: "contactEmail",
      contactPhone: "contactPhone",
      services: "services",
      internalNotes: "internalNotes",
      description: "description",
      hostId: "hostId",
      staffId: "staffId",
      metadata: "metadata",
      completedAt: "completedAt",
      cancelledAt: "cancelledAt",
      companyName: "companyName",
      billingEmail: "billingEmail",
      poNumber: "poNumber",
    },
    eventGuests: {
      id: "id",
      eventId: "eventId",
      name: "name",
      service: "service",
      paid: "paid",
    },
    eventVenues: {
      id: "id",
      name: "name",
      address: "address",
      venueType: "venueType",
      parkingInfo: "parkingInfo",
      setupNotes: "setupNotes",
      defaultTravelFeeInCents: "defaultTravelFeeInCents",
      isActive: "isActive",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/emails/EventInviteEmail", () => ({
    EventInviteEmail: vi.fn(() => null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("events/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getEvents ---- */

  describe("getEvents", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getEvents } = await import("./actions");
      await expect(getEvents()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no events exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getEvents } = await import("./actions");
      const result = await getEvents();
      expect(result).toEqual([]);
    });

    it("maps event rows with guests and ISO date strings", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-04-01T10:00:00Z");
      const endsAt = new Date("2026-04-01T14:00:00Z");
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            // event rows
            return makeChain([
              {
                id: 10,
                title: "Bridal Party",
                eventType: "bridal",
                status: "upcoming",
                startsAt,
                endsAt,
                venueId: 1,
                venueName: "The Studio",
                location: "The Studio",
                address: "123 Main St",
                equipmentNotes: null,
                maxAttendees: 10,
                expectedRevenueInCents: 200000,
                depositInCents: 50000,
                travelFeeInCents: null,
                contactName: "Jane",
                contactEmail: "jane@example.com",
                contactPhone: "+1",
                services: "lash",
                internalNotes: null,
                description: null,
              },
            ]);
          }
          // guest rows
          return makeChain([{ id: 1, eventId: 10, name: "Alice", service: "lash", paid: false }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getEvents } = await import("./actions");
      const result = await getEvents();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(10);
      expect(result[0].startsAt).toBe(startsAt.toISOString());
      expect(result[0].endsAt).toBe(endsAt.toISOString());
      expect(result[0].guests).toHaveLength(1);
      expect(result[0].guests[0]).toEqual({ id: 1, name: "Alice", service: "lash", paid: false });
    });

    it("maps endsAt to null when not present", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-04-01T10:00:00Z");
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 20,
                title: "Pop-Up",
                eventType: "pop_up",
                status: "draft",
                startsAt,
                endsAt: null,
                venueId: null,
                venueName: null,
                location: null,
                address: null,
                equipmentNotes: null,
                maxAttendees: null,
                expectedRevenueInCents: null,
                depositInCents: null,
                travelFeeInCents: null,
                contactName: null,
                contactEmail: null,
                contactPhone: null,
                services: null,
                internalNotes: null,
                description: null,
              },
            ]);
          }
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getEvents } = await import("./actions");
      const result = await getEvents();
      expect(result[0].endsAt).toBeNull();
      expect(result[0].guests).toEqual([]);
    });

    it("returns companyName, billingEmail, and poNumber on corporate events", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-05-10T10:00:00Z");
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 30,
                title: "Corp Day",
                eventType: "corporate",
                status: "upcoming",
                startsAt,
                endsAt: null,
                venueId: null,
                venueName: null,
                location: "Acme HQ",
                address: null,
                equipmentNotes: null,
                maxAttendees: 40,
                expectedRevenueInCents: null,
                depositInCents: null,
                travelFeeInCents: null,
                contactName: "Bob",
                contactEmail: "bob@acme.com",
                contactPhone: null,
                services: "lash",
                internalNotes: null,
                description: null,
                companyName: "Acme Corp",
                billingEmail: "billing@acme.com",
                poNumber: "PO-999",
              },
            ]);
          }
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getEvents } = await import("./actions");
      const result = await getEvents();
      expect(result[0].companyName).toBe("Acme Corp");
      expect(result[0].billingEmail).toBe("billing@acme.com");
      expect(result[0].poNumber).toBe("PO-999");
    });
  });

  /* ---- createEvent ---- */

  describe("createEvent", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createEvent } = await import("./actions");
      await expect(
        createEvent({
          title: "Test",
          eventType: "bridal",
          status: "draft",
          startsAt: new Date().toISOString(),
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts event and returns new id", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 42 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])), // resolveVenueLocation with no venueId
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createEvent } = await import("./actions");
      const id = await createEvent({
        title: "Birthday Party",
        eventType: "birthday",
        status: "upcoming",
        startsAt: "2026-05-01T10:00:00Z",
        contactEmail: "host@example.com",
      });
      expect(id).toBe(42);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Birthday Party",
          eventType: "birthday",
          status: "upcoming",
          hostId: "user-1",
        }),
      );
    });

    it("fires trackEvent with event_created", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createEvent } = await import("./actions");
      await createEvent({
        title: "Pop-Up",
        eventType: "pop_up",
        status: "draft",
        startsAt: "2026-06-01T09:00:00Z",
      });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "event_created",
        expect.objectContaining({ title: "Pop-Up", eventType: "pop_up" }),
      );
    });

    it("revalidates /dashboard/events", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createEvent } = await import("./actions");
      await createEvent({
        title: "Workshop",
        eventType: "workshop",
        status: "draft",
        startsAt: "2026-07-01T09:00:00Z",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/events");
    });

    it("resolves venue location when venueId is provided", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 5 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ name: "Grand Hall", address: "456 Venue Blvd" }])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createEvent } = await import("./actions");
      await createEvent({
        title: "Corporate Event",
        eventType: "corporate",
        status: "upcoming",
        startsAt: "2026-08-01T09:00:00Z",
        venueId: 3,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ location: "Grand Hall", address: "456 Venue Blvd" }),
      );
    });

    it("passes companyName, billingEmail, and poNumber to insert", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createEvent } = await import("./actions");
      await createEvent({
        title: "Corp Event",
        eventType: "corporate",
        status: "upcoming",
        startsAt: "2026-09-01T09:00:00Z",
        companyName: "Acme Corp",
        billingEmail: "billing@acme.com",
        poNumber: "PO-12345",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: "Acme Corp",
          billingEmail: "billing@acme.com",
          poNumber: "PO-12345",
        }),
      );
    });

    it("inserts null for corporate fields when not provided", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 11 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createEvent } = await import("./actions");
      await createEvent({
        title: "Regular Event",
        eventType: "bridal",
        status: "draft",
        startsAt: "2026-09-01T09:00:00Z",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: null,
          billingEmail: null,
          poNumber: null,
        }),
      );
    });
  });

  /* ---- updateEvent ---- */

  describe("updateEvent", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateEvent } = await import("./actions");
      await expect(updateEvent(1, { title: "New Title" })).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with the provided fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateEvent } = await import("./actions");
      await updateEvent(7, { title: "Updated Title", maxAttendees: 20 });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Updated Title", maxAttendees: 20 }),
      );
    });

    it("sets completedAt when status is completed", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateEvent } = await import("./actions");
      await updateEvent(7, { status: "completed" });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ completedAt: expect.any(Date) }),
      );
    });

    it("sets cancelledAt when status is cancelled", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateEvent } = await import("./actions");
      await updateEvent(7, { status: "cancelled" });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ cancelledAt: expect.any(Date) }),
      );
    });

    it("fires trackEvent with event_updated", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateEvent } = await import("./actions");
      await updateEvent(7, { status: "confirmed" });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "event_updated",
        expect.objectContaining({ eventId: 7, status: "confirmed" }),
      );
    });

    it("revalidates /dashboard/events", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateEvent } = await import("./actions");
      await updateEvent(7, { title: "New" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/events");
    });

    it("passes companyName, billingEmail, poNumber when updating corporate fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateEvent } = await import("./actions");
      await updateEvent(7, {
        companyName: "New Corp",
        billingEmail: "pay@newcorp.com",
        poNumber: "PO-001",
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: "New Corp",
          billingEmail: "pay@newcorp.com",
          poNumber: "PO-001",
        }),
      );
    });
  });

  /* ---- deleteEvent ---- */

  describe("deleteEvent", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteEvent } = await import("./actions");
      await expect(deleteEvent(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the event", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteEvent } = await import("./actions");
      await deleteEvent(99);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("fires trackEvent with event_deleted", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteEvent } = await import("./actions");
      await deleteEvent(99);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "event_deleted",
        expect.objectContaining({ eventId: 99 }),
      );
    });

    it("revalidates /dashboard/events", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteEvent } = await import("./actions");
      await deleteEvent(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/events");
    });
  });

  /* ---- addGuest ---- */

  describe("addGuest", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { addGuest } = await import("./actions");
      await expect(addGuest(1, { name: "Alice" })).rejects.toThrow("Not authenticated");
    });

    it("inserts guest with defaults and returns id", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 7 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { addGuest } = await import("./actions");
      const id = await addGuest(5, { name: "Bob", service: "jewelry" });
      expect(id).toBe(7);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 5, name: "Bob", service: "jewelry", paid: false }),
      );
    });

    it("revalidates /dashboard/events", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { addGuest } = await import("./actions");
      await addGuest(5, { name: "Carol" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/events");
    });
  });

  /* ---- removeGuest ---- */

  describe("removeGuest", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { removeGuest } = await import("./actions");
      await expect(removeGuest(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the guest", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { removeGuest } = await import("./actions");
      await removeGuest(55);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates /dashboard/events", async () => {
      vi.resetModules();
      setupMocks();
      const { removeGuest } = await import("./actions");
      await removeGuest(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/events");
    });
  });

  /* ---- sendEventRsvpInvite ---- */

  describe("sendEventRsvpInvite", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { sendEventRsvpInvite } = await import("./actions");
      await expect(sendEventRsvpInvite(1)).rejects.toThrow("Not authenticated");
    });

    it("throws when event is not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendEventRsvpInvite } = await import("./actions");
      await expect(sendEventRsvpInvite(999)).rejects.toThrow("Event not found");
    });

    it("throws when event has no contact email", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 10,
              title: "Test Event",
              startsAt: new Date("2026-05-01T10:00:00Z"),
              location: "Studio",
              services: "lash",
              contactEmail: null,
              contactName: "Jane",
              metadata: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendEventRsvpInvite } = await import("./actions");
      await expect(sendEventRsvpInvite(10)).rejects.toThrow("Event has no contact email");
    });

    it("sends email and returns RSVP URL", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 10,
              title: "Bridal Party",
              startsAt: new Date("2026-05-01T10:00:00Z"),
              location: "The Studio",
              services: "lash",
              contactEmail: "bride@example.com",
              contactName: "Bride",
              metadata: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendEventRsvpInvite } = await import("./actions");
      const result = await sendEventRsvpInvite(10);
      expect(result.url).toMatch(/\/rsvp\//);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "bride@example.com",
          entityType: "event_invite",
        }),
      );
    });

    it("reuses existing rsvpToken when present in metadata", async () => {
      vi.resetModules();
      const existingToken = "existing-token-abc";
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 10,
              title: "Event",
              startsAt: new Date("2026-05-01T10:00:00Z"),
              location: "Studio",
              services: null,
              contactEmail: "host@example.com",
              contactName: "Host",
              metadata: { rsvpToken: existingToken },
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendEventRsvpInvite } = await import("./actions");
      const result = await sendEventRsvpInvite(10);
      expect(result.url).toContain(existingToken);
      // Should NOT call update since token already exists
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it("revalidates /dashboard/events", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 10,
              title: "Event",
              startsAt: new Date("2026-05-01T10:00:00Z"),
              location: "Studio",
              services: null,
              contactEmail: "host@example.com",
              contactName: "Host",
              metadata: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendEventRsvpInvite } = await import("./actions");
      await sendEventRsvpInvite(10);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/events");
    });
  });
});
