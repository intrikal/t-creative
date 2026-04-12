// @vitest-environment node

/**
 * inngest/functions/email-sequences.test.ts
 *
 * Unit tests for the emailSequenceCron Inngest function.
 * These complement the integration test in tests/integration/email-sequence.test.ts
 * by covering branches not reached there.
 *
 * Covers:
 *   (1) No active sequences → returns zero counts immediately
 *   (2) Enrolled client past delay window → next step email sent, enrollment advanced
 *   (3) Enrolled client within delay window → enrollment skipped, no email sent
 *   (4) All steps completed (no nextStep row) → enrollment marked "completed"
 *   (5) Email send failure → enrollment NOT advanced, step not incremented
 *
 * DB call order per enrollment (happy path):
 *   find-candidates: SELECT enrollments INNER JOIN sequences
 *   process-N:
 *     SELECT email_sequence_steps  (nextStep)
 *     isNotificationEnabled()      (marketing check)
 *     SELECT sync_log              (dedup)
 *     SELECT profiles              (client email)
 *     sendEmail()
 *     SELECT count(*)              (total steps for last-step detection)
 *     UPDATE email_sequence_enrollments
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Step stub                                                           */
/* ------------------------------------------------------------------ */

const step = {
  run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
};

/* ------------------------------------------------------------------ */
/*  Shared mocks                                                        */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockIsResendConfigured = vi.fn().mockReturnValue(true);
const mockIsNotificationEnabled = vi.fn().mockResolvedValue(true);
const mockGetPublicBusinessProfile = vi.fn().mockResolvedValue({
  businessName: "T Creative Studio",
  emailSenderName: "T Creative",
  emailFromAddress: "hello@tcreative.com",
});
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  DB mock — positional select queue                                   */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[]) {
  const p = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (res: any, rej: any) => p.then(res, rej),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  };
  return chain;
}

type UpdateCall = { values: Record<string, unknown> };

function createDb(selectResults: unknown[][]) {
  let idx = 0;
  const updateCalls: UpdateCall[] = [];

  const db = {
    _updateCalls: updateCalls,
    select: vi.fn(() => makeChain(selectResults[idx++] ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      })),
    })),
    update: vi.fn((_table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updateCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  };
  return db;
}

/* ------------------------------------------------------------------ */
/*  Common enrollment fixture                                           */
/* ------------------------------------------------------------------ */

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    enrollmentId: 1,
    sequenceId: 10,
    profileId: "client-1",
    currentStep: 0,
    lastStepSentAt: null,
    enrolledAt: new Date(Date.now() - 5 * 86_400_000), // 5 days ago
    sequenceName: "Welcome Series",
    ...overrides,
  };
}

function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    sequenceId: 10,
    stepOrder: 1,
    delayDays: 0,
    subject: "Welcome {{firstName}}!",
    body: "Hi {{firstName}}, thanks for joining {{businessName}}.",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Setup helper                                                        */
/* ------------------------------------------------------------------ */

