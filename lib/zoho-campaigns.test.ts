import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Persistent mock references ---
const mockIsZohoAuthConfigured = vi.fn();
const mockGetZohoAccessToken = vi.fn();
const mockFetch = vi.fn();
const mockDbLimit = vi.fn();
const mockDbSetWhere = vi.fn();
const mockDbInsertValues = vi.fn();

vi.mock("@/lib/zoho-auth", () => ({
  isZohoAuthConfigured: mockIsZohoAuthConfigured,
  getZohoAccessToken: mockGetZohoAccessToken,
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockDbLimit,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: mockDbSetWhere,
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: mockDbInsertValues,
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  profiles: {},
  syncLog: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockReturnValue({}),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubEnv("ZOHO_CAMPAIGNS_LIST_KEY", "list-key-abc");
  vi.resetModules();
  vi.clearAllMocks();

  mockIsZohoAuthConfigured.mockReturnValue(true);
  mockGetZohoAccessToken.mockResolvedValue("test-access-token");
  mockDbLimit.mockResolvedValue([]);
  mockDbSetWhere.mockResolvedValue(undefined);
  mockDbInsertValues.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ status: "success", message: "contact-key-xyz" }),
    text: vi.fn().mockResolvedValue(""),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function okJson(data: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(""),
  };
}

function errorResponse(status = 500, body = "Server Error") {
  return { ok: false, status, text: vi.fn().mockResolvedValue(body) };
}

describe("lib/zoho-campaigns", () => {
  describe("isZohoCampaignsConfigured", () => {
    it("returns true when auth and list key are configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(true);
      const { isZohoCampaignsConfigured } = await import("./zoho-campaigns");
      expect(isZohoCampaignsConfigured()).toBe(true);
    });

    it("returns false when ZOHO_CAMPAIGNS_LIST_KEY is missing", async () => {
      vi.stubEnv("ZOHO_CAMPAIGNS_LIST_KEY", "");
      vi.resetModules();
      mockIsZohoAuthConfigured.mockReturnValue(true);

      const { isZohoCampaignsConfigured } = await import("./zoho-campaigns");
      expect(isZohoCampaignsConfigured()).toBe(false);
    });

    it("returns false when Zoho auth is not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { isZohoCampaignsConfigured } = await import("./zoho-campaigns");
      expect(isZohoCampaignsConfigured()).toBe(false);
    });
  });

  describe("syncCampaignsSubscriber", () => {
    it("is a no-op when not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { syncCampaignsSubscriber } = await import("./zoho-campaigns");

      await syncCampaignsSubscriber({
        profileId: "p1",
        email: "test@example.com",
        firstName: "Test",
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls the Campaigns listsubscribe endpoint with correct fields", async () => {
      mockFetch.mockResolvedValue(okJson({ status: "success", message: "new-contact-key" }));

      const { syncCampaignsSubscriber } = await import("./zoho-campaigns");
      await syncCampaignsSubscriber({
        profileId: "p2",
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        isVip: true,
        source: "instagram",
        tags: "lash,jewelry",
        interests: "lash",
        birthday: "06/15",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/json/listsubscribe"),
        expect.objectContaining({ method: "POST" }),
      );

      const callOptions = mockFetch.mock.calls[0][1];
      const body = new URLSearchParams(callOptions.body);
      expect(body.get("listkey")).toBe("list-key-abc");
      expect(body.get("resfmt")).toBe("JSON");

      const contactInfo = JSON.parse(body.get("contactinfo")!);
      expect(contactInfo["Contact Email"]).toBe("alice@example.com");
      expect(contactInfo["First Name"]).toBe("Alice");
      expect(contactInfo["Last Name"]).toBe("Smith");
      expect(contactInfo["VIP"]).toBe("true");
      expect(contactInfo["Source"]).toBe("instagram");
      expect(contactInfo["Tags"]).toBe("lash,jewelry");
      expect(contactInfo["Interests"]).toBe("lash");
      expect(contactInfo["Birthday"]).toBe("06/15");
    });

    it("stores the returned contact key in the profile", async () => {
      mockFetch.mockResolvedValue(okJson({ status: "success", message: "stored-contact-key" }));

      const { syncCampaignsSubscriber } = await import("./zoho-campaigns");
      await syncCampaignsSubscriber({
        profileId: "p3",
        email: "bob@example.com",
        firstName: "Bob",
      });

      expect(mockDbSetWhere).toHaveBeenCalled();
    });

    it("omits optional fields from contactInfo when not provided", async () => {
      const { syncCampaignsSubscriber } = await import("./zoho-campaigns");
      await syncCampaignsSubscriber({
        profileId: "p4",
        email: "min@example.com",
        firstName: "Min",
      });

      const callOptions = mockFetch.mock.calls[0][1];
      const body = new URLSearchParams(callOptions.body);
      const contactInfo = JSON.parse(body.get("contactinfo")!);

      expect(contactInfo).not.toHaveProperty("VIP");
      expect(contactInfo).not.toHaveProperty("Source");
      expect(contactInfo).not.toHaveProperty("Tags");
      expect(contactInfo).not.toHaveProperty("Interests");
      expect(contactInfo).not.toHaveProperty("Birthday");
    });

    it("does not throw when the API call fails (fire-and-forget)", async () => {
      mockFetch.mockResolvedValue(errorResponse(500));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { syncCampaignsSubscriber } = await import("./zoho-campaigns");
      await expect(
        syncCampaignsSubscriber({ profileId: "p5", email: "fail@e.com", firstName: "Fail" }),
      ).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });

  describe("unsubscribeFromCampaigns", () => {
    it("is a no-op when not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { unsubscribeFromCampaigns } = await import("./zoho-campaigns");

      await unsubscribeFromCampaigns("p1");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("is a no-op when the profile has no email", async () => {
      mockDbLimit.mockResolvedValue([{ email: null, zohoCampaignsContactKey: null }]);

      const { unsubscribeFromCampaigns } = await import("./zoho-campaigns");
      await unsubscribeFromCampaigns("p2");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("is a no-op when the profile row is not found", async () => {
      mockDbLimit.mockResolvedValue([]);

      const { unsubscribeFromCampaigns } = await import("./zoho-campaigns");
      await unsubscribeFromCampaigns("p-missing");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls the listunsubscribe endpoint with the profile email", async () => {
      mockDbLimit.mockResolvedValue([
        { email: "unsub@example.com", zohoCampaignsContactKey: "ckey-abc" },
      ]);

      const { unsubscribeFromCampaigns } = await import("./zoho-campaigns");
      await unsubscribeFromCampaigns("p3");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/json/listunsubscribe"),
        expect.objectContaining({ method: "POST" }),
      );

      const callOptions = mockFetch.mock.calls[0][1];
      const body = new URLSearchParams(callOptions.body);
      const contactInfo = JSON.parse(body.get("contactinfo")!);
      expect(contactInfo["Contact Email"]).toBe("unsub@example.com");
    });

    it("does not throw when the API call fails (fire-and-forget)", async () => {
      mockDbLimit.mockResolvedValue([{ email: "fail@example.com", zohoCampaignsContactKey: null }]);
      mockFetch.mockResolvedValue(errorResponse(500));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { unsubscribeFromCampaigns } = await import("./zoho-campaigns");
      await expect(unsubscribeFromCampaigns("p4")).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });
});
