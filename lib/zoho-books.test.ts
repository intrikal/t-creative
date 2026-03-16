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
  bookings: {},
  orders: {},
  enrollments: {},
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
  vi.stubEnv("ZOHO_BOOKS_ORGANIZATION_ID", "org-123");
  vi.resetModules();
  vi.clearAllMocks();

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

describe("lib/zoho-books", () => {
  describe("isZohoBooksConfigured", () => {
    it("returns true when auth and organization ID are configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(true);
      const { isZohoBooksConfigured } = await import("./zoho-books");
      expect(isZohoBooksConfigured()).toBe(true);
    });

    it("returns false when ZOHO_BOOKS_ORGANIZATION_ID is missing", async () => {
      vi.stubEnv("ZOHO_BOOKS_ORGANIZATION_ID", "");
      vi.resetModules();
      mockIsZohoAuthConfigured.mockReturnValue(true);

      const { isZohoBooksConfigured } = await import("./zoho-books");
      expect(isZohoBooksConfigured()).toBe(false);
    });

    it("returns false when Zoho auth is not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { isZohoBooksConfigured } = await import("./zoho-books");
      expect(isZohoBooksConfigured()).toBe(false);
    });
  });

  describe("ensureZohoBooksCustomer", () => {
    it("returns null when not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { ensureZohoBooksCustomer } = await import("./zoho-books");

      const result = await ensureZohoBooksCustomer({
        profileId: "p1",
        email: "e@e.com",
        firstName: "Test",
      });

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns the cached zohoCustomerId without hitting the API", async () => {
      mockDbLimit.mockResolvedValue([{ zohoCustomerId: "cached-cust-id" }]);

      const { ensureZohoBooksCustomer } = await import("./zoho-books");
      const result = await ensureZohoBooksCustomer({
        profileId: "p1",
        email: "e@e.com",
        firstName: "Alice",
      });

      expect(result).toBe("cached-cust-id");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("finds an existing customer by email via the API", async () => {
      mockDbLimit.mockResolvedValue([{ zohoCustomerId: null }]);
      mockFetch.mockResolvedValue(okJson({ contacts: [{ contact_id: "existing-cust-99" }] }));

      const { ensureZohoBooksCustomer } = await import("./zoho-books");
      const result = await ensureZohoBooksCustomer({
        profileId: "p2",
        email: "found@example.com",
        firstName: "Bob",
      });

      expect(result).toBe("existing-cust-99");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/contacts?email="),
        expect.any(Object),
      );
      expect(mockDbSetWhere).toHaveBeenCalled();
    });

    it("creates a new customer when none is found", async () => {
      mockDbLimit.mockResolvedValue([{ zohoCustomerId: null }]);

      // First call: search → empty; second call: create → new customer
      mockFetch
        .mockResolvedValueOnce(okJson({ contacts: [] }))
        .mockResolvedValueOnce(okJson({ contact: { contact_id: "new-cust-77" } }));

      const { ensureZohoBooksCustomer } = await import("./zoho-books");
      const result = await ensureZohoBooksCustomer({
        profileId: "p3",
        email: "new@example.com",
        firstName: "Carol",
        lastName: "Doe",
        phone: "555-9999",
      });

      expect(result).toBe("new-cust-77");

      // The second fetch is the create call
      const createCall = mockFetch.mock.calls[1];
      const body = JSON.parse(createCall[1].body);
      expect(body.email).toBe("new@example.com");
      expect(body.contact_type).toBe("customer");
      expect(body.phone).toBe("555-9999");
    });

    it("returns null when the API throws", async () => {
      mockDbLimit.mockResolvedValue([{ zohoCustomerId: null }]);
      mockFetch.mockResolvedValue(errorResponse(500));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { ensureZohoBooksCustomer } = await import("./zoho-books");
      const result = await ensureZohoBooksCustomer({
        profileId: "p4",
        email: "fail@example.com",
        firstName: "Dave",
      });

      expect(result).toBeNull();
      errorSpy.mockRestore();
    });
  });

  describe("createZohoBooksInvoice", () => {
    it("is a no-op when not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { createZohoBooksInvoice } = await import("./zoho-books");

      await createZohoBooksInvoice({
        entityType: "booking",
        entityId: 1,
        profileId: "p1",
        email: "e@e.com",
        firstName: "Test",
        lineItems: [{ name: "Lash", rate: 10000, quantity: 1 }],
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("creates a customer and invoice, then marks it sent", async () => {
      // Customer lookup (cache miss), customer search, invoice creation, mark sent
      mockDbLimit.mockResolvedValue([{ zohoCustomerId: null }]);
      mockFetch
        .mockResolvedValueOnce(okJson({ contacts: [{ contact_id: "cust-55" }] })) // search
        .mockResolvedValueOnce(
          okJson({ invoice: { invoice_id: "inv-11", invoice_number: "INV-011" } }),
        ) // create invoice
        .mockResolvedValueOnce(okJson({})); // mark sent

      const { createZohoBooksInvoice } = await import("./zoho-books");
      await createZohoBooksInvoice({
        entityType: "booking",
        entityId: 5,
        profileId: "p5",
        email: "alice@example.com",
        firstName: "Alice",
        lineItems: [{ name: "Lash Full Set", rate: 15000, quantity: 1 }],
      });

      // Invoice creation call
      const invoiceCall = mockFetch.mock.calls[1];
      const body = JSON.parse(invoiceCall[1].body);
      expect(body.customer_id).toBe("cust-55");
      expect(body.line_items[0].name).toBe("Lash Full Set");
      expect(body.line_items[0].rate).toBe(150); // cents → dollars
      expect(body.reference_number).toBe("tc-booking-5");

      // Marked sent
      expect(mockFetch.mock.calls[2][0]).toContain("/invoices/inv-11/status/sent");
    });

    it("records a deposit payment when depositInCents is provided", async () => {
      mockDbLimit.mockResolvedValue([{ zohoCustomerId: "cust-66" }]);
      mockFetch
        .mockResolvedValueOnce(
          okJson({ invoice: { invoice_id: "inv-22", invoice_number: "INV-022" } }),
        ) // create invoice
        .mockResolvedValueOnce(okJson({})) // mark sent
        .mockResolvedValueOnce(okJson({})); // record deposit

      const { createZohoBooksInvoice } = await import("./zoho-books");
      await createZohoBooksInvoice({
        entityType: "order",
        entityId: 7,
        profileId: "p7",
        email: "bob@example.com",
        firstName: "Bob",
        lineItems: [{ name: "Jewelry", rate: 20000, quantity: 1 }],
        depositInCents: 5000,
      });

      const depositCall = mockFetch.mock.calls[2];
      const body = JSON.parse(depositCall[1].body);
      expect(body.amount).toBe(50); // 5000 cents → $50
      expect(body.invoices[0].invoice_id).toBe("inv-22");
    });

    it("does not throw when invoice creation fails (fire-and-forget)", async () => {
      mockDbLimit.mockResolvedValue([{ zohoCustomerId: "cust-77" }]);
      mockFetch.mockResolvedValue(errorResponse(500));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { createZohoBooksInvoice } = await import("./zoho-books");
      await expect(
        createZohoBooksInvoice({
          entityType: "enrollment",
          entityId: 3,
          profileId: "p8",
          email: "err@example.com",
          firstName: "Err",
          lineItems: [{ name: "Training", rate: 50000, quantity: 1 }],
        }),
      ).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });

  describe("recordZohoBooksPayment", () => {
    it("is a no-op when not configured", async () => {
      mockIsZohoAuthConfigured.mockReturnValue(false);
      const { recordZohoBooksPayment } = await import("./zoho-books");

      await recordZohoBooksPayment({
        zohoInvoiceId: "inv-1",
        amountInCents: 10000,
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fetches the invoice and records the payment", async () => {
      mockFetch
        .mockResolvedValueOnce(
          okJson({ invoice: { invoice_id: "inv-33", customer_id: "cust-33" } }),
        ) // get invoice
        .mockResolvedValueOnce(okJson({})); // record payment

      const { recordZohoBooksPayment } = await import("./zoho-books");
      await recordZohoBooksPayment({
        zohoInvoiceId: "inv-33",
        amountInCents: 12500,
        squarePaymentId: "sq-pay-abc",
        description: "Balance payment",
      });

      // Payment POST
      const paymentCall = mockFetch.mock.calls[1];
      const body = JSON.parse(paymentCall[1].body);
      expect(body.customer_id).toBe("cust-33");
      expect(body.amount).toBe(125); // 12500 cents → $125
      expect(body.reference_number).toBe("sq-pay-abc");
      expect(body.invoices[0].invoice_id).toBe("inv-33");
    });

    it("throws (and catches) when invoice is missing customer_id", async () => {
      mockFetch.mockResolvedValue(okJson({ invoice: { invoice_id: "inv-x" } }));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { recordZohoBooksPayment } = await import("./zoho-books");
      await expect(
        recordZohoBooksPayment({ zohoInvoiceId: "inv-x", amountInCents: 1000 }),
      ).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });

    it("does not throw when the API call fails (fire-and-forget)", async () => {
      mockFetch.mockResolvedValue(errorResponse(503));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { recordZohoBooksPayment } = await import("./zoho-books");
      await expect(
        recordZohoBooksPayment({ zohoInvoiceId: "inv-fail", amountInCents: 5000 }),
      ).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });
});
