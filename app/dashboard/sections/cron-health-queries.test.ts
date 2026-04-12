/**
 * @file cron-health-queries.test.ts
 * Unit tests for getCronHealth — reads audit_log to derive per-cron
 * last-run status (success / failure / never).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(rows: unknown[] = []) {
  vi.doMock("@/db", () => ({
    db: { select: vi.fn(() => makeChain(rows)) },
  }));
  vi.doMock("@/db/schema", () => ({
    auditLog: {
      entityId: "entityId",
      entityType: "entityType",
      metadata: "metadata",
      createdAt: "createdAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("getCronHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 'never' status for every cron when audit log is empty", async () => {
    vi.resetModules();
    setupMocks([]);
    const { getCronHealth, CRON_NAMES } = await import("./cron-health-queries");
    const result = await getCronHealth();
    expect(result).toHaveLength(CRON_NAMES.length);
    for (const row of result) {
      expect(row.lastStatus).toBe("never");
      expect(row.lastRunAt).toBeNull();
      expect(row.lastDurationMs).toBeNull();
      expect(row.lastRecordsProcessed).toBeNull();
      expect(row.lastError).toBeNull();
    }
  });

  it("returns 'success' with metadata for a cron that succeeded", async () => {
    vi.resetModules();
    const successDate = new Date("2026-04-10T12:00:00Z");
    setupMocks([
      {
        entityId: "booking-reminders",
        entityType: "cron_success",
        metadata: { durationMs: 250, recordsProcessed: 5 },
        createdAt: successDate,
      },
    ]);
    const { getCronHealth } = await import("./cron-health-queries");
    const result = await getCronHealth();
    const row = result.find((r) => r.cronName === "booking-reminders");
    expect(row?.lastStatus).toBe("success");
    expect(row?.lastRunAt).toEqual(successDate);
    expect(row?.lastDurationMs).toBe(250);
    expect(row?.lastRecordsProcessed).toBe(5);
    expect(row?.lastError).toBeNull();
  });

  it("returns 'failure' with error message for a cron that failed", async () => {
    vi.resetModules();
    const failDate = new Date("2026-04-10T08:00:00Z");
    setupMocks([
      {
        entityId: "zoho-books",
        entityType: "cron_failure",
        metadata: { error: "Timeout exceeded", durationMs: 30000 },
        createdAt: failDate,
      },
    ]);
    const { getCronHealth } = await import("./cron-health-queries");
    const result = await getCronHealth();
    const row = result.find((r) => r.cronName === "zoho-books");
    expect(row?.lastStatus).toBe("failure");
    expect(row?.lastRunAt).toEqual(failDate);
    expect(row?.lastError).toBe("Timeout exceeded");
    expect(row?.lastDurationMs).toBe(30000);
  });

  it("uses the first (most recent) entry when duplicate rows exist for a cron", async () => {
    vi.resetModules();
    const newerDate = new Date("2026-04-11T10:00:00Z");
    const olderDate = new Date("2026-04-10T10:00:00Z");
    // DB returns rows newest-first (orderBy desc); getCronHealth keeps first seen per name
    setupMocks([
      {
        entityId: "backup",
        entityType: "cron_success",
        metadata: { durationMs: 100 },
        createdAt: newerDate,
      },
      {
        entityId: "backup",
        entityType: "cron_failure",
        metadata: { error: "old error" },
        createdAt: olderDate,
      },
    ]);
    const { getCronHealth } = await import("./cron-health-queries");
    const result = await getCronHealth();
    const row = result.find((r) => r.cronName === "backup");
    expect(row?.lastStatus).toBe("success");
    expect(row?.lastRunAt).toEqual(newerDate);
  });

  it("returns 'never' for crons absent from audit log while others have entries", async () => {
    vi.resetModules();
    setupMocks([
      {
        entityId: "booking-reminders",
        entityType: "cron_success",
        metadata: {},
        createdAt: new Date(),
      },
    ]);
    const { getCronHealth } = await import("./cron-health-queries");
    const result = await getCronHealth();
    const neverRows = result.filter((r) => r.cronName !== "booking-reminders");
    expect(neverRows.length).toBeGreaterThan(0);
    for (const row of neverRows) {
      expect(row.lastStatus).toBe("never");
    }
  });

  it("handles null metadata without crashing", async () => {
    vi.resetModules();
    setupMocks([
      {
        entityId: "campaigns",
        entityType: "cron_success",
        metadata: null,
        createdAt: new Date(),
      },
    ]);
    const { getCronHealth } = await import("./cron-health-queries");
    const result = await getCronHealth();
    const row = result.find((r) => r.cronName === "campaigns");
    expect(row?.lastStatus).toBe("success");
    expect(row?.lastDurationMs).toBeNull();
    expect(row?.lastRecordsProcessed).toBeNull();
    expect(row?.lastError).toBeNull();
  });
});
