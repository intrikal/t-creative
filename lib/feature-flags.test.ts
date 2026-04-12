import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/feature-flags — PostHog server-side feature flag checks.
 *
 * Covers:
 *  - PostHog configured + flag enabled  → returns true
 *  - PostHog configured + flag disabled → returns false
 *  - PostHog not configured (no API key) → returns false without instantiating client
 *  - PostHog API error → returns false, captures exception via Sentry
 *
 * Mocks: posthog-node (PostHog class), @sentry/nextjs.
 * Uses vi.stubEnv + vi.resetModules so the module-level `apiKey` constant is
 * re-read from a fresh environment on each import.
 */

// Terminal mock refs that survive vi.resetModules() via closure capture.
const mockIsFeatureEnabled = vi.fn();
const mockPostHogCtor = vi.fn().mockImplementation(() => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));
const mockCaptureException = vi.fn();

vi.mock("posthog-node", () => ({
  PostHog: mockPostHogCtor,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

describe("lib/feature-flags", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Re-wire constructor after clearAllMocks() resets the implementation.
    mockPostHogCtor.mockImplementation(() => ({
      isFeatureEnabled: mockIsFeatureEnabled,
    }));
  });

  it("returns true when PostHog is configured and the flag is enabled", async () => {
    vi.stubEnv("POSTHOG_API_KEY", "phc_test_key");
    mockIsFeatureEnabled.mockResolvedValue(true);

    const { isFeatureEnabled } = await import("./feature-flags");
    expect(await isFeatureEnabled("assistant-dashboard", "user-1")).toBe(true);
  });

  it("returns false when PostHog is configured but the flag is disabled", async () => {
    vi.stubEnv("POSTHOG_API_KEY", "phc_test_key");
    // PostHog returns false (or undefined) when flag is off — the module does
    // a strict === true check, so anything other than true becomes false.
    mockIsFeatureEnabled.mockResolvedValue(false);

    const { isFeatureEnabled } = await import("./feature-flags");
    expect(await isFeatureEnabled("assistant-dashboard", "user-1")).toBe(false);
  });

  it("returns false and never instantiates the PostHog client when API key is absent", async () => {
    vi.stubEnv("POSTHOG_API_KEY", "");

    const { isFeatureEnabled } = await import("./feature-flags");
    expect(await isFeatureEnabled("assistant-dashboard", "user-1")).toBe(false);
    // No PostHog client should be created — early-return path.
    expect(mockPostHogCtor).not.toHaveBeenCalled();
  });

  it("returns false and captures exception via Sentry when PostHog throws", async () => {
    vi.stubEnv("POSTHOG_API_KEY", "phc_test_key");
    mockIsFeatureEnabled.mockRejectedValue(new Error("PostHog API unavailable"));

    const { isFeatureEnabled } = await import("./feature-flags");
    expect(await isFeatureEnabled("assistant-dashboard", "user-1")).toBe(false);
    expect(mockCaptureException).toHaveBeenCalled();
  });
});
