// @vitest-environment node

/**
 * Tests for POST /api/webhooks/square — Square webhook receiver.
 *
 * The route verifies HMAC signatures, checks idempotency, stores the raw
 * event in webhook_events, and enqueues to Inngest for async processing.
 * All heavy lifting (payment linking, tax handling, etc.) lives in the
 * Inngest function, not in this route.
 *
 * Covers:
 *  - Signature verification: invalid HMAC (403), valid HMAC (200)
 *  - Invalid input: malformed JSON body (400)
 *  - Idempotency: already-processed event_id → 200 "Already processed"
 *  - Happy path: stores webhook event, sends Inngest event, returns 200
 *  - DB error: insert returns empty → 500
 *
 * Mocks: @/lib/env, @/inngest/client, @/db, @/db/schema, drizzle-orm,
 * @/lib/middleware/request-logger (passthrough).
 */
import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockInngestSend = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();

let mockSignatureKey = "test-webhook-key";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeSignature(body: string, url: string, key: string): string {
  const hmac = createHmac("sha256", key);
  hmac.update(url + body);
  return hmac.digest("base64");
}

const TEST_URL = "https://example.com/api/webhooks/square";

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request(TEST_URL, { method: "POST", body, headers });
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "evt_test_123",
    type: "payment.completed",
    data: {
      object: {
        payment: {
          id: "sq_pay_abc",
          amount_money: { amount: 5000, currency: "USD" },
          order_id: "sq_order_456",
        },
      },
    },
    ...overrides,
  };
}

/** Builds a valid signed request for the default test event. */
function makeSignedRequest(eventOverrides: Record<string, unknown> = {}) {
  const body = JSON.stringify(makeEvent(eventOverrides));
  const sig = makeSignature(body, TEST_URL, mockSignatureKey);
  return makeRequest(body, { "x-square-hmacsha256-signature": sig });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/webhooks/square", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSignatureKey = "test-webhook-key";
    mockInngestSend.mockResolvedValue({ ids: ["evt-abc"] });

    // Default: no existing webhook event, insert returns id
    mockWhere.mockReturnValue([]);
    mockReturning.mockReturnValue([{ id: 1 }]);

    vi.resetModules();

    vi.doMock("@/lib/env", () => ({
      env: { SQUARE_WEBHOOK_SIGNATURE_KEY: mockSignatureKey },
    }));
    vi.doMock("@/inngest/client", () => ({
      inngest: { send: mockInngestSend },
    }));
    vi.doMock("@/lib/middleware/request-logger", () => ({
      withRequestLogger: (handler: Function) => handler,
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn(),
      and: vi.fn(),
    }));
    vi.doMock("@/db", () => ({
      db: {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            from: (...fArgs: unknown[]) => {
              mockFrom(...fArgs);
              return {
                where: (...wArgs: unknown[]) => {
                  mockWhere(...wArgs);
                  return mockWhere.mock.results.at(-1)?.value ?? [];
                },
              };
            },
          };
        },
        insert: (...args: unknown[]) => {
          mockInsert(...args);
          return {
            values: (...vArgs: unknown[]) => {
              mockValues(...vArgs);
              return {
                returning: (...rArgs: unknown[]) => {
                  mockReturning(...rArgs);
                  return mockReturning.mock.results.at(-1)?.value ?? [{ id: 1 }];
                },
              };
            },
          };
        },
      },
    }));
    vi.doMock("@/db/schema", () => ({
      webhookEvents: {
        id: "id",
        provider: "provider",
        externalEventId: "externalEventId",
        isProcessed: "isProcessed",
      },
    }));

    const mod = await import("./route");
    POST = mod.POST;
  });

  /* ---------- Signature verification ---------- */

  it("returns 403 when signature is invalid", async () => {
    const body = JSON.stringify(makeEvent());
    const req = makeRequest(body, {
      "x-square-hmacsha256-signature": "invalid-signature",
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when signature header is missing", async () => {
    const body = JSON.stringify(makeEvent());
    const req = makeRequest(body);

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("accepts valid HMAC signature and returns 200", async () => {
    const res = await POST(makeSignedRequest());
    expect(res.status).toBe(200);
  });

  /* ---------- Invalid input ---------- */

  it("returns 400 for invalid JSON", async () => {
    const body = "not valid json {{{";
    const sig = makeSignature(body, TEST_URL, mockSignatureKey);
    const req = makeRequest(body, { "x-square-hmacsha256-signature": sig });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  /* ---------- Idempotency ---------- */

  it("returns 200 'Already processed' for duplicate events", async () => {
    // First where() call returns existing processed event
    mockWhere.mockReturnValueOnce([{ id: 99, isProcessed: true }]);

    const res = await POST(makeSignedRequest());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("Already processed");
    // Should NOT enqueue to Inngest
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  /* ---------- Happy path: store + enqueue ---------- */

  it("stores webhook event and enqueues to Inngest", async () => {
    const res = await POST(makeSignedRequest());
    expect(res.status).toBe(200);

    // Webhook event was inserted
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "square",
        externalEventId: "evt_test_123",
        eventType: "payment.completed",
        isProcessed: false,
        attempts: 1,
      }),
    );

    // Inngest event was sent
    expect(mockInngestSend).toHaveBeenCalledOnce();
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "square/webhook.received",
        data: expect.objectContaining({
          webhookRowId: 1,
          eventType: "payment.completed",
          eventId: "evt_test_123",
        }),
      }),
    );
  });

  it("forwards all event types to Inngest", async () => {
    for (const type of ["payment.completed", "payment.updated", "refund.created", "unknown.type"]) {
      vi.clearAllMocks();
      mockWhere.mockReturnValue([]);
      mockReturning.mockReturnValue([{ id: 1 }]);
      mockInngestSend.mockResolvedValue({ ids: ["evt-abc"] });

      const res = await POST(makeSignedRequest({ type }));
      expect(res.status).toBe(200);
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: type }),
        }),
      );
    }
  });

  /* ---------- DB error ---------- */

  it("returns 500 when webhook insert fails", async () => {
    mockReturning.mockReturnValue([]);

    const res = await POST(makeSignedRequest());
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe("DB error");
    expect(mockInngestSend).not.toHaveBeenCalled();
  });
});
