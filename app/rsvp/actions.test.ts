import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/rsvp/actions.ts
 *
 * Covers:
 *  submitRsvp   — successful RSVP creates event guest record
 *  submitRsvp   — invalid token (event not found) returns error
 *  submitRsvp   — capacity full returns error
 *  submitRsvp   — empty name returns error without hitting DB
 *  getEventByRsvpToken — returns null for unknown token
 *  getEventByRsvpToken — returns event info with current guest count
 *
 * Mocks: @/db, @/db/schema, drizzle-orm.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    then(onFulfilled: (v: unknown) => unknown) {
      return resolved.then(onFulfilled);
    },
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(
  selectResponses: unknown[][] = [],
  mockInsert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
) {
  let callIdx = 0;
  const selectFn = vi.fn(() => {
    const rows = selectResponses[callIdx] ?? [];
    callIdx++;
    return makeChain(rows);
  });

  vi.doMock("@/db", () => ({
    db: {
      select: selectFn,
      insert: mockInsert,
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    events: {
      id: "id",
      title: "title",
      startsAt: "startsAt",
      location: "location",
      services: "services",
      maxAttendees: "maxAttendees",
      metadata: "metadata",
      isActive: "isActive",
    },
    eventGuests: {
      id: "id",
      eventId: "eventId",
      name: "name",
      service: "service",
      paid: "paid",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      {
        as: vi.fn(),
      },
    ),
  }));

  return { selectFn, mockInsert };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("rsvp/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- submitRsvp — empty name ---- */

  describe("submitRsvp — input validation", () => {
    it("returns error immediately for empty name without hitting DB", async () => {
      vi.resetModules();
      const { selectFn } = setupMocks();
      const { submitRsvp } = await import("@/app/rsvp/actions");

      const result = await submitRsvp("valid-token", { name: "   ", service: "" });

      expect(result).toEqual({ success: false, error: "Name is required." });
      expect(selectFn).not.toHaveBeenCalled();
    });
  });

  /* ---- submitRsvp — invalid token ---- */

  describe("submitRsvp — invalid token", () => {
    it("returns Event not found when token does not match any event", async () => {
      vi.resetModules();
      setupMocks([
        [], // event lookup returns nothing
      ]);
      const { submitRsvp } = await import("@/app/rsvp/actions");

      const result = await submitRsvp("bad-token", { name: "Jane Doe", service: "" });

      expect(result).toEqual({ success: false, error: "Event not found." });
    });
  });

  /* ---- submitRsvp — event full ---- */

  describe("submitRsvp — capacity", () => {
    it("returns error when event is at max capacity", async () => {
      vi.resetModules();
      const mockValues = vi.fn().mockResolvedValue(undefined);
      setupMocks(
        [
          // event lookup
          [
            {
              id: 1,
              title: "Lash Masterclass",
              startsAt: new Date("2026-05-01T10:00:00Z"),
              location: "Studio A",
              services: "lash",
              maxAttendees: 5,
              metadata: { rsvpToken: "abc123" },
            },
          ],
          // guest count
          [{ count: 5 }],
        ],
        vi.fn(() => ({ values: mockValues })),
      );
      const { submitRsvp } = await import("@/app/rsvp/actions");

      const result = await submitRsvp("abc123", { name: "Jane Doe", service: "lash" });

      expect(result).toEqual({ success: false, error: "This event is full." });
      expect(mockValues).not.toHaveBeenCalled();
    });

    it("allows RSVP when count is below max", async () => {
      vi.resetModules();
      const mockValues = vi.fn().mockResolvedValue(undefined);
      setupMocks(
        [
          [
            {
              id: 2,
              title: "Volume Workshop",
              startsAt: new Date("2026-06-15T09:00:00Z"),
              location: "Studio B",
              services: "volume",
              maxAttendees: 10,
              metadata: { rsvpToken: "xyz789" },
            },
          ],
          [{ count: 7 }], // 7 < 10 — not full
        ],
        vi.fn(() => ({ values: mockValues })),
      );
      const { submitRsvp } = await import("@/app/rsvp/actions");

      const result = await submitRsvp("xyz789", { name: "Alice Smith", service: "volume" });

      expect(result).toEqual({ success: true });
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 2,
          name: "Alice Smith",
          service: "volume",
          paid: false,
        }),
      );
    });
  });

  /* ---- submitRsvp — success ---- */

  describe("submitRsvp — success", () => {
    it("inserts guest record and returns success for valid RSVP", async () => {
      vi.resetModules();
      const mockValues = vi.fn().mockResolvedValue(undefined);
      setupMocks(
        [
          // event lookup
          [
            {
              id: 10,
              title: "Lash Essentials",
              startsAt: new Date("2026-07-20T13:00:00Z"),
              location: null,
              services: null,
              maxAttendees: null, // unlimited
              metadata: { rsvpToken: "token-abc" },
            },
          ],
          // guest count (irrelevant — no max)
          [{ count: 3 }],
        ],
        vi.fn(() => ({ values: mockValues })),
      );
      const { submitRsvp } = await import("@/app/rsvp/actions");

      const result = await submitRsvp("token-abc", { name: "  Bob Jones  ", service: "" });

      expect(result).toEqual({ success: true });
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 10,
          name: "Bob Jones", // trimmed
          service: null, // empty string → null
          paid: false,
        }),
      );
    });
  });

  /* ---- getEventByRsvpToken ---- */

  describe("getEventByRsvpToken", () => {
    it("returns null for an unknown token", async () => {
      vi.resetModules();
      setupMocks([
        [], // no event found
      ]);
      const { getEventByRsvpToken } = await import("@/app/rsvp/actions");

      const result = await getEventByRsvpToken("no-such-token");

      expect(result).toBeNull();
    });

    it("returns event info with currentCount for a known token", async () => {
      vi.resetModules();
      const startsAt = new Date("2026-08-10T11:00:00Z");
      setupMocks([
        // event row
        [
          {
            id: 5,
            title: "Brow Lamination Class",
            startsAt,
            location: "Main Studio",
            services: "brows",
            maxAttendees: 8,
            metadata: { rsvpToken: "brow-token" },
          },
        ],
        // guest count
        [{ count: 4 }],
      ]);
      const { getEventByRsvpToken } = await import("@/app/rsvp/actions");

      const result = await getEventByRsvpToken("brow-token");

      expect(result).not.toBeNull();
      expect(result!.id).toBe(5);
      expect(result!.title).toBe("Brow Lamination Class");
      expect(result!.maxAttendees).toBe(8);
      expect(result!.currentCount).toBe(4);
      expect(result!.location).toBe("Main Studio");
    });
  });
});
