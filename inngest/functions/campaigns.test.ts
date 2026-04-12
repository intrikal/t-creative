// @vitest-environment node

/**
 * inngest/functions/campaigns.test.ts
 *
 * Unit tests for the campaigns Inngest function (Zoho Campaigns sync).
 * Verifies: skipping when not configured, syncing unsynced profiles,
 * and graceful handling of per-profile sync failures.
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

const mockSyncSubscriber = vi.fn().mockResolvedValue(undefined);
const mockIsZohoConfigured = vi.fn().mockReturnValue(true);
const mockCaptureException = vi.fn();

const UNSYNCED_PROFILES = [
  { id: "p1", email: "alice@example.com", firstName: "Alice", lastName: "Smith", isVip: false, source: "web", tags: null, onboardingData: null },
  { id: "p2", email: "bob@example.com", firstName: "Bob", lastName: null, isVip: true, source: null, tags: ["vip"], onboardingData: { interests: ["photography"], birthday: "1990-05-15" } },
];

function makeDb(selectRows: Record<string, unknown>[][]) {
  let idx = 0;

  function makeChain(rows: Record<string, unknown>[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  return { select: vi.fn(() => makeChain(selectRows[idx++] ?? [])) };
}

function setupMocks(selectRows: Record<string, unknown>[][], zohoConfigured = true) {
  const db = makeDb(selectRows);
  mockIsZohoConfigured.mockReturnValue(zohoConfigured);

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      email: "email",
      firstName: "firstName",
      lastName: "lastName",
      isVip: "isVip",
      source: "source",
      tags: "tags",
      onboardingData: "onboardingData",
      notifyMarketing: "notifyMarketing",
      isActive: "isActive",
      zohoCampaignsContactKey: "zohoCampaignsContactKey",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
  }));
  vi.doMock("@/lib/zoho-campaigns", () => ({
    syncCampaignsSubscriber: mockSyncSubscriber,
    isZohoCampaignsConfigured: mockIsZohoConfigured,
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
}

async function runHandler() {
  const mod = await import("@/inngest/functions/campaigns");
  const fn = (mod.campaigns as any)?.handler ?? mod.campaigns;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("campaigns", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns early with 'not configured' message when Zoho is not set up", async () => {
    setupMocks([[]], false);

    const result = await runHandler();

    expect(result).toMatchObject({ message: expect.stringContaining("not configured") });
    expect(mockSyncSubscriber).not.toHaveBeenCalled();
  });

  it("syncs all unsynced profiles and returns correct counts", async () => {
    setupMocks([UNSYNCED_PROFILES]);

    const result = await runHandler();

    expect(mockSyncSubscriber).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ found: 2, synced: 2, failed: 0 });
  });

  it("counts failures without throwing when a single sync fails", async () => {
    mockSyncSubscriber
      .mockResolvedValueOnce(undefined) // first profile ok
      .mockRejectedValueOnce(new Error("Zoho API 503")); // second fails
    setupMocks([UNSYNCED_PROFILES]);

    const result = await runHandler();

    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(result).toEqual({ found: 2, synced: 1, failed: 1 });
  });

  it("returns 0 synced when there are no unsynced profiles", async () => {
    setupMocks([[]]); // empty profiles (zoho configured)

    const result = await runHandler();

    expect(mockSyncSubscriber).not.toHaveBeenCalled();
    expect(result).toEqual({ found: 0, synced: 0, failed: 0 });
  });
});
