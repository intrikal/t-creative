// @vitest-environment node

/**
 * inngest/functions/waitlist-expiry.test.ts
 *
 * Unit tests for the waitlist-expiry Inngest function.
 * Verifies that expired entries are marked "expired", future entries are
 * left untouched, and the return value contains the correct expired count.
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

const mockNotifyNext = vi.fn().mockResolvedValue(undefined);
const mockCaptureException = vi.fn();

// Stateful update tracker
let updateCalls: Array<{ values: Record<string, unknown> }> = [];

function makeDb(selectRows: Record<string, unknown>[][]) {
  let selectIdx = 0;

  function makeChain(rows: Record<string, unknown>[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      select: () => chain,
      limit: () => chain,
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  return {
    select: vi.fn(() => makeChain(selectRows[selectIdx++] ?? [])),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updateCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
  };
}

function setupMocks(selectRows: Record<string, unknown>[][]) {
  const db = makeDb(selectRows);

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    waitlist: {
      id: "id",
      status: "status",
      serviceId: "serviceId",
      offeredSlotStartsAt: "offeredSlotStartsAt",
      offeredStaffId: "offeredStaffId",
      claimToken: "claimToken",
      claimTokenExpiresAt: "claimTokenExpiresAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    lt: vi.fn((...a: unknown[]) => ({ type: "lt", a })),
  }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyNextWaitlistEntry: mockNotifyNext,
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
}

async function runHandler() {
  const mod = await import("@/inngest/functions/waitlist-expiry");
  const fn = (mod.waitlistExpiry as any)?.handler ?? mod.waitlistExpiry;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("waitlist-expiry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    updateCalls = [];
  });

  it("marks expired entries as 'expired' and advances the slot when it is in the future", async () => {
    const futureSlot = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1 hour
    setupMocks([
      [{ id: "w1", serviceId: "svc1", offeredSlotStartsAt: futureSlot, offeredStaffId: "staff1" }],
    ]);

    const result = await runHandler();

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].values).toMatchObject({
      status: "expired",
      claimToken: null,
      claimTokenExpiresAt: null,
    });
    expect(mockNotifyNext).toHaveBeenCalledOnce();
    expect(result).toEqual({ expired: 1, advanced: 1, skippedPastSlots: 0 });
  });

  it("skips advancing when the offered slot is in the past", async () => {
    const pastSlot = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // -1 hour
    setupMocks([
      [{ id: "w2", serviceId: "svc1", offeredSlotStartsAt: pastSlot, offeredStaffId: null }],
    ]);

    const result = await runHandler();

    expect(updateCalls.length).toBe(1); // still marked expired
    expect(mockNotifyNext).not.toHaveBeenCalled();
    expect(result).toEqual({ expired: 1, advanced: 0, skippedPastSlots: 1 });
  });

  it("returns expired: 0 when no entries have expired tokens", async () => {
    setupMocks([[]]); // empty query result

    const result = await runHandler();

    expect(updateCalls.length).toBe(0);
    expect(mockNotifyNext).not.toHaveBeenCalled();
    expect(result).toEqual({ expired: 0, advanced: 0, skippedPastSlots: 0 });
  });

  it("counts failed notify attempts but does not throw", async () => {
    const futureSlot = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockNotifyNext.mockRejectedValueOnce(new Error("sms failed"));
    setupMocks([
      [{ id: "w3", serviceId: "svc2", offeredSlotStartsAt: futureSlot, offeredStaffId: null }],
    ]);

    const result = await runHandler();

    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(result).toEqual({ expired: 1, advanced: 0, skippedPastSlots: 0 });
  });
});
