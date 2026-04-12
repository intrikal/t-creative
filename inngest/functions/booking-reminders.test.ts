// @vitest-environment node

/**
 * inngest/functions/booking-reminders.test.ts
 *
 * Unit tests for the booking-reminders Inngest function.
 * Covers reminder windows, channel toggling, deduplication, and custom config.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const syncLogTable: MockRow[] = [];
  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  const insertCalls: Array<MockRow> = [];

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _syncLog: syncLogTable,
    _insertCalls: insertCalls,

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
      values: vi.fn((values: MockRow | MockRow[]) => {
        const rows = Array.isArray(values) ? values : [values];
        for (const v of rows) {
          const id = nextId++;
          const row = { ...v, id };
          insertCalls.push(row);
          if ("provider" in v && "direction" in v) {
            syncLogTable.push(row);
          }
        }
        const returning = vi.fn().mockResolvedValue([{ id: nextId - 1 }]);
        return {
          returning,
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(db)),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Shared mock instances                                              */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockSendSms = vi.fn().mockResolvedValue(true);
const mockSendPush = vi.fn().mockResolvedValue(1);
const mockIsPushConfigured = vi.fn().mockReturnValue(false);
const mockIsNotificationEnabled = vi.fn().mockResolvedValue(true);
const mockRenderSmsTemplate = vi.fn().mockResolvedValue("SMS body");
const mockGetPublicRemindersConfig = vi.fn().mockResolvedValue({
  bookingReminderHours: [24, 48],
});
const mockGetPublicBusinessProfile = vi.fn().mockResolvedValue({
  businessName: "T Creative Studio",
  emailSenderName: "T Creative",
  emailFromAddress: "hello@tcreative.com",
});

/* ------------------------------------------------------------------ */
/*  Inngest step stub                                                  */
/* ------------------------------------------------------------------ */

