// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Square Subscriptions integration (createSquareSubscription,
 * cancelSquareSubscription, pauseSquareSubscription, resumeSquareSubscription,
 * getSquareSubscriptionStatus).
 *
 * Covers:
 *  - createSquareSubscription: correct planVariationId, customerId, cardId, and startDate
 *  - cancelSquareSubscription: correct subscriptionId forwarded to Square
 *  - pauseSquareSubscription / resumeSquareSubscription: correct subscriptionId; true on success
 *  - getSquareSubscriptionStatus: subscription not found → returns null
 *  - API timeout: graceful degradation (returns null/false), Sentry alert
 *
 * Mocks: ./client (squareClient, isSquareConfigured, SQUARE_LOCATION_ID),
 *        @/lib/retry (withRetry pass-through), @sentry/nextjs (captureException).
 */

// --- Sentry mock ---
const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

// --- Square API mocks ---
const mockIsSquareConfigured = vi.fn().mockReturnValue(true);
const mockSubscriptionsCreate = vi.fn();
const mockSubscriptionsCancel = vi.fn();
const mockSubscriptionsPause = vi.fn();
const mockSubscriptionsResume = vi.fn();
const mockSubscriptionsGet = vi.fn();
const mockCatalogBatchUpsert = vi.fn();

vi.mock("./client", () => ({
  isSquareConfigured: mockIsSquareConfigured,
  SQUARE_LOCATION_ID: "TEST_LOCATION",
  squareClient: {
    subscriptions: {
      create: (...args: unknown[]) => mockSubscriptionsCreate(...args),
      cancel: (...args: unknown[]) => mockSubscriptionsCancel(...args),
      pause: (...args: unknown[]) => mockSubscriptionsPause(...args),
      resume: (...args: unknown[]) => mockSubscriptionsResume(...args),
      get: (...args: unknown[]) => mockSubscriptionsGet(...args),
    },
    catalog: {
      batchUpsert: (...args: unknown[]) => mockCatalogBatchUpsert(...args),
    },
  },
}));

// withRetry: pass-through — calls fn() immediately so tests stay synchronous-style
vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn().mockImplementation((fn: () => unknown) => fn()),
}));

