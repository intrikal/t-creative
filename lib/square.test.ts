import { describe, it, expect, vi, beforeEach } from "vitest";

describe("lib/square", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("isSquareConfigured", () => {
    it("returns true when both SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are set", async () => {
      vi.stubEnv("SQUARE_ACCESS_TOKEN", "test-token");
      vi.stubEnv("SQUARE_LOCATION_ID", "test-location");

      const { isSquareConfigured } = await import("./square");
      expect(isSquareConfigured()).toBe(true);
    });

    it("returns false when SQUARE_ACCESS_TOKEN is missing", async () => {
      vi.stubEnv("SQUARE_ACCESS_TOKEN", "");
      vi.stubEnv("SQUARE_LOCATION_ID", "test-location");

      const { isSquareConfigured } = await import("./square");
      expect(isSquareConfigured()).toBe(false);
    });

    it("returns false when SQUARE_LOCATION_ID is missing", async () => {
      vi.stubEnv("SQUARE_ACCESS_TOKEN", "test-token");
      vi.stubEnv("SQUARE_LOCATION_ID", "");

      const { isSquareConfigured } = await import("./square");
      expect(isSquareConfigured()).toBe(false);
    });

    it("returns false when both env vars are missing", async () => {
      vi.stubEnv("SQUARE_ACCESS_TOKEN", "");
      vi.stubEnv("SQUARE_LOCATION_ID", "");

      const { isSquareConfigured } = await import("./square");
      expect(isSquareConfigured()).toBe(false);
    });
  });

  describe("SQUARE_LOCATION_ID", () => {
    it("exports the location ID from env", async () => {
      vi.stubEnv("SQUARE_LOCATION_ID", "loc_abc123");
      vi.stubEnv("SQUARE_ACCESS_TOKEN", "tok");

      const { SQUARE_LOCATION_ID } = await import("./square");
      expect(SQUARE_LOCATION_ID).toBe("loc_abc123");
    });

    it("defaults to empty string when env var is missing", async () => {
      vi.stubEnv("SQUARE_LOCATION_ID", "");
      vi.stubEnv("SQUARE_ACCESS_TOKEN", "");

      const { SQUARE_LOCATION_ID } = await import("./square");
      expect(SQUARE_LOCATION_ID).toBe("");
    });
  });

  describe("createSquareOrder", () => {
    it("throws when Square is not configured", async () => {
      vi.stubEnv("SQUARE_ACCESS_TOKEN", "");
      vi.stubEnv("SQUARE_LOCATION_ID", "");

      const { createSquareOrder } = await import("./square");
      await expect(
        createSquareOrder({
          bookingId: 1,
          serviceName: "Lash Full Set",
          amountInCents: 15000,
        }),
      ).rejects.toThrow("Square not configured");
    });
  });

  describe("createSquarePaymentLink", () => {
    it("throws when Square is not configured", async () => {
      vi.stubEnv("SQUARE_ACCESS_TOKEN", "");
      vi.stubEnv("SQUARE_LOCATION_ID", "");

      const { createSquarePaymentLink } = await import("./square");
      await expect(
        createSquarePaymentLink({
          bookingId: 1,
          serviceName: "Lash Full Set",
          amountInCents: 15000,
          type: "balance",
        }),
      ).rejects.toThrow("Square not configured");
    });
  });
});
