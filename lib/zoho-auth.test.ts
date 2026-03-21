// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
// afterEach: runs a cleanup function after every test in the current describe block
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the Zoho OAuth2 authentication module.
 *
 * Covers:
 *  - isZohoAuthConfigured: all 3 credentials required
 *  - getZohoAccessToken: fetches token, sends correct params, caches results,
 *    handles non-ok responses, handles network errors
 *
 * Mocks: global fetch (simulates Zoho OAuth endpoint).
 * Uses vi.stubEnv for credential combinations.
 */

// mockFetch: simulates the Zoho OAuth2 token endpoint
const mockFetch = vi.fn();

// Inject mock fetch before each test and reset module cache for clean env var reads
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.resetModules();
  mockFetch.mockReset();
});

// Restore all env vars and globals to prevent cross-test leakage
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Helper: builds a mock Response for a successful token refresh
function okTokenResponse(accessToken = "zoho-access-token-123", expiresIn = 3600) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ access_token: accessToken, expires_in: expiresIn }),
    text: vi.fn().mockResolvedValue(""),
  };
}

// Helper: builds a mock Response for a failed token refresh (e.g., invalid credentials)
function errorResponse(status = 400, body = "invalid_client") {
  return {
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("lib/zoho-auth", () => {
  // Tests for the env-var gate — all 3 OAuth2 credentials must be present
  describe("isZohoAuthConfigured", () => {
    it("returns true when all three credentials are set", async () => {
      vi.stubEnv("ZOHO_CLIENT_ID", "client-id");
      vi.stubEnv("ZOHO_CLIENT_SECRET", "client-secret");
      vi.stubEnv("ZOHO_REFRESH_TOKEN", "refresh-token");

      const { isZohoAuthConfigured } = await import("./zoho-auth");
      expect(isZohoAuthConfigured()).toBe(true);
    });

    it("returns false when ZOHO_CLIENT_ID is missing", async () => {
      vi.stubEnv("ZOHO_CLIENT_ID", "");
      vi.stubEnv("ZOHO_CLIENT_SECRET", "client-secret");
      vi.stubEnv("ZOHO_REFRESH_TOKEN", "refresh-token");

      const { isZohoAuthConfigured } = await import("./zoho-auth");
      expect(isZohoAuthConfigured()).toBe(false);
    });

    it("returns false when ZOHO_CLIENT_SECRET is missing", async () => {
      vi.stubEnv("ZOHO_CLIENT_ID", "client-id");
      vi.stubEnv("ZOHO_CLIENT_SECRET", "");
      vi.stubEnv("ZOHO_REFRESH_TOKEN", "refresh-token");

      const { isZohoAuthConfigured } = await import("./zoho-auth");
      expect(isZohoAuthConfigured()).toBe(false);
    });

    it("returns false when ZOHO_REFRESH_TOKEN is missing", async () => {
      vi.stubEnv("ZOHO_CLIENT_ID", "client-id");
      vi.stubEnv("ZOHO_CLIENT_SECRET", "client-secret");
      vi.stubEnv("ZOHO_REFRESH_TOKEN", "");

      const { isZohoAuthConfigured } = await import("./zoho-auth");
      expect(isZohoAuthConfigured()).toBe(false);
    });

    it("returns false when all credentials are missing", async () => {
      vi.stubEnv("ZOHO_CLIENT_ID", "");
      vi.stubEnv("ZOHO_CLIENT_SECRET", "");
      vi.stubEnv("ZOHO_REFRESH_TOKEN", "");

      const { isZohoAuthConfigured } = await import("./zoho-auth");
      expect(isZohoAuthConfigured()).toBe(false);
    });
  });

  // Tests for the token fetch/cache function — used by all Zoho API calls
  describe("getZohoAccessToken", () => {
    beforeEach(() => {
      vi.stubEnv("ZOHO_CLIENT_ID", "client-id");
      vi.stubEnv("ZOHO_CLIENT_SECRET", "client-secret");
      vi.stubEnv("ZOHO_REFRESH_TOKEN", "refresh-token");
    });

    it("fetches and returns a new access token", async () => {
      mockFetch.mockResolvedValue(okTokenResponse("fresh-token-abc"));

      const { getZohoAccessToken } = await import("./zoho-auth");
      const token = await getZohoAccessToken();

      expect(token).toBe("fresh-token-abc");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("accounts.zoho.com/oauth/v2/token"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("sends the correct OAuth2 params in the URL", async () => {
      mockFetch.mockResolvedValue(okTokenResponse());

      const { getZohoAccessToken } = await import("./zoho-auth");
      await getZohoAccessToken();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("grant_type=refresh_token");
      expect(calledUrl).toContain("client_id=client-id");
      expect(calledUrl).toContain("client_secret=client-secret");
      expect(calledUrl).toContain("refresh_token=refresh-token");
    });

    it("returns the cached token on subsequent calls without re-fetching", async () => {
      mockFetch.mockResolvedValue(okTokenResponse("cached-token", 3600));

      const { getZohoAccessToken } = await import("./zoho-auth");

      const token1 = await getZohoAccessToken();
      const token2 = await getZohoAccessToken();

      expect(token1).toBe("cached-token");
      expect(token2).toBe("cached-token");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("throws when the OAuth endpoint returns a non-ok status", async () => {
      mockFetch.mockResolvedValue(errorResponse(401, "invalid_client"));

      const { getZohoAccessToken } = await import("./zoho-auth");

      await expect(getZohoAccessToken()).rejects.toThrow("Zoho OAuth refresh failed (401)");
    });

    it("throws when fetch itself rejects (network error)", async () => {
      mockFetch.mockRejectedValue(new Error("Network unreachable"));

      const { getZohoAccessToken } = await import("./zoho-auth");

      await expect(getZohoAccessToken()).rejects.toThrow("Network unreachable");
    });
  });
});
