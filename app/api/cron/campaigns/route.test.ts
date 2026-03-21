/**
 * Tests for GET /api/cron/campaigns — Zoho Campaigns batch sync.
 *
 * Covers:
 *  - Auth: missing or wrong x-cron-secret returns 401
 *  - Not configured: Zoho Campaigns env vars missing → 200 with skip message
 *  - No-op: no unsynced profiles → zero counts, no sync calls
 *  - Happy path: two unsynced profiles → syncs both, extracts interests
 *    and birthday from onboardingData JSON
 *  - Error handling: syncCampaignsSubscriber throws → increments failed counter,
 *    captured by Sentry
 *
 * Mocks: db (select chain), syncCampaignsSubscriber,
 * isZohoCampaignsConfigured, Sentry.
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
const mockSyncCampaigns = vi.fn();
const mockIsZohoCampaignsConfigured = vi.fn();

function buildDb() {
  return {
    select: vi.fn().mockImplementation(() => {
      const idx = selectIdx++;
      const rows = selectData[idx] ?? [];
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi
        .fn()
        .mockReturnValue(Object.assign([...rows], { limit: vi.fn().mockReturnValue(rows) }));
      chain.limit = vi.fn().mockReturnValue(rows);
      return chain;
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/campaigns", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectIdx = 0;
    selectData = [];
    mockSyncCampaigns.mockResolvedValue(undefined);
    mockIsZohoCampaignsConfigured.mockReturnValue(true);
    process.env.CRON_SECRET = "test-secret";

    vi.resetModules();

    vi.doMock("@/db", () => ({ db: buildDb() }));
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
    vi.doMock("@/lib/zoho-campaigns", () => ({
      syncCampaignsSubscriber: mockSyncCampaigns,
      isZohoCampaignsConfigured: mockIsZohoCampaignsConfigured,
    }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string) {
    return new Request("https://example.com/api/cron/campaigns", {
      headers: secret ? { "x-cron-secret": secret } : {},
    });
  }

  /* ---------- Auth ---------- */

  it("returns 401 without x-cron-secret header", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await GET(makeGet("bad"));
    expect(res.status).toBe(401);
  });

  /* ---------- Not configured ---------- */

  it("returns 200 with skip message when Zoho Campaigns is not configured", async () => {
    mockIsZohoCampaignsConfigured.mockReturnValueOnce(false);

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ message: expect.stringContaining("not configured") });
    expect(mockSyncCampaigns).not.toHaveBeenCalled();
  });

  /* ---------- No-op ---------- */

  it("returns zero counts when no unsynced profiles exist", async () => {
    selectData[0] = [];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ found: 0, synced: 0, failed: 0 });
    expect(mockSyncCampaigns).not.toHaveBeenCalled();
  });

  /* ---------- Happy path ---------- */

  it("syncs profiles and returns correct counts", async () => {
    selectData[0] = [
      {
        id: "p1",
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        isVip: false,
        source: "referral",
        tags: ["vip"],
        onboardingData: { interests: ["color", "cut"], birthday: "04/15" },
      },
      {
        id: "p2",
        email: "bob@example.com",
        firstName: "Bob",
        lastName: null,
        isVip: true,
        source: null,
        tags: null,
        onboardingData: {},
      },
    ];

    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ found: 2, synced: 2, failed: 0 });
    expect(mockSyncCampaigns).toHaveBeenCalledTimes(2);
    expect(mockSyncCampaigns).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "p1",
        email: "alice@example.com",
        interests: "color, cut",
        birthday: "04/15",
      }),
    );
  });

  it("counts failures when syncCampaignsSubscriber throws", async () => {
    selectData[0] = [
      {
        id: "p1",
        email: "a@b.com",
        firstName: "A",
        lastName: null,
        isVip: false,
        source: null,
        tags: null,
        onboardingData: {},
      },
    ];
    mockSyncCampaigns.mockRejectedValueOnce(new Error("Zoho error"));

    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ found: 1, synced: 0, failed: 1 });
  });
});
