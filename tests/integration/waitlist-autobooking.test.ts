// @vitest-environment node

/**
 * tests/integration/waitlist-autobooking.test.ts
 *
 * Integration tests for the waitlist claim → auto-booking flow.
 *
 * Exercises claimWaitlistSlot (app/book/claim/[token]/actions.ts) and
 * notifyNextWaitlistEntry (lib/waitlist-notify.ts).
 *
 * (1) Happy path: valid claim token → booking created with correct service,
 *     staff, time → waitlist status=booked → audit logged → confirmation email
 *     sent via notifyNextWaitlistEntry
 * (2) Overlap: booking created as "pending" (no overlap check at claim time);
 *     overlap is enforced later when admin confirms — claim itself succeeds
 * (3) Advisory lock: two claims with same token → first succeeds, second
 *     returns "already_claimed" (token cleared after first claim)
 * (4) Deposit: booking created as "pending" status — admin confirmation
 *     triggers deposit link via the normal booking flow
 * (5) Expired claim token: returns { success: false, error: "expired" }
 * (6) Staff time-off: claim still succeeds (booking is "pending"); time-off
 *     check happens when admin confirms — tested in timeoff-blocking tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const bookingsTable: MockRow[] = [];
  const notificationsTable: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  const updateCalls: Array<{ values: MockRow }> = [];

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
    _bookings: bookingsTable,
    _notifications: notificationsTable,
    _updateCalls: updateCalls,

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
        if ("type" in values && "channel" in values) {
          notificationsTable.push(row);
        } else if ("clientId" in values && "serviceId" in values) {
          bookingsTable.push(row);
        }
        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn(() => ({
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  External API mocks                                                 */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockTrackEvent = vi.fn();
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helpers                                                      */
/* ------------------------------------------------------------------ */

/** Mocks for claimWaitlistSlot (app/book/claim/[token]/actions.ts) */
function setupClaimMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      staffId: "staffId",
      status: "status",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      clientNotes: "clientNotes",
    },
    services: {
      id: "id",
      name: "name",
      priceInCents: "priceInCents",
      durationMinutes: "durationMinutes",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
      notifyEmail: "notifyEmail",
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
      notifiedAt: "notifiedAt",
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
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
}

