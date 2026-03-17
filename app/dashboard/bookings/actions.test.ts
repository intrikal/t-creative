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
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockUpdateZohoDeal = vi.fn();
const mockCreateZohoDeal = vi.fn();
const mockCreateZohoBooksInvoice = vi.fn();
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockIsSquareConfigured = vi.fn(() => false);
const mockCreateSquareOrder = vi.fn().mockResolvedValue("sq_order_123");
const mockCreateSquarePaymentLink = vi.fn().mockResolvedValue({
  url: "https://sq.link/abc",
  orderId: "order_1",
});
const mockNotifyWaitlist = vi.fn().mockResolvedValue(undefined);
const mockSendSms = vi.fn().mockResolvedValue(undefined);
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
      squareOrderId: "squareOrderId",
      parentBookingId: "parentBookingId",
      startsAt: "startsAt",
      staffId: "staffId",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      location: "location",
      clientNotes: "clientNotes",
      recurrenceRule: "recurrenceRule",
      subscriptionId: "subscriptionId",
      confirmedAt: "confirmedAt",
      completedAt: "completedAt",
      cancelledAt: "cancelledAt",
      cancellationReason: "cancellationReason",
      staffNotes: "staffNotes",
      depositPaidInCents: "depositPaidInCents",
      zohoInvoiceId: "zohoInvoiceId",
    },
    bookingSubscriptions: {
      id: "id",
      status: "status",
      sessionsUsed: "sessionsUsed",
      totalSessions: "totalSessions",
      intervalDays: "intervalDays",
    },
    clientPreferences: {
      profileId: "profileId",
      preferredRebookIntervalDays: "preferredRebookIntervalDays",
    },
    mediaItems: {
      id: "id",
      bookingId: "bookingId",
      url: "url",
      thumbnailUrl: "thumbnailUrl",
      category: "category",
      isPortfolio: "isPortfolio",
    },
    notifications: {},
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      role: "role",
      phone: "phone",
      notifyEmail: "notifyEmail",
    },
    services: {
      id: "id",
      name: "name",
      category: "category",
      isActive: "isActive",
      durationMinutes: "durationMinutes",
      priceInCents: "priceInCents",
      depositInCents: "depositInCents",
    },
    serviceRecords: { id: "id", bookingId: "bookingId" },
    syncLog: {},
    waitlist: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      createdAt: "createdAt",
      preferredDateStart: "preferredDateStart",
      preferredDateEnd: "preferredDateEnd",
      timePreference: "timePreference",
      notes: "notes",
      notifiedAt: "notifiedAt",
    },
    reviews: { id: "id", clientId: "clientId", bookingId: "bookingId" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
      email: `${name}_email`,
      phone: `${name}_phone`,
      notifyEmail: `${name}_notify`,
    })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: mockIsSquareConfigured,
    createSquareOrder: mockCreateSquareOrder,
    createSquarePaymentLink: mockCreateSquarePaymentLink,
  }));
  vi.doMock("@/lib/zoho", () => ({
    updateZohoDeal: mockUpdateZohoDeal,
    createZohoDeal: mockCreateZohoDeal,
  }));
  vi.doMock("@/lib/zoho-books", () => ({ createZohoBooksInvoice: mockCreateZohoBooksInvoice }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/twilio", () => ({ sendSms: mockSendSms }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: mockNotifyWaitlist,
  }));
  for (const name of [
    "BookingCancellation",
    "BookingCompleted",
    "BookingConfirmation",
    "BookingNoShow",
    "BookingReschedule",
    "PaymentLinkEmail",
    "RecurringBookingConfirmation",
    "WaitlistNotification",
  ]) {
    vi.doMock(`@/emails/${name}`, () => ({ [name]: vi.fn(() => null) }));
  }
  vi.doMock("@/app/dashboard/media/actions", () => ({}));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getBookings ---- */

  describe("getBookings", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getBookings } = await import("./actions");
      await expect(getBookings()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when there are no bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { getBookings } = await import("./actions");
      const result = await getBookings();
      expect(result).toEqual([]);
    });

    it("maps rows to BookingRow shape with fallback values", async () => {
      vi.resetModules();
      const row = {
        id: 1,
        status: "confirmed",
        startsAt: new Date("2026-04-01T10:00:00Z"),
        durationMinutes: 60,
        totalInCents: 10000,
        location: "Studio",
        clientNotes: "notes",
        clientId: "client-1",
        clientFirstName: null, // tests fallback to ""
        clientLastName: "Doe",
        clientPhone: "+1",
        serviceId: 2,
        serviceName: null, // tests fallback to ""
        serviceCategory: null, // tests fallback to "lash"
        staffId: "staff-1",
        staffFirstName: "Alex",
        recurrenceRule: null,
        parentBookingId: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getBookings } = await import("./actions");
      const result = await getBookings();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        clientFirstName: "",
        serviceName: "",
        serviceCategory: "lash",
      });
    });
  });

  /* ---- updateBookingStatus ---- */

  describe("updateBookingStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateBookingStatus } = await import("./actions");
      await expect(updateBookingStatus(1, "confirmed")).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with the new status", async () => {
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
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(42, "pending");
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
    });

    it("sets confirmedAt when status is 'confirmed'", async () => {
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
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(42, "confirmed");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "confirmed", confirmedAt: expect.any(Date) }),
      );
    });

    it("stores cancellationReason when provided", async () => {
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
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(10, "cancelled", "Client requested");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          cancellationReason: "Client requested",
        }),
      );
    });

    it("fires trackEvent with booking_status_changed", async () => {
      vi.resetModules();
      setupMocks();
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(42, "pending");
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "42",
        "booking_status_changed",
        expect.objectContaining({ bookingId: 42, newStatus: "pending" }),
      );
    });

    it("calls updateZohoDeal('Closed Won') when status is completed", async () => {
      vi.resetModules();
      setupMocks();
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(42, "completed");
      expect(mockUpdateZohoDeal).toHaveBeenCalledWith(42, "Closed Won");
    });

    it("calls updateZohoDeal('Closed Lost') when status is cancelled", async () => {
      vi.resetModules();
      setupMocks();
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(42, "cancelled");
      expect(mockUpdateZohoDeal).toHaveBeenCalledWith(42, "Closed Lost");
    });

    it("calls updateZohoDeal('Confirmed') when status is confirmed", async () => {
      vi.resetModules();
      setupMocks();
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(42, "confirmed");
      expect(mockUpdateZohoDeal).toHaveBeenCalledWith(42, "Confirmed");
    });

    it("notifies waitlist when booking is cancelled", async () => {
      vi.resetModules();
      setupMocks();
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(42, "cancelled");
      expect(mockNotifyWaitlist).toHaveBeenCalledWith(42);
    });

    it("does not notify waitlist for non-cancelled statuses", async () => {
      vi.resetModules();
      setupMocks();
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(42, "completed");
      expect(mockNotifyWaitlist).not.toHaveBeenCalled();
    });

    it("revalidates /dashboard/bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { updateBookingStatus } = await import("./actions");
      await updateBookingStatus(1, "pending");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });

  /* ---- createBooking ---- */

  describe("createBooking", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createBooking } = await import("./actions");
      await expect(
        createBooking({
          clientId: "c1",
          serviceId: 1,
          staffId: null,
          startsAt: new Date(),
          durationMinutes: 60,
          totalInCents: 5000,
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts booking with status 'confirmed'", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 99 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBooking } = await import("./actions");
      await createBooking({
        clientId: "client-1",
        staffId: null,
        serviceId: 5,
        startsAt: new Date("2026-05-01T10:00:00Z"),
        durationMinutes: 60,
        totalInCents: 15000,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-1",
          serviceId: 5,
          totalInCents: 15000,
          status: "confirmed",
        }),
      );
    });

    it("fires PostHog booking_created event", async () => {
      vi.resetModules();
      setupMocks();
      const { createBooking } = await import("./actions");
      await createBooking({
        clientId: "client-1",
        staffId: null,
        serviceId: 5,
        startsAt: new Date(),
        durationMinutes: 60,
        totalInCents: 15000,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "client-1",
        "booking_created",
        expect.objectContaining({ serviceId: 5, totalInCents: 15000 }),
      );
    });

    it("calls createZohoDeal when client is found", async () => {
      vi.resetModules();
      // Return a universal row that satisfies every internal helper's select
      // (trySendBookingConfirmation, Zoho client lookup, Zoho service lookup).
      // notifyEmail: false prevents any email send side-effects.
      const universalRow = {
        email: "client@example.com",
        clientEmail: "client@example.com",
        firstName: "Jane",
        clientFirstName: "Jane",
        notifyEmail: false,
        name: "Lash Extensions",
        serviceName: "Lash Extensions",
        depositInCents: 0,
        depositPaidInCents: 0,
        squareOrderId: "existing",
        zohoInvoiceId: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([universalRow])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 77 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBooking } = await import("./actions");
      await createBooking({
        clientId: "client-1",
        staffId: null,
        serviceId: 5,
        startsAt: new Date(),
        durationMinutes: 60,
        totalInCents: 15000,
      });
      expect(mockCreateZohoDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          contactEmail: "client@example.com",
          stage: "Confirmed",
          amountInCents: 15000,
          bookingId: 77,
        }),
      );
    });

    it("calls createZohoBooksInvoice for admin-created bookings when client is found", async () => {
      vi.resetModules();
      const universalRow = {
        email: "client@example.com",
        clientEmail: "client@example.com",
        firstName: "Jane",
        clientFirstName: "Jane",
        notifyEmail: false,
        name: "Lash Extensions",
        serviceName: "Lash Extensions",
        depositInCents: 0,
        depositPaidInCents: 0,
        squareOrderId: "existing",
        zohoInvoiceId: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([universalRow])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 77 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBooking } = await import("./actions");
      await createBooking({
        clientId: "client-1",
        staffId: null,
        serviceId: 5,
        startsAt: new Date(),
        durationMinutes: 60,
        totalInCents: 15000,
      });
      expect(mockCreateZohoBooksInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "booking",
          entityId: 77,
          email: "client@example.com",
        }),
      );
    });

    it("skips Zoho calls when client is not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])), // client lookup returns nothing
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBooking } = await import("./actions");
      await createBooking({
        clientId: "c1",
        serviceId: 1,
        staffId: null,
        startsAt: new Date(),
        durationMinutes: 60,
        totalInCents: 5000,
      });
      expect(mockCreateZohoDeal).not.toHaveBeenCalled();
      expect(mockCreateZohoBooksInvoice).not.toHaveBeenCalled();
    });

    it("revalidates /dashboard/bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { createBooking } = await import("./actions");
      await createBooking({
        clientId: "c1",
        serviceId: 1,
        staffId: null,
        startsAt: new Date(),
        durationMinutes: 60,
        totalInCents: 5000,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });

    it("throws when staff has an overlapping booking", async () => {
      vi.resetModules();
      // The overlap query (select) returns a conflict row
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 50 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBooking } = await import("./actions");
      await expect(
        createBooking({
          clientId: "c1",
          serviceId: 1,
          staffId: "staff-1",
          startsAt: new Date("2026-05-01T14:00:00Z"),
          durationMinutes: 60,
          totalInCents: 5000,
        }),
      ).rejects.toThrow("already has a booking during that time slot");
    });

    it("skips overlap check when staffId is null", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 99 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBooking } = await import("./actions");
      await createBooking({
        clientId: "c1",
        serviceId: 1,
        staffId: null,
        startsAt: new Date("2026-05-01T14:00:00Z"),
        durationMinutes: 60,
        totalInCents: 5000,
      });
      expect(mockInsertValues).toHaveBeenCalled();
    });
  });

  /* ---- updateBooking ---- */

  describe("updateBooking", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateBooking } = await import("./actions");
      await expect(
        updateBooking(1, {
          clientId: "c1",
          serviceId: 1,
          staffId: null,
          startsAt: new Date(),
          durationMinutes: 60,
          totalInCents: 5000,
          status: "confirmed",
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("updates booking fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      const existingDate = new Date("2026-04-01T10:00:00Z");
      const newDate = new Date("2026-04-05T10:00:00Z");
      setupMocks({
        select: vi.fn(() => makeChain([{ startsAt: existingDate }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateBooking } = await import("./actions");
      await updateBooking(1, {
        clientId: "c1",
        serviceId: 1,
        staffId: null,
        startsAt: newDate,
        durationMinutes: 60,
        totalInCents: 5000,
        status: "confirmed",
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "c1", serviceId: 1, status: "confirmed" }),
      );
    });

    it("revalidates /dashboard/bookings", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ startsAt: new Date() }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateBooking } = await import("./actions");
      await updateBooking(1, {
        clientId: "c1",
        serviceId: 1,
        staffId: null,
        startsAt: new Date(),
        durationMinutes: 60,
        totalInCents: 5000,
        status: "pending",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });

    it("throws when staff has an overlapping booking on update", async () => {
      vi.resetModules();
      // The overlap query (select) returns a conflict row
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 50 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateBooking } = await import("./actions");
      await expect(
        updateBooking(1, {
          clientId: "c1",
          serviceId: 1,
          staffId: "staff-1",
          startsAt: new Date("2026-05-01T14:00:00Z"),
          durationMinutes: 60,
          totalInCents: 5000,
          status: "confirmed",
        }),
      ).rejects.toThrow("already has a booking during that time slot");
    });

    it("skips overlap check when updating to cancelled status", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      // select returns a conflict row, but it should not matter for cancel
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 50, startsAt: new Date() }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateBooking } = await import("./actions");
      await updateBooking(1, {
        clientId: "c1",
        serviceId: 1,
        staffId: "staff-1",
        startsAt: new Date("2026-05-01T14:00:00Z"),
        durationMinutes: 60,
        totalInCents: 5000,
        status: "cancelled",
      });
      expect(mockUpdateSet).toHaveBeenCalled();
    });
  });

  /* ---- deleteBooking ---- */

  describe("deleteBooking", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteBooking } = await import("./actions");
      await expect(deleteBooking(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the booking", async () => {
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
      const { deleteBooking } = await import("./actions");
      await deleteBooking(99);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates /dashboard/bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteBooking } = await import("./actions");
      await deleteBooking(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });

  /* ---- getClientsForSelect ---- */

  describe("getClientsForSelect", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientsForSelect } = await import("./actions");
      await expect(getClientsForSelect()).rejects.toThrow("Not authenticated");
    });

    it("returns mapped client list", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: "c1",
              firstName: "Jane",
              lastName: "Doe",
              phone: "+1",
              preferredRebookIntervalDays: 30,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientsForSelect } = await import("./actions");
      const result = await getClientsForSelect();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "c1",
        name: "Jane Doe",
        phone: "+1",
        preferredRebookIntervalDays: 30,
      });
    });

    it("handles null lastName gracefully", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: "c1",
              firstName: "Jane",
              lastName: null,
              phone: null,
              preferredRebookIntervalDays: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientsForSelect } = await import("./actions");
      const result = await getClientsForSelect();
      expect(result[0].name).toBe("Jane");
      expect(result[0].preferredRebookIntervalDays).toBeNull();
    });
  });

  /* ---- getServicesForSelect ---- */

  describe("getServicesForSelect", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getServicesForSelect } = await import("./actions");
      await expect(getServicesForSelect()).rejects.toThrow("Not authenticated");
    });

    it("returns mapped service list with defaults for null fields", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              name: "Lash Extensions",
              category: "lash",
              durationMinutes: null,
              priceInCents: null,
              depositInCents: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getServicesForSelect } = await import("./actions");
      const result = await getServicesForSelect();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        name: "Lash Extensions",
        category: "lash",
        durationMinutes: 60,
        priceInCents: 0,
        depositInCents: 0, // defaults
      });
    });
  });

  /* ---- getStaffForSelect ---- */

  describe("getStaffForSelect", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getStaffForSelect } = await import("./actions");
      await expect(getStaffForSelect()).rejects.toThrow("Not authenticated");
    });

    it("returns mapped staff list", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ id: "s1", firstName: "Alex", lastName: "Smith" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStaffForSelect } = await import("./actions");
      const result = await getStaffForSelect();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: "s1", name: "Alex Smith" });
    });
  });

  /* ---- addToWaitlist ---- */

  describe("addToWaitlist", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { addToWaitlist } = await import("./actions");
      await expect(addToWaitlist({ clientId: "c1", serviceId: 1 })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("inserts waitlist record with provided fields", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { addToWaitlist } = await import("./actions");
      await addToWaitlist({ clientId: "client-1", serviceId: 3, notes: "Flexible" });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "client-1", serviceId: 3, notes: "Flexible" }),
      );
    });

    it("fires PostHog waitlist_added event with user id", async () => {
      vi.resetModules();
      setupMocks();
      const { addToWaitlist } = await import("./actions");
      await addToWaitlist({ clientId: "client-1", serviceId: 3 });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "waitlist_added",
        expect.objectContaining({ clientId: "client-1", serviceId: 3 }),
      );
    });

    it("revalidates /dashboard/bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { addToWaitlist } = await import("./actions");
      await addToWaitlist({ clientId: "c1", serviceId: 1 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });

  /* ---- updateWaitlistStatus ---- */

  describe("updateWaitlistStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateWaitlistStatus } = await import("./actions");
      await expect(updateWaitlistStatus(1, "notified")).rejects.toThrow("Not authenticated");
    });

    it("updates the waitlist status", async () => {
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
      const { updateWaitlistStatus } = await import("./actions");
      await updateWaitlistStatus(5, "booked");
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "booked" }));
    });

    it("sets notifiedAt timestamp when status is 'notified'", async () => {
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
      const { updateWaitlistStatus } = await import("./actions");
      await updateWaitlistStatus(5, "notified");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "notified", notifiedAt: expect.any(Date) }),
      );
    });

    it("sends notification email when status is 'notified' and client has email+notifyEmail", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientEmail: "client@example.com",
              clientFirstName: "Jane",
              notifyEmail: true,
              serviceName: "Lash Extensions",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateWaitlistStatus } = await import("./actions");
      await updateWaitlistStatus(5, "notified");
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "client@example.com",
          entityType: "waitlist_notification",
        }),
      );
    });

    it("does not send email when notifyEmail is false", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              clientEmail: "client@example.com",
              clientFirstName: "Jane",
              notifyEmail: false,
              serviceName: "Lash Extensions",
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateWaitlistStatus } = await import("./actions");
      await updateWaitlistStatus(5, "notified");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("does not send email for non-notified statuses", async () => {
      vi.resetModules();
      setupMocks();
      const { updateWaitlistStatus } = await import("./actions");
      await updateWaitlistStatus(5, "expired");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  /* ---- removeFromWaitlistById ---- */

  describe("removeFromWaitlistById", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { removeFromWaitlistById } = await import("./actions");
      await expect(removeFromWaitlistById(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the waitlist entry", async () => {
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
      const { removeFromWaitlistById } = await import("./actions");
      await removeFromWaitlistById(7);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates /dashboard/bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { removeFromWaitlistById } = await import("./actions");
      await removeFromWaitlistById(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
    });
  });

  /* ---- cancelBookingSeries ---- */

  describe("cancelBookingSeries", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { cancelBookingSeries } = await import("./actions");
      await expect(cancelBookingSeries(1)).rejects.toThrow("Not authenticated");
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
      const { cancelBookingSeries } = await import("./actions");
      await expect(cancelBookingSeries(999)).rejects.toThrow("Booking not found");
    });

    it("cancels all future series bookings", async () => {
      vi.resetModules();
      let selectCount = 0;
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ parentBookingId: null }]);
          return makeChain([
            { id: 10, status: "confirmed" },
            { id: 11, status: "pending" },
          ]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelBookingSeries } = await import("./actions");
      await cancelBookingSeries(10);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled", cancelledAt: expect.any(Date) }),
      );
    });

    it("returns early without updating when no future series bookings exist", async () => {
      vi.resetModules();
      let selectCount = 0;
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ parentBookingId: null }]);
          return makeChain([]); // no future bookings
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelBookingSeries } = await import("./actions");
      await cancelBookingSeries(10);
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it("uses parentBookingId as series root when present", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          // First call: booking has a parentBookingId, meaning it's a child booking
          if (selectCount === 1) return makeChain([{ parentBookingId: 5 }]);
          return makeChain([{ id: 6, status: "confirmed" }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { cancelBookingSeries } = await import("./actions");
      // Should not throw; the series root (5) is used internally
      await expect(cancelBookingSeries(6)).resolves.toBeUndefined();
    });
  });
});
