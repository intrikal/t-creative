/**
 * Tests for GET /api/cron/membership-reminders — membership cycle renewal
 * reminder email sender.
 *
 * Covers:
 *  - Auth: missing or wrong CRON_SECRET returns 401
 *  - Happy path: active membership renewing in 3 days with unused fills →
 *    sends reminder email with fill count and cycle end date, returns
 *    matched=1, sent=1
 *  - Deduplication: existing sync_log entry for this subscription+cycle →
 *    skipped=1, no email sent
 *  - No upcoming renewals: candidates query returns empty → zero counts
 *  - Preference check: notifyEmail=false → skipped=1, no email sent
 *
 * Mocks: db (select chain), sendEmail, MembershipReminder component,
 * drizzle-orm operators, date-fns format.
 */
// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

let selectIdx = 0;
let selectData: unknown[][] = [];
const mockSendEmail = vi.fn();

function buildDb() {
  return {
    select: vi.fn().mockImplementation(() => {
      const idx = selectIdx++;
      const rows = selectData[idx] ?? [];
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi
        .fn()
        .mockReturnValue(Object.assign([...rows], { limit: vi.fn().mockReturnValue(rows) }));
      chain.limit = vi.fn().mockReturnValue(rows);
      return chain;
    }),
  };
}

/** Returns a Date offset by `daysFromNow` days relative to now. */
function makeCycleDate(daysFromNow: number): Date {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

/** A membership candidate shaped the way the route expects from the join query. */
function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    subscriptionId: 1,
    clientId: "client-1",
    fillsRemainingThisCycle: 2,
    cycleEndsAt: makeCycleDate(3),
    planName: "Classic Membership",
    fillsPerCycle: 4,
    clientEmail: "alice@example.com",
    clientFirstName: "Alice",
    notifyEmail: true,
    ...overrides,
  };
}

/** A minimal admin profile shaped the way the route expects. */
function makeAdminProfile(overrides: Record<string, unknown> = {}) {
  return {
    onboardingData: { studioName: "Test Studio", ...overrides },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/membership-reminders", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectIdx = 0;
    selectData = [];
    mockSendEmail.mockResolvedValue(true);
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

    vi.resetModules();

    vi.doMock("@/db", () => ({ db: buildDb() }));
    vi.doMock("@/db/schema", () => ({
      membershipPlans: {
        id: "id",
        name: "name",
        fillsPerCycle: "fillsPerCycle",
      },
      membershipSubscriptions: {
        id: "id",
        clientId: "clientId",
        planId: "planId",
        status: "status",
        fillsRemainingThisCycle: "fillsRemainingThisCycle",
        cycleEndsAt: "cycleEndsAt",
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
        entityType: "entityType",
        localId: "localId",
        status: "status",
      },
    }));
    vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
    vi.doMock("@/emails/MembershipReminder", () => ({
      MembershipReminder: vi.fn().mockReturnValue("email-component"),
    }));
    vi.doMock("drizzle-orm", () => ({
      and: (...args: unknown[]) => args,
      eq: (...args: unknown[]) => args,
      gte: (...args: unknown[]) => args,
      lte: (...args: unknown[]) => args,
    }));
    vi.doMock("date-fns", () => ({
      format: vi.fn().mockReturnValue("April 1"),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string) {
    return new Request("https://example.com/api/cron/membership-reminders", {
      headers: secret ? { "x-cron-secret": secret } : {},
    });
  }

  /* ---------- Auth ---------- */

  it("returns 401 when CRON_SECRET is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    const res = await GET(makeGet("wrong-secret"));
    expect(res.status).toBe(401);
  });

  /* ---------- Happy path ---------- */

  it("sends reminder for memberships renewing within window", async () => {
    // selectIdx 0: candidates query
    selectData[0] = [makeCandidate()];
    // selectIdx 1: admin profile
    selectData[1] = [makeAdminProfile()];
    // selectIdx 2: syncLog lookup for the candidate → no existing entry
    selectData[2] = [];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 1, failed: 0, skipped: 0 });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "membership_cycle_reminder",
      }),
    );
  });

  /* ---------- Deduplication ---------- */

  it("skips already-reminded memberships (idempotent)", async () => {
    // selectIdx 0: candidates query
    selectData[0] = [makeCandidate()];
    // selectIdx 1: admin profile
    selectData[1] = [makeAdminProfile()];
    // selectIdx 2: syncLog lookup → existing entry found
    selectData[2] = [{ id: 42 }];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 0, failed: 0, skipped: 1 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  /* ---------- No upcoming renewals ---------- */

  it("handles no upcoming renewals gracefully", async () => {
    // selectIdx 0: candidates query returns empty
    selectData[0] = [];
    // selectIdx 1: admin profile
    selectData[1] = [makeAdminProfile()];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ matched: 0, sent: 0, failed: 0, skipped: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  /* ---------- notifyEmail disabled ---------- */

  it("skips candidates without email notifications enabled", async () => {
    // selectIdx 0: candidates query — candidate has notifyEmail: false
    selectData[0] = [makeCandidate({ notifyEmail: false })];
    // selectIdx 1: admin profile
    selectData[1] = [makeAdminProfile()];
    // No syncLog lookup expected since candidate is skipped early

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ matched: 1, sent: 0, failed: 0, skipped: 1 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
