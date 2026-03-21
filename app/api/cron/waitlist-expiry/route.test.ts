/**
 * Tests for GET /api/cron/waitlist-expiry — advance waitlist queue after
 * claim token expiry.
 *
 * Covers:
 *  - Auth: missing or wrong x-cron-secret returns 401
 *  - Empty waitlist: no expired "notified" entries → zero counts,
 *    notifyNextWaitlistEntry never called
 *  - Token clearing: expired entry → update sets status="expired",
 *    claimToken=null, claimTokenExpiresAt=null
 *  - Queue advancement: expired entry with future offeredSlotStartsAt →
 *    calls notifyNextWaitlistEntry with serviceId and slot details,
 *    returns advanced=1
 *  - Past slot: offeredSlotStartsAt in the past → skips re-offering,
 *    returns skippedPastSlots=1
 *  - Null slot: offeredSlotStartsAt is null → skips, skippedPastSlots=1
 *  - Mixed entries: 2 entries (1 future, 1 past) → expired=2, advanced=1,
 *    skippedPastSlots=1
 *  - Error resilience: notifyNextWaitlistEntry throws on first entry →
 *    continues processing second entry (both attempted)
 *
 * Mocks: db (select/update chains), notifyNextWaitlistEntry,
 * drizzle-orm operators, Sentry.
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

const mockNotifyNextWaitlistEntry = vi.fn();
const mockWhere = vi.fn();
const mockUpdateSet = vi.fn();

function buildDb(expiredEntries: unknown[] = []) {
  // select().from().where() returns the expired entries
  const selectWhere = vi.fn().mockResolvedValue(expiredEntries);
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  // update().set().where() used to mark entries as expired
  mockWhere.mockResolvedValue(undefined);
  mockUpdateSet.mockReturnValue({ where: mockWhere });
  const update = vi.fn().mockReturnValue({ set: mockUpdateSet });

  return { select, update };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/waitlist-expiry", () => {
  let GET: (request: Request) => Promise<Response>;

  const now = new Date("2026-03-18T12:00:00Z");
  // A slot in the future relative to our fixed "now"
  const futureSlot = new Date("2026-03-19T10:00:00Z");
  // A slot already in the past
  const pastSlot = new Date("2026-03-17T10:00:00Z");

  function makeExpiredEntry(overrides: Record<string, unknown> = {}) {
    return {
      id: 1,
      serviceId: 10,
      offeredSlotStartsAt: futureSlot,
      offeredStaffId: "staff-1",
      ...overrides,
    };
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockNotifyNextWaitlistEntry.mockResolvedValue(undefined);

    vi.resetModules();

    // Default: empty waitlist (no expired entries)
    vi.doMock("@/db", () => ({ db: buildDb([]) }));

    vi.doMock("@/db/schema", () => ({
      waitlist: {
        id: "id",
        serviceId: "serviceId",
        status: "status",
        claimToken: "claimToken",
        claimTokenExpiresAt: "claimTokenExpiresAt",
        offeredSlotStartsAt: "offeredSlotStartsAt",
        offeredStaffId: "offeredStaffId",
      },
    }));

    vi.doMock("@/lib/waitlist-notify", () => ({
      notifyNextWaitlistEntry: mockNotifyNextWaitlistEntry,
    }));

    vi.doMock("drizzle-orm", () => ({
      and: vi.fn(),
      eq: vi.fn(),
      lt: vi.fn(),
    }));

    vi.doMock("@sentry/nextjs", () => ({
      captureException: vi.fn(),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string): Request {
    return new Request("https://example.com/api/cron/waitlist-expiry", {
      headers: secret ? { "x-cron-secret": secret } : {},
    });
  }

  /* ---------- Auth ---------- */

  it("returns 401 when x-cron-secret header is missing", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when x-cron-secret header is wrong", async () => {
    const res = await GET(makeGet("bad-secret"));
    expect(res.status).toBe(401);
  });

  /* ---------- Empty waitlist ---------- */

  it("returns zero counts when there are no expired entries", async () => {
    const res = await GET(makeGet("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(0);
    expect(body.advanced).toBe(0);
    expect(body.skippedPastSlots).toBe(0);
    expect(mockNotifyNextWaitlistEntry).not.toHaveBeenCalled();
  });

  /* ---------- Expiry + queue advancement ---------- */

  it("marks expired entries as expired and clears their tokens", async () => {
    vi.resetModules();
    const entry = makeExpiredEntry({ id: 5 });
    vi.doMock("@/db", () => ({ db: buildDb([entry]) }));
    vi.doMock("@/db/schema", () => ({
      waitlist: {
        id: "id",
        serviceId: "serviceId",
        status: "status",
        claimToken: "claimToken",
        claimTokenExpiresAt: "claimTokenExpiresAt",
        offeredSlotStartsAt: "offeredSlotStartsAt",
        offeredStaffId: "offeredStaffId",
      },
    }));
    vi.doMock("@/lib/waitlist-notify", () => ({
      notifyNextWaitlistEntry: mockNotifyNextWaitlistEntry,
    }));
    vi.doMock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), lt: vi.fn() }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    await mod.GET(makeGet("test-cron-secret"));

    expect(mockUpdateSet).toHaveBeenCalledWith({
      status: "expired",
      claimToken: null,
      claimTokenExpiresAt: null,
    });
  });

  it("calls notifyNextWaitlistEntry for entries with a future slot", async () => {
    vi.resetModules();
    const entry = makeExpiredEntry({ offeredSlotStartsAt: futureSlot });
    vi.doMock("@/db", () => ({ db: buildDb([entry]) }));
    vi.doMock("@/db/schema", () => ({
      waitlist: {
        id: "id",
        serviceId: "serviceId",
        status: "status",
        claimToken: "claimToken",
        claimTokenExpiresAt: "claimTokenExpiresAt",
        offeredSlotStartsAt: "offeredSlotStartsAt",
        offeredStaffId: "offeredStaffId",
      },
    }));
    vi.doMock("@/lib/waitlist-notify", () => ({
      notifyNextWaitlistEntry: mockNotifyNextWaitlistEntry,
    }));
    vi.doMock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), lt: vi.fn() }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const res = await mod.GET(makeGet("test-cron-secret"));
    const body = await res.json();

    expect(mockNotifyNextWaitlistEntry).toHaveBeenCalledOnce();
    expect(mockNotifyNextWaitlistEntry).toHaveBeenCalledWith({
      serviceId: entry.serviceId,
      offeredSlotStartsAt: entry.offeredSlotStartsAt,
      offeredStaffId: entry.offeredStaffId,
    });
    expect(body.advanced).toBe(1);
    expect(body.skippedPastSlots).toBe(0);
  });

  it("skips queue advancement when offeredSlotStartsAt is in the past", async () => {
    vi.resetModules();
    const entry = makeExpiredEntry({ offeredSlotStartsAt: pastSlot });
    vi.doMock("@/db", () => ({ db: buildDb([entry]) }));
    vi.doMock("@/db/schema", () => ({
      waitlist: {
        id: "id",
        serviceId: "serviceId",
        status: "status",
        claimToken: "claimToken",
        claimTokenExpiresAt: "claimTokenExpiresAt",
        offeredSlotStartsAt: "offeredSlotStartsAt",
        offeredStaffId: "offeredStaffId",
      },
    }));
    vi.doMock("@/lib/waitlist-notify", () => ({
      notifyNextWaitlistEntry: mockNotifyNextWaitlistEntry,
    }));
    vi.doMock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), lt: vi.fn() }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const res = await mod.GET(makeGet("test-cron-secret"));
    const body = await res.json();

    expect(mockNotifyNextWaitlistEntry).not.toHaveBeenCalled();
    expect(body.advanced).toBe(0);
    expect(body.skippedPastSlots).toBe(1);
  });

  it("skips queue advancement when offeredSlotStartsAt is null", async () => {
    vi.resetModules();
    const entry = makeExpiredEntry({ offeredSlotStartsAt: null });
    vi.doMock("@/db", () => ({ db: buildDb([entry]) }));
    vi.doMock("@/db/schema", () => ({
      waitlist: {
        id: "id",
        serviceId: "serviceId",
        status: "status",
        claimToken: "claimToken",
        claimTokenExpiresAt: "claimTokenExpiresAt",
        offeredSlotStartsAt: "offeredSlotStartsAt",
        offeredStaffId: "offeredStaffId",
      },
    }));
    vi.doMock("@/lib/waitlist-notify", () => ({
      notifyNextWaitlistEntry: mockNotifyNextWaitlistEntry,
    }));
    vi.doMock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), lt: vi.fn() }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const res = await mod.GET(makeGet("test-cron-secret"));
    const body = await res.json();

    expect(mockNotifyNextWaitlistEntry).not.toHaveBeenCalled();
    expect(body.skippedPastSlots).toBe(1);
  });

  /* ---------- Return shape ---------- */

  it("returns expired count matching the number of entries found", async () => {
    vi.resetModules();
    const entries = [
      makeExpiredEntry({ id: 1, offeredSlotStartsAt: futureSlot }),
      makeExpiredEntry({ id: 2, offeredSlotStartsAt: pastSlot }),
    ];
    vi.doMock("@/db", () => ({ db: buildDb(entries) }));
    vi.doMock("@/db/schema", () => ({
      waitlist: {
        id: "id",
        serviceId: "serviceId",
        status: "status",
        claimToken: "claimToken",
        claimTokenExpiresAt: "claimTokenExpiresAt",
        offeredSlotStartsAt: "offeredSlotStartsAt",
        offeredStaffId: "offeredStaffId",
      },
    }));
    vi.doMock("@/lib/waitlist-notify", () => ({
      notifyNextWaitlistEntry: mockNotifyNextWaitlistEntry,
    }));
    vi.doMock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), lt: vi.fn() }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const res = await mod.GET(makeGet("test-cron-secret"));
    const body = await res.json();

    expect(body.expired).toBe(2);
    expect(body.advanced).toBe(1);
    expect(body.skippedPastSlots).toBe(1);
  });

  /* ---------- Error handling ---------- */

  it("continues processing remaining entries when notifyNextWaitlistEntry throws", async () => {
    vi.resetModules();
    const entries = [
      makeExpiredEntry({ id: 1, offeredSlotStartsAt: futureSlot }),
      makeExpiredEntry({ id: 2, offeredSlotStartsAt: futureSlot }),
    ];
    const localNotify = vi
      .fn()
      .mockRejectedValueOnce(new Error("email send failed"))
      .mockResolvedValue(undefined);

    vi.doMock("@/db", () => ({ db: buildDb(entries) }));
    vi.doMock("@/db/schema", () => ({
      waitlist: {
        id: "id",
        serviceId: "serviceId",
        status: "status",
        claimToken: "claimToken",
        claimTokenExpiresAt: "claimTokenExpiresAt",
        offeredSlotStartsAt: "offeredSlotStartsAt",
        offeredStaffId: "offeredStaffId",
      },
    }));
    vi.doMock("@/lib/waitlist-notify", () => ({ notifyNextWaitlistEntry: localNotify }));
    vi.doMock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), lt: vi.fn() }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const res = await mod.GET(makeGet("test-cron-secret"));

    // Should not throw — error is caught per-entry
    expect(res.status).toBe(200);
    // Second entry should still have been attempted
    expect(localNotify).toHaveBeenCalledTimes(2);
  });
});
