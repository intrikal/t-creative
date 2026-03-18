import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockFetchRecentMedia = vi.fn();
const mockIsInstagramConfigured = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();

function buildDb() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  mockInsertValues.mockReturnValue({ onConflictDoUpdate });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  mockUpdateSet.mockReturnValue({ where: updateWhere });

  return {
    insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
    update: vi.fn().mockReturnValue({ set: mockUpdateSet }),
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/instagram-sync", () => {
  let GET: (request: Request) => Promise<Response>;

  const fakePost = (id: string) => ({
    id,
    username: "lashedbytrini_",
    media_type: "IMAGE" as const,
    media_url: `https://cdn.instagram.com/${id}.jpg`,
    permalink: `https://www.instagram.com/p/${id}/`,
    timestamp: "2026-03-18T10:00:00+0000",
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";

    // Default: Instagram is configured, returns two posts
    mockIsInstagramConfigured.mockReturnValue(true);
    mockFetchRecentMedia.mockResolvedValue([fakePost("post_1"), fakePost("post_2")]);

    vi.resetModules();

    vi.doMock("@/lib/instagram", () => ({
      fetchRecentMedia: mockFetchRecentMedia,
      isInstagramConfigured: mockIsInstagramConfigured,
    }));

    vi.doMock("@/db", () => ({ db: buildDb() }));

    vi.doMock("@/db/schema", () => ({
      instagramPosts: { igMediaId: "igMediaId", isVisible: "isVisible" },
      syncLog: {},
    }));

    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn(),
      notInArray: vi.fn(),
    }));

    vi.doMock("@sentry/nextjs", () => ({
      captureException: vi.fn(),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string): Request {
    return new Request("https://example.com/api/cron/instagram-sync", {
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
    const res = await GET(makeGet("wrong-secret"));
    expect(res.status).toBe(401);
  });

  /* ---------- Instagram not configured ---------- */

  it("returns 200 with skipped:true when Instagram is not configured", async () => {
    mockIsInstagramConfigured.mockReturnValue(false);
    const res = await GET(makeGet("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toMatch(/not configured/i);
    expect(mockFetchRecentMedia).not.toHaveBeenCalled();
  });

  /* ---------- Happy path ---------- */

  it("calls fetchRecentMedia with the max posts limit", async () => {
    await GET(makeGet("test-cron-secret"));
    expect(mockFetchRecentMedia).toHaveBeenCalledOnce();
    expect(mockFetchRecentMedia).toHaveBeenCalledWith(12);
  });

  it("upserts each fetched post into the DB", async () => {
    await GET(makeGet("test-cron-secret"));
    // One insert().values() call per post, plus one for the sync_log
    expect(mockInsertValues).toHaveBeenCalledTimes(3);
  });

  it("inserts post data including igMediaId, mediaUrl, and isVisible:true", async () => {
    await GET(makeGet("test-cron-secret"));
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        igMediaId: "post_1",
        mediaUrl: "https://cdn.instagram.com/post_1.jpg",
        isVisible: true,
      }),
    );
  });

  it("returns synced count of 2 when two posts are fetched", async () => {
    const res = await GET(makeGet("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(2);
    expect(body.failed).toBe(0);
  });

  it("hides posts not in the latest fetch by setting isVisible:false", async () => {
    await GET(makeGet("test-cron-secret"));
    // update().set() should be called once for the hide-old-posts step
    expect(mockUpdateSet).toHaveBeenCalledWith({ isVisible: false });
  });

  it("writes a success sync_log entry after syncing", async () => {
    await GET(makeGet("test-cron-secret"));
    // Last insert().values() call should be the sync_log entry
    const syncLogCall = mockInsertValues.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(syncLogCall).toBeDefined();
    expect(syncLogCall.provider).toBe("instagram");
    expect(syncLogCall.status).toBe("success");
  });

  /* ---------- Zero posts ---------- */

  it("returns synced:0 when fetchRecentMedia returns empty array", async () => {
    mockFetchRecentMedia.mockResolvedValue([]);

    const res = await GET(makeGet("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(0);
    expect(body.failed).toBe(0);
    // No insert for posts, but sync_log insert still runs
    expect(mockInsertValues).toHaveBeenCalledOnce(); // only sync_log
  });

  it("skips hide-old-posts update when no posts are fetched", async () => {
    mockFetchRecentMedia.mockResolvedValue([]);
    await GET(makeGet("test-cron-secret"));
    // update().set() should NOT be called when media is empty
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  /* ---------- Error handling ---------- */

  it("returns 500 when fetchRecentMedia throws", async () => {
    mockFetchRecentMedia.mockRejectedValue(new Error("Instagram API rate limited"));

    const res = await GET(makeGet("test-cron-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Sync failed");
  });

  it("writes a failed sync_log entry when fetchRecentMedia throws", async () => {
    mockFetchRecentMedia.mockRejectedValue(new Error("Token expired"));

    await GET(makeGet("test-cron-secret"));
    const syncLogCall = mockInsertValues.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(syncLogCall).toBeDefined();
    expect(syncLogCall.provider).toBe("instagram");
    expect(syncLogCall.status).toBe("failed");
    expect(syncLogCall.errorMessage).toBe("Token expired");
  });

  it("counts individual post failures and continues syncing remaining posts", async () => {
    // First post insert throws, second succeeds
    const onConflictDoUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error("DB constraint"))
      .mockResolvedValue(undefined);
    mockInsertValues.mockReturnValue({ onConflictDoUpdate });

    const res = await GET(makeGet("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(1);
    expect(body.failed).toBe(1);
  });

  it("writes sync_log with failed status when any post insert fails", async () => {
    const onConflictDoUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error("insert error"))
      .mockResolvedValue(undefined);
    mockInsertValues.mockReturnValue({ onConflictDoUpdate });

    await GET(makeGet("test-cron-secret"));
    const syncLogCall = mockInsertValues.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(syncLogCall.status).toBe("failed");
  });
});
