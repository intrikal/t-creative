// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Square Customers integration (getSquareCardOnFile,
 * createSquareCustomer, linkSquareCustomer).
 *
 * Covers:
 *  - linkSquareCustomer: new client → search Square → not found → create → squareCustomerId stored on profile
 *  - linkSquareCustomer: existing Square customer found by email → link without creating
 *  - linkSquareCustomer: Square API failure → return null, log to Sentry, booking still works (graceful degradation)
 *  - getSquareCardOnFile: returns first active (enabled) card ID
 *  - getSquareCardOnFile: no cards on file → returns null
 *
 * Mocks: ./client (squareClient, isSquareConfigured), @/lib/retry (withRetry pass-through),
 *        @sentry/nextjs (captureException), @/db, @/db/schema, drizzle-orm.
 */

// --- Sentry mock ---
const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

// --- Square API mocks ---
const mockIsSquareConfigured = vi.fn().mockReturnValue(true);
const mockCustomersCreate = vi.fn();
const mockCustomersSearch = vi.fn();
const mockCardsList = vi.fn();

vi.mock("./client", () => ({
  isSquareConfigured: mockIsSquareConfigured,
  squareClient: {
    customers: {
      create: (...args: unknown[]) => mockCustomersCreate(...args),
      search: (...args: unknown[]) => mockCustomersSearch(...args),
    },
    cards: {
      list: (...args: unknown[]) => mockCardsList(...args),
    },
  },
}));

// withRetry: pass-through — just calls the function immediately so tests stay synchronous-style
vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn().mockImplementation((fn: () => unknown) => fn()),
}));

// --- DB mocks ---
// Chain: db.select({...}).from(table).where(eq(...)).limit(1) → [row]
// Chain: db.update(table).set({...}).where(eq(...))
const mockDbWhere = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockDbUpdateWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockDbSelectLimit,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: mockDbUpdateWhere,
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  profiles: { id: "id", squareCustomerId: "squareCustomerId" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

describe("lib/square/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSquareConfigured.mockReturnValue(true);
  });

  // ---------------------------------------------------------------------------
  // linkSquareCustomer
  // ---------------------------------------------------------------------------
  describe("linkSquareCustomer", () => {
    // New client with no existing Square customer: search returns nothing,
    // so createSquareCustomer is called. The new ID is stored on the profile row.
    it("searches Square, creates a new customer when not found, and stores the ID on the profile", async () => {
      const { linkSquareCustomer } = await import("./customers");

      // Profile has no squareCustomerId yet
      mockDbSelectLimit.mockResolvedValue([{ squareCustomerId: null }]);

      // Search returns no matches
      mockCustomersSearch.mockResolvedValue({ customers: [] });

      // Create returns a new customer
      mockCustomersCreate.mockResolvedValue({
        customer: { id: "SQ_CUST_NEW_001" },
      });

      // DB update succeeds
      mockDbUpdateWhere.mockResolvedValue(undefined);

      const result = await linkSquareCustomer({
        profileId: "profile-abc",
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
        phone: "+15551234567",
      });

      expect(result).toBe("SQ_CUST_NEW_001");

      // Must have searched by email first
      expect(mockCustomersSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            filter: {
              emailAddress: { exact: "jane@example.com" },
            },
          },
        }),
      );

      // Must have created a new customer after search returned nothing
      expect(mockCustomersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "customer-profile-abc",
          givenName: "Jane",
          familyName: "Doe",
          emailAddress: "jane@example.com",
          phoneNumber: "+15551234567",
          referenceId: "profile-abc",
        }),
      );

      // Must have stored the new Square ID on the profile
      expect(mockDbUpdateWhere).toHaveBeenCalled();
    });

    // When Square already has a customer matching the email, linkSquareCustomer
    // should use that existing ID and skip the create call entirely.
    it("links the existing Square customer found by email without creating a new one", async () => {
      const { linkSquareCustomer } = await import("./customers");

      // Profile has no squareCustomerId yet
      mockDbSelectLimit.mockResolvedValue([{ squareCustomerId: null }]);

      // Search finds an existing customer
      mockCustomersSearch.mockResolvedValue({
        customers: [{ id: "SQ_CUST_EXISTING_042" }],
      });

      // DB update succeeds
      mockDbUpdateWhere.mockResolvedValue(undefined);

      const result = await linkSquareCustomer({
        profileId: "profile-xyz",
        email: "existing@example.com",
        firstName: "Existing",
      });

      expect(result).toBe("SQ_CUST_EXISTING_042");

      // create must NOT have been called — the customer already exists
      expect(mockCustomersCreate).not.toHaveBeenCalled();

      // The existing ID must be stored on the profile
      expect(mockDbUpdateWhere).toHaveBeenCalled();
    });

    // Square API failures must be non-fatal: return null, log to Sentry, and
    // let the booking flow continue (graceful degradation).
    it("returns null and logs to Sentry when the Square API fails, allowing the booking to proceed", async () => {
      const { linkSquareCustomer } = await import("./customers");

      // Profile lookup itself throws (simulating a Square or DB failure in outer try)
      const apiError = new Error("Square API timeout");
      mockDbSelectLimit.mockRejectedValue(apiError);

      const result = await linkSquareCustomer({
        profileId: "profile-fail",
        email: "fail@example.com",
        firstName: "Fail",
      });

      // Must return null — not throw
      expect(result).toBeNull();

      // Sentry must capture the exception
      expect(mockCaptureException).toHaveBeenCalledWith(apiError);
    });
  });

  // ---------------------------------------------------------------------------
  // getSquareCardOnFile
  // ---------------------------------------------------------------------------
  describe("getSquareCardOnFile", () => {
    // When the customer has cards on file, return the first enabled card's ID.
    it("returns the first active (enabled) card ID", async () => {
      const { getSquareCardOnFile } = await import("./customers");

      mockCardsList.mockResolvedValue({
        data: [
          { id: "CARD_DISABLED", enabled: false },
          { id: "CARD_ACTIVE_001", enabled: true },
          { id: "CARD_ACTIVE_002", enabled: true },
        ],
      });

      const result = await getSquareCardOnFile("SQ_CUST_123");

      expect(result).toBe("CARD_ACTIVE_001");

      // cards.list must be called with the customer ID
      expect(mockCardsList).toHaveBeenCalledWith({
        customerId: "SQ_CUST_123",
      });
    });

    // When the customer has no cards (or all are disabled), return null.
    it("returns null when the customer has no cards on file", async () => {
      const { getSquareCardOnFile } = await import("./customers");

      mockCardsList.mockResolvedValue({ data: [] });

      const result = await getSquareCardOnFile("SQ_CUST_EMPTY");

      expect(result).toBeNull();
    });
  });
});
