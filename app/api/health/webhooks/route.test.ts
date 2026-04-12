// @vitest-environment node

/**
 * Tests for GET /api/health/webhooks — Webhook health status endpoint.
 *
 * Covers:
 *  - Happy path: no failures → status "healthy", failureCountLastHour: 0
 *  - Degraded: 1–4 failures → status "degraded"
 *  - Failing: 5+ failures → status "failing"
 *  - lastSuccessfulWebhook: present when Redis has a value, null when absent
 *  - Response shape includes lastSuccessfulWebhook, failureCountLastHour, status
 *
 * Mocks: @/lib/auth (requireAdmin), @/lib/redis (redis.get).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockRequireAdmin = vi.fn();
const mockRedisGet = vi.fn();

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/health/webhooks", () => {
  let GET: () => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    // Default: no failures, no timestamp
    mockRedisGet.mockResolvedValue(null);

    vi.resetModules();

    vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
    vi.doMock("@/lib/redis", () => ({ redis: { get: mockRedisGet } }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  /* ---------- Status thresholds ---------- */

  it('returns status "healthy" when there are zero failures', async () => {
    mockRedisGet.mockResolvedValueOnce(null); // last_success
    mockRedisGet.mockResolvedValueOnce(null); // sig_failures (null → 0)

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.failureCountLastHour).toBe(0);
  });

  it('returns status "degraded" with 1 failure', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisGet.mockResolvedValueOnce(1);

    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.failureCountLastHour).toBe(1);
  });

  it('returns status "degraded" with 4 failures', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisGet.mockResolvedValueOnce(4);

    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.failureCountLastHour).toBe(4);
  });

  it('returns status "failing" with 5 failures', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisGet.mockResolvedValueOnce(5);

    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("failing");
    expect(body.failureCountLastHour).toBe(5);
  });

  it('returns status "failing" with more than 5 failures', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisGet.mockResolvedValueOnce(12);

    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("failing");
    expect(body.failureCountLastHour).toBe(12);
  });

  /* ---------- lastSuccessfulWebhook ---------- */

  it("includes lastSuccessfulWebhook timestamp when Redis has a value", async () => {
    const ts = "2026-04-12T10:00:00.000Z";
    mockRedisGet.mockResolvedValueOnce(ts); // last_success
    mockRedisGet.mockResolvedValueOnce(0);  // sig_failures

    const res = await GET();
    const body = await res.json();
    expect(body.lastSuccessfulWebhook).toBe(ts);
  });

  it("returns lastSuccessfulWebhook as null when Redis has no value", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisGet.mockResolvedValueOnce(null);

    const res = await GET();
    const body = await res.json();
    expect(body.lastSuccessfulWebhook).toBeNull();
  });

  /* ---------- Response shape ---------- */

  it("response includes all required fields", async () => {
    const ts = "2026-04-12T08:30:00.000Z";
    mockRedisGet.mockResolvedValueOnce(ts);
    mockRedisGet.mockResolvedValueOnce(2);

    const res = await GET();
    const body = await res.json();
    expect(body).toMatchObject({
      lastSuccessfulWebhook: ts,
      failureCountLastHour: 2,
      status: "degraded",
    });
  });

  /* ---------- Auth ---------- */

  it("propagates error when requireAdmin throws", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
    await expect(GET()).rejects.toThrow("Forbidden");
  });
});
