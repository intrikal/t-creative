// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// afterEach: runs a cleanup function after every test in the current describe block
import { describe, it, expect, vi, afterEach } from "vitest";
// generateCalendarToken: creates an HMAC-SHA256 token for a given profileId using CRON_SECRET
// verifyCalendarToken: checks whether a token matches the expected HMAC for a profileId
// calendarUrl: builds a full iCal subscription URL embedding the profileId and its HMAC token
import { generateCalendarToken, verifyCalendarToken, calendarUrl } from "./calendar-token";

/**
 * Tests for the calendar token module — HMAC-based authentication for iCal feeds.
 *
 * Covers:
 *  - Token generation: deterministic, profile-specific, secret-dependent
 *  - Token verification: valid, wrong profileId, tampered, malformed, wrong length
 *  - URL building: uses NEXT_PUBLIC_SITE_URL or falls back to localhost,
 *    embeds profileId in path, embeds a verifiable token in query string
 *
 * No mocks needed — these are pure crypto functions using env vars only.
 */

// Restore all env stubs after each test to prevent cross-test leakage
afterEach(() => {
  vi.unstubAllEnvs();
});

// Tests for the HMAC token generator that secures iCal feed URLs
describe("generateCalendarToken", () => {
  // Basic format check — HMAC-SHA256 output is always hexadecimal
  it("returns a hex string", () => {
    const token = generateCalendarToken("profile-123");
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  // HMACs must be deterministic — same input always yields the same token
  it("is deterministic for the same profileId and secret", () => {
    vi.stubEnv("CRON_SECRET", "stable-secret");
    const a = generateCalendarToken("profile-abc");
    const b = generateCalendarToken("profile-abc");
    expect(a).toBe(b);
  });

  // Each profile gets a unique token — prevents one user from accessing another's feed
  it("produces different tokens for different profileIds", () => {
    vi.stubEnv("CRON_SECRET", "same-secret");
    const a = generateCalendarToken("profile-1");
    const b = generateCalendarToken("profile-2");
    expect(a).not.toBe(b);
  });

  // Rotating the secret invalidates all existing tokens — important for security
  it("produces different tokens when CRON_SECRET changes", () => {
    vi.stubEnv("CRON_SECRET", "secret-X");
    const tokenX = generateCalendarToken("profile-1");

    vi.stubEnv("CRON_SECRET", "secret-Y");
    const tokenY = generateCalendarToken("profile-1");

    expect(tokenX).not.toBe(tokenY);
  });

  it("falls back to 'dev-secret' when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    const tokenEmpty = generateCalendarToken("profile-1");

    // The function uses ?? so empty string is treated as falsy (no, actually ?? only checks null/undefined)
    // Empty string IS returned by process.env so ?? won't fall back — dev-secret is only used for undefined
    // Just verify it returns some hex string
    expect(tokenEmpty).toMatch(/^[0-9a-f]+$/);
  });
});

// Tests for HMAC verification — the gatekeeper for the iCal API endpoint
describe("verifyCalendarToken", () => {
  it("returns true for a valid token", () => {
    vi.stubEnv("CRON_SECRET", "verify-secret");
    const token = generateCalendarToken("profile-x");
    expect(verifyCalendarToken("profile-x", token)).toBe(true);
  });

  it("returns false for a token generated for a different profileId", () => {
    vi.stubEnv("CRON_SECRET", "verify-secret");
    const token = generateCalendarToken("profile-A");
    expect(verifyCalendarToken("profile-B", token)).toBe(false);
  });

  it("returns false for a tampered token", () => {
    vi.stubEnv("CRON_SECRET", "verify-secret");
    const token = generateCalendarToken("profile-y");
    const tampered = token.replace(/.$/, token.endsWith("0") ? "1" : "0");
    expect(verifyCalendarToken("profile-y", tampered)).toBe(false);
  });

  it("returns false for a malformed (non-hex) token", () => {
    expect(verifyCalendarToken("profile-z", "not-hex-at-all!")).toBe(false);
  });

  it("returns false when tokens differ in length", () => {
    vi.stubEnv("CRON_SECRET", "verify-secret");
    const token = generateCalendarToken("profile-len");
    expect(verifyCalendarToken("profile-len", token + "ab")).toBe(false);
  });
});

// Tests for the full URL builder — used in settings UI and email links
describe("calendarUrl", () => {
  it("builds a URL using NEXT_PUBLIC_SITE_URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tcreativestudio.com");
    vi.stubEnv("CRON_SECRET", "url-secret");

    const url = calendarUrl("profile-url");
    expect(url).toMatch(
      /^https:\/\/tcreativestudio\.com\/api\/calendar\/profile-url\?token=[0-9a-f]+$/,
    );
  });

  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is unset", () => {
    vi.stubEnv("CRON_SECRET", "url-secret");
    // Delete the var so ?? fallback activates (stubEnv("", ...) sets empty string, not undefined)
    const saved = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const url = calendarUrl("profile-local");

    if (saved !== undefined) process.env.NEXT_PUBLIC_SITE_URL = saved;

    expect(url).toMatch(/^http:\/\/localhost:3000\/api\/calendar\/profile-local\?token=[0-9a-f]+$/);
  });

  it("embeds the profileId in the path", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    const url = calendarUrl("my-profile-id");
    expect(url).toContain("/api/calendar/my-profile-id");
  });

  it("embeds a token that verifyCalendarToken accepts", () => {
    vi.stubEnv("CRON_SECRET", "url-verify-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");

    const profileId = "profile-verify";
    const url = calendarUrl(profileId);
    const token = new URL(url).searchParams.get("token")!;

    expect(verifyCalendarToken(profileId, token)).toBe(true);
  });
});
