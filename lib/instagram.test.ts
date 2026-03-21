// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Instagram Graph API integration module.
 *
 * Covers:
 *  - isInstagramConfigured: true when INSTAGRAM_ACCESS_TOKEN is set
 *  - fetchRecentMedia: returns formatted posts, parses all fields correctly,
 *    handles empty data, passes limit param, throws when unconfigured,
 *    throws + reports to Sentry on API error/rate limit
 *
 * Mocks: global fetch (Instagram Graph API), @sentry/nextjs.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

// mockCaptureException: captures Sentry error reports for API failures
const mockCaptureException = vi.fn();
// mockFetch: simulates the Instagram Graph API /me/media endpoint
const mockFetch = vi.fn();

// Mock Sentry so tests don't send real error reports
vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/instagram", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", mockFetch);
  });

  describe("isInstagramConfigured", () => {
    it("returns true when INSTAGRAM_ACCESS_TOKEN is set", async () => {
      vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "IGQtoken123");

      const { isInstagramConfigured } = await import("./instagram");
      expect(isInstagramConfigured()).toBe(true);
    });

    it("returns false when INSTAGRAM_ACCESS_TOKEN is not set", async () => {
      vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "");

      const { isInstagramConfigured } = await import("./instagram");
      expect(isInstagramConfigured()).toBe(false);
    });
  });

  describe("fetchRecentMedia", () => {
    it("returns formatted posts when API responds successfully", async () => {
      vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "IGQtoken123");

      const mockPosts = [
        {
          id: "17854360229135492",
          username: "tcreativestudio",
          media_type: "IMAGE",
          media_url: "https://scontent.cdninstagram.com/photo.jpg",
          permalink: "https://www.instagram.com/p/abc123/",
          caption: "Beautiful lash set ✨",
          timestamp: "2024-01-15T12:00:00+0000",
        },
        {
          id: "17854360229135493",
          username: "tcreativestudio",
          media_type: "CAROUSEL_ALBUM",
          media_url: "https://scontent.cdninstagram.com/photo2.jpg",
          permalink: "https://www.instagram.com/p/def456/",
          timestamp: "2024-01-14T10:00:00+0000",
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: mockPosts }),
      });

      const { fetchRecentMedia } = await import("./instagram");
      const result = await fetchRecentMedia();

      expect(result).toEqual(mockPosts);
      expect(result).toHaveLength(2);
    });

    it("parses caption, media_url, permalink, and timestamp correctly", async () => {
      vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "IGQtoken123");

      const post = {
        id: "17854360229135494",
        username: "tcreativestudio",
        media_type: "IMAGE" as const,
        media_url: "https://cdn.example.com/lashes.jpg",
        permalink: "https://www.instagram.com/p/xyz789/",
        caption: "New jewelry arrivals 💎",
        timestamp: "2024-03-01T09:30:00+0000",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [post] }),
      });

      const { fetchRecentMedia } = await import("./instagram");
      const [result] = await fetchRecentMedia();

      expect(result.caption).toBe("New jewelry arrivals 💎");
      expect(result.media_url).toBe("https://cdn.example.com/lashes.jpg");
      expect(result.permalink).toBe("https://www.instagram.com/p/xyz789/");
      expect(result.timestamp).toBe("2024-03-01T09:30:00+0000");
    });

    it("returns empty array when API response has no data field", async () => {
      vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "IGQtoken123");

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      const { fetchRecentMedia } = await import("./instagram");
      const result = await fetchRecentMedia();

      expect(result).toEqual([]);
    });

    it("passes limit parameter to the API", async () => {
      vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "IGQtoken123");

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [] }),
      });

      const { fetchRecentMedia } = await import("./instagram");
      await fetchRecentMedia(6);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=6"),
        expect.any(Object),
      );
    });

    it("throws when INSTAGRAM_ACCESS_TOKEN is not set", async () => {
      vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "");

      const { fetchRecentMedia } = await import("./instagram");
      await expect(fetchRecentMedia()).rejects.toThrow("INSTAGRAM_ACCESS_TOKEN not configured");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws and reports to Sentry when API returns an error response", async () => {
      vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "IGQtoken123");

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('{"error":{"message":"Invalid OAuth access token"}}'),
      });

      const { fetchRecentMedia } = await import("./instagram");
      await expect(fetchRecentMedia()).rejects.toThrow("Instagram API error 400");
      expect(mockCaptureException).toHaveBeenCalledOnce();
    });

    it("throws and reports to Sentry on rate limit (429) response", async () => {
      vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "IGQtoken123");

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue("Rate limit exceeded"),
      });

      const { fetchRecentMedia } = await import("./instagram");
      await expect(fetchRecentMedia()).rejects.toThrow("Instagram API error 429");
      expect(mockCaptureException).toHaveBeenCalledOnce();
    });
  });
});
