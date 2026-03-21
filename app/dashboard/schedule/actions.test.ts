/**
 * @file actions.test.ts
 * @description Unit tests for schedule/actions (appointment mapping, stats
 * computation, client initials, event rows, notes priority).
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
 * groupBy switches to an empty-resolving chain so event sub-queries
 * return nothing in booking-only test cases.
 */
function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  // emptyChain always resolves to [] — used as the result of groupBy so that
  // the events sub-query returns nothing in booking-only test cases.
  const empty = Promise.resolve([] as unknown[]);
  const emptyChain: any = {
    from: () => emptyChain,
    where: () => emptyChain,
    leftJoin: () => emptyChain,
    innerJoin: () => emptyChain,
    orderBy: () => emptyChain,
    limit: () => emptyChain,
    groupBy: () => emptyChain,
    then: empty.then.bind(empty),
    catch: empty.catch.bind(empty),
    finally: empty.finally.bind(empty),
  };
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    groupBy: () => emptyChain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

// A chain where groupBy stays on the same resolved chain — used to return
// event rows from the grouped events query in event-specific test cases.
/**
 * Variant of makeChain where groupBy stays on the same resolved chain.
 * Used to return event rows from the grouped events sub-query.
 */
function makeEventChain(rows: unknown[] = []) {
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
    bookings: {
      id: "id",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      status: "status",
      location: "location",
      clientNotes: "clientNotes",
      staffNotes: "staffNotes",
      staffId: "staffId",
      serviceId: "serviceId",
      clientId: "clientId",
    },
    services: {
      id: "id",
      name: "name",
      category: "category",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
    },
    events: {
      id: "id",
      startsAt: "startsAt",
      endsAt: "endsAt",
      title: "title",
      status: "status",
      location: "location",
      address: "address",
      companyName: "companyName",
      maxAttendees: "maxAttendees",
      contactName: "contactName",
      staffId: "staffId",
    },
    eventGuests: {
      id: "id",
      eventId: "eventId",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    count: vi.fn((...args: unknown[]) => ({ type: "count", args })),
    not: vi.fn((...args: unknown[]) => ({ type: "not", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("schedule/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getScheduleData ---- */

  describe("getScheduleData", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getScheduleData } = await import("./actions");
      await expect(getScheduleData()).rejects.toThrow("Not authenticated");
    });

    it("returns empty appointments and zero stats when no bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      expect(result.appointments).toEqual([]);
      expect(result.stats).toEqual({
        todayCount: 0,
        todayRevenue: 0,
        weekCount: 0,
        weekRevenue: 0,
      });
      expect(result.todayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("maps booking rows to AppointmentRow shape", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-03-15T10:00:00Z");
      const row = {
        id: 1,
        startsAt,
        durationMinutes: 60,
        totalInCents: 15000,
        status: "confirmed",
        location: "Studio",
        clientNotes: "Client note",
        staffNotes: null,
        serviceName: "Lash Extensions",
        serviceCategory: "lash",
        clientFirstName: "Jane",
        clientLastName: "Doe",
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      expect(result.appointments).toHaveLength(1);
      const appt = result.appointments[0];
      expect(appt).toMatchObject({
        id: 1,
        service: "Lash Extensions",
        category: "lash",
        status: "confirmed",
        durationMin: 60,
        price: 150,
        location: "Studio",
      });
      expect(appt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(appt.clientInitials).toBeTruthy();
    });

    it("defaults category to 'lash' when serviceCategory is null", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-03-15T10:00:00Z");
      const row = {
        id: 2,
        startsAt,
        durationMinutes: 30,
        totalInCents: 5000,
        status: "pending",
        location: null,
        clientNotes: null,
        staffNotes: null,
        serviceName: "Custom Service",
        serviceCategory: null,
        clientFirstName: "Bob",
        clientLastName: "Smith",
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      expect(result.appointments[0].category).toBe("lash");
    });

    it("uses staffNotes over clientNotes when both present", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-03-15T09:00:00Z");
      const row = {
        id: 3,
        startsAt,
        durationMinutes: 45,
        totalInCents: 8000,
        status: "confirmed",
        location: null,
        clientNotes: "client note",
        staffNotes: "staff note",
        serviceName: "Service",
        serviceCategory: "jewelry",
        clientFirstName: "Alice",
        clientLastName: "Lee",
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      expect(result.appointments[0].notes).toBe("staff note");
    });

    it("falls back to clientNotes when staffNotes is null", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-03-15T09:00:00Z");
      const row = {
        id: 4,
        startsAt,
        durationMinutes: 45,
        totalInCents: 8000,
        status: "confirmed",
        location: null,
        clientNotes: "client note",
        staffNotes: null,
        serviceName: "Service",
        serviceCategory: "crochet",
        clientFirstName: "Alice",
        clientLastName: "Lee",
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      expect(result.appointments[0].notes).toBe("client note");
    });

    it("computes client name with last initial", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-03-15T14:00:00Z");
      const row = {
        id: 5,
        startsAt,
        durationMinutes: 60,
        totalInCents: 10000,
        status: "confirmed",
        location: null,
        clientNotes: null,
        staffNotes: null,
        serviceName: "Consulting",
        serviceCategory: "consulting",
        clientFirstName: "Maria",
        clientLastName: "Garcia",
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      // client name should be "Maria G."
      expect(result.appointments[0].client).toBe("Maria G.");
      expect(result.appointments[0].clientInitials).toBe("MG");
    });

    it("handles empty firstName and lastName gracefully", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-03-15T14:00:00Z");
      const row = {
        id: 6,
        startsAt,
        durationMinutes: 60,
        totalInCents: 10000,
        status: "pending",
        location: null,
        clientNotes: null,
        staffNotes: null,
        serviceName: "Service",
        serviceCategory: "lash",
        clientFirstName: null,
        clientLastName: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      // clientInitials falls back to "?"
      expect(result.appointments[0].clientInitials).toBe("?");
    });

    it("converts totalInCents to price in dollars", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-03-15T10:00:00Z");
      const row = {
        id: 7,
        startsAt,
        durationMinutes: 60,
        totalInCents: 7500,
        status: "confirmed",
        location: null,
        clientNotes: null,
        staffNotes: null,
        serviceName: "Service",
        serviceCategory: "lash",
        clientFirstName: "X",
        clientLastName: "Y",
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      expect(result.appointments[0].price).toBe(75);
    });

    it("returns todayKey as YYYY-MM-DD string", async () => {
      vi.resetModules();
      setupMocks();
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      // Should match today's date in local time
      expect(result.todayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("computes stats correctly for today's appointments", async () => {
      vi.resetModules();
      // Use today's date so the appointment falls in today's stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
      const rows = [
        {
          id: 8,
          startsAt: todayStart,
          durationMinutes: 60,
          totalInCents: 10000,
          status: "confirmed",
          location: null,
          clientNotes: null,
          staffNotes: null,
          serviceName: "Service A",
          serviceCategory: "lash",
          clientFirstName: "A",
          clientLastName: "B",
        },
        {
          id: 9,
          startsAt: todayStart,
          durationMinutes: 30,
          totalInCents: 5000,
          status: "confirmed",
          location: null,
          clientNotes: null,
          staffNotes: null,
          serviceName: "Service B",
          serviceCategory: "jewelry",
          clientFirstName: "C",
          clientLastName: "D",
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();
      expect(result.stats.todayCount).toBe(2);
      expect(result.stats.todayRevenue).toBe(150); // (10000 + 5000) / 100
    });

    it("includes assigned events with companyName and kind=event but no billingEmail/poNumber", async () => {
      vi.resetModules();
      const eventRow = {
        id: 100,
        startsAt: new Date("2026-03-20T14:00:00Z"),
        endsAt: new Date("2026-03-20T17:00:00Z"),
        title: "Corporate Lash Day",
        status: "confirmed",
        location: "Acme HQ",
        address: null,
        companyName: "Acme Corp",
        maxAttendees: 30,
        contactName: "Jane Organizer",
        guestCount: 20,
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([]); // bookings: empty
          return makeEventChain([eventRow]); // events: returns row through groupBy
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getScheduleData } = await import("./actions");
      const result = await getScheduleData();

      expect(result.appointments).toHaveLength(1);
      const appt = result.appointments[0];
      expect(appt.kind).toBe("event");
      expect(appt.companyName).toBe("Acme Corp");
      expect(appt.guestCount).toBe(20);
      expect(appt.price).toBe(0); // financial data not exposed to assistants
      expect(appt.id).toBe(-100); // negative ID to avoid collision with booking IDs
      // billingEmail and poNumber are never on AppointmentRow
      expect(appt).not.toHaveProperty("billingEmail");
      expect(appt).not.toHaveProperty("poNumber");
    });
  });
});
