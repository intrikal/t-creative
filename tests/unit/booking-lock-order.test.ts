// @vitest-environment node

/**
 * tests/unit/booking-lock-order.test.ts
 *
 * Verifies the lock-then-check-then-insert sequence inside createBooking()
 * that prevents the double-booking race condition.
 *
 * The critical sequence inside db.transaction():
 *   1. pg_advisory_xact_lock(hashtext(staffId))   — serialises concurrent writes
 *   2. hasOverlappingBooking()  via db.select()   — overlap check AFTER the lock
 *   3. hasApprovedTimeOffConflict() via db.select()
 *   4. tx.insert(bookings)                         — insert ONLY if no conflict
 *
 * Strategy:
 *   - vi.mock all side-effect modules (db, auth, email, Square, Zoho, etc.)
 *   - db.select() returns a fully-chainable stub ending in .limit() / .where()
 *     so post-transaction helpers (trySendBookingConfirmation etc.) don't throw.
 *   - Capture the transaction callback, replay it against a fake `tx` that records
 *     every call in a shared callLog, then assert ordering.
 */

import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

// ─── Mock all heavy dependencies before importing the action ──────────────────

vi.mock("@/db", () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-admin-1" }),
  requireAdmin: vi.fn().mockResolvedValue({ id: "user-admin-1" }),
  requireStaff: vi.fn().mockResolvedValue({ id: "user-admin-1" }),
}));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/resend", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  sendEmailHtml: vi.fn().mockResolvedValue(true),
  getEmailRecipient: vi.fn().mockReturnValue("client@example.com"),
  isResendConfigured: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/square", () => ({
  isSquareConfigured: vi.fn().mockReturnValue(false),
  createSquarePayment: vi.fn(),
  createSquareOrder: vi.fn(),
  createSquarePaymentLink: vi.fn(),
  squareClient: { refunds: { refundPayment: vi.fn() } },
}));
vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/zoho", () => ({
  createZohoDeal: vi.fn().mockResolvedValue(undefined),
  updateZohoDeal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/zoho-books", () => ({
  createZohoBooksInvoice: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/waitlist-notify", () => ({
  notifyWaitlistForCancelledBooking: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } },
  }),
}));
vi.mock("@/app/dashboard/settings/settings-actions", () => ({
  getPolicies: vi.fn().mockResolvedValue({
    fullRefundHours: 48,
    partialRefundPct: 50,
    partialRefundMinHours: 24,
    noRefundHours: 24,
    cancelWindowHours: 48,
    lateCancelFeePercent: 50,
    noShowFeePercent: 100,
    depositRequired: true,
    depositPercent: 25,
    cancellationPolicy: "",
    tosVersion: "",
  }),
  getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "T Creative", location: "" }),
}));

vi.mock("@/emails/BookingConfirmation", () => ({ BookingConfirmation: vi.fn(() => null) }));
vi.mock("@/emails/BookingCancellation", () => ({ BookingCancellation: vi.fn(() => null) }));
vi.mock("@/emails/BookingCompleted", () => ({ BookingCompleted: vi.fn(() => null) }));
vi.mock("@/emails/BookingNoShow", () => ({ BookingNoShow: vi.fn(() => null) }));
vi.mock("@/emails/BookingReschedule", () => ({ BookingReschedule: vi.fn(() => null) }));
vi.mock("@/emails/NoShowFeeCharged", () => ({ NoShowFeeCharged: vi.fn(() => null) }));
vi.mock("@/emails/NoShowFeeInvoice", () => ({ NoShowFeeInvoice: vi.fn(() => null) }));
vi.mock("@/emails/PaymentLinkEmail", () => ({ PaymentLinkEmail: vi.fn(() => null) }));
vi.mock("@/emails/RecurringBookingConfirmation", () => ({
  RecurringBookingConfirmation: vi.fn(() => null),
}));

// ─── Import AFTER mocks are registered ────────────────────────────────────────

import { createBooking } from "@/app/dashboard/bookings/actions";
import { db } from "@/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAFF_ID = "staff-uuid-abc";
const CLIENT_ID = "client-uuid-def";
const BOOKING_ID = 42;

function makeValidInput(overrides: Record<string, unknown> = {}) {
  return {
    clientId: CLIENT_ID,
    serviceId: 1,
    staffId: STAFF_ID,
    startsAt: new Date("2026-06-15T10:00:00Z"),
    durationMinutes: 90,
    totalInCents: 12000,
    location: "Studio",
    ...overrides,
  };
}

/**
 * Returns a fully chainable Drizzle-style query builder stub.
 * Every method returns `this` except terminal resolvers (.limit, .returning, etc.)
 * which resolve to `terminalValue`.
 */
