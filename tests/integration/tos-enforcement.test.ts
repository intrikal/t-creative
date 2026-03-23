// @vitest-environment node

/**
 * tests/integration/tos-enforcement.test.ts
 *
 * Integration tests for Terms of Service enforcement on client-initiated bookings.
 *
 * Exercises createBookingRequest (messages/actions.ts) which validates
 * tosAccepted: z.literal(true) and tosVersion: z.string().min(1), then
 * stores tosAcceptedAt + tosVersion on the booking record.
 *
 * (1) tosAccepted=true  → booking created, tosAcceptedAt + tosVersion stored
 * (2) tosAccepted=false → Zod validation error (literal(true) fails)
 * (3) tosAccepted missing → Zod validation error
 * (4) tosVersion mismatch → succeeds, stores the version from request
 * (5) Admin view: getBookings returns tosAcceptedAt and tosVersion
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const bookingsTable: MockRow[] = [];
  const addOnsTable: MockRow[] = [];
  const threadsTable: MockRow[] = [];
  const messagesTable: MockRow[] = [];

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
      offset: () => chain,
      returning: vi.fn().mockResolvedValue(rows.map((r) => ({ id: r.id ?? nextId++ }))),
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _bookings: bookingsTable,
    _addOns: addOnsTable,
    _threads: threadsTable,
    _messages: messagesTable,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },

    select: vi.fn((...args: unknown[]) => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((table: any) => ({
      values: vi.fn((values: MockRow | MockRow[]) => {
        const rows = Array.isArray(values) ? values : [values];
        const ids: { id: number }[] = [];
        for (const v of rows) {
          const id = nextId++;
          const row = { ...v, id };
          // Route to the right table based on field signatures
          if ("threadId" in v && "senderId" in v) {
            messagesTable.push(row);
          } else if ("subject" in v && "threadType" in v) {
            threadsTable.push(row);
          } else if ("addOnName" in v && "bookingId" in v) {
            addOnsTable.push(row);
          } else if ("clientId" in v && "serviceId" in v) {
            bookingsTable.push(row);
          }
          ids.push({ id });
        }
        const returning = vi.fn().mockResolvedValue(ids);
        return { returning };
      }),
    })),

    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),

    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      // Not used by createBookingRequest, but kept for completeness
      return fn(db);
    }),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  External API mocks                                                 */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockRevalidatePath = vi.fn();
