import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * payment-actions.test.ts -- Tests for getSavedCards, deleteCard, saveCardToken.
 *
 * Mocks: @/lib/auth (getUser), @/db + @/db/schema (Drizzle), @/lib/square
 * (squareClient, isSquareConfigured), @/lib/square/customers
 * (createSquareCustomer), @/lib/retry (withRetry pass-through),
 * @sentry/nextjs (captureException), next/cache (revalidatePath).
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockCaptureException = vi.fn();
const mockRevalidatePath = vi.fn();
const mockIsSquareConfigured = vi.fn(() => true);
const mockCardsList = vi.fn();
const mockCardsDisable = vi.fn();
const mockCardsCreate = vi.fn();
const mockCreateSquareCustomer = vi.fn();
const mockDbSelect = vi.fn(() => makeChain([]));
const mockDbUpdateWhere = vi.fn();

function setupMocks() {
  vi.doMock("@/lib/auth", () => ({
    getUser: mockGetUser,
  }));

  vi.doMock("@sentry/nextjs", () => ({
    captureException: mockCaptureException,
  }));

  vi.doMock("next/cache", () => ({
    revalidatePath: mockRevalidatePath,
  }));

  vi.doMock("@/lib/retry", () => ({
    withRetry: vi.fn().mockImplementation((fn: () => unknown) => fn()),
  }));

  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: mockIsSquareConfigured,
    squareClient: {
      cards: {
        list: (...args: unknown[]) => mockCardsList(...args),
        disable: (...args: unknown[]) => mockCardsDisable(...args),
        create: (...args: unknown[]) => mockCardsCreate(...args),
      },
    },
  }));

  vi.doMock("@/lib/square/customers", () => ({
    createSquareCustomer: mockCreateSquareCustomer,
  }));

  const tableMock = () =>
    new Proxy({} as Record<string, string>, {
      get: (_t, prop: string) => prop,
    });

  vi.doMock("@/db", () => ({
    db: {
      select: mockDbSelect,
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: mockDbUpdateWhere })),
      })),
    },
  }));

  vi.doMock("@/db/schema", () => ({
    profiles: tableMock(),
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("payment-actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    mockIsSquareConfigured.mockReturnValue(true);
  });

  /* ---- getSavedCards ---- */

  describe("getSavedCards", () => {
    it("returns empty array when Square is not configured", async () => {
      vi.resetModules();
      mockIsSquareConfigured.mockReturnValue(false);
      setupMocks();
      const { getSavedCards } = await import("./payment-actions");
      const result = await getSavedCards();
      expect(result).toEqual([]);
    });

    it("returns empty array when profile has no squareCustomerId", async () => {
      vi.resetModules();
      mockDbSelect.mockReturnValue(makeChain([{ squareCustomerId: null }]));
      setupMocks();
      const { getSavedCards } = await import("./payment-actions");
      const result = await getSavedCards();
      expect(result).toEqual([]);
    });

    it("returns mapped card data from Square API", async () => {
      vi.resetModules();
      mockDbSelect.mockReturnValue(makeChain([{ squareCustomerId: "SQ_CUST_1" }]));
      mockCardsList.mockResolvedValue({
        data: [
          {
            id: "card-1",
            cardBrand: "VISA",
            last4: "4242",
            expMonth: BigInt(8),
            expYear: BigInt(2027),
            enabled: true,
          },
          {
            id: "card-2",
            cardBrand: "MASTERCARD",
            last4: "5555",
            expMonth: BigInt(12),
            expYear: BigInt(2026),
            enabled: true,
          },
          {
            id: "card-disabled",
            cardBrand: "AMEX",
            last4: "0001",
            expMonth: BigInt(1),
            expYear: BigInt(2025),
            enabled: false,
          },
        ],
      });
      setupMocks();

      const { getSavedCards } = await import("./payment-actions");
      const result = await getSavedCards();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "card-1",
        brand: "VISA",
        last4: "4242",
        expMonth: 8,
        expYear: 2027,
        isDefault: true,
      });
      expect(result[1]).toEqual({
        id: "card-2",
        brand: "MASTERCARD",
        last4: "5555",
        expMonth: 12,
        expYear: 2026,
        isDefault: false,
      });
    });

    it("returns empty array and logs to Sentry on Square API error", async () => {
      vi.resetModules();
      mockDbSelect.mockReturnValue(makeChain([{ squareCustomerId: "SQ_CUST_1" }]));
      const apiError = new Error("Square timeout");
      mockCardsList.mockRejectedValue(apiError);
      setupMocks();

      const { getSavedCards } = await import("./payment-actions");
      const result = await getSavedCards();

      expect(result).toEqual([]);
      expect(mockCaptureException).toHaveBeenCalledWith(apiError);
    });
  });

  /* ---- deleteCard ---- */

  describe("deleteCard", () => {
    it("calls Square cards.disable and returns success", async () => {
      vi.resetModules();
      mockCardsDisable.mockResolvedValue({});
      setupMocks();

      const { deleteCard } = await import("./payment-actions");
      const result = await deleteCard("card-123");

      expect(result).toEqual({ success: true });
      expect(mockCardsDisable).toHaveBeenCalledWith({ cardId: "card-123" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });

    it("returns error when cardId is empty", async () => {
      vi.resetModules();
      setupMocks();

      const { deleteCard } = await import("./payment-actions");
      const result = await deleteCard("");

      expect(result.success).toBe(false);
      expect(mockCardsDisable).not.toHaveBeenCalled();
    });

    it("returns error and logs to Sentry on Square API failure", async () => {
      vi.resetModules();
      const apiError = new Error("Square error");
      mockCardsDisable.mockRejectedValue(apiError);
      setupMocks();

      const { deleteCard } = await import("./payment-actions");
      const result = await deleteCard("card-fail");

      expect(result).toEqual({ success: false, error: "Square error" });
      expect(mockCaptureException).toHaveBeenCalledWith(apiError);
    });
  });

  /* ---- saveCardToken ---- */

  describe("saveCardToken", () => {
    it("creates card for existing Square customer", async () => {
      vi.resetModules();
      mockDbSelect.mockReturnValue(
        makeChain([
          {
            squareCustomerId: "SQ_CUST_1",
            firstName: "Jane",
            lastName: "Doe",
            email: "jane@test.com",
            phone: "555",
          },
        ]),
      );
      mockCardsCreate.mockResolvedValue({
        card: {
          id: "new-card-1",
          cardBrand: "VISA",
          last4: "1234",
          expMonth: BigInt(3),
          expYear: BigInt(2028),
        },
      });
      setupMocks();

      const { saveCardToken } = await import("./payment-actions");
      const result = await saveCardToken("cnon_token_123");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.card.id).toBe("new-card-1");
        expect(result.card.brand).toBe("VISA");
        expect(result.card.last4).toBe("1234");
      }
      expect(mockCreateSquareCustomer).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });

    it("creates Square customer if profile has none, then creates card", async () => {
      vi.resetModules();
      mockDbSelect.mockReturnValue(
        makeChain([
          {
            squareCustomerId: null,
            firstName: "Jane",
            lastName: "Doe",
            email: "jane@test.com",
            phone: "555",
          },
        ]),
      );
      mockCreateSquareCustomer.mockResolvedValue("SQ_CUST_NEW");
      mockCardsCreate.mockResolvedValue({
        card: {
          id: "new-card-2",
          cardBrand: "MASTERCARD",
          last4: "9999",
          expMonth: BigInt(6),
          expYear: BigInt(2029),
        },
      });
      setupMocks();

      const { saveCardToken } = await import("./payment-actions");
      const result = await saveCardToken("cnon_token_456");

      expect(result.success).toBe(true);
      expect(mockCreateSquareCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "user-1",
          email: "jane@test.com",
          firstName: "Jane",
        }),
      );
      expect(mockDbUpdateWhere).toHaveBeenCalled();
    });

    it("returns error when createSquareCustomer fails", async () => {
      vi.resetModules();
      mockDbSelect.mockReturnValue(
        makeChain([
          {
            squareCustomerId: null,
            firstName: "Jane",
            lastName: "Doe",
            email: "jane@test.com",
            phone: null,
          },
        ]),
      );
      mockCreateSquareCustomer.mockResolvedValue(null);
      setupMocks();

      const { saveCardToken } = await import("./payment-actions");
      const result = await saveCardToken("cnon_token_789");

      expect(result).toEqual({ success: false, error: "Failed to create Square customer" });
      expect(mockCardsCreate).not.toHaveBeenCalled();
    });

    it("returns error when token is empty", async () => {
      vi.resetModules();
      setupMocks();

      const { saveCardToken } = await import("./payment-actions");
      const result = await saveCardToken("");

      expect(result.success).toBe(false);
    });

    it("returns error and logs to Sentry on Square cards.create failure", async () => {
      vi.resetModules();
      mockDbSelect.mockReturnValue(
        makeChain([
          {
            squareCustomerId: "SQ_CUST_1",
            firstName: "Jane",
            lastName: "Doe",
            email: "jane@test.com",
            phone: null,
          },
        ]),
      );
      const apiError = new Error("Card creation failed");
      mockCardsCreate.mockRejectedValue(apiError);
      setupMocks();

      const { saveCardToken } = await import("./payment-actions");
      const result = await saveCardToken("cnon_token_fail");

      expect(result).toEqual({ success: false, error: "Card creation failed" });
      expect(mockCaptureException).toHaveBeenCalledWith(apiError);
    });
  });
});
