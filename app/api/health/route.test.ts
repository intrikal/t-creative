/**
 * Tests for GET /api/health — liveness and database connectivity check.
 *
 * Covers:
 *  - Healthy: db.execute resolves → 200, status="ok", db="ok",
 *    latencyMs is a number, timestamp is an ISO string
 *  - DB call: verifies db.execute is invoked exactly once (SELECT 1 ping)
 *  - Unhealthy: db.execute rejects → 503, status="error", db="error",
 *    latencyMs and timestamp still present for monitoring
 *
 * Mocks: db.execute (single SQL ping), drizzle-orm sql tag.
 * No auth — endpoint is fully public for uptime monitors.
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

const mockDbExecute = vi.fn();

vi.mock("@/db", () => ({
  db: {
    execute: (...args: unknown[]) => mockDbExecute(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn().mockReturnValue({}),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("GET /api/health", () => {
  let GET: (request?: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDbExecute.mockResolvedValue([{ "?column?": 1 }]);

    const mod = await import("./route");
    GET = mod.GET as unknown as typeof GET;
  });

  it("returns 200 with db: ok when the database responds", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(typeof body.latencyMs).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });

  it("calls db.execute with a SQL ping", async () => {
    await GET();
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 503 with db: error when the database throws", async () => {
    mockDbExecute.mockRejectedValue(new Error("Connection refused"));

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.db).toBe("error");
    expect(typeof body.latencyMs).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });
});