describe("lib/square/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSquareConfigured.mockReturnValue(true);
  });

  // ---------------------------------------------------------------------------
  // createSquareSubscription
  // ---------------------------------------------------------------------------
  describe("createSquareSubscription", () => {
    // Square requires planVariationId, customerId, cardId, and locationId to
    // create a subscription. startDate is optional but must be forwarded when supplied.
    it("creates a subscription with the correct planVariationId, customerId, cardId, and startDate", async () => {
      const { createSquareSubscription } = await import("./subscriptions");

      mockSubscriptionsCreate.mockResolvedValue({
        subscription: { id: "SQ_SUB_001" },
      });

      const result = await createSquareSubscription({
        squareCustomerId: "SQ_CUST_ABC",
        planVariationId: "PLAN_VAR_XYZ",
        cardId: "CARD_DEF",
        localSubscriptionId: "sub-42",
        startDate: "2026-04-01",
      });

      expect(result).toBe("SQ_SUB_001");

      expect(mockSubscriptionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "sub-sub-42",
          locationId: "TEST_LOCATION",
          customerId: "SQ_CUST_ABC",
          planVariationId: "PLAN_VAR_XYZ",
          cardId: "CARD_DEF",
          startDate: "2026-04-01",
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // cancelSquareSubscription
  // ---------------------------------------------------------------------------
  describe("cancelSquareSubscription", () => {
    // The cancel call must pass the exact subscriptionId so Square cancels the
    // right subscription at end of the current billing period.
    it("cancels the subscription with the correct subscriptionId and returns true", async () => {
      const { cancelSquareSubscription } = await import("./subscriptions");

      mockSubscriptionsCancel.mockResolvedValue({});

      const result = await cancelSquareSubscription("SQ_SUB_CANCEL_001");

      expect(result).toBe(true);
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith({
        subscriptionId: "SQ_SUB_CANCEL_001",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // pauseSquareSubscription / resumeSquareSubscription
  // ---------------------------------------------------------------------------
  describe("pauseSquareSubscription", () => {
    // Pause must forward the subscriptionId and return true on success.
    it("pauses the subscription with the correct subscriptionId and returns true", async () => {
      const { pauseSquareSubscription } = await import("./subscriptions");

      mockSubscriptionsPause.mockResolvedValue({});

      const result = await pauseSquareSubscription("SQ_SUB_PAUSE_001");

      expect(result).toBe(true);
      expect(mockSubscriptionsPause).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId: "SQ_SUB_PAUSE_001" }),
      );
    });
  });

  describe("resumeSquareSubscription", () => {
    // Resume must forward the subscriptionId and return true on success.
    it("resumes the subscription with the correct subscriptionId and returns true", async () => {
      const { resumeSquareSubscription } = await import("./subscriptions");

      mockSubscriptionsResume.mockResolvedValue({});

      const result = await resumeSquareSubscription("SQ_SUB_RESUME_001");

      expect(result).toBe(true);
      expect(mockSubscriptionsResume).toHaveBeenCalledWith({
        subscriptionId: "SQ_SUB_RESUME_001",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getSquareSubscriptionStatus — not found
  // ---------------------------------------------------------------------------
  describe("getSquareSubscriptionStatus", () => {
    // When Square returns a response with no subscription object (e.g. the ID
    // was deleted or never existed), the function must return null rather than
    // crashing — callers check for null to detect missing subscriptions.
    it("returns null when Square returns no subscription object for the given ID", async () => {
      const { getSquareSubscriptionStatus } = await import("./subscriptions");

      // Square responds successfully but with no subscription body
      mockSubscriptionsGet.mockResolvedValue({ subscription: undefined });

      const result = await getSquareSubscriptionStatus("SQ_SUB_MISSING");

      expect(result).toBeNull();
      expect(mockSubscriptionsGet).toHaveBeenCalledWith({
        subscriptionId: "SQ_SUB_MISSING",
      });
    });

    // A successful lookup must return the status and chargedThroughDate.
    it("returns status and chargedThroughDate when the subscription is found", async () => {
      const { getSquareSubscriptionStatus } = await import("./subscriptions");

      mockSubscriptionsGet.mockResolvedValue({
        subscription: {
          id: "SQ_SUB_ACTIVE",
          status: "ACTIVE",
          chargedThroughDate: "2026-04-30",
        },
      });

      const result = await getSquareSubscriptionStatus("SQ_SUB_ACTIVE");

      expect(result).toEqual({
        status: "ACTIVE",
        chargedThroughDate: "2026-04-30",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // API timeout / graceful degradation
  // ---------------------------------------------------------------------------
  describe("graceful degradation on API timeout", () => {
    // A network timeout or Square 503 must not throw into the caller.
    // The function returns null/false and logs the error to Sentry so oncall
    // is alerted without breaking the booking or membership flow.
    it("returns null and logs to Sentry when createSquareSubscription times out", async () => {
      const { createSquareSubscription } = await import("./subscriptions");

      const timeoutError = new Error("Request timed out");
      mockSubscriptionsCreate.mockRejectedValue(timeoutError);

      const result = await createSquareSubscription({
        squareCustomerId: "SQ_CUST_TIMEOUT",
        planVariationId: "PLAN_VAR_TIMEOUT",
        cardId: "CARD_TIMEOUT",
        localSubscriptionId: "sub-timeout",
      });

      // Must degrade gracefully — null, not a thrown exception
      expect(result).toBeNull();
      expect(mockCaptureException).toHaveBeenCalledWith(timeoutError);
    });

    it("returns false and logs to Sentry when cancelSquareSubscription times out", async () => {
      const { cancelSquareSubscription } = await import("./subscriptions");

      const timeoutError = new Error("Network timeout");
      mockSubscriptionsCancel.mockRejectedValue(timeoutError);

      const result = await cancelSquareSubscription("SQ_SUB_TIMEOUT");

      expect(result).toBe(false);
      expect(mockCaptureException).toHaveBeenCalledWith(timeoutError);
    });
  });
});
