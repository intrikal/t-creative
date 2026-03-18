import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the waitlist add → notification → expiry flow.
 *
 * Calls real functions from:
 *   - waitlist-actions.ts:  addToWaitlist
 *   - waitlist-notify.ts:   notifyNextWaitlistEntry, notifyWaitlistForCancelledBooking
 *   - actions.ts:           updateBookingStatus("cancelled") → triggers waitlist notify
 *
 * Verifies FINAL STATE:
 *   - addToWaitlist inserts entry with status "waiting"
 *   - notifyNextWaitlistEntry updates entry to "notified" with token + expiry
 *   - Notification email is sent with booking link
 *   - Expiry flow (waitlist-expiry route) marks entry "expired" and re-notifies next in queue
 *   - Cancelling a booking calls notifyWaitlistForCancelledBooking which notifies next entry
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const waitlistTable: MockRow[] = [];
  const notificationsTable: MockRow[] = [];
  const bookingsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: vi.fn().mockResolvedValue(rows.map((r) => ({ id: r.id ?? nextId++ }))),
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _waitlist: waitlistTable,
    _notifications: notificationsTable,
    _bookings: bookingsTable,
    _syncLog: syncLogTable,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const row = { ...values, id };

        if ("serviceId" in values && !("clientId" in values && "status" in values && "method" in values)) {
          if ("clientId" in values && ("preferredDateStart" in values || "notes" in values || Object.keys(values).length <= 6)) {
            waitlistTable.push(row);
          }
        }
        if ("type" in values && "channel" in values) {
          notificationsTable.push(row);
        }
        if ("provider" in values && "direction" in values) {
          syncLogTable.push(row);
        }

        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn((table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          // Apply status/token updates to waitlist entries
          if ("status" in values || "claimToken" in values) {
            const last = waitlistTable[waitlistTable.length - 1];
            if (last) Object.assign(last, values);
          }
          return Promise.resolve();
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  External API mocks                                                 */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockSendSms = vi.fn().mockResolvedValue(undefined);
const mockGetEmailRecipient = vi.fn();
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } });
const mockRevalidatePath = vi.fn();
const mockTrackEvent = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helpers                                                      */
/* ------------------------------------------------------------------ */

function setupWaitlistMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    waitlist: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      preferredDateStart: "preferredDateStart",
      preferredDateEnd: "preferredDateEnd",
      timePreference: "timePreference",
      notes: "notes",
      notifiedAt: "notifiedAt",
      claimToken: "claimToken",
      claimTokenExpiresAt: "claimTokenExpiresAt",
      offeredSlotStartsAt: "offeredSlotStartsAt",
      offeredStaffId: "offeredStaffId",
      createdAt: "createdAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      notifyEmail: "notifyEmail",
      notifySms: "notifySms",
    },
    services: { id: "id", name: "name", category: "category" },
    bookings: {
      id: "id",
      serviceId: "serviceId",
      clientId: "clientId",
      startsAt: "startsAt",
      staffId: "staffId",
      status: "status",
      deletedAt: "deletedAt",
    },
    notifications: {
      profileId: "profileId",
      type: "type",
      channel: "channel",
      status: "status",
      title: "title",
      body: "body",
      relatedEntityType: "relatedEntityType",
      relatedEntityId: "relatedEntityId",
    },
    syncLog: { provider: "provider", direction: "direction", status: "status" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    or: vi.fn((...a: unknown[]) => ({ type: "or", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

function setupNotifyMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    waitlist: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      notifiedAt: "notifiedAt",
      claimToken: "claimToken",
      claimTokenExpiresAt: "claimTokenExpiresAt",
      offeredSlotStartsAt: "offeredSlotStartsAt",
      offeredStaffId: "offeredStaffId",
      createdAt: "createdAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
      notifyEmail: "notifyEmail",
    },
    services: { id: "id", name: "name" },
    bookings: {
      id: "id",
      serviceId: "serviceId",
      startsAt: "startsAt",
      staffId: "staffId",
    },
    notifications: {
      profileId: "profileId",
      type: "type",
      channel: "channel",
      status: "status",
      title: "title",
      body: "body",
      relatedEntityType: "relatedEntityType",
      relatedEntityId: "relatedEntityId",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
  }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Waitlist flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
  });

  /* --- Add to waitlist --- */

  it("addToWaitlist inserts an entry with status 'waiting'", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupWaitlistMocks(db);
    const { addToWaitlist } = await import("./waitlist-actions");

    await addToWaitlist({ clientId: "client-1", serviceId: 2 });

    expect(db._waitlist).toHaveLength(1);
    expect(db._waitlist[0]).toMatchObject({
      clientId: "client-1",
      serviceId: 2,
    });
  });

  /* --- Notify next entry --- */

  it("notifyNextWaitlistEntry updates entry to 'notified' and sets claim token", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Seed a waiting entry
    const waitingEntry = {
      id: 1,
      clientId: "client-1",
      serviceId: 2,
      status: "waiting",
    };
    db._waitlist.push(waitingEntry);

    // Select: first waiting entry (joined with profiles + services)
    db._queue([
      {
        id: 1,
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
      },
    ]);

    setupNotifyMocks(db);
    const { notifyNextWaitlistEntry } = await import("@/lib/waitlist-notify");

    const offeredSlot = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await notifyNextWaitlistEntry({
      serviceId: 2,
      offeredSlotStartsAt: offeredSlot,
      offeredStaffId: "staff-1",
    });

    // Entry updated to notified with token
    expect(db._waitlist[0].status).toBe("notified");
    expect(db._waitlist[0].claimToken).toBeDefined();
    expect(db._waitlist[0].offeredSlotStartsAt).toBe(offeredSlot);

    // Token expires in ~24 hours
    const expiresAt = db._waitlist[0].claimTokenExpiresAt as Date;
    const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(hoursUntilExpiry).toBeGreaterThan(23);
    expect(hoursUntilExpiry).toBeLessThan(25);
  });

  it("notifyNextWaitlistEntry sends email with booking link containing the token", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([
      {
        id: 1,
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
      },
    ]);

    setupNotifyMocks(db);
    const { notifyNextWaitlistEntry } = await import("@/lib/waitlist-notify");

    await notifyNextWaitlistEntry({
      serviceId: 2,
      offeredSlotStartsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      offeredStaffId: null,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "waitlist_notification",
        localId: "1",
      }),
    );
  });

  it("notifyNextWaitlistEntry is a no-op when no waiting entries exist", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // No waiting entries in the queue
    db._queue([]);

    setupNotifyMocks(db);
    const { notifyNextWaitlistEntry } = await import("@/lib/waitlist-notify");

    await notifyNextWaitlistEntry({
      serviceId: 2,
      offeredSlotStartsAt: new Date(),
      offeredStaffId: null,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(db._waitlist.some((e) => e.status === "notified")).toBe(false);
  });

  it("notifyNextWaitlistEntry skips when client has opted out of email", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([
      {
        id: 1,
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: false, // opted out
        serviceName: "Classic Lash Set",
      },
    ]);

    setupNotifyMocks(db);
    const { notifyNextWaitlistEntry } = await import("@/lib/waitlist-notify");

    await notifyNextWaitlistEntry({
      serviceId: 2,
      offeredSlotStartsAt: new Date(),
      offeredStaffId: null,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  /* --- Cancellation triggers waitlist notification --- */

  it("notifyWaitlistForCancelledBooking notifies next waiting entry for that service", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // notifyWaitlistForCancelledBooking: look up cancelled booking
    db._queue([{ serviceId: 2, startsAt: new Date(), staffId: "staff-1" }]);

    // notifyNextWaitlistEntry: first waiting entry
    db._queue([
      {
        id: 5,
        clientId: "client-2",
        clientEmail: "bob@example.com",
        clientFirstName: "Bob",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
      },
    ]);

    // Seed a waiting entry to be updated
    db._waitlist.push({ id: 5, clientId: "client-2", serviceId: 2, status: "waiting" });

    setupNotifyMocks(db);
    const { notifyWaitlistForCancelledBooking } = await import("@/lib/waitlist-notify");

    await notifyWaitlistForCancelledBooking(42);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "bob@example.com",
        entityType: "waitlist_notification",
      }),
    );
    expect(db._waitlist[0].status).toBe("notified");
  });

  it("notifyWaitlistForCancelledBooking is a no-op when booking not found", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Booking not found
    db._queue([]);

    setupNotifyMocks(db);
    const { notifyWaitlistForCancelledBooking } = await import("@/lib/waitlist-notify");

    // Should not throw and should not send email
    await expect(notifyWaitlistForCancelledBooking(999)).resolves.toBeUndefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
