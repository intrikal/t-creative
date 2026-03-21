// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the waiver enforcement → confirmation flow.
 *
 * Calls real functions from:
 *   - waiver-actions.ts: checkBookingWaivers, sendWaiverLink
 *   - actions.ts:        updateBookingStatus (confirming)
 *
 * Verifies the FINAL STATE:
 *   - Attempting to confirm before waiver is complete throws with WAIVER_REQUIRED
 *   - sendWaiverLink emails the client with a valid token
 *   - After waiver is submitted (form_submission inserted), confirm succeeds
 *   - Confirmation email is sent on success
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const bookingsTable: MockRow[] = [];
  const formSubmissionsTable: MockRow[] = [];
  const notificationsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];

  let nextId = 1;

  // Per-test ordered select responses
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
    _formSubmissions: formSubmissionsTable,
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

    insert: vi.fn((table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const row = { ...values, id };
        if ("formId" in values && "clientId" in values) {
          formSubmissionsTable.push(row);
        } else if ("type" in values && "channel" in values) {
          notificationsTable.push(row);
        } else if ("provider" in values && "direction" in values) {
          syncLogTable.push(row);
        } else if ("status" in values && "clientId" in values && !("type" in values)) {
          bookingsTable.push(row);
        }
        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn((table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          // Persist status updates into bookingsTable
          if ("status" in values) {
            const last = bookingsTable[bookingsTable.length - 1];
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
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      confirmedAt: "confirmedAt",
      squareOrderId: "squareOrderId",
      deletedAt: "deletedAt",
    },
    services: { id: "id", name: "name", category: "category", depositInCents: "depositInCents" },
    clientForms: {
      id: "id",
      name: "name",
      type: "type",
      appliesTo: "appliesTo",
      isActive: "isActive",
      required: "required",
    },
    formSubmissions: {
      id: "id",
      clientId: "clientId",
      formId: "formId",
      submittedAt: "submittedAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
      phone: "phone",
      notifyEmail: "notifyEmail",
      notifySms: "notifySms",
    },
    bookingAddOns: { bookingId: "bookingId", addOnName: "addOnName", priceInCents: "priceInCents" },
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
    invoices: { id: "id", number: "number" },
    payments: { id: "id", squarePaymentId: "squarePaymentId", method: "method" },
    syncLog: { provider: "provider", direction: "direction", status: "status" },
    bookingSubscriptions: { id: "id", status: "status" },
    waitlist: { id: "id", serviceId: "serviceId", status: "status" },
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
  vi.doMock("drizzle-orm/pg-core", () => ({ alias: vi.fn((_t: any, name: string) => ({ _alias: name })) }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/twilio", () => ({ sendSms: mockSendSms }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(false),
    createSquareOrder: vi.fn().mockRejectedValue(new Error("not configured")),
    createSquarePaymentLink: vi.fn().mockRejectedValue(new Error("not configured")),
    getSquareCardOnFile: vi.fn().mockResolvedValue(null),
    chargeCardOnFile: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("@/lib/waiver-token", () => ({
    generateWaiverToken: vi.fn().mockReturnValue("test-waiver-token"),
  }));
  vi.doMock("@/lib/zoho", () => ({
    createZohoDeal: vi.fn(),
    updateZohoDeal: vi.fn(),
  }));
  vi.doMock("@/lib/zoho-books", () => ({ createZohoBooksInvoice: vi.fn() }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPolicies: vi.fn().mockResolvedValue({
      cancelWindowHours: 48,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
      depositRequired: false,
      depositPercent: 0,
    }),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Waiver confirmation flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
  });

  it("checkBookingWaivers returns missing waivers when client has not submitted", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // 1. booking lookup (clientId + serviceCategory)
    db._queue([{ clientId: "client-1", serviceCategory: "lash" }]);
    // 2. all required active forms
    db._queue([{ id: 5, name: "Lash Consent Form", type: "consent", appliesTo: ["Lash", "All"] }]);
    // 3. submissions for this client — none
    db._queue([]);

    setupMocks(db);
    const { checkBookingWaivers } = await import("./waiver-actions");

    const result = await checkBookingWaivers(1);

    expect(result.passed).toBe(false);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]).toMatchObject({ formId: 5, formName: "Lash Consent Form" });
  });

  it("checkBookingWaivers passes when client has already submitted all forms", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([{ clientId: "client-1", serviceCategory: "lash" }]);
    db._queue([{ id: 5, name: "Lash Consent Form", type: "consent", appliesTo: ["Lash"] }]);
    // Client already submitted form 5
    db._queue([{ formId: 5 }]);

    setupMocks(db);
    const { checkBookingWaivers } = await import("./waiver-actions");

    const result = await checkBookingWaivers(1);

    expect(result.passed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("updateBookingStatus('confirmed') throws WAIVER_REQUIRED when waivers are missing", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // waiver check queries (inside checkBookingWaivers via updateBookingStatus):
    // 1. booking+service for waiver check
    db._queue([{ clientId: "client-1", serviceCategory: "lash" }]);
    // 2. required forms
    db._queue([{ id: 5, name: "Lash Waiver", type: "consent", appliesTo: ["Lash"] }]);
    // 3. submissions — none
    db._queue([]);

    setupMocks(db);
    const { updateBookingStatus } = await import("./actions");

    await expect(updateBookingStatus(1, "confirmed")).rejects.toThrow("WAIVER_REQUIRED");
  });

  it("sendWaiverLink sends email with waiver token URL", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // booking + service lookup
    db._queue([{ clientId: "client-1", serviceName: "Classic Lash Set", startsAt: new Date() }]);

    mockGetEmailRecipient.mockResolvedValue({
      email: "alice@example.com",
      firstName: "Alice",
    });

    setupMocks(db);
    const { sendWaiverLink } = await import("./waiver-actions");

    const sent = await sendWaiverLink(1);

    expect(sent).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "waiver_required",
      }),
    );
  });

  it("updateBookingStatus('confirmed') succeeds after waiver is completed", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // waiver check queries:
    // 1. booking+service
    db._queue([{ clientId: "client-1", serviceCategory: "lash" }]);
    // 2. required forms
    db._queue([{ id: 5, name: "Lash Waiver", type: "consent", appliesTo: ["Lash"] }]);
    // 3. submissions — waiver 5 IS submitted now
    db._queue([{ formId: 5 }]);

    // post-waiver-check queries (inside updateBookingStatus for "confirmed"):
    // 4. booking squareOrderId check
    db._queue([{ squareOrderId: null, serviceId: 2, totalInCents: 15000 }]);
    // 5. trySendBookingConfirmation: booking+client+service join
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientPhone: "+14085550001",
        clientFirstName: "Alice",
        notifyEmail: true,
        notifySms: false,
        serviceName: "Classic Lash Set",
        startsAt: new Date(),
        durationMinutes: 90,
        totalInCents: 15000,
      },
    ]);
    // 6. add-ons for confirmation email
    db._queue([]);
    // 7. tryAutoSendDepositLink: booking+client+service
    db._queue([{ depositInCents: null }]);
    // 8. Zoho: client profile
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]);
    // 9. Zoho: service name
    db._queue([{ name: "Classic Lash Set" }]);

    setupMocks(db);
    const { updateBookingStatus } = await import("./actions");

    // Should NOT throw
    await expect(updateBookingStatus(1, "confirmed")).resolves.toBeUndefined();

    // Confirmation email sent
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "booking_confirmation",
      }),
    );
  });

  it("confirmation email is NOT sent when client has opted out of email notifications", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // waiver check — all passed
    db._queue([{ clientId: "client-1", serviceCategory: "lash" }]);
    db._queue([]);
    db._queue([]);

    // updateBookingStatus post-check
    db._queue([{ squareOrderId: null, serviceId: 2, totalInCents: 15000 }]);
    // notifyEmail: false → no email
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: false,
        notifySms: false,
        serviceName: "Classic Lash Set",
        startsAt: new Date(),
        durationMinutes: 90,
        totalInCents: 15000,
      },
    ]);
    db._queue([]); // add-ons
    db._queue([{ depositInCents: null }]); // deposit check
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]); // zoho client
    db._queue([{ name: "Classic Lash Set" }]); // zoho service

    setupMocks(db);
    const { updateBookingStatus } = await import("./actions");

    await updateBookingStatus(1, "confirmed");

    const confirmationCalls = (mockSendEmail.mock.calls as any[]).filter(
      (args) => args[0]?.entityType === "booking_confirmation",
    );
    expect(confirmationCalls).toHaveLength(0);
  });
});
