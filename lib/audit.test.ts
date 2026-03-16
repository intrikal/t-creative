import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsertValues = vi.fn();
const mockHeadersGet = vi.fn();
const mockHeaders = vi.fn();

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: mockInsertValues,
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  auditLog: {},
}));

describe("lib/audit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);

    // Default: headers() returns an object with get()
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === "x-forwarded-for") return "1.2.3.4";
      if (key === "user-agent") return "TestAgent/1.0";
      return null;
    });
    mockHeaders.mockResolvedValue({ get: mockHeadersGet });
  });

  describe("logAction", () => {
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
