import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/**
 * Tests for lib/zoho-crm — Zoho CRM v7 contact management.
 *
 * Covers:
 *  - createZohoContact: POST to /Contacts/upsert with correct fields, stores
 *    the returned contact ID in profiles.zohoContactId
 *  - updateZohoContact: PUT to /Contacts/:id with provided fields
 *  - getZohoAccessToken called for every request (token refresh handled internally)
 *  - API error: captured by Sentry, logged as failed to sync_log, never re-thrown
 *
 * Note: createZohoDeal lives in lib/zoho.ts (not this module).
 *
 * Mocks: @/lib/zoho-auth, @/db (insert/update/select), @/db/schema,
 *        drizzle-orm, @sentry/nextjs, global fetch.
 */

// ── zoho-auth mocks ───────────────────────────────────────────────────────────

const mockIsZohoAuthConfigured = vi.fn().mockReturnValue(true);
const mockGetZohoAccessToken = vi.fn().mockResolvedValue("test-access-token");

vi.mock("@/lib/zoho-auth", () => ({
  isZohoAuthConfigured: mockIsZohoAuthConfigured,
  getZohoAccessToken: mockGetZohoAccessToken,
}));

// ── DB mocks ──────────────────────────────────────────────────────────────────

// insert(syncLog).values({...})
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

// update(profiles).set({...}).where(...)
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

// select({...}).from(profiles).where(eq(...)).limit(1)
const mockSelectLimit = vi.fn();
const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockSelectLimit });
const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

vi.mock("@/db", () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
  },
}));

vi.mock("@/db/schema", () => ({
  profiles: {},
  syncLog: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockReturnValue({}),
}));

// ── Sentry mock ───────────────────────────────────────────────────────────────

const mockCaptureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

// ── helpers ───────────────────────────────────────────────────────────────────

/** Factory for a successful Zoho upsert response containing a new contact ID. */
function zohoUpsertOkResponse(contactId = "zoho-contact-123") {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      data: [{ details: { id: contactId }, status: "success" }],
    }),
  } as unknown as Response;
}

/** Factory for a successful Zoho PUT response (update). */
function zohoUpdateOkResponse() {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ data: [{}] }),
  } as unknown as Response;
}

/** Factory for a failed Zoho API response. */
function zohoErrorResponse(status = 500, body = "Internal Server Error") {
  return {
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("lib/zoho-crm", () => {
  let createZohoContact: typeof import("./zoho-crm").createZohoContact;
  let updateZohoContact: typeof import("./zoho-crm").updateZohoContact;

  // Import once — no env-var branches to test, so resetModules is not needed.
  beforeAll(async () => {
    const mod = await import("./zoho-crm");
    createZohoContact = mod.createZohoContact;
    updateZohoContact = mod.updateZohoContact;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set implementations cleared by clearAllMocks().
    mockIsZohoAuthConfigured.mockReturnValue(true);
    mockGetZohoAccessToken.mockResolvedValue("test-access-token");
    mockInsertValues.mockResolvedValue(undefined);
    mockUpdateWhere.mockResolvedValue(undefined);
    mockSelectLimit.mockResolvedValue([]);
  });

  // ── createZohoContact ───────────────────────────────────────────────────────

  describe("createZohoContact", () => {
    it("sends POST to /Contacts/upsert with correct mapped fields", async () => {
      global.fetch = vi.fn().mockResolvedValue(zohoUpsertOkResponse());

      await createZohoContact({
        profileId: "profile-1",
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
        phone: "555-0100",
        source: "Website",
        role: "Client",
        isVip: true,
        description: "VIP client",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/crm/v7/Contacts/upsert"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Zoho-oauthtoken test-access-token",
            "Content-Type": "application/json",
          }),
        }),
      );

      const callBody = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
      ) as { data: Record<string, unknown>[] };
      const contact = callBody.data[0];

      expect(contact.Email).toBe("jane@example.com");
      expect(contact.First_Name).toBe("Jane");
      expect(contact.Last_Name).toBe("Doe");
      expect(contact.Phone).toBe("555-0100");
      expect(contact.Lead_Source).toBe("Website");
      expect(contact.Title).toBe("Client");
      expect(contact.Tag).toEqual([{ name: "VIP" }]);
    });

    it("stores the returned Zoho contact ID in profiles.zohoContactId", async () => {
      global.fetch = vi.fn().mockResolvedValue(zohoUpsertOkResponse("zoho-456"));

      await createZohoContact({
        profileId: "profile-2",
        email: "bob@example.com",
        firstName: "Bob",
      });

      expect(mockSet).toHaveBeenCalledWith({ zohoContactId: "zoho-456" });
    });

    it("calls getZohoAccessToken to obtain a fresh access token before the request", async () => {
      global.fetch = vi.fn().mockResolvedValue(zohoUpsertOkResponse());

      await createZohoContact({
        profileId: "profile-1",
        email: "test@example.com",
        firstName: "Test",
      });

      expect(mockGetZohoAccessToken).toHaveBeenCalled();
    });

    it("captures exception via Sentry and logs failure when the API returns an error", async () => {
      global.fetch = vi.fn().mockResolvedValue(zohoErrorResponse(500, "Server Error"));

      // Fire-and-forget — must NOT throw to the caller.
      await expect(
        createZohoContact({ profileId: "profile-1", email: "a@a.com", firstName: "A" }),
      ).resolves.toBeUndefined();

      expect(mockCaptureException).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", entityType: "crm_contact" }),
      );
    });

    it("is a no-op when Zoho auth is not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      global.fetch = vi.fn();

      await createZohoContact({ profileId: "p1", email: "a@a.com", firstName: "A" });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ── updateZohoContact ───────────────────────────────────────────────────────

  describe("updateZohoContact", () => {
    it("sends PUT to /Contacts/:id with the provided fields", async () => {
      global.fetch = vi.fn().mockResolvedValue(zohoUpdateOkResponse());

      await updateZohoContact({
        profileId: "profile-1",
        zohoContactId: "zoho-789",
        fields: { Phone: "555-9999", Lead_Source: "Referral" },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/crm/v7/Contacts/zoho-789"),
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            Authorization: "Zoho-oauthtoken test-access-token",
          }),
        }),
      );

      const callBody = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
      ) as { data: Record<string, unknown>[] };
      expect(callBody.data[0]).toEqual({ Phone: "555-9999", Lead_Source: "Referral" });
    });

    it("looks up zohoContactId from profiles DB when not explicitly provided", async () => {
      mockSelectLimit.mockResolvedValue([{ zohoContactId: "zoho-from-db" }]);
      global.fetch = vi.fn().mockResolvedValue(zohoUpdateOkResponse());

      await updateZohoContact({
        profileId: "profile-1",
        fields: { Phone: "555-1111" },
      });

      // Should have fetched the contactId from the DB, then called the API.
      expect(mockSelectLimit).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/Contacts/zoho-from-db"),
        expect.anything(),
      );
    });

    it("captures exception via Sentry and logs failure when the API returns an error", async () => {
      global.fetch = vi.fn().mockResolvedValue(zohoErrorResponse(404, "Not Found"));

      await expect(
        updateZohoContact({
          profileId: "profile-1",
          zohoContactId: "zoho-789",
          fields: { Phone: "555-0000" },
        }),
      ).resolves.toBeUndefined();

      expect(mockCaptureException).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", entityType: "crm_contact" }),
      );
    });
  });
});
