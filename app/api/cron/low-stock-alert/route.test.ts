/**
 * Tests for GET /api/cron/low-stock-alert — low-stock inventory alert trigger.
 *
 * Covers:
 *  - Auth: missing or wrong secret returns 401
 *  - Happy path: valid secret sends the Inngest event and returns 200
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockInngestSend = vi.fn();

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/cron/low-stock-alert", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue({ ids: ["evt-1"] });
    process.env.CRON_SECRET = "test-secret";

    vi.resetModules();

    vi.doMock("@/inngest/client", () => ({
      inngest: { send: mockInngestSend },
    }));
    vi.doMock("@/lib/cron-monitor", () => ({
      withCronMonitoring: vi.fn(async (_name: string, fn: () => Promise<unknown>) => {
        const result = await fn();
        return Response.json(result, { status: 200 });
      }),
    }));

    const mod = await import("./route");
    GET = mod.GET;
  });

  function makeGet(secret?: string, useBearer = false) {
    const headers: Record<string, string> = {};
    if (secret) {
      if (useBearer) {
        headers.authorization = `Bearer ${secret}`;
      } else {
        headers["x-cron-secret"] = secret;
      }
    }
    return new Request("https://example.com/api/cron/low-stock-alert", {
      headers,
    });
  }

  /* ---------- Auth ---------- */

  it("returns 401 without any secret header", async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await GET(makeGet("bad"));
    expect(res.status).toBe(401);
  });

  /* ---------- Happy path ---------- */

  it("sends the Inngest event with x-cron-secret header", async () => {
    const res = await GET(makeGet("test-secret"));
    expect(res.status).toBe(200);
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "cron/low-stock-alert",
      data: {},
    });
  });

  it("sends the Inngest event with Bearer authorization header", async () => {
    const res = await GET(makeGet("test-secret", true));
    expect(res.status).toBe(200);
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "cron/low-stock-alert",
      data: {},
    });
  });

  it("returns recordsProcessed in response body", async () => {
    const res = await GET(makeGet("test-secret"));
    const body = await res.json();
    expect(body).toEqual({ recordsProcessed: 1 });
  });
});
