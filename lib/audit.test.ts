// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the audit logging utility (logAction).
 *
 * Covers:
 *  - IP + user-agent extraction from request headers
 *  - Multi-IP x-forwarded-for parsing (only first IP stored)
 *  - Graceful fallback when headers() is unavailable (e.g., cron context)
 *  - Optional fields (actorId, description, metadata) default to null
 *  - Fire-and-forget behavior: DB errors are caught and logged, never thrown
 *
 * Mocks: next/headers (headers()), db (insert into audit_log), db/schema.
 */

// mockInsertValues: captures the row passed to db.insert(auditLog).values(...)
const mockInsertValues = vi.fn();
// mockHeadersGet: simulates headers().get(key) for IP and user-agent extraction
const mockHeadersGet = vi.fn();
// mockHeaders: simulates the next/headers headers() function
const mockHeaders = vi.fn();

// Mock Next.js headers() so we can control what IP and user-agent the audit logger sees
vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

// Mock the database so tests don't need a real Postgres connection
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: mockInsertValues,
    }),
  },
}));

// Mock the schema import — only the table reference is needed, not the full definition
vi.mock("@/db/schema", () => ({
  auditLog: {},
}));

describe("lib/audit", () => {
  // Reset all mocks and set up a default headers() implementation that returns
  // a known IP and user-agent so tests start from a predictable state
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);

    // Default: headers() returns an object with get() — simulates a normal HTTP request context
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === "x-forwarded-for") return "1.2.3.4";
      if (key === "user-agent") return "TestAgent/1.0";
      return null;
    });
    mockHeaders.mockResolvedValue({ get: mockHeadersGet });
  });

  // Tests for the logAction function — the single entry point for all audit trail writes
  describe("logAction", () => {
    // Verifies the full audit row is written with all fields including IP and user-agent
    it("inserts an audit log entry with IP and user-agent from headers", async () => {
      const { logAction } = await import("./audit");

      await logAction({
        actorId: "user-1",
        action: "create",
        entityType: "booking",
        entityId: "42",
        description: "Booking created",
        metadata: { service: "lash" },
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "user-1",
          action: "create",
          entityType: "booking",
          entityId: "42",
          description: "Booking created",
          metadata: { service: "lash" },
          ipAddress: "1.2.3.4",
          userAgent: "TestAgent/1.0",
        }),
      );
    });

    // Proxies chain multiple IPs in x-forwarded-for — only the first (client) IP matters
    it("uses only the first IP when x-forwarded-for has multiple entries", async () => {
      mockHeadersGet.mockImplementation((key: string) => {
        if (key === "x-forwarded-for") return "10.0.0.1, 10.0.0.2, 10.0.0.3";
        if (key === "user-agent") return "TestAgent/1.0";
        return null;
      });

      const { logAction } = await import("./audit");
      await logAction({ action: "login", entityType: "user", entityId: "u1" });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: "10.0.0.1" }),
      );
    });

    // Cron jobs and server actions run outside request context — headers() throws
    it("inserts with null IP and user-agent when headers() throws", async () => {
      mockHeaders.mockRejectedValue(new Error("Not in request context"));

      const { logAction } = await import("./audit");

      await logAction({
        action: "export",
        entityType: "report",
        entityId: "r1",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: null, userAgent: null }),
      );
    });

    it("inserts with null actorId and description when omitted", async () => {
      const { logAction } = await import("./audit");

      await logAction({
        action: "status_change",
        entityType: "booking",
        entityId: "99",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: null,
          description: null,
          metadata: null,
        }),
      );
    });

    // Audit logging must never crash the calling function — it's a best-effort side effect
    it("does not throw when db.insert fails (fire-and-forget)", async () => {
      mockInsertValues.mockRejectedValue(new Error("DB connection lost"));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { logAction } = await import("./audit");

      await expect(
        logAction({ action: "delete", entityType: "booking", entityId: "1" }),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith("[audit] Failed to log action:", expect.any(Error));
      errorSpy.mockRestore();
    });
  });
});