function makeChainableSelect(terminalValue: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(terminalValue);
  // All chainable methods return the same chain object
  for (const m of ["from", "where", "innerJoin", "leftJoin", "orderBy", "groupBy", "having"]) {
    chain[m] = vi.fn(() => chain);
  }
  // Terminal methods
  chain.limit = terminal;
  // Some queries don't call .limit — they just await the chain directly via .where()
  // Make the chain itself thenable so `await db.select()...from()...where()` works
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(terminalValue).then(resolve);
  return chain as unknown as ReturnType<typeof db.select>;
}

function makeChainableInsert() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue([{ id: BOOKING_ID }]);
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

function makeChainableUpdate() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

/**
 * Builds the fake `tx` object used inside db.transaction().
 * Records every call in callLog so tests can assert ordering.
 */
function makeFakeTx(
  callLog: Array<{ method: string; args: unknown[] }>,
  { overlapConflict = false } = {},
) {
  let selectCallCount = 0;

  return {
    execute: vi.fn(async (sqlQuery: unknown) => {
      callLog.push({ method: "tx.execute", args: [sqlQuery] });
      return [];
    }),
    select: vi.fn(() => {
      // First select = overlap check, second = time-off check (both use db.select in source,
      // but we also handle tx.select if the query ever moves into the transaction)
      const callIndex = selectCallCount++;
      const name = callIndex === 0 ? "tx.select[overlap]" : "tx.select[timeoff]";
      callLog.push({ method: name, args: [] });
      return makeChainableSelect(callIndex === 0 && overlapConflict ? [{ id: 99 }] : []);
    }),
    insert: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.values = vi.fn(() => ({
        returning: vi.fn(async () => {
          callLog.push({ method: "tx.insert.returning", args: [] });
          return [{ id: BOOKING_ID }];
        }),
      }));
      return chain;
    }),
    update: vi.fn(() => makeChainableUpdate()),
  };
}

/**
 * Patches db.select() (the module-level instance, used by hasOverlappingBooking etc.)
 * to record calls in callLog and return mock results.
 */
