import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPublicBusinessProfile = vi.fn();
const mockGetSiteContent = vi.fn();
const mockGetPublicPolicies = vi.fn();

vi.mock("@/app/dashboard/settings/settings-actions", () => ({
  getPublicBusinessProfile: (...args: unknown[]) => mockGetPublicBusinessProfile(...args),
  getSiteContent: (...args: unknown[]) => mockGetSiteContent(...args),
  getPublicPolicies: (...args: unknown[]) => mockGetPublicPolicies(...args),
}));

import { getSiteData } from "./site-data";

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

const DEFAULT_CONTENT = {
  heroHeadline: "",
  heroSubheadline: "",
  aboutText: "",
  ctaText: "",
  ctaUrl: "",
};

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
