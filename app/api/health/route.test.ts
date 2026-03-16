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
  let GET: () => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDbExecute.mockResolvedValue([{ "?column?": 1 }]);

    const mod = await import("./route");
    GET = mod.GET;
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
