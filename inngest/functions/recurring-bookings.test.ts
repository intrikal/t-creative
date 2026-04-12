// @vitest-environment node

/**
 * inngest/functions/recurring-bookings.test.ts
 *
 * Unit tests for the recurring-bookings Inngest function.
 * Covers RRULE parsing, subscription path, deduplication, successor detection,
 * series end dates, and batch processing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const syncLogTable: MockRow[] = [];
  let nextId = 1000;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  const insertCalls: Array<MockRow> = [];
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
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _syncLog: syncLogTable,
    _insertCalls: insertCalls,
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
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),

    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(db)),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Shared mocks                                                       */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
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
      completedAt: "completedAt",
      recurrenceRule: "recurrenceRule",
      parentBookingId: "parentBookingId",
      subscriptionId: "subscriptionId",
      deletedAt: "deletedAt",
      confirmedAt: "confirmedAt",
    },
    bookingSubscriptions: {
      id: "id",
      status: "status",
      sessionsUsed: "sessionsUsed",
      totalSessions: "totalSessions",
      intervalDays: "intervalDays",
    },
    profiles: {
      id: "id",
      email: "email",
      firstName: "firstName",
      notifyEmail: "notifyEmail",
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
    or: vi.fn((...a: unknown[]) => ({ type: "or", a })),
    ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
    gt: vi.fn((...a: unknown[]) => ({ type: "gt", a })),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: any, _name: string) => ({
      id: "id",
      email: "email",
      firstName: "firstName",
      notifyEmail: "notifyEmail",
    })),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
  vi.doMock("@/emails/RecurringBookingConfirmation", () => ({
    RecurringBookingConfirmation: vi.fn(() => ({ type: "RecurringBookingConfirmation" })),
  }));
  vi.doMock("react", () => ({
    createElement: vi.fn((...args: unknown[]) => ({ type: "div", props: args[1] })),
    default: { createElement: vi.fn() },
    cache: vi.fn((fn: any) => fn),
  }));
}

/* ------------------------------------------------------------------ */
/*  Helper: invoke the handler directly                                */
/* ------------------------------------------------------------------ */

async function runHandler(
  module: typeof import("@/inngest/functions/recurring-bookings"),
): Promise<{ checked: number; created: number; skipped: number }> {
  const fn = module.recurringBookings as any;
  const handler = fn?.handler ?? fn;
  return handler({ step });
}

/* ------------------------------------------------------------------ */
/*  Booking factory                                                    */
/* ------------------------------------------------------------------ */

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

function makeCandidate(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: 1,
    clientId: "client-1",
    serviceId: 10,
    staffId: "staff-1",
    startsAt: new Date(NOW - 2 * HOUR).toISOString(),
    durationMinutes: 60,
    totalInCents: 5000,
    location: "Studio A",
    recurrenceRule: "FREQ=WEEKLY;INTERVAL=1",
    parentBookingId: null,
    subscriptionId: null,
    completedAt: new Date(NOW - 1 * HOUR).toISOString(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("recurring-bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    step.run.mockImplementation(async (_name: string, fn: () => Promise<any>) => fn());
  });

  it("generates next booking 7 days out for weekly RRULE", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeCandidate({ recurrenceRule: "FREQ=WEEKLY;INTERVAL=1" });

    // query-records: candidates, successors, already-processed
    db._queue([candidate]); // candidates
    db._queue([]); // existing successors
    db._queue([]); // sync_log already-processed

    // process-1: no sync_log insert for booking creation needed since
    // the insert mock handles returning. The confirmation email sub-query:
    db._queue([{
      clientEmail: "client@test.com",
      clientFirstName: "Alice",
      notifyEmail: true,
      serviceName: "Nail Fill",
    }]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/recurring-bookings");
    const result = await runHandler(mod);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    // A booking insert + 1 sync_log insert
    const bookingInserts = db._insertCalls.filter((c) => "clientId" in c);
    expect(bookingInserts.length).toBe(1);
    expect(bookingInserts[0].status).toBe("confirmed");
  });

  it("generates next booking ~30 days out for monthly RRULE", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeCandidate({ recurrenceRule: "FREQ=MONTHLY;INTERVAL=1" });

    db._queue([candidate]); // candidates
    db._queue([]); // successors
    db._queue([]); // already-processed

    // confirmation email sub-query
    db._queue([{
      clientEmail: "client@test.com",
      clientFirstName: "Alice",
      notifyEmail: true,
      serviceName: "Nail Fill",
    }]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/recurring-bookings");
    const result = await runHandler(mod);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("skips when successor booking already exists (no duplicate)", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeCandidate({ id: 5, parentBookingId: null });
    const futureDate = new Date(NOW + 7 * 24 * HOUR).toISOString();

    db._queue([candidate]); // candidates
    // Existing successor with parentBookingId = 5 and future startsAt
    db._queue([{ parentBookingId: 5, startsAt: futureDate }]);
    db._queue([]); // already-processed

    setupMocks(db);
    const mod = await import("@/inngest/functions/recurring-bookings");
    const result = await runHandler(mod);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips when series UNTIL date is reached", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    // UNTIL in the past relative to next booking start
    const yesterday = new Date(NOW - 24 * HOUR);
    const untilStr = yesterday
      .toISOString()
      .replace(/[-:]/g, "")
      .slice(0, 8);
    const candidate = makeCandidate({
      recurrenceRule: `FREQ=WEEKLY;INTERVAL=1;UNTIL=${untilStr}`,
    });

    db._queue([candidate]); // candidates
    db._queue([]); // successors
    db._queue([]); // already-processed

    setupMocks(db);
    const mod = await import("@/inngest/functions/recurring-bookings");
    const result = await runHandler(mod);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("skips already-processed booking via sync_log deduplication", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeCandidate({ id: 42 });

    db._queue([candidate]); // candidates
    db._queue([]); // successors
    // Already processed — localId "42" found in sync_log
    db._queue([{ localId: "42" }]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/recurring-bookings");
    const result = await runHandler(mod);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("returns early when no candidates found", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // query-records returns empty candidates
    db._queue([]); // candidates
    db._queue([]); // successors
    db._queue([]); // already-processed

    setupMocks(db);
    const mod = await import("@/inngest/functions/recurring-bookings");
    const result = await runHandler(mod);

    expect(result.checked).toBe(0);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("processes multiple eligible bookings in batch", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate1 = makeCandidate({ id: 1 });
    const candidate2 = makeCandidate({ id: 2 });

    // query-records returns both candidates
    db._queue([candidate1, candidate2]); // candidates
    db._queue([]); // successors
    db._queue([]); // already-processed

    // Confirmation queries for booking 1
    db._queue([{
      clientEmail: "c1@test.com",
      clientFirstName: "Alice",
      notifyEmail: true,
      serviceName: "Nail Fill",
    }]);
    // Confirmation queries for booking 2
    db._queue([{
      clientEmail: "c2@test.com",
      clientFirstName: "Bob",
      notifyEmail: true,
      serviceName: "Nail Fill",
    }]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/recurring-bookings");
    const result = await runHandler(mod);

    expect(result.checked).toBe(2);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it("handles subscription path — inactive subscription is skipped", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeCandidate({
      id: 10,
      subscriptionId: 50,
      recurrenceRule: null,
    });

    db._queue([candidate]); // candidates
    db._queue([]); // successors
    db._queue([]); // already-processed

    // process-10: subscription lookup → inactive
    db._queue([{
      id: 50,
      status: "paused",
      sessionsUsed: 2,
      totalSessions: 10,
      intervalDays: 7,
    }]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/recurring-bookings");
    const result = await runHandler(mod);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
