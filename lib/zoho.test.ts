// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
// afterEach: runs a cleanup function after every test in the current describe block
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the Zoho CRM integration module (contacts, deals, notes).
 *
 * Covers:
 *  - isZohoConfigured: delegates to isZohoAuthConfigured
 *  - upsertZohoContact: no-op when unconfigured, upserts via CRM API, stores
 *    zohoContactId, fire-and-forget on failure
 *  - createZohoDeal: no-op when unconfigured, creates deal + stores ID on booking,
 *    fire-and-forget on failure
 *  - updateZohoDeal: no-op when unconfigured/no deal, PUTs new stage, fire-and-forget
 *  - logZohoNote: no-op when unconfigured/no contact, POSTs note, fire-and-forget
 *
 * Mocks: zoho-auth (OAuth), global fetch (Zoho CRM API), db (profile/booking lookup),
 * db/schema, drizzle-orm, Sentry.
 */

// --- Persistent mock references ---
// mockIsZohoAuthConfigured: controls whether Zoho OAuth layer reports as ready
const mockIsZohoAuthConfigured = vi.fn();
// mockGetZohoAccessToken: returns a fake bearer token for API calls
const mockGetZohoAccessToken = vi.fn();
// mockFetch: simulates Zoho CRM REST API endpoints
const mockFetch = vi.fn();
// mockDbLimit: controls profile/booking lookup results
const mockDbLimit = vi.fn();
// mockDbSetWhere: captures profile/booking update calls (storing Zoho IDs)
const mockDbSetWhere = vi.fn();
// mockDbInsertValues: captures sync_log writes
const mockDbInsertValues = vi.fn();

// Mock Zoho auth so tests don't need real OAuth credentials
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
  bookings: {},
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
  vi.resetModules();
  vi.clearAllMocks();

  // Defaults: configured & fetch succeeds
  mockIsZohoAuthConfigured.mockReturnValue(true);
  mockGetZohoAccessToken.mockResolvedValue("test-access-token");
  mockDbLimit.mockResolvedValue([]);
  mockDbSetWhere.mockResolvedValue(undefined);
  mockDbInsertValues.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({}),
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

