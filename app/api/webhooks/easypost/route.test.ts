/**
 * Tests for POST /api/webhooks/easypost — EasyPost tracking webhook handler.
 *
 * Covers:
 *  - Signature verification: invalid HMAC (403), valid sig (200)
 *  - Invalid input: malformed JSON body (400)
 *  - Idempotency: already-processed event → 200 "Already processed"
 *  - tracker.updated → shipped: order found with status "in_progress",
 *    tracking status "in_transit" → updates order to "shipped", sends
 *    OrderShipped email to client
 *  - tracker.updated → completed: tracking "delivered" → updates order
 *    to "completed" with completedAt timestamp
 *  - Status unchanged: order already "shipped" + tracking "in_transit" →
 *    no DB update, no email sent
 *  - OrderShipped email: verifies sendEmail and OrderShipped component
 *    called with correct client name, order number, tracking info
 *  - Unknown event type: non-tracker event → 200 OK, skipped processing
 *
 * Mocks: db (select/insert/update chains), verifyEasyPostWebhook,
 * sendEmail, logAction, OrderShipped component, Sentry.
 * Uses per-test vi.resetModules + vi.doMock to swap DB behaviour.
 */
// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
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

const mockVerifyEasyPostWebhook = vi.fn();
const mockSendEmail = vi.fn();
const mockLogAction = vi.fn();
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/webhooks/easypost", {
    method: "POST",
    body,
    headers,
  });
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_123",
    description: "tracker.updated",
    result: {
      tracking_code: "TRACK123",
      status: "in_transit",
      public_url: "https://track.example.com/TRACK123",
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/webhooks/easypost", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default mock returns
    mockWhere.mockReturnValue([]);
    mockReturning.mockReturnValue([{ id: 1 }]);
    mockVerifyEasyPostWebhook.mockReturnValue(true);
    mockSendEmail.mockResolvedValue(undefined);
    mockLogAction.mockResolvedValue(undefined);

    vi.resetModules();

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
      orders: {
        id: "id",
        clientId: "clientId",
        orderNumber: "orderNumber",
        title: "title",
        status: "status",
        trackingNumber: "trackingNumber",
        trackingUrl: "trackingUrl",
        completedAt: "completedAt",
      },
      profiles: {
        id: "id",
        email: "email",
        firstName: "firstName",
      },
      webhookEvents: {
        id: "id",
        provider: "provider",
        externalEventId: "externalEventId",
        eventType: "eventType",
        payload: "payload",
        isProcessed: "isProcessed",
        processedAt: "processedAt",
        attempts: "attempts",
        errorMessage: "errorMessage",
      },
      syncLog: {},
    }));

    vi.doMock("@/lib/easypost", () => ({
      verifyEasyPostWebhook: mockVerifyEasyPostWebhook,
    }));

    vi.doMock("@/lib/resend", () => ({
      sendEmail: mockSendEmail,
    }));

    vi.doMock("@/lib/audit", () => ({
      logAction: mockLogAction,
    }));

    vi.doMock("@/emails/OrderShipped", () => ({
      OrderShipped: vi.fn(() => "email-component"),
    }));

    vi.doMock("@sentry/nextjs", () => ({
      captureException: mockCaptureException,
    }));

    const mod = await import("./route");
    POST = mod.POST;
  });

  /* ---------- Signature verification ---------- */

  it("returns 403 for invalid HMAC signature", async () => {
    mockVerifyEasyPostWebhook.mockReturnValue(false);

    const body = JSON.stringify(makeEvent());
    const req = makeRequest(body, { "x-hmac-signature": "invalid-sig" });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe("Invalid signature");
  });

  it("returns 200 for valid signature", async () => {
    const body = JSON.stringify(makeEvent());
    const req = makeRequest(body, { "x-hmac-signature": "valid-sig" });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  /* ---------- Invalid input ---------- */

  it("returns 400 for invalid JSON", async () => {
    // Signature passes but body is not valid JSON
    const req = makeRequest("not valid json {{{", { "x-hmac-signature": "valid-sig" });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe("Invalid JSON");
  });

  /* ---------- Idempotency ---------- */

  it("returns 200 for already-processed event (idempotency)", async () => {
    vi.resetModules();

    vi.doMock("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => [{ id: 99, isProcessed: true }],
          }),
        }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 1 }] }) }),
        update: () => ({ set: () => ({ where: vi.fn() }) }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      orders: {},
      profiles: {},
      webhookEvents: {
        id: "id",
        externalEventId: "externalEventId",
        isProcessed: "isProcessed",
      },
      syncLog: {},
    }));
    vi.doMock("@/lib/easypost", () => ({
      verifyEasyPostWebhook: vi.fn(() => true),
    }));
    vi.doMock("@/lib/resend", () => ({ sendEmail: vi.fn() }));
    vi.doMock("@/lib/audit", () => ({ logAction: vi.fn() }));
    vi.doMock("@/emails/OrderShipped", () => ({ OrderShipped: vi.fn(() => "email-component") }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const body = JSON.stringify(makeEvent({ id: "already-processed-evt" }));
    const req = makeRequest(body, { "x-hmac-signature": "sig" });

    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("Already processed");
  });

  /* ---------- tracker.updated → shipped ---------- */

  it("processes tracker.updated event and updates order status", async () => {
    vi.resetModules();

    let selectCallCount = 0;
    const localMockSet = vi.fn().mockReturnValue({ where: vi.fn() });

    vi.doMock("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              selectCallCount++;
              // Call 1: idempotency check → not found
              if (selectCallCount === 1) return [];
              // Call 2: order lookup → found with status "in_progress"
              if (selectCallCount === 2) {
                return [
                  {
                    id: 10,
                    clientId: "client-uuid-1",
                    orderNumber: "ORD-001",
                    title: "Custom Print",
                    status: "in_progress",
                  },
                ];
              }
              // Call 3: client lookup
              if (selectCallCount === 3) {
                return [{ email: "client@example.com", firstName: "Jane" }];
              }
              return [];
            },
          }),
        }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 1 }] }) }),
        update: () => ({
          set: localMockSet,
        }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      orders: {
        id: "id",
        clientId: "clientId",
        orderNumber: "orderNumber",
        title: "title",
        status: "status",
        trackingNumber: "trackingNumber",
        trackingUrl: "trackingUrl",
        completedAt: "completedAt",
      },
      profiles: { id: "id", email: "email", firstName: "firstName" },
      webhookEvents: {
        id: "id",
        externalEventId: "externalEventId",
        isProcessed: "isProcessed",
        processedAt: "processedAt",
        errorMessage: "errorMessage",
      },
      syncLog: {},
    }));
    vi.doMock("@/lib/easypost", () => ({
      verifyEasyPostWebhook: vi.fn(() => true),
    }));
    const localSendEmail = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/lib/resend", () => ({ sendEmail: localSendEmail }));
    vi.doMock("@/lib/audit", () => ({ logAction: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock("@/emails/OrderShipped", () => ({ OrderShipped: vi.fn(() => "email-component") }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const event = makeEvent({
      result: {
        tracking_code: "EZ1000000001",
        status: "in_transit",
        public_url: "https://track.easypost.com/abc123",
      },
    });
    const body = JSON.stringify(event);
    const req = makeRequest(body, { "x-hmac-signature": "sig" });

    const res = await mod.POST(req);
    expect(res.status).toBe(200);

    // Verify order was updated with "shipped" status
    expect(localMockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "shipped" }));
  });

  /* ---------- OrderShipped email ---------- */

  it("sends OrderShipped email when order transitions to shipped", async () => {
    vi.resetModules();

    let selectCallCount = 0;
    const localSendEmail = vi.fn().mockResolvedValue(undefined);
    const localOrderShipped = vi.fn(() => "email-component");

    vi.doMock("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              selectCallCount++;
              if (selectCallCount === 1) return [];
              if (selectCallCount === 2) {
                return [
                  {
                    id: 20,
                    clientId: "client-uuid-2",
                    orderNumber: "ORD-002",
                    title: "Photo Book",
                    status: "in_progress",
                  },
                ];
              }
              if (selectCallCount === 3) {
                return [{ email: "buyer@example.com", firstName: "John" }];
              }
              return [];
            },
          }),
        }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 2 }] }) }),
        update: () => ({ set: () => ({ where: vi.fn() }) }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      orders: {
        id: "id",
        clientId: "clientId",
        orderNumber: "orderNumber",
        title: "title",
        status: "status",
        trackingNumber: "trackingNumber",
        trackingUrl: "trackingUrl",
        completedAt: "completedAt",
      },
      profiles: { id: "id", email: "email", firstName: "firstName" },
      webhookEvents: {
        id: "id",
        externalEventId: "externalEventId",
        isProcessed: "isProcessed",
        processedAt: "processedAt",
        errorMessage: "errorMessage",
      },
      syncLog: {},
    }));
    vi.doMock("@/lib/easypost", () => ({ verifyEasyPostWebhook: vi.fn(() => true) }));
    vi.doMock("@/lib/resend", () => ({ sendEmail: localSendEmail }));
    vi.doMock("@/lib/audit", () => ({ logAction: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock("@/emails/OrderShipped", () => ({ OrderShipped: localOrderShipped }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const event = makeEvent({
      result: {
        tracking_code: "EZ2000000002",
        status: "out_for_delivery",
        public_url: "https://track.easypost.com/xyz",
      },
    });
    const body = JSON.stringify(event);
    const req = makeRequest(body, { "x-hmac-signature": "sig" });

    await mod.POST(req);

    // Verify sendEmail was called with correct args
    expect(localSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        subject: expect.stringContaining("ORD-002"),
        react: "email-component",
        entityType: "order_shipped",
        localId: "20",
      }),
    );

    // Verify OrderShipped was called with correct props
    expect(localOrderShipped).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "John",
        orderNumber: "ORD-002",
        productTitle: "Photo Book",
        trackingNumber: "EZ2000000002",
        trackingUrl: "https://track.easypost.com/xyz",
      }),
    );
  });

  /* ---------- tracker.updated → completed ---------- */

  it("processes tracker.updated and updates order to completed on delivered", async () => {
    vi.resetModules();

    let selectCallCount = 0;
    const localMockSet = vi.fn().mockReturnValue({ where: vi.fn() });

    vi.doMock("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              selectCallCount++;
              if (selectCallCount === 1) return [];
              if (selectCallCount === 2) {
                return [
                  {
                    id: 30,
                    clientId: "client-uuid-3",
                    orderNumber: "ORD-003",
                    title: "Canvas Print",
                    status: "shipped",
                  },
                ];
              }
              return [];
            },
          }),
        }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 3 }] }) }),
        update: () => ({ set: localMockSet }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      orders: {
        id: "id",
        clientId: "clientId",
        orderNumber: "orderNumber",
        title: "title",
        status: "status",
        trackingNumber: "trackingNumber",
        trackingUrl: "trackingUrl",
        completedAt: "completedAt",
      },
      profiles: { id: "id", email: "email", firstName: "firstName" },
      webhookEvents: {
        id: "id",
        externalEventId: "externalEventId",
        isProcessed: "isProcessed",
        processedAt: "processedAt",
        errorMessage: "errorMessage",
      },
      syncLog: {},
    }));
    vi.doMock("@/lib/easypost", () => ({ verifyEasyPostWebhook: vi.fn(() => true) }));
    vi.doMock("@/lib/resend", () => ({ sendEmail: vi.fn() }));
    vi.doMock("@/lib/audit", () => ({ logAction: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock("@/emails/OrderShipped", () => ({ OrderShipped: vi.fn(() => "email-component") }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const event = makeEvent({
      result: {
        tracking_code: "EZ3000000003",
        status: "delivered",
        public_url: "https://track.easypost.com/del",
      },
    });
    const body = JSON.stringify(event);
    const req = makeRequest(body, { "x-hmac-signature": "sig" });

    const res = await mod.POST(req);
    expect(res.status).toBe(200);

    // Verify order was updated to "completed" and completedAt was set
    expect(localMockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        completedAt: expect.any(Date),
      }),
    );
  });

  /* ---------- Unknown event type ---------- */

  it("returns 200 and skips processing for unknown event type", async () => {
    vi.resetModules();

    vi.doMock("@/db", () => ({
      db: {
        select: () => ({ from: () => ({ where: () => [] }) }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 1 }] }) }),
        update: () => ({ set: () => ({ where: vi.fn() }) }),
      },
    }));
    vi.doMock("@/db/schema", () => ({
      orders: {},
      profiles: {},
      webhookEvents: {
        id: "id",
        externalEventId: "externalEventId",
        isProcessed: "isProcessed",
        processedAt: "processedAt",
        errorMessage: "errorMessage",
      },
      syncLog: {},
    }));
    vi.doMock("@/lib/easypost", () => ({ verifyEasyPostWebhook: vi.fn(() => true) }));
    vi.doMock("@/lib/resend", () => ({ sendEmail: vi.fn() }));
    vi.doMock("@/lib/audit", () => ({ logAction: vi.fn() }));
    vi.doMock("@/emails/OrderShipped", () => ({ OrderShipped: vi.fn(() => "email-component") }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const event = makeEvent({ description: "batch.created", result: {} });
    const body = JSON.stringify(event);
    const req = makeRequest(body, { "x-hmac-signature": "sig" });

    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("OK");
  });

  /* ---------- Skip update when status unchanged ---------- */

  it("skips status update when order already has same status", async () => {
    vi.resetModules();

    let selectCallCount = 0;
    const localMockUpdate = vi.fn();
    const localMockSet = vi.fn().mockReturnValue({ where: vi.fn() });

    vi.doMock("@/db", () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              selectCallCount++;
              if (selectCallCount === 1) return [];
              if (selectCallCount === 2) {
                return [
                  {
                    id: 40,
                    clientId: "client-uuid-4",
                    orderNumber: "ORD-004",
                    title: "Poster",
                    // Already shipped — same as what in_transit maps to
                    status: "shipped",
                  },
                ];
              }
              return [];
            },
          }),
        }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 4 }] }) }),
        update: (...args: unknown[]) => {
          localMockUpdate(...args);
          return { set: localMockSet };
        },
      },
    }));
    vi.doMock("@/db/schema", () => ({
      orders: {
        id: "id",
        clientId: "clientId",
        orderNumber: "orderNumber",
        title: "title",
        status: "status",
        trackingNumber: "trackingNumber",
        trackingUrl: "trackingUrl",
        completedAt: "completedAt",
      },
      profiles: { id: "id", email: "email", firstName: "firstName" },
      webhookEvents: {
        id: "id",
        externalEventId: "externalEventId",
        isProcessed: "isProcessed",
        processedAt: "processedAt",
        errorMessage: "errorMessage",
      },
      syncLog: {},
    }));
    vi.doMock("@/lib/easypost", () => ({ verifyEasyPostWebhook: vi.fn(() => true) }));
    const localSendEmail = vi.fn();
    vi.doMock("@/lib/resend", () => ({ sendEmail: localSendEmail }));
    vi.doMock("@/lib/audit", () => ({ logAction: vi.fn() }));
    vi.doMock("@/emails/OrderShipped", () => ({ OrderShipped: vi.fn(() => "email-component") }));
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

    const mod = await import("./route");
    const event = makeEvent({
      result: {
        tracking_code: "EZ4000000004",
        status: "in_transit",
        public_url: "https://track.easypost.com/same",
      },
    });
    const body = JSON.stringify(event);
    const req = makeRequest(body, { "x-hmac-signature": "sig" });

    const res = await mod.POST(req);
    expect(res.status).toBe(200);

    // update should only be called for webhookEvents (mark processed), NOT for orders
    // The order update sets status; check localMockSet was NOT called with a status field
    const statusUpdateCall = localMockSet.mock.calls.find(
      (call: unknown[]) =>
        call[0] && typeof call[0] === "object" && "status" in (call[0] as Record<string, unknown>),
    );
    expect(statusUpdateCall).toBeUndefined();

    // sendEmail should NOT have been called (no new shipped transition)
    expect(localSendEmail).not.toHaveBeenCalled();
  });
});
