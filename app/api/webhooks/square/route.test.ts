import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// Mock db — tracks all calls for assertions
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              // Default: return empty array (no existing records)
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
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...sArgs: unknown[]) => {
          mockSet(...sArgs);
          return {
            where: vi.fn(),
          };
        },
      };
    },
  },
}));

vi.mock("@/db/schema", () => ({
  payments: { id: "id", squarePaymentId: "squarePaymentId" },
  bookings: { id: "id", clientId: "clientId", squareOrderId: "squareOrderId" },
  webhookEvents: {
    id: "id",
    provider: "provider",
    externalEventId: "externalEventId",
    isProcessed: "isProcessed",
  },
  syncLog: {},
}));

let mockSignatureKey = "";
vi.mock("@/lib/square", () => ({
  get SQUARE_WEBHOOK_SIGNATURE_KEY() {
    return mockSignatureKey;
  },
  squareClient: { orders: { get: vi.fn().mockRejectedValue(new Error("not configured")) } },
  isSquareConfigured: vi.fn(() => false),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeSignature(body: string, url: string, key: string): string {
  const hmac = createHmac("sha256", key);
  hmac.update(url + body);
  return hmac.digest("base64");
}

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/webhooks/square", {
    method: "POST",
    body,
    headers,
  });
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
          receipt_url: "https://squareup.com/receipt/123",
          order_id: "sq_order_456",
        },
      },
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/webhooks/square", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSignatureKey = "";

    // Default mock returns: no existing webhook event, insert returns id
    mockWhere.mockReturnValue([]);
    mockReturning.mockReturnValue([{ id: 1 }]);

    // Re-import to get fresh module
    vi.resetModules();

    // Re-mock modules after reset
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
        update: (...args: unknown[]) => {
          mockUpdate(...args);
          return {
            set: (...sArgs: unknown[]) => {
              mockSet(...sArgs);
              return {
                where: vi.fn(),
              };
            },
          };
        },
      },
    }));

    vi.doMock("@/db/schema", () => ({
      payments: { id: "id", squarePaymentId: "squarePaymentId" },
      webhookEvents: {
        id: "id",
        provider: "provider",
        externalEventId: "externalEventId",
        isProcessed: "isProcessed",
      },
      syncLog: {},
    }));

    vi.doMock("@/lib/square", () => ({
      get SQUARE_WEBHOOK_SIGNATURE_KEY() {
        return mockSignatureKey;
      },
      squareClient: { orders: { get: vi.fn().mockRejectedValue(new Error("not configured")) } },
      isSquareConfigured: vi.fn(() => false),
    }));

    const mod = await import("./route");
    POST = mod.POST;
  });

  /* ---------- Signature verification ---------- */

  it("returns 403 when signature key is set but signature is invalid", async () => {
    mockSignatureKey = "test-webhook-key";
    // Re-import with new key
    vi.resetModules();
    vi.doMock("@/lib/square", () => ({
      get SQUARE_WEBHOOK_SIGNATURE_KEY() {
        return "test-webhook-key";
      },
    }));
    vi.doMock("@/db", () => ({
      db: {
        select: () => ({ from: () => ({ where: () => [] }) }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 1 }] }) }),
        update: () => ({ set: () => ({ where: vi.fn() }) }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      payments: {},
      bookings: {},
      webhookEvents: {},
      syncLog: {},
    }));

    const mod = await import("./route");
    const body = JSON.stringify(makeEvent());
    const req = makeRequest(body, {
      "x-square-hmacsha256-signature": "invalid-signature",
    });

    const res = await mod.POST(req);
    expect(res.status).toBe(403);
  });

  it("accepts valid HMAC signature", async () => {
    const key = "test-webhook-key";
    const body = JSON.stringify(makeEvent());
    const url = "https://example.com/api/webhooks/square";
    const validSig = makeSignature(body, url, key);

    vi.resetModules();
    vi.doMock("@/lib/square", () => ({
      SQUARE_WEBHOOK_SIGNATURE_KEY: key,
      squareClient: { orders: { get: vi.fn().mockRejectedValue(new Error("not configured")) } },
      isSquareConfigured: vi.fn(() => false),
    }));
    vi.doMock("@/db", () => ({
      db: {
        select: () => ({ from: () => ({ where: () => [] }) }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 1 }] }) }),
        update: () => ({ set: () => ({ where: vi.fn() }) }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      payments: {},
      bookings: {},
      webhookEvents: {},
      syncLog: {},
    }));

    const mod = await import("./route");
    const req = makeRequest(body, {
      "x-square-hmacsha256-signature": validSig,
    });

    const res = await mod.POST(req);
    expect(res.status).toBe(200);
  });

  /* ---------- Invalid input ---------- */

  it("returns 400 for invalid JSON", async () => {
    const req = makeRequest("not valid json {{{");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  /* ---------- Idempotency ---------- */

  it("returns 200 without reprocessing already-processed events", async () => {
    vi.resetModules();

    // First where() call returns existing processed event
    const mockWhereIdempotent = vi.fn().mockReturnValueOnce([{ id: 99, isProcessed: true }]); // idempotency check

    vi.doMock("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: mockWhereIdempotent,
          }),
        }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 1 }] }) }),
        update: () => ({ set: () => ({ where: vi.fn() }) }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      payments: {},
      webhookEvents: {
        id: "id",
        provider: "provider",
        externalEventId: "externalEventId",
        isProcessed: "isProcessed",
      },
      syncLog: {},
    }));
    vi.doMock("@/lib/square", () => ({
      SQUARE_WEBHOOK_SIGNATURE_KEY: "",
      squareClient: { orders: { get: vi.fn().mockRejectedValue(new Error("not configured")) } },
      isSquareConfigured: vi.fn(() => false),
    }));

    const mod = await import("./route");
    const body = JSON.stringify(makeEvent({ event_id: "already-processed" }));
    const req = makeRequest(body);

    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("Already processed");
  });

  /* ---------- Event routing ---------- */

  it("processes payment.completed events and stores webhook", async () => {
    const body = JSON.stringify(makeEvent({ type: "payment.completed" }));
    const req = makeRequest(body);

    const res = await POST(req);
    expect(res.status).toBe(200);
    // Should have called insert for webhook_events and sync_log
    expect(mockInsert).toHaveBeenCalled();
  });

  it("processes payment.updated events", async () => {
    const event = makeEvent({ type: "payment.updated" });
    const body = JSON.stringify(event);
    const req = makeRequest(body);

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("processes refund.created events", async () => {
    const event = {
      event_id: "evt_refund_1",
      type: "refund.created",
      data: {
        object: {
          refund: {
            id: "refund_123",
            payment_id: "sq_pay_abc",
            amount_money: { amount: 2500, currency: "USD" },
            status: "COMPLETED",
          },
        },
      },
    };
    const body = JSON.stringify(event);
    const req = makeRequest(body);

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("handles unknown event types gracefully", async () => {
    const event = makeEvent({ type: "inventory.count.updated" });
    const body = JSON.stringify(event);
    const req = makeRequest(body);

    const res = await POST(req);
    expect(res.status).toBe(200); // Always returns 200 to Square
  });

  /* ---------- Signature bypass when key not configured ---------- */

  it("skips signature check when webhook key is empty", async () => {
    // mockSignatureKey is already "" from beforeEach
    const body = JSON.stringify(makeEvent());
    const req = makeRequest(body); // No signature header

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  /* ---------- Order-based auto-linking ---------- */

  it("auto-links payment to booking via squareOrderId", async () => {
    vi.resetModules();

    let selectCallCount = 0;
    const localInsertValues = vi.fn();

    vi.doMock("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              selectCallCount++;
              // Call 1: idempotency check → not found
              // Call 2: payment by squarePaymentId → not found
              // Call 3: booking by squareOrderId → found!
              if (selectCallCount === 3) {
                return [{ id: 42, clientId: "client-abc" }];
              }
              return [];
            },
          }),
        }),
        insert: () => ({
          values: (...args: unknown[]) => {
            localInsertValues(...args);
            return { returning: () => [{ id: 1 }] };
          },
        }),
        update: () => ({ set: () => ({ where: vi.fn() }) }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      payments: {},
      bookings: {},
      webhookEvents: {},
      syncLog: {},
    }));
    vi.doMock("@/lib/square", () => ({
      SQUARE_WEBHOOK_SIGNATURE_KEY: "",
      squareClient: { orders: { get: vi.fn().mockRejectedValue(new Error("no")) } },
      isSquareConfigured: vi.fn(() => false),
    }));

    const mod = await import("./route");
    const event = makeEvent({
      type: "payment.completed",
      data: {
        object: {
          payment: {
            id: "sq_pay_new",
            order_id: "sq_order_linked",
            amount_money: { amount: 7500, currency: "USD" },
            tenders: [{ type: "CARD" }],
            receipt_url: "https://squareup.com/receipt/test",
          },
        },
      },
    });

    const res = await mod.POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    // Should have inserted a payment record (webhook_events + payment + sync_log)
    expect(localInsertValues).toHaveBeenCalled();
  });

  it("falls through to manual linking when no order match", async () => {
    vi.resetModules();

    const localInsertValues = vi.fn();

    vi.doMock("@/db", () => ({
      db: {
        select: () => ({ from: () => ({ where: () => [] }) }),
        insert: () => ({
          values: (...args: unknown[]) => {
            localInsertValues(...args);
            return { returning: () => [{ id: 1 }] };
          },
        }),
        update: () => ({ set: () => ({ where: vi.fn() }) }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      payments: {},
      bookings: {},
      orders: { squareOrderId: "squareOrderId" },
      webhookEvents: {},
      syncLog: {},
    }));
    vi.doMock("@/lib/square", () => ({
      SQUARE_WEBHOOK_SIGNATURE_KEY: "",
      squareClient: { orders: { get: vi.fn().mockRejectedValue(new Error("no")) } },
      isSquareConfigured: vi.fn(() => false),
    }));

    const mod = await import("./route");
    const event = makeEvent({
      type: "payment.completed",
      data: {
        object: {
          payment: {
            id: "sq_pay_orphan",
            order_id: "sq_order_unknown",
            amount_money: { amount: 5000, currency: "USD" },
          },
        },
      },
    });

    const res = await mod.POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    // Should log to sync_log with "needs manual linking" message
    const syncLogCall = localInsertValues.mock.calls.find(
      (call: unknown[]) =>
        call[0] &&
        typeof call[0] === "object" &&
        "message" in (call[0] as Record<string, unknown>) &&
        String((call[0] as Record<string, unknown>).message).includes("manual linking"),
    );
    expect(syncLogCall).toBeDefined();
  });
});