const mockTrackEvent = vi.fn();
const mockCaptureException = vi.fn();

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
      cancelledAt: "cancelledAt",
      cancellationReason: "cancellationReason",
      squareOrderId: "squareOrderId",
      deletedAt: "deletedAt",
      depositPaidInCents: "depositPaidInCents",
      locationId: "locationId",
      confirmedAt: "confirmedAt",
      completedAt: "completedAt",
      location: "location",
      clientNotes: "clientNotes",
      recurrenceRule: "recurrenceRule",
      subscriptionId: "subscriptionId",
      tosAcceptedAt: "tosAcceptedAt",
      tosVersion: "tosVersion",
      parentBookingId: "parentBookingId",
      referrerCode: "referrerCode",
    },
    services: {
      id: "id",
      name: "name",
      category: "category",
      depositInCents: "depositInCents",
      durationMinutes: "durationMinutes",
      priceInCents: "priceInCents",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      role: "role",
      notifyEmail: "notifyEmail",
      notifySms: "notifySms",
      squareCustomerId: "squareCustomerId",
    },
    threads: {
      id: "id",
      subject: "subject",
      clientId: "clientId",
      threadType: "threadType",
      status: "status",
      bookingId: "bookingId",
      referencePhotoUrls: "referencePhotoUrls",
    },
    messages: {
      id: "id",
      threadId: "threadId",
      senderId: "senderId",
      body: "body",
      channel: "channel",
    },
    threadParticipants: { threadId: "threadId", profileId: "profileId" },
    quickReplies: { id: "id" },
    bookingAddOns: { bookingId: "bookingId", addOnName: "addOnName", priceInCents: "priceInCents" },
    bookingSubscriptions: { id: "id", status: "status" },
    invoices: { id: "id" },
    notifications: {
      profileId: "profileId",
      type: "type",
      channel: "channel",
      status: "status",
      title: "title",
    },
    payments: { id: "id", bookingId: "bookingId" },
    syncLog: { provider: "provider", direction: "direction", status: "status" },
    waitlist: { id: "id", serviceId: "serviceId", status: "status" },
    timeOff: {
      id: "id",
      staffId: "staffId",
      startDate: "startDate",
      endDate: "endDate",
      notes: "notes",
    },
    referrals: { id: "id" },
    clientForms: { id: "id" },
    formSubmissions: { id: "id" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    or: vi.fn((...a: unknown[]) => ({ type: "or", a })),
    ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      {
        join: vi.fn(() => ({ type: "sql_join" })),
      },
    ),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lte: vi.fn((...a: unknown[]) => ({ type: "lte", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: any, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("@/lib/twilio", () => ({
    sendSms: vi.fn().mockResolvedValue(undefined),
    getSmsRecipient: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(false),
    squareClient: { refunds: { refundPayment: vi.fn() } },
    createSquareOrder: vi.fn().mockResolvedValue(undefined),
    createSquarePaymentLink: vi.fn().mockResolvedValue(undefined),
    getSquareCardOnFile: vi.fn().mockResolvedValue(null),
    chargeCardOnFile: vi.fn().mockResolvedValue(null),
    createSquareInvoice: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/lib/zoho", () => ({
    createZohoDeal: vi.fn(),
    updateZohoDeal: vi.fn(),
  }));
  vi.doMock("@/lib/zoho-books", () => ({ createZohoBooksInvoice: vi.fn() }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPolicies: vi.fn().mockResolvedValue({
      fullRefundHours: 48,
      partialRefundPct: 50,
      partialRefundMinHours: 24,
      noRefundHours: 24,
      cancelWindowHours: 24,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
      depositRequired: false,
      depositPercent: 0,
      tosVersion: "2026-01",
      cancellationPolicy: "Standard policy",
    }),
    getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "T Creative Studio" }),
    getPublicLoyaltyConfig: vi.fn().mockResolvedValue(null),
    getPublicPolicies: vi.fn().mockResolvedValue({
      tosVersion: "2026-01",
      cancellationPolicy: "Standard policy",
    }),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
      },
    }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("next/headers", () => ({
    cookies: vi.fn().mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    }),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/env", () => ({
    env: {
      DATABASE_POOLER_URL: "postgresql://localhost:5432/test",
      DIRECT_URL: "postgresql://localhost:5432/test",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      RESEND_API_KEY: "re_test",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-key",
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    },
  }));
  vi.doMock("@/utils/supabase/admin", () => ({
    createAdminClient: vi.fn().mockReturnValue({
      auth: { admin: { generateLink: vi.fn() } },
    }),
  }));
  vi.doMock("@/lib/auth", () => ({
    getUser: vi.fn().mockResolvedValue({ id: "client-1", email: "alice@example.com" }),
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "admin" }),
    requireStaff: vi.fn().mockResolvedValue({ id: "admin-1" }),
    getCurrentUser: vi.fn().mockResolvedValue(null),
  }));

  const mockComponent = vi.fn().mockReturnValue(null);
  vi.doMock("@/emails/BookingCancellation", () => ({ BookingCancellation: mockComponent }));
  vi.doMock("@/emails/BookingCompleted", () => ({ BookingCompleted: mockComponent }));
  vi.doMock("@/emails/BookingConfirmation", () => ({ BookingConfirmation: mockComponent }));
  vi.doMock("@/emails/BookingNoShow", () => ({ BookingNoShow: mockComponent }));
  vi.doMock("@/emails/BookingReschedule", () => ({ BookingReschedule: mockComponent }));
  vi.doMock("@/emails/NoShowFeeCharged", () => ({ NoShowFeeCharged: mockComponent }));
  vi.doMock("@/emails/NoShowFeeInvoice", () => ({ NoShowFeeInvoice: mockComponent }));
  vi.doMock("@/emails/PaymentLinkEmail", () => ({ PaymentLinkEmail: mockComponent }));
  vi.doMock("@/emails/RecurringBookingConfirmation", () => ({
    RecurringBookingConfirmation: mockComponent,
  }));
  vi.doMock("@/emails/MessageNotification", () => ({ MessageNotification: mockComponent }));
  vi.doMock("@/emails/TimeOffDenied", () => ({ TimeOffDenied: mockComponent }));
  vi.doMock("@/app/dashboard/bookings/waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));
  vi.doMock("@/lib/cadence", () => ({
    rruleToCadenceLabel: vi.fn().mockReturnValue(null),
  }));
  vi.doMock("react", () => ({
    cache: vi.fn((fn: any) => fn),
    default: {},
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("TOS enforcement — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockCaptureException.mockImplementation(() => {});
  });

  /* --- (1) tosAccepted=true: booking created with tos fields stored --- */

  it("(1) tosAccepted=true: booking created, tosAcceptedAt and tosVersion stored", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // createBookingRequest queries:
    // 1. service lookup
    db._queue([{ name: "Classic Lash Set", durationMinutes: 90, priceInCents: 15000 }]);

    setupMocks(db);
    const { createBookingRequest } = await import("@/app/dashboard/messages/actions");

    const result = await createBookingRequest({
      serviceId: 1,
      message: "I'd like to book please",
      tosAccepted: true,
      tosVersion: "2026-01",
    });

    expect(result.bookingId).toBeDefined();
    expect(result.threadId).toBeDefined();

    // Booking record stored with TOS fields
    expect(db._bookings).toHaveLength(1);
    const booking = db._bookings[0];
    expect(booking.tosAcceptedAt).toBeInstanceOf(Date);
    expect(booking.tosVersion).toBe("2026-01");
    expect(booking.status).toBe("pending");
    expect(booking.serviceId).toBe(1);
  });

  /* --- (2) tosAccepted=false: Zod validation rejects --- */

  it("(2) tosAccepted=false: server action rejects with Zod validation error", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db);
    const { createBookingRequest } = await import("@/app/dashboard/messages/actions");

    // z.literal(true) rejects false
    await expect(
      createBookingRequest({
        serviceId: 1,
        message: "Book me",
        tosAccepted: false as any,
        tosVersion: "2026-01",
      }),
    ).rejects.toThrow();

    // No booking created
    expect(db._bookings).toHaveLength(0);
  });

  /* --- (3) tosAccepted missing: Zod validation rejects --- */

  it("(3) tosAccepted missing: server action rejects", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db);
    const { createBookingRequest } = await import("@/app/dashboard/messages/actions");

    // Missing tosAccepted entirely
    await expect(
      createBookingRequest({
        serviceId: 1,
        message: "Book me",
        tosVersion: "2026-01",
      } as any),
    ).rejects.toThrow();

    // No booking created
    expect(db._bookings).toHaveLength(0);
  });

  /* --- (4) tosVersion mismatch: still succeeds, stores request version --- */

  it("(4) tosVersion mismatch: succeeds and stores the version from the request, not current settings", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // service lookup
    db._queue([{ name: "Classic Lash Set", durationMinutes: 90, priceInCents: 15000 }]);

    setupMocks(db);
    const { createBookingRequest } = await import("@/app/dashboard/messages/actions");

    // Client loaded page when tosVersion was "2025-06", settings now say "2026-01".
    // The request carries the version the client actually saw and agreed to.
    const result = await createBookingRequest({
      serviceId: 1,
      message: "Booking please",
      tosAccepted: true,
      tosVersion: "2025-06", // ← older version than current "2026-01" in settings
    });

    expect(result.bookingId).toBeDefined();

    // Booking stores the version the client agreed to, NOT the current settings version
    const booking = db._bookings[0];
    expect(booking.tosVersion).toBe("2025-06");
    expect(booking.tosAcceptedAt).toBeInstanceOf(Date);
  });

  /* --- (5) Admin view: getBookings returns tosAcceptedAt and tosVersion --- */

  it("(5) admin view: getBookings returns tosAcceptedAt and tosVersion on booking rows", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const acceptedAt = new Date("2026-03-20T14:30:00Z");

    // getBookings: single select with joins (limit+1 for pagination)
    db._queue([
      {
        id: 42,
        status: "pending",
        startsAt: new Date("2026-03-25T10:00:00Z"),
        durationMinutes: 90,
        totalInCents: 15000,
        location: null,
        clientNotes: "I'd like to book",
        clientId: "client-1",
        clientFirstName: "Alice",
        clientLastName: "Smith",
        clientPhone: "+15551234567",
        serviceId: 1,
        serviceName: "Classic Lash Set",
        serviceCategory: "lash",
        staffId: null,
        staffFirstName: null,
        recurrenceRule: null,
        parentBookingId: null,
        tosAcceptedAt: acceptedAt,
        tosVersion: "2026-01",
        locationId: null,
      },
    ]);

    setupMocks(db);
    const { getBookings } = await import("@/app/dashboard/bookings/actions");

    const data = await getBookings();

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].tosAcceptedAt).toEqual(acceptedAt);
    expect(data.rows[0].tosVersion).toBe("2026-01");
  });
});
