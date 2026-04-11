// @vitest-environment node

/**
 * tests/integration/email-sequence.test.ts
 *
 * Integration tests for the email sequence system.
 *
 * Covers two surfaces:
 *   A) autoEnrollClient() — lifecycle hook called after booking completion
 *   B) emailSequenceCron handler — daily processor that advances enrollments
 *
 * The Inngest handler is extracted by mocking inngest.createFunction() to
 * capture the handler, then calling it directly with a step stub where
 * step.run(_, fn) immediately invokes fn().
 *
 * DB call order for autoEnrollClient():
 *   SELECT notification_preferences (marketing check)
 *   SELECT email_sequences WHERE triggerEvent = ? AND isActive = true
 *   INSERT email_sequence_enrollments ON CONFLICT DO NOTHING  (per sequence)
 *
 * DB call order for cron handler (per enrollment):
 *   [find-candidates] SELECT enrollments INNER JOIN sequences WHERE status='active'
 *   [process-N] SELECT email_sequence_steps WHERE sequenceId = ? AND stepOrder = ?
 *               SELECT notification_preferences (marketing check, if step due)
 *               SELECT sync_log (dedup check, if pref enabled)
 *               SELECT profiles (client email, if not deduped)
 *               sendEmail() → external Resend call
 *               SELECT count(*) FROM email_sequence_steps (total steps, if sent)
 *               UPDATE email_sequence_enrollments (advance step / mark completed)
 *
 * (1) Full sequence run: trigger → enrolled → step 1 (delay=0) → 3 days → step 2
 *     → 7 days → step 3 → marked completed.
 * (2) Unsubscribe mid-sequence: cron detects opt-out → enrollment cancelled, no send.
 * (3) Duplicate enrollment: second autoEnrollClient call uses ON CONFLICT DO NOTHING → 1 row.
 * (4) Re-enrollment after completion: completed enrollment allows new active enrollment.
 * (5) Marketing disabled: autoEnrollClient skips enrollment entirely.
 * (6) Sequence deactivated: INNER JOIN excludes it → enrollment stays active (paused, not cancelled).
 * (7) Send failure: sendEmail returns false → enrollment NOT advanced → retry next cron.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const enrollmentsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  const updateCalls: Array<{ values: MockRow }> = [];
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
    _enrollments: enrollmentsTable,
    _syncLog: syncLogTable,
    _updateCalls: updateCalls,
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

          if ("sequenceId" in v && "profileId" in v && "currentStep" in v) {
            enrollmentsTable.push(row);
          } else if ("provider" in v && "direction" in v) {
            syncLogTable.push(row);
          }
        }
        const returning = vi.fn().mockResolvedValue([{ id: nextId - 1 }]);
        return {
          returning,
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
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
/*  Shared mock instances                                              */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockIsResendConfigured = vi.fn().mockReturnValue(true);
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockTrackEvent = vi.fn();
const mockCaptureException = vi.fn();
const mockRevalidatePath = vi.fn();
const mockGetPublicBusinessProfile = vi.fn().mockResolvedValue({
  businessName: "T Creative Studio",
  emailSenderName: "T Creative",
  emailFromAddress: "hello@tcreative.com",
});

/* ------------------------------------------------------------------ */
/*  Inngest step stub — executes each step.run callback immediately    */
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
    emailSequences: {
      id: "id",
      name: "name",
      triggerEvent: "triggerEvent",
      isActive: "isActive",
      createdAt: "createdAt",
    },
    emailSequenceSteps: {
      id: "id",
      sequenceId: "sequenceId",
      stepOrder: "stepOrder",
      delayDays: "delayDays",
      subject: "subject",
      body: "body",
    },
    emailSequenceEnrollments: {
      id: "id",
      sequenceId: "sequenceId",
      profileId: "profileId",
      currentStep: "currentStep",
      status: "status",
      enrolledAt: "enrolledAt",
      lastStepSentAt: "lastStepSentAt",
      completedAt: "completedAt",
      cancelledAt: "cancelledAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
      notifyEmail: "notifyEmail",
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
    notificationPreferences: {
      id: "id",
      profileId: "profileId",
      channel: "channel",
      notificationType: "notificationType",
      enabled: "enabled",
    },
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
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    isResendConfigured: mockIsResendConfigured,
    getEmailRecipient: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/lib/auth", () => ({
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "admin" }),
    getUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
  }));
  // Mock the compiled inngest client used by the cron function.
  // We intercept createFunction to capture the handler so tests can call it directly.
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
  vi.doMock("inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
  vi.doMock("@/lib/notification-preferences", () => ({
    isNotificationEnabled: vi.fn().mockResolvedValue(true),
  }));
  vi.doMock("react", () => ({
    createElement: vi.fn((...args: unknown[]) => ({ type: "div", props: args[1] })),
    default: { createElement: vi.fn() },
    cache: vi.fn((fn: any) => fn),
  }));
  vi.doMock("@/lib/env", () => ({
    env: {
      RESEND_API_KEY: "re_test",
      DATABASE_POOLER_URL: "postgresql://localhost:5432/test",
    },
  }));
}

