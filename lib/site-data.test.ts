// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for getSiteData — aggregates business profile, content, and policies
 * into a single object for the public site.
 *
 * Covers:
 *  - Returns all three data sources combined
 *  - Returns defaults when no settings are configured
 *  - Propagates database errors (not swallowed)
 *
 * Mocks: settings-actions (getPublicBusinessProfile, getSiteContent, getPublicPolicies).
 */

// mockGetPublicBusinessProfile: controls the business profile data returned
const mockGetPublicBusinessProfile = vi.fn();
// mockGetSiteContent: controls the CMS content (hero, about, CTA) returned
const mockGetSiteContent = vi.fn();
// mockGetPublicPolicies: controls the cancellation/deposit policy data returned
const mockGetPublicPolicies = vi.fn();

// Mock the settings-actions module so tests don't hit the real database
vi.mock("@/app/dashboard/settings/settings-actions", () => ({
  getPublicBusinessProfile: (...args: unknown[]) => mockGetPublicBusinessProfile(...args),
  getSiteContent: (...args: unknown[]) => mockGetSiteContent(...args),
  getPublicPolicies: (...args: unknown[]) => mockGetPublicPolicies(...args),
}));

// getSiteData: the function under test — fetches all 3 data sources in parallel
import { getSiteData } from "./site-data";

// Default business profile — represents an unconfigured studio (fresh install)
const DEFAULT_BUSINESS = {
  businessName: "T Creative Studio",
  owner: "Trini",
  email: "",
  phone: "",
  location: "",
  timezone: "America/Los_Angeles",
  currency: "USD ($)",
  bookingLink: "",
  bio: "",
  emailSenderName: "T Creative",
  emailFromAddress: "noreply@tcreativestudio.com",
};

// Default CMS content — all empty strings until the admin configures the site
const DEFAULT_CONTENT = {
  heroHeadline: "",
  heroSubheadline: "",
  aboutText: "",
  ctaText: "",
  ctaUrl: "",
};

// Default policy settings — standard 24h cancel window, no deposit required
const DEFAULT_POLICIES = {
  cancelWindowHours: 24,
  lateCancelFeePercent: 50,
  noShowFeePercent: 100,
  depositRequired: false,
  depositPercent: 0,
};

describe("getSiteData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns business, content, and policies", async () => {
    const business = { ...DEFAULT_BUSINESS, businessName: "Test Studio" };
    const content = { ...DEFAULT_CONTENT, heroHeadline: "Welcome" };
    const policies = { ...DEFAULT_POLICIES, cancelWindowHours: 48 };

    mockGetPublicBusinessProfile.mockResolvedValue(business);
    mockGetSiteContent.mockResolvedValue(content);
    mockGetPublicPolicies.mockResolvedValue(policies);

    const result = await getSiteData();

    expect(result).toEqual({ business, content, policies });
    expect(mockGetPublicBusinessProfile).toHaveBeenCalledOnce();
    expect(mockGetSiteContent).toHaveBeenCalledOnce();
    expect(mockGetPublicPolicies).toHaveBeenCalledOnce();
  });

  it("returns defaults when no settings are configured", async () => {
    mockGetPublicBusinessProfile.mockResolvedValue(DEFAULT_BUSINESS);
    mockGetSiteContent.mockResolvedValue(DEFAULT_CONTENT);
    mockGetPublicPolicies.mockResolvedValue(DEFAULT_POLICIES);

    const result = await getSiteData();

    expect(result.business.businessName).toBe("T Creative Studio");
    expect(result.content.heroHeadline).toBe("");
    expect(result.policies.cancelWindowHours).toBe(24);
  });

  it("handles database errors gracefully by propagating them", async () => {
    mockGetPublicBusinessProfile.mockRejectedValue(new Error("DB connection failed"));
    mockGetSiteContent.mockResolvedValue(DEFAULT_CONTENT);
    mockGetPublicPolicies.mockResolvedValue(DEFAULT_POLICIES);

    await expect(getSiteData()).rejects.toThrow("DB connection failed");
  });
});
