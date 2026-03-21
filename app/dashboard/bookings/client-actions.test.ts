// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns an object that is both awaitable (thenable) and chainable.
 * Every builder method returns the same object so any call chain can be
 * awaited and will resolve to `rows`.
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
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockTrackEvent = vi.fn();
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockUpdateZohoDeal = vi.fn();
const mockLogZohoNote = vi.fn();
const mockNotifyWaitlist = vi.fn().mockResolvedValue(undefined);
const mockCalendarUrl = vi.fn((id: string) => `webcal://example.com/calendar/${id}`);
const mockRevalidatePath = vi.fn();

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
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      startsAt: "startsAt",
      staffId: "staffId",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      clientNotes: "clientNotes",
      location: "location",
      depositPaidInCents: "depositPaidInCents",
      cancelledAt: "cancelledAt",
      cancellationReason: "cancellationReason",
      staffNotes: "staffNotes",
    },
    bookingAddOns: {
      bookingId: "bookingId",
      addOnName: "addOnName",
      priceInCents: "priceInCents",
    },
    services: { id: "id", name: "name", category: "category" },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      notifyEmail: "notifyEmail",
    },
    reviews: {
      id: "id",
      clientId: "clientId",
      bookingId: "bookingId",
      rating: "rating",
      body: "body",
      serviceName: "serviceName",
      source: "source",
      status: "status",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
    })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/calendar-token", () => ({ calendarUrl: mockCalendarUrl }));
  vi.doMock("@/lib/zoho", () => ({
    updateZohoDeal: mockUpdateZohoDeal,
    logZohoNote: mockLogZohoNote,
  }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: mockNotifyWaitlist,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("client-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getClientBookings ---- */

  describe("getClientBookings", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientBookings } = await import("./client-actions");
      await expect(getClientBookings()).rejects.toThrow("Not authenticated");
    });

    it("returns empty bookings and calendarUrl when user has no bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientBookings } = await import("./client-actions");
      const result = await getClientBookings();
      expect(result.bookings).toEqual([]);
      expect(typeof result.calendarUrl).toBe("string");
    });

    it("passes user id to calendarUrl", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientBookings } = await import("./client-actions");
      await getClientBookings();
      expect(mockCalendarUrl).toHaveBeenCalledWith("user-1");
    });

    it("maps booking rows to ClientBookingRow shape", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 1,
                status: "confirmed",
                startsAt: new Date("2026-05-01T14:00:00Z"),
                durationMinutes: 60,
                totalInCents: 15000,
                clientNotes: null,
                location: "Studio A",
                serviceName: "Lash Extensions",
                serviceCategory: "lash",
                staffFirstName: "Alex",
                depositPaidInCents: 5000,
              },
            ]);
          }
          return makeChain([]); // add-ons and reviews queries
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientBookings } = await import("./client-actions");
      const result = await getClientBookings();
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]).toMatchObject({
        id: 1,
        status: "confirmed",
        service: "Lash Extensions",
        category: "lash",
        assistant: "Alex",
        price: 150,
        depositPaid: true,
        location: "Studio A",
      });
    });

    it("maps 'no_show' status to 'cancelled' for client view", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              status: "no_show",
              startsAt: new Date("2026-04-01T10:00:00Z"),
              durationMinutes: 60,
              totalInCents: 5000,
              clientNotes: null,
              location: null,
              serviceName: "Consulting",
              serviceCategory: "consulting",
              staffFirstName: null,
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientBookings } = await import("./client-actions");
      const result = await getClientBookings();
      expect(result.bookings[0].status).toBe("cancelled");
    });

    it("maps 'cancelled' status to 'cancelled' for client view", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              status: "cancelled",
              startsAt: new Date("2026-04-01T10:00:00Z"),
              durationMinutes: 60,
              totalInCents: 5000,
              clientNotes: null,
              location: null,
              serviceName: "Lash",
              serviceCategory: "lash",
              staffFirstName: null,
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientBookings } = await import("./client-actions");
      const result = await getClientBookings();
      expect(result.bookings[0].status).toBe("cancelled");
    });

    it("marks depositPaid as false when depositPaidInCents is 0", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              status: "confirmed",
              startsAt: new Date("2026-05-01T14:00:00Z"),
              durationMinutes: 60,
              totalInCents: 10000,
              clientNotes: null,
              location: null,
              serviceName: "Lash",
              serviceCategory: "lash",
              staffFirstName: null,
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientBookings } = await import("./client-actions");
      const result = await getClientBookings();
      expect(result.bookings[0].depositPaid).toBe(false);
    });
  });

  /* ---- submitClientReview ---- */

  describe("submitClientReview", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { submitClientReview } = await import("./client-actions");
      await expect(
        submitClientReview({ bookingId: 1, rating: 5, comment: "Great!" }),
      ).rejects.toThrow("Not authenticated");
    });

    it("throws when booking is not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitClientReview } = await import("./client-actions");
      await expect(
        submitClientReview({ bookingId: 999, rating: 5, comment: "Great!" }),
      ).rejects.toThrow("Booking not found");
    });

    it("throws when booking belongs to a different user", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "other-user", serviceId: 1 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitClientReview } = await import("./client-actions");
      await expect(
        submitClientReview({ bookingId: 1, rating: 5, comment: "Great!" }),
      ).rejects.toThrow("Booking not found");
    });

    it("throws when review already exists for this booking", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ clientId: "user-1", serviceId: 2 }]);
          if (selectCount === 2) return makeChain([{ name: "Lash Extensions" }]);
          if (selectCount === 3) return makeChain([{ id: 99 }]); // existing review
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitClientReview } = await import("./client-actions");
      await expect(
        submitClientReview({ bookingId: 1, rating: 5, comment: "Amazing!" }),
      ).rejects.toThrow("Review already submitted");
    });

    it("inserts review with correct shape", async () => {
      vi.resetModules();
      let selectCount = 0;
      const mockInsertValues = vi.fn();
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ clientId: "user-1", serviceId: 2 }]);
          if (selectCount === 2) return makeChain([{ name: "Lash Extensions" }]);
          return makeChain([]); // no existing review
        }),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitClientReview } = await import("./client-actions");
      await submitClientReview({ bookingId: 1, rating: 5, comment: "Loved it!" });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 1,
          clientId: "user-1",
          rating: 5,
          body: "Loved it!",
          serviceName: "Lash Extensions",
          status: "pending",
          source: "website",
        }),
      );
    });

    it("stores null body when comment is empty string", async () => {
      vi.resetModules();
      let selectCount = 0;
      const mockInsertValues = vi.fn();
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ clientId: "user-1", serviceId: 2 }]);
          if (selectCount === 2) return makeChain([{ name: "Lash" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitClientReview } = await import("./client-actions");
      await submitClientReview({ bookingId: 1, rating: 4, comment: "" });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ body: null }));
    });

    it("fires PostHog review_submitted event", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ clientId: "user-1", serviceId: 2 }]);
          if (selectCount === 2) return makeChain([{ name: "Lash Extensions" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitClientReview } = await import("./client-actions");
      await submitClientReview({ bookingId: 1, rating: 4, comment: "Nice!" });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "review_submitted",
        expect.objectContaining({ bookingId: 1, rating: 4, hasComment: true }),
      );
    });

    it("calls logZohoNote with review details", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ clientId: "user-1", serviceId: 2 }]);
          if (selectCount === 2) return makeChain([{ name: "Lash Extensions" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitClientReview } = await import("./client-actions");
      await submitClientReview({ bookingId: 1, rating: 5, comment: "Excellent!" });
      expect(mockLogZohoNote).toHaveBeenCalledWith(
        "user-1",
        expect.stringContaining("Review"),
        "Excellent!",
      );
    });

    it("revalidates /dashboard/bookings", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ clientId: "user-1", serviceId: 2 }]);
          if (selectCount === 2) return makeChain([{ name: "Lash" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitClientReview } = await import("./client-actions");
      await submitClientReview({ bookingId: 1, rating: 5, comment: "" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });

  /* ---- rescheduleClientBooking ---- */

  describe("rescheduleClientBooking", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { rescheduleClientBooking } = await import("./client-actions");
      await expect(rescheduleClientBooking(1, "2026-06-01T10:00:00Z")).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("throws when booking is not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      await expect(rescheduleClientBooking(999, "2026-06-01T10:00:00Z")).rejects.toThrow(
        "Booking not found",
      );
    });

    it("throws when booking belongs to a different user", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "other-user",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              serviceName: "Lash",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      await expect(rescheduleClientBooking(1, "2026-06-01T10:00:00Z")).rejects.toThrow(
        "Booking not found",
      );
    });

    it("throws when booking status is not pending or confirmed", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "completed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              serviceName: "Lash",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      await expect(rescheduleClientBooking(1, "2026-06-01T10:00:00Z")).rejects.toThrow(
        "cannot be rescheduled",
      );
    });

    it("throws when appointment is within 24 hours", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
              serviceName: "Lash",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      await expect(rescheduleClientBooking(1, "2026-06-01T10:00:00Z")).rejects.toThrow(
        "within 24 hours",
      );
    });

    it("throws for invalid date string", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              serviceName: "Lash",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      await expect(rescheduleClientBooking(1, "not-a-date")).rejects.toThrow("Invalid date");
    });

    it("throws when new time is in the past", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              serviceName: "Lash",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      await expect(rescheduleClientBooking(1, "2020-01-01T10:00:00Z")).rejects.toThrow(
        "must be in the future",
      );
    });

    it("updates booking with new start time and resets status to 'pending'", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      const existingDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: existingDate,
              serviceName: "Lash Extensions",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      const newDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      await rescheduleClientBooking(1, newDate);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending", startsAt: expect.any(Date) }),
      );
    });

    it("fires PostHog booking_rescheduled_by_client event", async () => {
      vi.resetModules();
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: futureDate,
              serviceName: "Lash",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      const newDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      await rescheduleClientBooking(1, newDate);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "booking_rescheduled_by_client",
        expect.objectContaining({ bookingId: 1 }),
      );
    });

    it("logs audit action", async () => {
      vi.resetModules();
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: futureDate,
              serviceName: "Lash",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      const newDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      await rescheduleClientBooking(1, newDate);
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "user-1",
          action: "update",
          entityType: "booking",
          entityId: "1",
        }),
      );
    });

    it("revalidates /dashboard/bookings", async () => {
      vi.resetModules();
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "pending",
              startsAt: futureDate,
              serviceName: "Lash",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { rescheduleClientBooking } = await import("./client-actions");
      const newDate = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      await rescheduleClientBooking(1, newDate);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });

  /* ---- cancelClientBooking ---- */

  describe("cancelClientBooking", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { cancelClientBooking } = await import("./client-actions");
      await expect(cancelClientBooking(1)).rejects.toThrow("Not authenticated");
    });

    it("throws when booking is not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await expect(cancelClientBooking(999)).rejects.toThrow("Booking not found");
    });

    it("throws when booking belongs to a different user", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "other-user",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await expect(cancelClientBooking(1)).rejects.toThrow("Booking not found");
    });

    it("throws when booking status cannot be cancelled", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "completed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await expect(cancelClientBooking(1)).rejects.toThrow("cannot be cancelled");
    });

    it("throws when appointment is within 24 hours", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await expect(cancelClientBooking(1)).rejects.toThrow("within 24 hours");
    });

    it("updates booking status to 'cancelled' with cancelledAt timestamp", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await cancelClientBooking(1);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled", cancelledAt: expect.any(Date) }),
      );
    });

    it("uses deposit-aware cancellation reason when deposit was paid", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 5000,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await cancelClientBooking(1);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          cancellationReason: expect.stringContaining("deposit pending admin review"),
        }),
      );
    });

    it("uses simple cancellation reason when no deposit was paid", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "pending",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await cancelClientBooking(1);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ cancellationReason: "Cancelled by client" }),
      );
    });

    it("fires PostHog booking_cancelled_by_client event", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "pending",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await cancelClientBooking(5);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "booking_cancelled_by_client",
        expect.objectContaining({ bookingId: 5, previousStatus: "pending", depositPaidInCents: 0 }),
      );
    });

    it("calls updateZohoDeal('Closed Lost') on cancellation", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await cancelClientBooking(7);
      expect(mockUpdateZohoDeal).toHaveBeenCalledWith(7, "Closed Lost");
    });

    it("calls notifyWaitlistForCancelledBooking on cancellation", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await cancelClientBooking(7);
      expect(mockNotifyWaitlist).toHaveBeenCalledWith(7);
    });

    it("logs audit action", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await cancelClientBooking(3);
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "user-1",
          action: "status_change",
          entityType: "booking",
          entityId: "3",
        }),
      );
    });

    it("revalidates /dashboard/bookings", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientId: "user-1",
              status: "confirmed",
              startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              depositPaidInCents: 0,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelClientBooking } = await import("./client-actions");
      await cancelClientBooking(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });
});
