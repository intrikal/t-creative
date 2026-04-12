// @vitest-environment node

/**
 * inngest/functions/refresh-views.test.ts
 *
 * Unit tests for the refresh-views Inngest function.
 * Verifies that each materialized view is refreshed via db.execute,
 * and that the handler returns an aggregated success object.
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

const mockExecute = vi.fn().mockResolvedValue(undefined);

function setupMocks() {
  vi.doMock("@/db", () => ({
    db: { execute: mockExecute },
  }));
  vi.doMock("drizzle-orm", () => ({
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      {
        raw: vi.fn((q: string) => ({ type: "sql_raw", q })),
        join: vi.fn(() => ({ type: "sql_join" })),
      },
    ),
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
}

async function runHandler() {
  const mod = await import("@/inngest/functions/refresh-views");
  const fn = (mod.refreshViews as any)?.handler ?? mod.refreshViews;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("refresh-views", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupMocks();
  });

  it("calls db.execute with REFRESH MATERIALIZED VIEW for each view", async () => {
    const result = await runHandler();

    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(result).toHaveProperty("revenue_by_service_daily");
    expect(result).toHaveProperty("client_retention_monthly");
  });

  it("returns allOk: true when all views refresh successfully", async () => {
    const result = await runHandler();

    expect(result.allOk).toBe(true);
    expect(result.revenue_by_service_daily).toBe("ok");
    expect(result.client_retention_monthly).toBe("ok");
  });

  it("returns allOk: false and captures error message when a view fails", async () => {
    mockExecute.mockRejectedValueOnce(new Error("view lock timeout"));

    const result = await runHandler();

    expect(result.allOk).toBe(false);
    expect(result.revenue_by_service_daily).toBe("view lock timeout");
    expect(result.client_retention_monthly).toBe("ok");
  });
});
