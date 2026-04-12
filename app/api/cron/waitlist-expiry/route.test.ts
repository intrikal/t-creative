// @vitest-environment node

/**
 * Tests for GET /api/cron/waitlist-expiry — Inngest waitlist-expiry trigger.
 *
 * Covers:
 *  - Auth: missing or wrong secret (x-cron-secret / Authorization Bearer) → 401
 *  - Valid x-cron-secret → sends Inngest event, returns 200
 *  - Valid Authorization Bearer → sends Inngest event, returns 200
 *
 * Mocks: @/lib/env (CRON_SECRET), @/inngest/client (inngest.send),
 * @/lib/cron-monitor (withCronMonitoring passthrough).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockInngestSend = vi.fn();

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/waitlist-expiry", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue({ ids: ["evt-abc"] });

    vi.resetModules();

    vi.doMock("@/lib/env", () => ({ env: { CRON_SECRET: "test-secret" } }));
    vi.doMock("@/inngest/client", () => ({ inngest: { send: mockInngestSend } }));
    vi.doMock("@/lib/cron-monitor", () => ({
      withCronMonitoring: vi.fn().mockImplementation(
        async (_name: string, fn: () => Promise<unknown>) => {
          const result = await fn();
          return new Response(JSON.stringify({ ok: true, ...(result as object) }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      ),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(opts: { authorization?: string; legacySecret?: string } = {}) {
    const headers: Record<string, string> = {};
    if (opts.authorization) headers["authorization"] = opts.authorization;
    if (opts.legacySecret) headers["x-cron-secret"] = opts.legacySecret;
    return new Request("https://example.com/api/cron/waitlist-expiry", { headers });
  }

  /* ---------- Auth ---------- */

  it("returns 401 when no auth header is provided", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong x-cron-secret", async () => {
    const res = await GET(makeGet({ legacySecret: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong Authorization Bearer", async () => {
    const res = await GET(makeGet({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  /* ---------- Happy path ---------- */

  it("sends Inngest event and returns 200 with valid x-cron-secret", async () => {
    const res = await GET(makeGet({ legacySecret: "test-secret" }));
    expect(res.status).toBe(200);
    expect(mockInngestSend).toHaveBeenCalledOnce();
    expect(mockInngestSend).toHaveBeenCalledWith({ name: "cron/waitlist-expiry", data: {} });
  });

  it("sends Inngest event and returns 200 with valid Authorization Bearer", async () => {
    const res = await GET(makeGet({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(200);
    expect(mockInngestSend).toHaveBeenCalledOnce();
    expect(mockInngestSend).toHaveBeenCalledWith({ name: "cron/waitlist-expiry", data: {} });
  });
});