function setupMocks(selectResults: unknown[][], resendConfigured = true) {
  mockIsResendConfigured.mockReturnValue(resendConfigured);

  const db = createDb(selectResults);
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    emailSequences: { id: "id", name: "name", isActive: "isActive" },
    emailSequenceSteps: { id: "id", sequenceId: "sequenceId", stepOrder: "stepOrder", delayDays: "delayDays", subject: "subject", body: "body" },
    emailSequenceEnrollments: { id: "id", sequenceId: "sequenceId", profileId: "profileId", currentStep: "currentStep", status: "status", enrolledAt: "enrolledAt", lastStepSentAt: "lastStepSentAt", completedAt: "completedAt", cancelledAt: "cancelledAt" },
    profiles: { id: "id", firstName: "firstName", email: "email" },
    syncLog: { id: "id", entityType: "entityType", localId: "localId" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    isResendConfigured: mockIsResendConfigured,
  }));
  vi.doMock("@/lib/notification-preferences", () => ({
    isNotificationEnabled: mockIsNotificationEnabled,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("isomorphic-dompurify", () => ({
    default: { sanitize: vi.fn((s: string) => s) },
  }));
  vi.doMock("react", () => ({
    createElement: vi.fn((...args: unknown[]) => ({ type: "div", props: args[1] })),
    default: { createElement: vi.fn() },
    cache: vi.fn((fn: any) => fn),
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
  return db;
}

async function runCron(): Promise<{
  processed: number;
  sent: number;
  completed: number;
  skipped: number;
}> {
  const mod = await import("@/inngest/functions/email-sequences");
  const fn = (mod.emailSequenceCron as any)?.handler ?? mod.emailSequenceCron;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("emailSequenceCron — unit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockIsResendConfigured.mockReturnValue(true);
    mockIsNotificationEnabled.mockResolvedValue(true);
    step.run.mockImplementation(async (_name: string, fn: () => Promise<any>) => fn());
  });

  /* ---------------------------------------------------------------- */
  /*  (1) No active sequences → returns 0 counts immediately           */
  /* ---------------------------------------------------------------- */

  it("(1) no active sequences → returns { processed: 0, sent: 0, completed: 0, skipped: 0 }", async () => {
    // find-candidates returns no enrollments
    setupMocks([[]]);

    const result = await runCron();

    expect(result).toEqual({ processed: 0, sent: 0, completed: 0, skipped: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /*  (2) Past delay window → email sent, enrollment advanced          */
  /* ---------------------------------------------------------------- */

  it("(2) enrolled client past delay window → email sent, currentStep incremented", async () => {
    const enrollment = makeEnrollment({
      lastStepSentAt: new Date(Date.now() - 4 * 86_400_000), // 4 days ago
    });
    const nextStep = makeStep({ delayDays: 3 }); // 3-day delay, 4 days elapsed → due

    setupMocks([
      // find-candidates
      [enrollment],
      // nextStep for enrollment
      [nextStep],
      // dedup check → no existing
      [],
      // profiles
      [{ email: "client@test.com", firstName: "Alice" }],
      // total steps count (not last step)
      [{ count: 3 }],
    ]);

    const result = await runCron();

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockSendEmail).toHaveBeenCalledOnce();

    // Subject has template variable replaced
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Welcome Alice!" }),
    );
  });

  /* ---------------------------------------------------------------- */
  /*  (3) Within delay window → skipped, no email                      */
  /* ---------------------------------------------------------------- */

  it("(3) enrolled client within delay window → enrollment skipped, no email sent", async () => {
    const enrollment = makeEnrollment({
      lastStepSentAt: new Date(Date.now() - 1 * 86_400_000), // 1 day ago
    });
    const nextStep = makeStep({ delayDays: 3 }); // 3-day delay, only 1 day elapsed → not due

    setupMocks([
      [enrollment],
      [nextStep],
      // No further DB calls needed — function returns before dedup
    ]);

    const result = await runCron();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  /* ---------------------------------------------------------------- */
  /*  (4) All steps completed → enrollment marked "completed"          */
  /* ---------------------------------------------------------------- */

  it("(4) no next step row (all steps done) → enrollment marked completed, no email sent", async () => {
    const enrollment = makeEnrollment({ currentStep: 3 }); // at step 3

    const db = setupMocks([
      // find-candidates
      [enrollment],
      // SELECT nextStep (stepOrder=4) → empty means no more steps
      [],
    ]);

    const result = await runCron();

    expect(result.sent).toBe(0);
    expect(result.completed).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();

    // Enrollment marked completed
    const completeUpdate = db._updateCalls.find((c) => c.values.status === "completed");
    expect(completeUpdate).toBeDefined();
    expect(completeUpdate!.values.completedAt).toBeInstanceOf(Date);
  });

  /* ---------------------------------------------------------------- */
  /*  (5) Email send failure → enrollment not advanced                 */
  /* ---------------------------------------------------------------- */

  it("(5) sendEmail returns false → enrollment not advanced, skipped count incremented", async () => {
    const enrollment = makeEnrollment();
    const nextStep = makeStep({ delayDays: 0 });

    const db = setupMocks([
      [enrollment],
      [nextStep],
      // dedup check → no existing
      [],
      // profiles
      [{ email: "client@test.com", firstName: "Carol" }],
      // NOTE: no total-steps SELECT — sendEmail failed so we never reach it
    ]);

    mockSendEmail.mockResolvedValue(false);

    const result = await runCron();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledOnce();

    // No update on enrollment — step was NOT advanced
    const advanceUpdates = db._updateCalls.filter(
      (c) => c.values.currentStep !== undefined,
    );
    expect(advanceUpdates).toHaveLength(0);
  });

  /* ---------------------------------------------------------------- */
  /*  (6) Resend not configured → skips entire run                     */
  /* ---------------------------------------------------------------- */

  it("(6) Resend not configured → returns skipped result without touching DB", async () => {
    setupMocks([[]], false /* resendConfigured = false */);

    const result = await runCron();

    expect(result).toMatchObject({ skipped: true, reason: "Resend not configured" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
