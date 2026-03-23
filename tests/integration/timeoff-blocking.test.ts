// @vitest-environment node

/**
 * tests/integration/timeoff-blocking.test.ts
 *
 * Integration tests for time-off blocking of booking creation.
 *
 * Tests the interaction between approveTimeOffRequest / denyTimeOffRequest
 * (time-off-actions.ts) and createBooking (actions.ts) via the
 * hasApprovedTimeOffConflict check.
 *
 * (1) Approved full-day time-off blocks booking on that day
 * (2) Approved partial time-off blocks overlapping booking, allows non-overlapping
 * (3) Pending time-off does NOT block bookings
 * (4) Denied time-off does NOT block bookings
 * (5) Staff A time-off does NOT block staff B
 * (6) Denial notification: Twilio SMS + Resend email sent to staff
 * (7) Time-off overlapping existing confirmed booking is still submittable
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
    _syncLog: syncLogTable,
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
        } else if ("provider" in values && "direction" in values) {
          syncLogTable.push(row);
        } else {
          bookingsTable.push(row);
        }
        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn((table: any) => ({
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),

    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        execute: vi.fn().mockResolvedValue(undefined),
        select: vi.fn(() => {
          const rows = selectQueue[selectIndex++] ?? [];
          return makeChain(rows);
        }),
        insert: vi.fn((table: any) => ({
          values: vi.fn((values: MockRow) => {
            const id = nextId++;
            const row = { ...values, id };
            bookingsTable.push(row);
            const returning = vi.fn().mockResolvedValue([{ id }]);
            return { returning };
          }),
        })),
        update: vi.fn((table: any) => ({
          set: vi.fn((values: MockRow) => {
            updateCalls.push({ values });
            return { where: vi.fn().mockResolvedValue(undefined) };
          }),
        })),
      };
      return fn(tx);
    }),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  External API mocks                                                 */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockSendSms = vi.fn().mockResolvedValue(undefined);