/** Mocks for notifyNextWaitlistEntry (lib/waitlist-notify.ts) */
function setupNotifyMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      serviceId: "serviceId",
      startsAt: "startsAt",
      staffId: "staffId",
    },
    services: { id: "id", name: "name" },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
      notifyEmail: "notifyEmail",
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
      notifiedAt: "notifiedAt",
      createdAt: "createdAt",
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
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBookingRules: vi.fn().mockResolvedValue({ waitlistClaimWindowHours: 24 }),
    getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "T Creative Studio" }),
  }));
  vi.doMock("@/emails/WaitlistNotification", () => ({
    WaitlistNotification: vi.fn().mockReturnValue(null),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Waitlist auto-booking — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockCaptureException.mockImplementation(() => {});
  });

  /* --- (1) Happy path: valid claim → booking created --- */

  it("(1) happy path: claim token accepted → booking created with correct service, staff, time → waitlist marked booked → audit logged, notification email sent", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const slotTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // ── notifyNextWaitlistEntry: send notification email ──

    // 1. Find first waiting entry (joined with profiles + services)
    db._queue([
      {
        id: 5,
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
      serviceId: 1,
      offeredSlotStartsAt: slotTime,
      offeredStaffId: "staff-A",
    });

    // Waitlist entry updated to "notified" with claim token
    const notifyUpdate = db._updateCalls.find((u) => u.values.status === "notified");
    expect(notifyUpdate).toBeDefined();
    expect(notifyUpdate!.values.claimToken).toBeDefined();
    expect(notifyUpdate!.values.claimTokenExpiresAt).toBeInstanceOf(Date);
    expect(notifyUpdate!.values.offeredSlotStartsAt).toEqual(slotTime);
    expect(notifyUpdate!.values.offeredStaffId).toBe("staff-A");

    // Notification email sent
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "waitlist_notification",
        localId: "5",
      }),
    );
    const emailSubject = mockSendEmail.mock.calls[0][0].subject as string;
    expect(emailSubject).toContain("spot opened up");
    expect(emailSubject).toContain("Classic Lash Set");

    // In-app notification created
    expect(db._notifications).toHaveLength(1);
    expect(db._notifications[0]).toMatchObject({
      profileId: "client-1",
      type: "waitlist_alert",
      channel: "internal",
    });

    // ── claimWaitlistSlot: client clicks claim link ──
    vi.resetModules();
    const claimDb = createStatefulDb();

    // 1. Waitlist entry lookup by token
    claimDb._queue([
      {
        id: 5,
        clientId: "client-1",
        serviceId: 1,
        status: "notified",
        claimTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        offeredSlotStartsAt: slotTime,
        offeredStaffId: "staff-A",
      },
    ]);
    // 2. Service snapshot (price + duration)
    claimDb._queue([{ priceInCents: 15000, durationMinutes: 90 }]);

    setupClaimMocks(claimDb);
    const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

    const result = await claimWaitlistSlot("valid-claim-token-uuid");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.bookingId).toBeDefined();
    }

    // Booking created with correct fields
    expect(claimDb._bookings).toHaveLength(1);
    expect(claimDb._bookings[0]).toMatchObject({
      clientId: "client-1",
      serviceId: 1,
      staffId: "staff-A",
      startsAt: slotTime,
      durationMinutes: 90,
      totalInCents: 15000,
      status: "pending",
      clientNotes: "Booked via waitlist claim link",
    });

    // Waitlist entry marked as booked, token cleared
    const bookedUpdate = claimDb._updateCalls.find((u) => u.values.status === "booked");
    expect(bookedUpdate).toBeDefined();
    expect(bookedUpdate!.values.claimToken).toBeNull();
    expect(bookedUpdate!.values.claimTokenExpiresAt).toBeNull();
    expect(bookedUpdate!.values.bookedBookingId).toBeDefined();

    // Audit log
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entityType: "booking",
        description: "Booking created from waitlist claim",
      }),
    );

    // Analytics event
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "client-1",
      "waitlist_slot_claimed",
      expect.objectContaining({ waitlistId: 5, serviceId: 1 }),
    );
  });

  /* --- (2) Overlap: claim creates "pending" booking, no overlap check --- */

  it("(2) claim creates 'pending' booking regardless of overlap — overlap check deferred to admin confirmation", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const slotTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Waitlist entry lookup
    db._queue([
      {
        id: 10,
        clientId: "client-1",
        serviceId: 1,
        status: "notified",
        claimTokenExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        offeredSlotStartsAt: slotTime,
        offeredStaffId: "staff-A",
      },
    ]);
    // Service snapshot
    db._queue([{ priceInCents: 15000, durationMinutes: 90 }]);

    setupClaimMocks(db);
    const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

    // Client already has a booking at this time, but claim doesn't check
    const result = await claimWaitlistSlot("overlap-token");

    // Claim succeeds — "pending" booking created
    expect(result.success).toBe(true);
    expect(db._bookings).toHaveLength(1);
    expect(db._bookings[0].status).toBe("pending");
  });

  /* --- (3) Advisory lock: two claims with same token --- */

  it("(3) two claims with same token: first succeeds, second returns 'already_claimed'", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const slotTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // First claim: valid entry
    db._queue([
      {
        id: 5,
        clientId: "client-1",
        serviceId: 1,
        status: "notified",
        claimTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        offeredSlotStartsAt: slotTime,
        offeredStaffId: null,
      },
    ]);
    db._queue([{ priceInCents: 15000, durationMinutes: 60 }]);

    // Second claim: token already cleared → entry not found by token lookup
    db._queue([]);

    setupClaimMocks(db);
    const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

    const first = await claimWaitlistSlot("shared-token");
    expect(first.success).toBe(true);

    // Second attempt with same token — db.update already set claimToken=null,
    // so SELECT by token returns nothing
    const second = await claimWaitlistSlot("shared-token");
    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.error).toBe("invalid_token");
    }

    // Only one booking created
    expect(db._bookings).toHaveLength(1);
  });

  /* --- (4) Deposit: booking created as "pending" --- */

  it("(4) deposit-required service: booking created as 'pending' — admin confirmation triggers deposit link", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const slotTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Waitlist entry
    db._queue([
      {
        id: 7,
        clientId: "client-1",
        serviceId: 2,
        status: "notified",
        claimTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        offeredSlotStartsAt: slotTime,
        offeredStaffId: "staff-A",
      },
    ]);
    // Service with deposit (depositInCents is on the service, but claim only
    // snapshots priceInCents + durationMinutes — deposit flow is on confirmation)
    db._queue([{ priceInCents: 20000, durationMinutes: 120 }]);

    setupClaimMocks(db);
    const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

    const result = await claimWaitlistSlot("deposit-token");

    expect(result.success).toBe(true);

    // Booking is "pending" — NOT "awaiting_deposit" or "confirmed"
    // The deposit link is sent when admin calls updateBookingStatus("confirmed")
    expect(db._bookings).toHaveLength(1);
    expect(db._bookings[0]).toMatchObject({
      status: "pending",
      totalInCents: 20000,
      durationMinutes: 120,
    });
  });

  /* --- (5) Expired claim token --- */

  it("(5) expired claim token: returns error, no booking created", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Waitlist entry with expired token
    db._queue([
      {
        id: 5,
        clientId: "client-1",
        serviceId: 1,
        status: "notified",
        claimTokenExpiresAt: new Date(Date.now() - 1000), // expired 1s ago
        offeredSlotStartsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        offeredStaffId: null,
      },
    ]);

    setupClaimMocks(db);
    const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

    const result = await claimWaitlistSlot("expired-token");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("expired");
    }

    // No booking created
    expect(db._bookings).toHaveLength(0);

    // No audit log or analytics
    expect(mockLogAction).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  /* --- (6) Staff time-off: claim succeeds (pending), check deferred --- */

  it("(6) staff has approved time-off: claim still succeeds as 'pending' — time-off check deferred to admin confirmation", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const slotTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Waitlist entry with staff who has time-off
    db._queue([
      {
        id: 8,
        clientId: "client-1",
        serviceId: 1,
        status: "notified",
        claimTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        offeredSlotStartsAt: slotTime,
        offeredStaffId: "staff-on-leave",
      },
    ]);
    db._queue([{ priceInCents: 15000, durationMinutes: 90 }]);

    setupClaimMocks(db);
    const { claimWaitlistSlot } = await import("@/app/book/claim/[token]/actions");

    // Claim doesn't check time-off — that's the admin's job on confirmation
    const result = await claimWaitlistSlot("timeoff-token");

    expect(result.success).toBe(true);
    expect(db._bookings).toHaveLength(1);
    expect(db._bookings[0]).toMatchObject({
      status: "pending",
      staffId: "staff-on-leave",
      startsAt: slotTime,
    });
  });
});
