// @vitest-environment node

/**
 * inngest/functions/instagram-sync.test.ts
 *
 * Unit tests for the instagram-sync Inngest function.
 * Verifies: posts fetched and upserted when Instagram is configured,
 * early exit when not configured, and API errors are caught and logged
 * via Sentry without propagating.
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

const mockIsInstagramConfigured = vi.fn().mockReturnValue(true);
const mockFetchRecentMedia = vi.fn();
const mockCaptureException = vi.fn();

const MEDIA_POST = {
  id: "ig-post-1",
  username: "tcreative",
  media_type: "IMAGE",
  media_url: "https://cdn.instagram.com/photo.jpg",
  thumbnail_url: null,
  permalink: "https://www.instagram.com/p/abc123/",
  caption: "Behind the scenes ✨",
  timestamp: "2025-01-15T10:00:00Z",
};

function makeDb() {
  const insertCalls: Record<string, unknown>[] = [];
  const updateCalls: Record<string, unknown>[] = [];

  function makeChain(rows: Record<string, unknown>[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  return {
    _insertCalls: insertCalls,
    _updateCalls: updateCalls,
    select: vi.fn(() => makeChain([])),
    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: Record<string, unknown>) => {
        insertCalls.push(values);
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updateCalls.push(values);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
  };
}

function setupMocks(
  db: ReturnType<typeof makeDb>,
  opts: { instagramConfigured?: boolean; mediaResult?: unknown[] | Error } = {},
) {
  const { instagramConfigured = true, mediaResult = [MEDIA_POST] } = opts;
  mockIsInstagramConfigured.mockReturnValue(instagramConfigured);

  if (mediaResult instanceof Error) {
    mockFetchRecentMedia.mockRejectedValue(mediaResult);
  } else {
    mockFetchRecentMedia.mockResolvedValue(mediaResult);
  }

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    instagramPosts: {
      igMediaId: "igMediaId",
      igUsername: "igUsername",
      mediaType: "mediaType",
      mediaUrl: "mediaUrl",
      thumbnailUrl: "thumbnailUrl",
      permalink: "permalink",
      caption: "caption",
      postedAt: "postedAt",
      isVisible: "isVisible",
    },
    syncLog: {
      id: "id",
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      localId: "localId",
      message: "message",
      errorMessage: "errorMessage",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    notInArray: vi.fn((...a: unknown[]) => ({ type: "notInArray", a })),
  }));
  vi.doMock("@/lib/instagram", () => ({
    isInstagramConfigured: mockIsInstagramConfigured,
    fetchRecentMedia: mockFetchRecentMedia,
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
}

async function runHandler() {
  const mod = await import("@/inngest/functions/instagram-sync");
  const fn = (mod.instagramSync as any)?.handler ?? mod.instagramSync;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("instagram-sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("fetches posts and upserts to DB when Instagram is configured", async () => {
    const db = makeDb();
    setupMocks(db, { mediaResult: [MEDIA_POST] });

    const result = await runHandler();

    expect(mockFetchRecentMedia).toHaveBeenCalledOnce();
    expect(db.insert).toHaveBeenCalled();
    expect(result).toEqual({ synced: 1, failed: 0 });
  });

  it("returns skipped when Instagram is not configured", async () => {
    const db = makeDb();
    setupMocks(db, { instagramConfigured: false });

    const result = await runHandler();

    expect(mockFetchRecentMedia).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: true, reason: "Instagram not configured" });
  });

  it("catches API error, logs to Sentry, and re-throws from step (step will handle retry)", async () => {
    const db = makeDb();
    const apiError = new Error("Instagram API rate limit exceeded");
    setupMocks(db, { mediaResult: apiError });

    await expect(runHandler()).rejects.toThrow("Instagram API rate limit exceeded");

    expect(mockCaptureException).toHaveBeenCalledWith(apiError);
    // A sync_log failure entry should be inserted
    expect(db.insert).toHaveBeenCalled();
    const insertArgs = db._insertCalls[0];
    expect(insertArgs).toMatchObject({ status: "failed", provider: "instagram" });
  });

  it("hides old posts that are no longer in the latest fetch", async () => {
    const db = makeDb();
    setupMocks(db, { mediaResult: [MEDIA_POST] });

    await runHandler();

    // update should be called to hide old posts
    expect(db.update).toHaveBeenCalled();
    const updateSet = db._updateCalls[0];
    expect(updateSet).toMatchObject({ isVisible: false });
  });

  it("handles empty media response gracefully", async () => {
    const db = makeDb();
    setupMocks(db, { mediaResult: [] });

    const result = await runHandler();

    expect(result).toEqual({ synced: 0, failed: 0 });
  });
});
