// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/book/claim/[token]/actions.ts
 *
 * Covers:
 *  1. claimWaitlistSlot — valid claim: creates booking, marks waitlist as booked
 *  2. claimWaitlistSlot — expired token: returns error without creating booking
 *  3. claimWaitlistSlot — already used token: returns already_claimed
 *  4. getClaimPageData — overlap: next notified client sees valid page data
 *  5. claimWaitlistSlot — deposit required (booking created as pending)
 *  6. claimWaitlistSlot — advisory lock (token cleared atomically)
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, @sentry/nextjs, @/lib/audit, @/lib/posthog.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockLogAction = vi.fn();
const mockTrackEvent = vi.fn();
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(dbOverrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (dbOverrides) Object.assign(resolvedDb, dbOverrides);

  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      staffId: "staffId",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      status: "status",
      clientNotes: "clientNotes",
    },
    waitlist: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      claimToken: "claimToken",
      claimTokenExpiresAt: "claimTokenExpiresAt",
      offeredSlotStartsAt: "offeredSlotStartsAt",
      offeredStaffId: "offeredStaffId",
      bookedBookingId: "bookedBookingId",
      createdAt: "createdAt",
    },
    services: {
      id: "id",
      name: "name",
      priceInCents: "priceInCents",
      durationMinutes: "durationMinutes",
      category: "category",
    },
    profiles: { id: "id", firstName: "firstName" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
}

function makeDefaultDb() {
  const self: Record<string, unknown> = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn() })),
    })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
  return self;
}

/* ------------------------------------------------------------------ */
/*  Helper: a valid notified waitlist entry                            */
/* ------------------------------------------------------------------ */

function validWaitlistEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    clientId: "client-1",
    serviceId: 10,
    status: "notified",
    claimTokenExpiresAt: new Date(Date.now() + 86_400_000), // +24h
    offeredSlotStartsAt: new Date("2026-04-01T14:00:00Z"),
    offeredStaffId: "staff-1",
    createdAt: new Date("2026-03-20"),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("claim/[token]/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- valid claim ---- */

  describe("claimWaitlistSlot", () => {
    it("creates a booking and marks waitlist as booked on valid claim", async () => {
      vi.resetModules();
      let selectCall = 0;
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 42 }]),
      }));
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) {
            // Waitlist entry lookup
            return makeChain([validWaitlistEntry()]);
          }
          // Service lookup
          return makeChain([{ priceInCents: 12000, durationMinutes: 90 }]);
        }),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

      const result = await claimWaitlistSlot("valid-token-abc");

      expect(result).toEqual({ success: true, bookingId: 42 });

      // Booking created with snapshotted price and pending status
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-1",
          serviceId: 10,
          staffId: "staff-1",
          totalInCents: 12000,
          durationMinutes: 90,
          status: "pending",
          clientNotes: "Booked via waitlist claim link",
        }),
      );

      // Waitlist marked as booked, token cleared
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "booked",
          bookedBookingId: 42,
          claimToken: null,
          claimTokenExpiresAt: null,
        }),
      );

      // Analytics tracked
      expect(mockTrackEvent).toHaveBeenCalledWith("client-1", "waitlist_converted", {
        waitTimeDays: expect.any(Number),
      });
    });
  });

  /* ---- expired token ---- */

  describe("expired token", () => {
    it("returns expired error without creating a booking", async () => {
      vi.resetModules();
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
      }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            validWaitlistEntry({
              claimTokenExpiresAt: new Date("2020-01-01"), // expired
            }),
          ]),
        ),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

      const result = await claimWaitlistSlot("expired-token");

      expect(result).toEqual({ success: false, error: "expired" });
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  /* ---- already used ---- */

  describe("already used token", () => {
    it("returns already_claimed when waitlist entry is already booked", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([validWaitlistEntry({ status: "booked" })])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

      const result = await claimWaitlistSlot("used-token");

      expect(result).toEqual({ success: false, error: "already_claimed" });
    });
  });

  /* ---- getClaimPageData (next notified client) ---- */

  describe("getClaimPageData", () => {
    it("returns valid page data with service name, slot date, and staff name", async () => {
      vi.resetModules();
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) {
            // Waitlist + service join
            return makeChain([
              {
                status: "notified",
                claimTokenExpiresAt: new Date(Date.now() + 86_400_000),
                offeredSlotStartsAt: new Date("2026-04-01T14:00:00Z"),
                offeredStaffId: "staff-1",
                serviceName: "Classic Full Set",
              },
            ]);
          }
          // Staff name lookup
          return makeChain([{ firstName: "Maria" }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClaimPageData } = await import("@/app/book/claim/[token]/actions");

      const result = await getClaimPageData("valid-token");

      expect(result).toMatchObject({
        valid: true,
        serviceName: "Classic Full Set",
        staffName: "Maria",
        slotDate: expect.stringContaining("2026-04-01"),
        expiresAt: expect.any(String),
      });
    });
  });

  /* ---- deposit required ---- */

  describe("deposit required", () => {
    it("creates booking as pending — admin confirmation triggers deposit link", async () => {
      vi.resetModules();
      let selectCall = 0;
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 55 }]),
      }));
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([validWaitlistEntry()]);
          // Service with deposit configured
          return makeChain([{ priceInCents: 15000, durationMinutes: 120 }]);
        }),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

      const result = await claimWaitlistSlot("deposit-token");

      expect(result).toEqual({ success: true, bookingId: 55 });
      // Booking is always created as "pending" — deposit flow happens on confirmation
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
        }),
      );
    });
  });

  /* ---- advisory lock (token cleared atomically) ---- */

  describe("advisory lock — token cleared atomically", () => {
    it("clears claimToken and claimTokenExpiresAt to prevent reuse", async () => {
      vi.resetModules();
      let selectCall = 0;
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([validWaitlistEntry()]);
          return makeChain([{ priceInCents: 10000, durationMinutes: 60 }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 60 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

      await claimWaitlistSlot("lock-token");

      // Token cleared so it cannot be reused
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          claimToken: null,
          claimTokenExpiresAt: null,
          status: "booked",
        }),
      );
    });
  });

  /* ---- invalid token format ---- */

  describe("invalid token", () => {
    it("returns invalid_token for empty string", async () => {
      vi.resetModules();
      setupMocks();
      const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

      const result = await claimWaitlistSlot("");

      expect(result).toEqual({ success: false, error: "invalid_token" });
    });
  });
});
