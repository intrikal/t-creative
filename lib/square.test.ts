// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Square payment integration helper module.
 *
 * Covers:
 *  - isSquareConfigured: returns true only when both SQUARE_ACCESS_TOKEN and
 *    SQUARE_LOCATION_ID are set
 *  - SQUARE_LOCATION_ID export: reads from env var, defaults to empty string
 *  - createSquareOrder: throws when Square is not configured
 *  - createSquarePaymentLink: throws when Square is not configured
 *
 * Uses vi.stubEnv + vi.resetModules to test different env var combinations
 * without leaking state between tests. No external mocks needed — the module
 * reads env vars directly at import time.
 */
describe("lib/square", () => {
  // Clear module cache before each test so env var changes take effect on re-import
  beforeEach(() => {
    vi.resetModules();
  });

  // Tests for the environment-variable gate that controls whether Square API calls are allowed
  describe("isSquareConfigured", () => {
    // Both env vars present — Square integration should be active
    it("returns true when both SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are set", async () => {
      vi.stubEnv("SQUARE_ACCESS_TOKEN", "test-token");
      vi.stubEnv("SQUARE_LOCATION_ID", "test-location");

      const { isSquareConfigured } = await import("./square");
      expect(isSquareConfigured()).toBe(true);
    });

    // Missing token — Square cannot authenticate API calls
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

  // Tests the re-export of the location ID — routes and server actions use this directly
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

  // Tests the guard clause that prevents order creation when credentials are absent
  describe("createSquareOrder", () => {
    // Calling without config should fail fast rather than sending a doomed API request
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

  // Tests the guard clause for payment link generation
  describe("createSquarePaymentLink", () => {
    // Same fail-fast behavior as createSquareOrder — no point hitting the API without creds
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
