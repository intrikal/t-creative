// @vitest-environment node

/**
 * inngest/functions/membership-reminders.test.ts
 *
 * Unit tests for the membership-reminders Inngest function.
 * Covers Phase 1 (Square subscription sync: auto-renew, pause, cancel)
 * and Phase 2 (cycle-end reminder emails with deduplication and preferences).
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
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockGetSquareSubscriptionStatus = vi.fn().mockResolvedValue(null);
const mockCancelSquareSubscription = vi.fn().mockResolvedValue(undefined);
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
    membershipSubscriptions: {
      id: "id",
      clientId: "clientId",
      planId: "planId",
      status: "status",
      squareSubscriptionId: "squareSubscriptionId",
      cycleEndsAt: "cycleEndsAt",
      cycleStartAt: "cycleStartAt",
      fillsRemainingThisCycle: "fillsRemainingThisCycle",
      pausedAt: "pausedAt",
      cancelledAt: "cancelledAt",
      notes: "notes",
    },
    membershipPlans: {
      id: "id",
      name: "name",
      fillsPerCycle: "fillsPerCycle",
      cycleIntervalDays: "cycleIntervalDays",
    },
    profiles: {
      id: "id",
      email: "email",
      firstName: "firstName",
      notifyEmail: "notifyEmail",
      role: "role",
      onboardingData: "onboardingData",
    },
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
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lte: vi.fn((...a: unknown[]) => ({ type: "lte", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
  }));
  vi.doMock("@/lib/audit", () => ({
    logAction: mockLogAction,
  }));
  vi.doMock("@/lib/square", () => ({
    getSquareSubscriptionStatus: mockGetSquareSubscriptionStatus,
    cancelSquareSubscription: mockCancelSquareSubscription,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
  vi.doMock("@/emails/MembershipReminder", () => ({
    MembershipReminder: vi.fn(() => ({ type: "MembershipReminder" })),
  }));
  vi.doMock("date-fns", () => ({
    addDays: vi.fn((d: Date, days: number) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000)),
    format: vi.fn((_d: Date, _f: string) => "April 15"),
  }));
  vi.doMock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
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
  module: typeof import("@/inngest/functions/membership-reminders"),
) {
  const fn = module.membershipReminders as any;
  const handler = fn?.handler ?? fn;
  return handler({ step });
}

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function makeSquareSub(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: 1,
    status: "active",
    squareSubscriptionId: "sq-sub-1",
    cycleEndsAt: new Date(Date.now() - DAY).toISOString(), // expired yesterday
    fillsPerCycle: 4,
    cycleIntervalDays: 30,
    ...overrides,
  };
}

function makeReminderCandidate(overrides: Partial<MockRow> = {}): MockRow {
  return {
    subscriptionId: 10,
    clientId: "client-1",
    fillsRemainingThisCycle: 2,
    cycleEndsAt: new Date(Date.now() + 3 * DAY + 12 * HOUR).toISOString(),
    planName: "Monthly Membership",
    fillsPerCycle: 4,
    clientEmail: "client@test.com",
    clientFirstName: "Alice",
    notifyEmail: true,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("membership-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockGetSquareSubscriptionStatus.mockResolvedValue(null);
    step.run.mockImplementation(async (_name: string, fn: () => Promise<any>) => fn());
  });

  /* ── Phase 1: Square sync ───────────────────────────────────────── */

  it("auto-renews membership when Square says ACTIVE and cycle expired", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const sub = makeSquareSub();

    mockGetSquareSubscriptionStatus.mockResolvedValue({ status: "ACTIVE" });

    // Phase 1: query-square-subs
    db._queue([sub]);
    // Phase 2: query-reminder-candidates → empty (no reminders this run)
    db._queue([]);
    // admin profile for slug
    db._queue([{ onboardingData: { studioName: "Studio" } }]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/membership-reminders");
    const result = await runHandler(mod);

    expect(result.sync.renewed).toBe(1);
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        description: expect.stringContaining("auto-renewed"),
      }),
    );
    // Verify the DB update was called with renewed fields
    const renewUpdate = db._updateCalls.find((c) => c.values.fillsRemainingThisCycle !== undefined);
    expect(renewUpdate).toBeDefined();
    expect(renewUpdate!.values.status).toBe("active");
  });

  it("pauses membership when Square says DEACTIVATED", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const sub = makeSquareSub({ status: "active" });

    mockGetSquareSubscriptionStatus.mockResolvedValue({ status: "DEACTIVATED" });

    db._queue([sub]); // square subs
    db._queue([]); // reminder candidates
    db._queue([{ onboardingData: { studioName: "Studio" } }]); // admin profile

    setupMocks(db);
    const mod = await import("@/inngest/functions/membership-reminders");
    const result = await runHandler(mod);

    expect(result.sync.deactivated).toBe(1);
    const pauseUpdate = db._updateCalls.find((c) => c.values.status === "paused");
    expect(pauseUpdate).toBeDefined();
  });

  it("cancels membership when Square says CANCELED", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const sub = makeSquareSub({ status: "active" });

    mockGetSquareSubscriptionStatus.mockResolvedValue({ status: "CANCELED" });

    db._queue([sub]); // square subs
    db._queue([]); // reminder candidates
    db._queue([{ onboardingData: { studioName: "Studio" } }]); // admin profile

    setupMocks(db);
    const mod = await import("@/inngest/functions/membership-reminders");
    const result = await runHandler(mod);

    expect(result.sync.cancelled).toBe(1);
    const cancelUpdate = db._updateCalls.find((c) => c.values.status === "cancelled");
    expect(cancelUpdate).toBeDefined();
  });

  /* ── Phase 2: Reminders ─────────────────────────────────────────── */

  it("sends renewal reminder when membership expiring in window", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeReminderCandidate();

    // Phase 1: no square subs
    db._queue([]);
    // Phase 2: query-reminder-candidates
    db._queue([candidate]);
    // admin profile for slug
    db._queue([{ onboardingData: { studioName: "Studio" } }]);
    // dedup check → not found
    db._queue([]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/membership-reminders");
    const result = await runHandler(mod);

    expect(result.reminders.sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("uses fills-remaining subject when fills remain", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeReminderCandidate({ fillsRemainingThisCycle: 1 });

    db._queue([]); // square subs
    db._queue([candidate]); // reminder candidates
    db._queue([{ onboardingData: { studioName: "Studio" } }]); // admin profile
    db._queue([]); // dedup check

    setupMocks(db);
    const mod = await import("@/inngest/functions/membership-reminders");
    const result = await runHandler(mod);

    expect(result.reminders.sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("1 fill remaining"),
      }),
    );
  });

  it("skips already-reminded subscription (dedup via sync_log)", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeReminderCandidate();

    db._queue([]); // square subs
    db._queue([candidate]); // reminder candidates
    db._queue([{ onboardingData: { studioName: "Studio" } }]); // admin profile
    // dedup check → already sent
    db._queue([{ id: 99 }]);

    setupMocks(db);
    const mod = await import("@/inngest/functions/membership-reminders");
    const result = await runHandler(mod);

    expect(result.reminders.sent).toBe(0);
    expect(result.reminders.skipped).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips when client notifyEmail=false", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeReminderCandidate({ notifyEmail: false });

    db._queue([]); // square subs
    db._queue([candidate]); // reminder candidates
    db._queue([{ onboardingData: { studioName: "Studio" } }]); // admin profile

    setupMocks(db);
    const mod = await import("@/inngest/functions/membership-reminders");
    const result = await runHandler(mod);

    expect(result.reminders.sent).toBe(0);
    expect(result.reminders.skipped).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips when client has no email", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    const candidate = makeReminderCandidate({ clientEmail: null });

    db._queue([]); // square subs
    db._queue([candidate]); // reminder candidates
    db._queue([{ onboardingData: { studioName: "Studio" } }]); // admin profile

    setupMocks(db);
    const mod = await import("@/inngest/functions/membership-reminders");
    const result = await runHandler(mod);

    expect(result.reminders.sent).toBe(0);
    expect(result.reminders.skipped).toBe(1);
  });
});