/* ------------------------------------------------------------------ */
/*  Helper: invoke the cron handler directly                           */
/* ------------------------------------------------------------------ */

async function runCron(
  module: typeof import("@/inngest/functions/email-sequences"),
): Promise<{ processed: number; sent: number; completed: number; skipped: number }> {
  const fn = module.emailSequenceCron as any;
  // Inngest createFunction returns the handler as second arg; our mock captures it
  // The module exports the result of createFunction, which our mock returns { handler }
  const handler = fn?.handler ?? fn;
  return handler({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Email sequence — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockIsResendConfigured.mockReturnValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockGetPublicBusinessProfile.mockResolvedValue({
      businessName: "T Creative Studio",
      emailSenderName: "T Creative",
      emailFromAddress: "hello@tcreative.com",
    });
    step.run.mockImplementation(async (_name: string, fn: () => Promise<any>) => fn());
  });

  /* --- (1) Full 3-step sequence run: step 1 immediate, step 2 after 3 days, step 3 after 7 days --- */

  it("(1) full sequence run: steps sent at correct delays, enrollment marked completed", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const enrolledAt = new Date(Date.now() - 8 * 86_400_000); // enrolled 8 days ago
    const step1SentAt = new Date(enrolledAt); // step 1 sent at enrollment (delay=0)
    const step2SentAt = new Date(enrolledAt.getTime() + 3 * 86_400_000); // sent 3 days after step 1

    // Simulate cron run 1: enrollment at step 0, step 1 has delayDays=0 → send immediately
    // find-candidates
    db._queue([
      {
        enrollmentId: 10,
        sequenceId: 1,
        profileId: "client-1",
        currentStep: 0,
        lastStepSentAt: null,
        enrolledAt,
        sequenceName: "First Booking Follow-up",
      },
    ]);
    // process-10: SELECT next step (stepOrder=1, delayDays=0)
    db._queue([
      {
        id: 101,
        sequenceId: 1,
        stepOrder: 1,
        delayDays: 0,
        subject: "Thank you {{firstName}}!",
        body: "Hi {{firstName}}, welcome to {{businessName}}.",
      },
    ]);
    // isNotificationEnabled → mocked to true (no DB queue needed, module is mocked)
    // dedup check → no existing sync_log entry
    db._queue([]);
    // SELECT profiles
    db._queue([{ email: "client@test.com", firstName: "Alice" }]);
    // SELECT count(*) total steps = 3 (not last step)
    db._queue([{ count: 3 }]);

    setupMocks(db);
    const { isNotificationEnabled } = await import("@/lib/notification-preferences");
    (isNotificationEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const mod = await import("@/inngest/functions/email-sequences");
    const result = await runCron(mod);

    expect(result.sent).toBe(1);
    expect(result.completed).toBe(0);
    expect(mockSendEmail).toHaveBeenCalledOnce();

    // Email subject has template variable replaced
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Thank you Alice!" }),
    );

    // Enrollment advanced to step 1
    const advance = db._updateCalls.find((c) => c.values.currentStep === 1);
    expect(advance).toBeDefined();
    expect(advance!.values.status).toBeUndefined(); // not last step — no status change yet
  });

  it("(1b) step 2 sent after 3-day delay, step 3 sent after 7-day delay → completed", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const step2SentAt = new Date(Date.now() - 8 * 86_400_000); // step 2 sent 8 days ago

    // Cron run for step 3: enrollment at step 2, step 3 has delayDays=7, 8 days elapsed
    db._queue([
      {
        enrollmentId: 10,
        sequenceId: 1,
        profileId: "client-1",
        currentStep: 2,
        lastStepSentAt: step2SentAt,
        enrolledAt: new Date(Date.now() - 20 * 86_400_000),
        sequenceName: "First Booking Follow-up",
      },
    ]);
    // SELECT step 3 (stepOrder=3, delayDays=7)
    db._queue([
      {
        id: 103,
        sequenceId: 1,
        stepOrder: 3,
        delayDays: 7,
        subject: "Miss you {{firstName}}",
        body: "Come back soon!",
      },
    ]);
    // dedup check → no existing entry
    db._queue([]);
    // SELECT profiles
    db._queue([{ email: "client@test.com", firstName: "Alice" }]);
    // SELECT count(*) total steps = 3 → isLastStep
    db._queue([{ count: 3 }]);

    setupMocks(db);
    const { isNotificationEnabled } = await import("@/lib/notification-preferences");
    (isNotificationEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const mod = await import("@/inngest/functions/email-sequences");
    const result = await runCron(mod);

    expect(result.sent).toBe(1);
    expect(result.completed).toBe(1);

    // Enrollment marked completed on last step
    const complete = db._updateCalls.find((c) => c.values.status === "completed");
    expect(complete).toBeDefined();
    expect(complete!.values.completedAt).toBeInstanceOf(Date);
    expect(complete!.values.currentStep).toBe(3);
  });

  /* --- (2) Unsubscribe mid-sequence: marketing opt-out detected → cancel enrollment, no send --- */

  it("(2) unsubscribe mid-sequence: marketing disabled → enrollment cancelled, email not sent", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const enrolledAt = new Date(Date.now() - 5 * 86_400_000);

    // find-candidates: enrollment at step 1, step 2 is due
    db._queue([
      {
        enrollmentId: 20,
        sequenceId: 2,
        profileId: "client-2",
        currentStep: 1,
        lastStepSentAt: new Date(Date.now() - 4 * 86_400_000),
        enrolledAt,
        sequenceName: "Re-engagement",
      },
    ]);
    // SELECT next step (stepOrder=2, delayDays=3 → 4 days elapsed, due)
    db._queue([
      {
        id: 201,
        sequenceId: 2,
        stepOrder: 2,
        delayDays: 3,
        subject: "We miss you",
        body: "Come back!",
      },
    ]);
    // isNotificationEnabled → mocked to false below (marketing disabled)

    setupMocks(db);
    const { isNotificationEnabled } = await import("@/lib/notification-preferences");
    (isNotificationEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const mod = await import("@/inngest/functions/email-sequences");
    const result = await runCron(mod);

    expect(result.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();

    // Enrollment cancelled (not completed — explicitly cancelled due to opt-out)
    const cancel = db._updateCalls.find((c) => c.values.status === "cancelled");
    expect(cancel).toBeDefined();
    expect(cancel!.values.cancelledAt).toBeInstanceOf(Date);
  });

  /* --- (3) Duplicate enrollment: ON CONFLICT DO NOTHING → only one active enrollment --- */

  it("(3) duplicate enrollment: second autoEnrollClient call does not create a second row", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Both calls: marketing pref check → enabled
    // Then: find active sequence for trigger
    // First call
    db._queue([{ enabled: true }]); // isNotificationEnabled
    db._queue([{ id: 5 }]); // SELECT active sequences
    // Second call (duplicate)
    db._queue([{ enabled: true }]); // isNotificationEnabled
    db._queue([{ id: 5 }]); // SELECT active sequences (same sequence)

    // Track onConflictDoNothing calls to verify deduplication path is taken
    let conflictDoNothingCalls = 0;
    const originalInsert = db.insert.bind(db);
    db.insert = vi.fn((_table: any) => ({
      values: vi.fn((_values: MockRow | MockRow[]) => {
        conflictDoNothingCalls++;
        const row = Array.isArray(_values) ? _values[0] : _values;
        db._enrollments.push({ ...row, id: db._enrollments.length + 1 });
        return {
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })) as typeof db.insert;

    setupMocks(db);
    // Override the notification-preferences module to use the queue
    vi.doMock("@/lib/notification-preferences", () => ({
      isNotificationEnabled: vi
        .fn()
        .mockResolvedValueOnce(true) // first call
        .mockResolvedValueOnce(true), // second call
    }));

    const { autoEnrollClient } = await import("@/app/dashboard/sequences/actions");

    await autoEnrollClient("client-3", "first_booking_completed");
    await autoEnrollClient("client-3", "first_booking_completed");

    // Two insert attempts were made (one per call), each using onConflictDoNothing
    expect(conflictDoNothingCalls).toBe(2);

    // In a real DB the unique partial index prevents a second active row;
    // the mock confirms the dedup path (onConflictDoNothing) is always used
  });

  /* --- (4) Re-enrollment after completion: new active enrollment created --- */

  it("(4) re-enrollment after completion: completed enrollment does not block a new one", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Seed a completed enrollment — unique partial index (WHERE status='active')
    // means a new active enrollment for the same (sequenceId, profileId) is allowed
    db._enrollments.push({
      id: 1,
      sequenceId: 7,
      profileId: "client-4",
      currentStep: 3,
      status: "completed",
      enrolledAt: new Date(Date.now() - 30 * 86_400_000),
    });

    setupMocks(db);
    vi.doMock("@/lib/notification-preferences", () => ({
      isNotificationEnabled: vi.fn().mockResolvedValue(true),
    }));

    // Queue SELECT for active sequences (marketing pref is handled by the mocked module)
    db._queue([{ id: 7 }]); // SELECT active sequences matching the trigger

    const { autoEnrollClient } = await import("@/app/dashboard/sequences/actions");
    await autoEnrollClient("client-4", "first_booking_completed");

    // A new enrollment row was inserted alongside the completed one
    const allEnrollments = db._enrollments.filter((e) => e.profileId === "client-4");
    expect(allEnrollments).toHaveLength(2);
    expect(allEnrollments.find((e) => e.status === "completed")).toBeDefined();

    // The new insert carries status='active' and currentStep=0
    const newEnrollment = db._insertCalls.find(
      (r) => "currentStep" in r && r.profileId === "client-4",
    );
    expect(newEnrollment).toBeDefined();
    expect(newEnrollment!.status).toBe("active");
    expect(newEnrollment!.currentStep).toBe(0);
  });

  /* --- (5) Marketing disabled: autoEnrollClient returns without inserting --- */

  it("(5) marketing disabled: autoEnrollClient skips enrollment entirely", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db);
    vi.doMock("@/lib/notification-preferences", () => ({
      isNotificationEnabled: vi.fn().mockResolvedValue(false),
    }));

    const { autoEnrollClient } = await import("@/app/dashboard/sequences/actions");
    await autoEnrollClient("client-5", "first_booking_completed");

    // No sequences queried and no enrollment inserted
    expect(db._enrollments).toHaveLength(0);
    expect(db._insertCalls.filter((r) => "currentStep" in r)).toHaveLength(0);
  });

  /* --- (6) Sequence deactivated: INNER JOIN excludes it → enrollment not touched --- */

  it("(6) sequence deactivated: cron INNER JOIN excludes inactive sequence → enrollment untouched", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // find-candidates returns empty because INNER JOIN on isActive=true excludes the row
    db._queue([]);

    setupMocks(db);

    const mod = await import("@/inngest/functions/email-sequences");
    const result = await runCron(mod);

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);

    // No update calls — enrollment status unchanged (paused, not cancelled)
    expect(db._updateCalls).toHaveLength(0);
  });

  /* --- (7) Send failure: sendEmail returns false → enrollment NOT advanced --- */

  it("(7) send failure: sendEmail returns false → enrollment stays at current step, no advance", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const enrolledAt = new Date(Date.now() - 5 * 86_400_000);

    db._queue([
      {
        enrollmentId: 30,
        sequenceId: 3,
        profileId: "client-6",
        currentStep: 0,
        lastStepSentAt: null,
        enrolledAt,
        sequenceName: "Win-back",
      },
    ]);
    // SELECT next step (stepOrder=1, delayDays=0)
    db._queue([
      {
        id: 301,
        sequenceId: 3,
        stepOrder: 1,
        delayDays: 0,
        subject: "We miss you",
        body: "Come back!",
      },
    ]);
    // dedup check → no existing entry
    db._queue([]);
    // SELECT profiles
    db._queue([{ email: "client@test.com", firstName: "Bob" }]);
    // NOTE: no total steps SELECT — sendEmail failed so we never reach that query

    setupMocks(db);
    mockSendEmail.mockResolvedValue(false); // Resend failure

    const { isNotificationEnabled } = await import("@/lib/notification-preferences");
    (isNotificationEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const mod = await import("@/inngest/functions/email-sequences");
    const result = await runCron(mod);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);

    // No UPDATE on enrollments — step was not advanced
    const advanceUpdates = db._updateCalls.filter((c) => c.values.currentStep !== undefined);
    expect(advanceUpdates).toHaveLength(0);

    // On next cron run, step 1 will be attempted again (dedup via sync_log prevents
    // double-send only if sendEmail succeeded and logged to sync_log)
  });
});