function patchDbSelect(
  callLog: Array<{ method: string; args: unknown[] }>,
  { overlapConflict = false } = {},
) {
  let callCount = 0;
  (db.select as unknown as MockedFunction<typeof db.select>).mockImplementation(() => {
    const idx = callCount++;
    const name = idx === 0 ? "db.select[overlap]" : `db.select[${idx}]`;
    callLog.push({ method: name, args: [] });
    // overlap check (first call): return row if conflict requested
    return makeChainableSelect(idx === 0 && overlapConflict ? [{ id: 99 }] : []);
  });

  (db.insert as unknown as MockedFunction<typeof db.insert>).mockImplementation(
    () => makeChainableInsert() as unknown as ReturnType<typeof db.insert>,
  );
  (db.update as unknown as MockedFunction<typeof db.update>).mockImplementation(
    () => makeChainableUpdate() as unknown as ReturnType<typeof db.update>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test group 1: correct lock → check → insert sequence
// ─────────────────────────────────────────────────────────────────────────────

describe("createBooking — lock-then-check-then-insert sequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes advisory lock, then overlap check, then insert — in that order", async () => {
    const callLog: Array<{ method: string; args: unknown[] }> = [];
    const fakeTx = makeFakeTx(callLog);

    patchDbSelect(callLog, { overlapConflict: false });

    (db.transaction as MockedFunction<typeof db.transaction>).mockImplementation(async (callback) =>
      callback(fakeTx as never),
    );

    const result = await createBooking(makeValidInput());

    expect(result.success, `Action failed: ${JSON.stringify(result)}`).toBe(true);

    const methods = callLog.map((c) => c.method);

    const lockIdx = methods.indexOf("tx.execute");
    const overlapIdx = methods.indexOf("db.select[overlap]");
    const insertIdx = methods.indexOf("tx.insert.returning");

    expect(lockIdx, "advisory lock must be called").toBeGreaterThanOrEqual(0);
    expect(overlapIdx, "overlap check must be called").toBeGreaterThanOrEqual(0);
    expect(insertIdx, "insert must be called").toBeGreaterThanOrEqual(0);

    expect(lockIdx, "lock must come before overlap check").toBeLessThan(overlapIdx);
    expect(overlapIdx, "overlap check must come before insert").toBeLessThan(insertIdx);
  });

  it("advisory lock SQL contains the staffId as the lock key", async () => {
    const callLog: Array<{ method: string; args: unknown[] }> = [];
    patchDbSelect(callLog);

    (db.transaction as MockedFunction<typeof db.transaction>).mockImplementation(async (callback) =>
      callback(makeFakeTx(callLog) as never),
    );

    await createBooking(makeValidInput());

    const lockCall = callLog.find((c) => c.method === "tx.execute");
    expect(lockCall).toBeDefined();

    const serialized = JSON.stringify(lockCall!.args[0]);
    expect(serialized).toContain(STAFF_ID);
  });

  it("db.transaction is called exactly once", async () => {
    const callLog: Array<{ method: string; args: unknown[] }> = [];
    patchDbSelect(callLog);

    (db.transaction as MockedFunction<typeof db.transaction>).mockImplementation(async (callback) =>
      callback(makeFakeTx(callLog) as never),
    );

    await createBooking(makeValidInput());

    expect(db.transaction).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test group 2: overlap conflict aborts insert
// ─────────────────────────────────────────────────────────────────────────────

describe("createBooking — conflict aborts insert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("when overlap check finds a conflict, insert is never called", async () => {
    const callLog: Array<{ method: string; args: unknown[] }> = [];
    const fakeTx = makeFakeTx(callLog, { overlapConflict: true });

    // db.select used by hasOverlappingBooking — first call returns a conflicting row
    patchDbSelect(callLog, { overlapConflict: true });

    (db.transaction as MockedFunction<typeof db.transaction>).mockImplementation(
      async (callback) => {
        try {
          return await callback(fakeTx as never);
        } catch (err) {
          throw err;
        }
      },
    );

    const result = await createBooking(makeValidInput());

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("already has a booking");

    const methods = callLog.map((c) => c.method);
    expect(methods).not.toContain("tx.insert.returning");
  });

  it("advisory lock is acquired even when conflict is found (lock happens before check)", async () => {
    const callLog: Array<{ method: string; args: unknown[] }> = [];
    const fakeTx = makeFakeTx(callLog, { overlapConflict: true });

    patchDbSelect(callLog, { overlapConflict: true });

    (db.transaction as MockedFunction<typeof db.transaction>).mockImplementation(
      async (callback) => {
        try {
          return await callback(fakeTx as never);
        } catch {
          /* swallow for assertion */
        }
      },
    );

    await createBooking(makeValidInput());

    const methods = callLog.map((c) => c.method);
    expect(methods).toContain("tx.execute"); // lock was acquired
    expect(methods).toContain("db.select[overlap]"); // check ran
    expect(methods).not.toContain("tx.insert.returning"); // insert did not run
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test group 3: lock key is per-staff, not global
// ─────────────────────────────────────────────────────────────────────────────

describe("createBooking — lock key is scoped to staffId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("two different staffIds produce different advisory lock keys", async () => {
    const lockKeys: string[] = [];

    async function runWithStaff(staffId: string) {
      const callLog: Array<{ method: string; args: unknown[] }> = [];
      patchDbSelect(callLog);

      (db.transaction as MockedFunction<typeof db.transaction>).mockImplementationOnce(
        async (callback) => {
          const tx = makeFakeTx(callLog);
          const result = await callback(tx as never);
          const lockCall = callLog.find((c) => c.method === "tx.execute");
          if (lockCall) lockKeys.push(JSON.stringify(lockCall.args[0]));
          return result;
        },
      );

      await createBooking(makeValidInput({ staffId }));
    }

    await runWithStaff("staff-aaa");
    await runWithStaff("staff-bbb");

    expect(lockKeys).toHaveLength(2);
    expect(lockKeys[0]).not.toBe(lockKeys[1]);
    expect(lockKeys[0]).toContain("staff-aaa");
    expect(lockKeys[1]).toContain("staff-bbb");
  });

  it("no advisory lock is acquired when staffId is null", async () => {
    const callLog: Array<{ method: string; args: unknown[] }> = [];
    patchDbSelect(callLog);

    (db.transaction as MockedFunction<typeof db.transaction>).mockImplementation(async (callback) =>
      callback(makeFakeTx(callLog) as never),
    );

    await createBooking(makeValidInput({ staffId: null }));

    const methods = callLog.map((c) => c.method);
    expect(methods).not.toContain("tx.execute");
    expect(methods).toContain("tx.insert.returning");
  });

  it("lock key includes locationId when provided (location-scoped, not global)", async () => {
    const callLog: Array<{ method: string; args: unknown[] }> = [];
    patchDbSelect(callLog);

    (db.transaction as MockedFunction<typeof db.transaction>).mockImplementation(async (callback) =>
      callback(makeFakeTx(callLog) as never),
    );

    await createBooking(makeValidInput({ locationId: 7 }));

    const lockCall = callLog.find((c) => c.method === "tx.execute");
    expect(lockCall).toBeDefined();
    const serialized = JSON.stringify(lockCall!.args[0]);
    expect(serialized).toContain(STAFF_ID);
    expect(serialized).toContain("7");
  });
});
