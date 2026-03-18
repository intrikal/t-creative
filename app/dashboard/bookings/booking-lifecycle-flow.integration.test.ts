import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the booking creation lifecycle flow.
 *
 * Calls the real `createBooking` from ./actions and verifies FINAL STATE
 * in the stateful mock DB:
 *   - Booking inserted with status "confirmed"
 *   - Confirmation email sent via Resend when client has notifyEmail = true
 *   - Throws with overlap error when staff already has a booking that time
 *
 * DB call order inside createBooking (no staffId):
 *   1. INSERT bookings RETURNING { id }
 *   2. tryCreateSquareOrder      → Square not configured → early return (0 selects)
 *   3. trySendBookingConfirmation → SELECT joined (bookings + confirmClient + services)
 *   4. trySendBookingConfirmation → SELECT bookingAddOns
 *   5. trySendBookingConfirmation → INSERT notifications (tryFireInternalNotification)
 *   6. tryAutoSendDepositLink    → Square not configured → early return (0 selects)
 *   7. SELECT profiles WHERE id = clientId    (Zoho CRM)
 *   8. SELECT services WHERE id = serviceId   (Zoho Books)
 *
 * When staffId is provided, a hasOverlappingBooking SELECT is prepended as call 1.
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const bookingsTable: MockRow[] = [];
  const notificationsTable: MockRow[] = [];
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
    _bookings: bookingsTable,
    _notifications: notificationsTable,
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

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const row = { ...values, id };

        if ("startsAt" in values && "clientId" in values && "serviceId" in values) {
          bookingsTable.push(row);
        } else if ("type" in values && "channel" in values) {
          notificationsTable.push(row);
        } else if ("provider" in values && "direction" in values) {
          syncLogTable.push(row);
        }

        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((_values: MockRow) => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Shared mock instances                                              */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockSendSms = vi.fn().mockResolvedValue(undefined);
const mockGetEmailRecipient = vi.fn().mockResolvedValue(null);
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } });
const mockRevalidatePath = vi.fn();
const mockTrackEvent = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
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
      location: "location",
      clientNotes: "clientNotes",
      recurrenceRule: "recurrenceRule",
      subscriptionId: "subscriptionId",
      parentBookingId: "parentBookingId",
      confirmedAt: "confirmedAt",
      completedAt: "completedAt",
      cancelledAt: "cancelledAt",
      cancellationReason: "cancellationReason",
      squareOrderId: "squareOrderId",
      depositPaidInCents: "depositPaidInCents",
      zohoInvoiceId: "zohoInvoiceId",
      deletedAt: "deletedAt",
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
    services: {
      id: "id",
      name: "name",
      category: "category",
      depositRequired: "depositRequired",
      depositPercent: "depositPercent",
      depositInCents: "depositInCents",
      durationMinutes: "durationMinutes",
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
    syncLog: {
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      localId: "localId",
      remoteId: "remoteId",
      message: "message",
      errorMessage: "errorMessage",
    },
    bookingAddOns: {
      id: "id",
      bookingId: "bookingId",
      addOnName: "addOnName",
      priceInCents: "priceInCents",
    },
    bookingSubscriptions: { id: "id", status: "status" },
    invoices: { id: "id", number: "number", amountInCents: "amountInCents", status: "status" },
    payments: { id: "id", bookingId: "bookingId", method: "method" },
    waitlist: { id: "id", serviceId: "serviceId", status: "status" },
    clientForms: { id: "id", name: "name", type: "type", appliesTo: "appliesTo", isActive: "isActive", required: "required" },
    formSubmissions: { id: "id", clientId: "clientId", formId: "formId" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    or: vi.fn((...a: unknown[]) => ({ type: "or", a })),
    ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: any, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(false),
    createSquareOrder: vi.fn(),
    createSquarePaymentLink: vi.fn(),
    getSquareCardOnFile: vi.fn().mockResolvedValue(null),
    chargeCardOnFile: vi.fn(),
    squareClient: {},
  }));
  vi.doMock("@/lib/zoho", () => ({
    createZohoDeal: vi.fn(),
    updateZohoDeal: vi.fn(),
  }));
  vi.doMock("@/lib/zoho-books", () => ({
    createZohoBooksInvoice: vi.fn(),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/twilio", () => ({ sendSms: mockSendSms }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPolicies: vi.fn().mockResolvedValue({
      cancelWindowHours: 24,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
      depositRequired: false,
      depositPercent: 0,
    }),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  // waiver-actions IS imported by actions.ts (via updateBookingStatus)
  vi.doMock("./waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Booking lifecycle flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
  });

  it("createBooking inserts a booking with status confirmed", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // 1. INSERT bookings → handled by insert mock (no select needed)
    // 2. tryCreateSquareOrder → Square not configured → early return
    // 3. trySendBookingConfirmation: SELECT joined → empty (non-fatal, skips email)
    db._queue([]);
    // 4. trySendBookingConfirmation: SELECT bookingAddOns → empty
    db._queue([]);
    // 5. tryAutoSendDepositLink → Square not configured → early return
    // 6. SELECT profiles for Zoho CRM → empty
    db._queue([]);
    // 7. SELECT services for Zoho Books → empty
    db._queue([]);

    setupMocks(db);
    const { createBooking } = await import("./actions");

    await createBooking({
      clientId: "client-1",
      serviceId: 2,
      staffId: null,
      startsAt: new Date("2026-04-01T10:00:00"),
      durationMinutes: 60,
      totalInCents: 8000,
    });

    expect(db._bookings).toHaveLength(1);
    expect(db._bookings[0].status).toBe("confirmed");
    expect(db._bookings[0].clientId).toBe("client-1");
  });

  it("createBooking sends a confirmation email when client has notifyEmail true", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // 1. INSERT bookings → handled by insert mock
    // 2. tryCreateSquareOrder → Square not configured → early return
    // 3. trySendBookingConfirmation: SELECT joined → client row with notifyEmail: true
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientPhone: null,
        clientFirstName: "Alice",
        notifyEmail: true,
        notifySms: false,
        serviceName: "Classic Lash Set",
        startsAt: new Date("2026-04-01T10:00:00"),
        durationMinutes: 60,
        totalInCents: 8000,
      },
    ]);
    // 4. trySendBookingConfirmation: SELECT bookingAddOns → empty
    db._queue([]);
    // 5. tryAutoSendDepositLink → Square not configured → early return
    // 6. SELECT profiles for Zoho CRM → empty
    db._queue([]);
    // 7. SELECT services for Zoho Books → empty
    db._queue([]);

    setupMocks(db);
    const { createBooking } = await import("./actions");

    await createBooking({
      clientId: "client-1",
      serviceId: 2,
      staffId: null,
      startsAt: new Date("2026-04-01T10:00:00"),
      durationMinutes: 60,
      totalInCents: 8000,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "booking_confirmation",
      }),
    );
  });

  it("createBooking throws when staff has overlapping booking", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // 1. hasOverlappingBooking: SELECT bookings → conflict found
    db._queue([{ id: 99 }]);

    setupMocks(db);
    const { createBooking } = await import("./actions");

    await expect(
      createBooking({
        clientId: "client-1",
        serviceId: 2,
        staffId: "staff-1",
        startsAt: new Date("2026-04-01T10:00:00"),
        durationMinutes: 60,
        totalInCents: 8000,
      }),
    ).rejects.toThrow(/already has a booking/i);
  });
});