const step = {
  run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
};

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
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      location: "location",
      status: "status",
    },
    profiles: {
      id: "id",
      email: "email",
      phone: "phone",
      firstName: "firstName",
      notifyEmail: "notifyEmail",
      notifySms: "notifySms",
    },
    services: { id: "id", name: "name" },
    syncLog: {
      id: "id",
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      localId: "localId",
      remoteId: "remoteId",
      message: "message",
      errorMessage: "errorMessage",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lte: vi.fn((...a: unknown[]) => ({ type: "lte", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
  }));
  vi.doMock("@/lib/twilio", () => ({
    sendSms: mockSendSms,
  }));
  vi.doMock("@/lib/web-push", () => ({
    sendPushNotification: mockSendPush,
    isPushConfigured: mockIsPushConfigured,
  }));
  vi.doMock("@/lib/notification-preferences", () => ({
    isNotificationEnabled: mockIsNotificationEnabled,
  }));
  vi.doMock("@/lib/sms-templates", () => ({
    renderSmsTemplate: mockRenderSmsTemplate,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicRemindersConfig: mockGetPublicRemindersConfig,
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
  vi.doMock("@/emails/BookingReminder", () => ({
    BookingReminder: vi.fn(() => ({ type: "BookingReminder" })),
  }));
  vi.doMock("date-fns", () => ({
    format: vi.fn((_d: Date, _f: string) => "Saturday, April 12 at 2:00 PM"),
  }));
  vi.doMock("react", () => ({
    createElement: vi.fn((...args: unknown[]) => ({ type: "div", props: args[1] })),
    default: { createElement: vi.fn() },
    cache: vi.fn((fn: any) => fn),
  }));
}

/* ------------------------------------------------------------------ */
/*  Helper: invoke the cron handler directly                           */
/* ------------------------------------------------------------------ */

async function runHandler(
  module: typeof import("@/inngest/functions/booking-reminders"),
): Promise<{ sent: number; failed: number }> {
  const fn = module.bookingReminders as any;
  const handler = fn?.handler ?? fn;
  return handler({ step });
}

/* ------------------------------------------------------------------ */
/*  Booking factory                                                    */
/* ------------------------------------------------------------------ */

function makeBooking(overrides: Partial<MockRow> = {}): MockRow {
  return {
    bookingId: 100,
    clientId: "client-1",
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    totalInCents: 5000,
    location: "Studio A",
    clientEmail: "client@test.com",
    clientPhone: "+15551234567",
    clientFirstName: "Alice",
    notifyEmail: true,
    notifySms: true,
    serviceName: "Nail Fill",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("booking-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockSendSms.mockResolvedValue(true);
    mockSendPush.mockResolvedValue(1);
    mockIsPushConfigured.mockReturnValue(false);
    mockIsNotificationEnabled.mockResolvedValue(true);
    mockRenderSmsTemplate.mockResolvedValue("SMS body");
    step.run.mockImplementation(async (_name: string, fn: () => Promise<any>) => fn());
  });

  it("sends 24h reminder via email and SMS", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const booking = makeBooking();

    // 24h window query returns one booking
    db._queue([booking]);
    // email dedup check → not found
    db._queue([]);
    // sms dedup check → not found
    db._queue([]);
    // 48h window query returns no bookings
    db._queue([]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/booking-reminders");
    const result = await runHandler(mod);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendSms).toHaveBeenCalledOnce();
  });

  it("sends 48h reminder for booking in 48h window", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const booking = makeBooking();

    // 24h window → empty
    db._queue([]);
    // 48h window → one booking
    db._queue([booking]);
    // email dedup check → not found
    db._queue([]);
    // sms dedup check → not found
    db._queue([]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/booking-reminders");
    const result = await runHandler(mod);

    expect(result.sent).toBe(2);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendSms).toHaveBeenCalledOnce();
  });

  it("sends no reminder for booking only 2h away (outside windows)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Both windows return empty
    db._queue([]);
    db._queue([]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/booking-reminders");
    const result = await runHandler(mod);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("skips already-reminded booking via sync_log deduplication", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const booking = makeBooking();

    // 24h window → one booking
    db._queue([booking]);
    // email dedup check → already sent
    db._queue([{ id: 99 }]);
    // sms dedup check → already sent
    db._queue([{ id: 100 }]);
    // 48h window → empty
    db._queue([]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/booking-reminders");
    const result = await runHandler(mod);

    expect(result.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("skips email when client notifyEmail=false, still sends SMS", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const booking = makeBooking({ notifyEmail: false });

    // 24h window → one booking
    db._queue([booking]);
    // sms dedup check → not found (email path skipped, no dedup query)
    db._queue([]);
    // 48h window → empty
    db._queue([]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/booking-reminders");
    const result = await runHandler(mod);

    expect(result.sent).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).toHaveBeenCalledOnce();
  });

  it("skips SMS when client notifySms=false, still sends email", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const booking = makeBooking({ notifySms: false });

    // 24h window → one booking
    db._queue([booking]);
    // email dedup check → not found
    db._queue([]);
    // 48h window → empty
    db._queue([]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/booking-reminders");
    const result = await runHandler(mod);

    expect(result.sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("sends nothing when both channels disabled, counts as zero", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const booking = makeBooking({ notifyEmail: false, notifySms: false });

    // 24h window → one booking
    db._queue([booking]);
    // 48h window → empty
    db._queue([]);

    setupMocks(db);
    mockIsNotificationEnabled.mockResolvedValue(true);
    const mod = await import("@/inngest/functions/booking-reminders");
    const result = await runHandler(mod);

    expect(result.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it("respects custom reminder config (e.g. 12h window only)", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const booking = makeBooking();

    mockGetPublicRemindersConfig.mockResolvedValue({
      bookingReminderHours: [12],
    });

    // Only one window: 12h → one booking
    db._queue([booking]);
    // email dedup → not found
    db._queue([]);
    // sms dedup → not found
    db._queue([]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/booking-reminders");
    const result = await runHandler(mod);

    expect(result.sent).toBe(2);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendSms).toHaveBeenCalledOnce();
  });
});