const mockGetEmailRecipient = vi.fn();
const mockGetSmsRecipient = vi.fn();
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
    },
    services: { id: "id", name: "name", category: "category", depositInCents: "depositInCents" },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      notifyEmail: "notifyEmail",
      notifySms: "notifySms",
      squareCustomerId: "squareCustomerId",
    },
    clientForms: {
      id: "id",
      name: "name",
      type: "type",
      appliesTo: "appliesTo",
      isActive: "isActive",
      required: "required",
    },
    formSubmissions: { id: "id", clientId: "clientId", formId: "formId" },
    payments: {
      id: "id",
      bookingId: "bookingId",
      clientId: "clientId",
      amountInCents: "amountInCents",
      refundedInCents: "refundedInCents",
      method: "method",
      status: "status",
      squarePaymentId: "squarePaymentId",
      squareRefundId: "squareRefundId",
      squareOrderId: "squareOrderId",
      squareReceiptUrl: "squareReceiptUrl",
      refundedAt: "refundedAt",
      notes: "notes",
      paidAt: "paidAt",
    },
    invoices: {
      id: "id",
      clientId: "clientId",
      number: "number",
      description: "description",
      amountInCents: "amountInCents",
      status: "status",
      issuedAt: "issuedAt",
      dueAt: "dueAt",
      notes: "notes",
    },
    notifications: {
      profileId: "profileId",
      type: "type",
      channel: "channel",
      status: "status",
      title: "title",
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
    bookingAddOns: { bookingId: "bookingId" },
    bookingSubscriptions: { id: "id", status: "status" },
    waitlist: { id: "id", serviceId: "serviceId", status: "status" },
    timeOff: {
      id: "id",
      staffId: "staffId",
      locationId: "locationId",
      type: "type",
      startDate: "startDate",
      endDate: "endDate",
      label: "label",
      notes: "notes",
      createdAt: "createdAt",
    },
    referrals: { id: "id" },
    timeOffTypeEnum: {},
    businessHours: { id: "id" },
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
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/twilio", () => ({
    sendSms: mockSendSms,
    getSmsRecipient: mockGetSmsRecipient,
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(true),
    squareClient: { refunds: { refundPayment: vi.fn() } },
    createSquareOrder: vi.fn().mockResolvedValue(undefined),
    createSquarePaymentLink: vi.fn().mockResolvedValue(undefined),
    getSquareCardOnFile: vi.fn().mockResolvedValue(null),
    chargeCardOnFile: vi.fn().mockResolvedValue(null),
    createSquareInvoice: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/lib/zoho", () => ({ createZohoDeal: vi.fn(), updateZohoDeal: vi.fn() }));
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
    }),
    getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "T Creative Studio" }),
    getPublicLoyaltyConfig: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
    }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
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
    getUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
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
  vi.doMock("@/emails/TimeOffDenied", () => ({ TimeOffDenied: mockComponent }));
  vi.doMock("@/app/dashboard/bookings/waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));
  vi.doMock("react", () => ({
    cache: vi.fn((fn: any) => fn),
    default: {},
  }));
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build a standard booking input for staff-A on a given date/time */
function makeBookingInput(startsAt: Date, staffId = "staff-A") {
  return {
    clientId: "client-1",
    serviceId: 1,
    staffId,
    startsAt,
    durationMinutes: 60,
    totalInCents: 15000,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Time-off blocking — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockSendSms.mockResolvedValue(undefined);
    mockLogAction.mockResolvedValue(undefined);
    mockCaptureException.mockImplementation(() => {});
  });

  /* --- (1) Approved full-day time-off blocks booking --- */

  it("(1) approved full-day time-off: booking on that day is rejected", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // March 25 2026, 10:00 AM local
    const bookingDate = new Date(2026, 2, 25, 10, 0, 0);

    // ── approveTimeOffRequest flow ──
    // 1. select notes for time-off id=1
    db._queue([{ notes: JSON.stringify({ status: "pending", reason: "Personal day" }) }]);

    setupMocks(db);
    const { approveTimeOffRequest } = await import("@/app/dashboard/time-off-actions");
    await approveTimeOffRequest(1);

    // Verify the notes were updated to approved
    const approveUpdate = db._updateCalls.find((u) => {
      if (typeof u.values.notes !== "string") return false;
      try {
        return JSON.parse(u.values.notes as string).status === "approved";
      } catch {
        return false;
      }
    });
    expect(approveUpdate).toBeDefined();

    // ── createBooking flow ──
    // Reset modules to get fresh import with same mocked db
    vi.resetModules();
    setupMocks(db);

    // createBooking transaction queries:
    // 1. hasOverlappingBooking: no conflicts
    db._queue([]);
    // 2. hasApprovedTimeOffConflict: returns approved full-day entry
    db._queue([
      {
        id: 1,
        startDate: "2026-03-25",
        endDate: "2026-03-25",
        notes: JSON.stringify({ status: "approved", partial: false }),
      },
    ]);

    const { createBooking } = await import("@/app/dashboard/bookings/actions");
    const result = await createBooking(makeBookingInput(bookingDate));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("This staff member has approved time off during that time slot");
    }
  });

  /* --- (2) Approved partial time-off: overlapping rejected, non-overlapping succeeds --- */

  it("(2) partial time-off 9am–12pm: 10am booking rejected, 2pm booking succeeds", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const partialNotes = JSON.stringify({
      status: "approved",
      partial: { startTime: "09:00", endTime: "12:00" },
    });

    // ── Attempt 1: booking at 10am (overlaps 9am–12pm) ──
    // hasOverlappingBooking: no booking conflicts
    db._queue([]);
    // hasApprovedTimeOffConflict: partial time-off 9am–12pm
    db._queue([
      {
        id: 1,
        startDate: "2026-03-25",
        endDate: "2026-03-25",
        notes: partialNotes,
      },
    ]);

    setupMocks(db);
    const { createBooking } = await import("@/app/dashboard/bookings/actions");

    const bookingAt10am = new Date(2026, 2, 25, 10, 0, 0);
    const rejected = await createBooking(makeBookingInput(bookingAt10am));

    expect(rejected.success).toBe(false);
    if (!rejected.success) {
      expect(rejected.error).toBe("This staff member has approved time off during that time slot");
    }

    // ── Attempt 2: booking at 2pm (does NOT overlap 9am–12pm) ──
    // hasOverlappingBooking: no conflicts
    db._queue([]);
    // hasApprovedTimeOffConflict: same entry, but 2pm–3pm doesn't overlap 9am–12pm
    db._queue([
      {
        id: 1,
        startDate: "2026-03-25",
        endDate: "2026-03-25",
        notes: partialNotes,
      },
    ]);
    // Post-insert queries for createBooking side-effects:
    // trySendBookingConfirmation: client+service lookup
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: new Date(2026, 2, 25, 14, 0, 0),
      },
    ]);
    // tryAutoSendDepositLink: service lookup
    db._queue([{ depositInCents: 0 }]);
    // clientForZoho
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]);
    // serviceForZoho
    db._queue([{ name: "Classic Lash Set" }]);

    const bookingAt2pm = new Date(2026, 2, 25, 14, 0, 0);
    const accepted = await createBooking(makeBookingInput(bookingAt2pm));

    expect(accepted.success).toBe(true);
  });

  /* --- (3) Pending time-off does NOT block bookings --- */

  it("(3) pending time-off: booking is allowed (only approved blocks)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // hasOverlappingBooking: no conflicts
    db._queue([]);
    // hasApprovedTimeOffConflict: returns entry with status=pending
    db._queue([
      {
        id: 1,
        startDate: "2026-03-25",
        endDate: "2026-03-25",
        notes: JSON.stringify({ status: "pending", partial: false }),
      },
    ]);
    // Post-insert side-effect queries
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: new Date(2026, 2, 25, 10, 0, 0),
      },
    ]);
    db._queue([{ depositInCents: 0 }]);
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]);
    db._queue([{ name: "Classic Lash Set" }]);

    setupMocks(db);
    const { createBooking } = await import("@/app/dashboard/bookings/actions");

    const bookingDate = new Date(2026, 2, 25, 10, 0, 0);
    const result = await createBooking(makeBookingInput(bookingDate));

    expect(result.success).toBe(true);
  });

  /* --- (4) Denied time-off does NOT block bookings --- */

  it("(4) denied time-off: booking is allowed", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // hasOverlappingBooking: no conflicts
    db._queue([]);
    // hasApprovedTimeOffConflict: returns entry with status=denied
    db._queue([
      {
        id: 1,
        startDate: "2026-03-25",
        endDate: "2026-03-25",
        notes: JSON.stringify({ status: "denied", deniedReason: "Busy day", partial: false }),
      },
    ]);
    // Post-insert side-effect queries
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: new Date(2026, 2, 25, 10, 0, 0),
      },
    ]);
    db._queue([{ depositInCents: 0 }]);
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]);
    db._queue([{ name: "Classic Lash Set" }]);

    setupMocks(db);
    const { createBooking } = await import("@/app/dashboard/bookings/actions");

    const bookingDate = new Date(2026, 2, 25, 10, 0, 0);
    const result = await createBooking(makeBookingInput(bookingDate));

    expect(result.success).toBe(true);
  });

  /* --- (5) Staff A time-off does NOT block staff B --- */

  it("(5) staff A time-off does not block staff B booking", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // hasOverlappingBooking for staff-B: no conflicts
    db._queue([]);
    // hasApprovedTimeOffConflict for staff-B: no entries (staff A's time-off
    // won't appear because the query filters by staffId=staff-B)
    db._queue([]);
    // Post-insert side-effect queries
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: new Date(2026, 2, 25, 10, 0, 0),
      },
    ]);
    db._queue([{ depositInCents: 0 }]);
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]);
    db._queue([{ name: "Classic Lash Set" }]);

    setupMocks(db);
    const { createBooking } = await import("@/app/dashboard/bookings/actions");

    const bookingDate = new Date(2026, 2, 25, 10, 0, 0);
    const result = await createBooking(makeBookingInput(bookingDate, "staff-B"));

    expect(result.success).toBe(true);
  });

  /* --- (6) Denial notification: SMS + email sent to staff --- */

  it("(6) deny time-off: Twilio SMS and Resend email called for staff", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // denyTimeOffRequest: select time-off row
    db._queue([
      {
        notes: JSON.stringify({ status: "pending", reason: "Vacation" }),
        staffId: "staff-A",
        startDate: "2026-03-25",
        endDate: "2026-03-27",
        label: "Vacation",
      },
    ]);

    mockGetSmsRecipient.mockResolvedValue({ phone: "+15551234567", firstName: "Dana" });
    mockGetEmailRecipient.mockResolvedValue({ email: "dana@example.com", firstName: "Dana" });

    setupMocks(db);
    const { denyTimeOffRequest } = await import("@/app/dashboard/time-off-actions");

    await denyTimeOffRequest(1, "We need you that week");

    // Status updated to denied
    const denyUpdate = db._updateCalls.find((u) => {
      if (typeof u.values.notes !== "string") return false;
      try {
        return JSON.parse(u.values.notes as string).status === "denied";
      } catch {
        return false;
      }
    });
    expect(denyUpdate).toBeDefined();
    const deniedMeta = JSON.parse(denyUpdate!.values.notes as string);
    expect(deniedMeta.deniedReason).toBe("We need you that week");

    // Twilio SMS sent to staff
    expect(mockSendSms).toHaveBeenCalledOnce();
    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+15551234567",
        entityType: "time_off_denied_sms",
        localId: "1",
      }),
    );
    // SMS body contains staff name and reason
    const smsBody = mockSendSms.mock.calls[0][0].body as string;
    expect(smsBody).toContain("Dana");
    expect(smsBody).toContain("denied");
    expect(smsBody).toContain("We need you that week");

    // Resend email sent to staff
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "dana@example.com",
        subject: "Your time-off request has been denied",
        entityType: "time_off_denied_email",
        localId: "1",
      }),
    );
  });

  /* --- (7) Time-off overlapping existing confirmed booking is still submittable --- */

  it("(7) time-off overlapping existing booking: approve still works (admin decides)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // approveTimeOffRequest: select notes for time-off id=5
    // The time-off request covers March 25 — same day as an existing booking.
    // The approve action does NOT check for booking conflicts; that's an admin decision.
    db._queue([
      {
        notes: JSON.stringify({
          status: "pending",
          reason: "Doctor appointment",
          partial: false,
        }),
      },
    ]);

    setupMocks(db);
    const { approveTimeOffRequest } = await import("@/app/dashboard/time-off-actions");

    // Should succeed — approval doesn't check existing bookings
    await expect(approveTimeOffRequest(5)).resolves.not.toThrow();

    // Verify status was set to approved
    const approveUpdate = db._updateCalls.find((u) => {
      if (typeof u.values.notes !== "string") return false;
      try {
        return JSON.parse(u.values.notes as string).status === "approved";
      } catch {
        return false;
      }
    });
    expect(approveUpdate).toBeDefined();

    // trackEvent called
    expect(mockTrackEvent).toHaveBeenCalledWith("5", "time_off_approved");
  });
});