describe("lib/zoho", () => {
  describe("isZohoConfigured", () => {
    it("returns true when auth is configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(true);
      const { isZohoConfigured } = await import("./zoho");
      expect(isZohoConfigured()).toBe(true);
    });

    it("returns false when auth is not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { isZohoConfigured } = await import("./zoho");
      expect(isZohoConfigured()).toBe(false);
    });
  });

  describe("upsertZohoContact", () => {
    it("is a no-op when not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { upsertZohoContact } = await import("./zoho");

      await upsertZohoContact({
        profileId: "p1",
        email: "test@example.com",
        firstName: "Test",
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls the Zoho upsert endpoint with contact data", async () => {
      mockFetch.mockResolvedValue(
        okJson({ data: [{ details: { id: "zoho-contact-123" }, status: "UPDATED" }] }),
      );

      const { upsertZohoContact } = await import("./zoho");
      await upsertZohoContact({
        profileId: "p1",
        email: "client@example.com",
        firstName: "Alice",
        lastName: "Smith",
        phone: "555-1234",
        isVip: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/crm/v7/Contacts/upsert"),
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.data[0].Email).toBe("client@example.com");
      expect(body.data[0].First_Name).toBe("Alice");
      expect(body.data[0].Tag).toEqual([{ name: "VIP" }]);
      expect(body.duplicate_check_fields).toContain("Email");
    });

    it("stores the returned zohoContactId on the profile", async () => {
      mockFetch.mockResolvedValue(
        okJson({ data: [{ details: { id: "contact-abc" }, status: "INSERTED" }] }),
      );

      const { upsertZohoContact } = await import("./zoho");
      await upsertZohoContact({ profileId: "p2", email: "e@e.com", firstName: "Bob" });

      expect(mockDbSetWhere).toHaveBeenCalled();
    });

    it("does not throw when the API call fails (fire-and-forget)", async () => {
      mockFetch.mockResolvedValue(errorResponse(500));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { upsertZohoContact } = await import("./zoho");
      await expect(
        upsertZohoContact({ profileId: "p3", email: "fail@example.com", firstName: "Err" }),
      ).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });

  describe("createZohoDeal", () => {
    it("is a no-op when not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { createZohoDeal } = await import("./zoho");

      await createZohoDeal({ contactEmail: "e@e.com", dealName: "Deal", stage: "Proposal" });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls the Deals endpoint and stores the deal ID on the booking", async () => {
      // First fetch: create deal
      mockFetch.mockResolvedValue(okJson({ data: [{ details: { id: "deal-999" } }] }));
      // Profile lookup returns a zohoContactId
      mockDbLimit.mockResolvedValue([{ zohoContactId: "contact-xyz" }]);

      const { createZohoDeal } = await import("./zoho");
      await createZohoDeal({
        contactEmail: "client@example.com",
        dealName: "Lash Full Set",
        stage: "Needs Analysis",
        amountInCents: 15000,
        bookingId: 42,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/crm/v7/Deals"),
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.data[0].Deal_Name).toBe("Lash Full Set");
      expect(body.data[0].Amount).toBe(150); // cents → dollars
      expect(body.data[0].Contact_Name).toEqual({ id: "contact-xyz" });

      // Should also update booking with deal ID
      expect(mockDbSetWhere).toHaveBeenCalled();
    });

    it("does not throw when the API call fails", async () => {
      mockFetch.mockResolvedValue(errorResponse(502));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { createZohoDeal } = await import("./zoho");
      await expect(
        createZohoDeal({ contactEmail: "e@e.com", dealName: "D", stage: "S" }),
      ).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });

  describe("updateZohoDeal", () => {
    it("is a no-op when not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { updateZohoDeal } = await import("./zoho");
      await updateZohoDeal(1, "Closed Won");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("is a no-op when the booking has no zohoProjectId", async () => {
      mockDbLimit.mockResolvedValue([{ zohoProjectId: null }]);

      const { updateZohoDeal } = await import("./zoho");
      await updateZohoDeal(99, "Closed Won");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls the Deals PUT endpoint with the new stage", async () => {
      mockDbLimit.mockResolvedValue([{ zohoProjectId: "deal-555" }]);

      const { updateZohoDeal } = await import("./zoho");
      await updateZohoDeal(10, "Closed Won");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/crm/v7/Deals/deal-555"),
        expect.objectContaining({ method: "PUT" }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.data[0].Stage).toBe("Closed Won");
    });

    it("does not throw when the API call fails", async () => {
      mockDbLimit.mockResolvedValue([{ zohoProjectId: "deal-x" }]);
      mockFetch.mockResolvedValue(errorResponse(500));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { updateZohoDeal } = await import("./zoho");
      await expect(updateZohoDeal(1, "Closed Won")).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });

  describe("logZohoNote", () => {
    it("is a no-op when not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { logZohoNote } = await import("./zoho");
      await logZohoNote("p1", "Title", "Content");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("is a no-op when the profile has no zohoContactId", async () => {
      mockDbLimit.mockResolvedValue([{ zohoContactId: null }]);

      const { logZohoNote } = await import("./zoho");
      await logZohoNote("p1", "Title", "Content");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("posts a note to the Zoho Notes endpoint", async () => {
      mockDbLimit.mockResolvedValue([{ zohoContactId: "contact-888" }]);

      const { logZohoNote } = await import("./zoho");
      await logZohoNote("p1", "Review Note", "Client left 5-star review");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/crm/v7/Notes"),
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.data[0].Note_Title).toBe("Review Note");
      expect(body.data[0].Note_Content).toBe("Client left 5-star review");
      expect(body.data[0].Parent_Id.id).toBe("contact-888");
    });

    it("does not throw when the API call fails", async () => {
      mockDbLimit.mockResolvedValue([{ zohoContactId: "contact-err" }]);
      mockFetch.mockResolvedValue(errorResponse(500));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { logZohoNote } = await import("./zoho");
      await expect(logZohoNote("p1", "T", "C")).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });
});
