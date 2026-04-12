// @vitest-environment node

/**
 * inngest/functions/square-webhook.test.ts
 *
 * Unit tests for the square-webhook Inngest function.
 * Covers handler dispatch for each event type, error handling,
 * sync_log writes, and webhook_events.is_processed marking.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const syncLogTable: MockRow[] = [];
  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  const insertCalls: Array<MockRow> = [];
  const updateCalls: Array<{ table: string; values: MockRow }> = [];

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _syncLog: syncLogTable,
    _insertCalls: insertCalls,
    _updateCalls: updateCalls,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow | MockRow[]) => {
        const rows = Array.isArray(values) ? values : [values];
        for (const v of rows) {
          const id = nextId++;
          const row = { ...v, id };
          insertCalls.push(row);
          if ("provider" in v && "direction" in v) {
            syncLogTable.push(row);
          }
        }
        const returning = vi.fn().mockResolvedValue([{ id: nextId - 1 }]);
        return {
          returning,
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ table: "unknown", values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),

    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(db)),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Handler mocks                                                      */
/* ------------------------------------------------------------------ */

const mockHandlePaymentCompleted = vi.fn().mockResolvedValue("payment processed");
const mockHandlePaymentUpdated = vi.fn().mockResolvedValue("payment updated");
const mockHandleRefundEvent = vi.fn().mockResolvedValue("refund processed");
const mockHandleInvoicePaymentMade = vi.fn().mockResolvedValue("invoice processed");
const mockHandleSubscriptionUpdated = vi.fn().mockResolvedValue("subscription updated");
const mockHandleGiftCardActivity = vi.fn().mockResolvedValue("gift card processed");
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  Inngest step stub                                                  */
/* ------------------------------------------------------------------ */

const step = {
  run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
};

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    webhookEvents: {
      id: "id",
      isProcessed: "isProcessed",
      processedAt: "processedAt",
      errorMessage: "errorMessage",
    },
    syncLog: {
      id: "id",
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      localId: "localId",
      remoteId: "remoteId",
      message: "message",
      errorMessage: "errorMessage",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
  }));
  vi.doMock("@sentry/nextjs", () => ({
    captureException: mockCaptureException,
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
  vi.doMock("@/app/api/webhooks/square/handlers/payment", () => ({
    handlePaymentCompleted: mockHandlePaymentCompleted,
    handlePaymentUpdated: mockHandlePaymentUpdated,
  }));
  vi.doMock("@/app/api/webhooks/square/handlers/refund", () => ({
    handleRefundEvent: mockHandleRefundEvent,
  }));
  vi.doMock("@/app/api/webhooks/square/handlers/invoice", () => ({
    handleInvoicePaymentMade: mockHandleInvoicePaymentMade,
  }));
  vi.doMock("@/app/api/webhooks/square/handlers/subscription", () => ({
    handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
  }));
  vi.doMock("@/app/api/webhooks/square/handlers/gift-card", () => ({
    handleGiftCardActivity: mockHandleGiftCardActivity,
  }));
  vi.doMock("react", () => ({
    createElement: vi.fn((...args: unknown[]) => ({ type: "div", props: args[1] })),
    default: { createElement: vi.fn() },
    cache: vi.fn((fn: any) => fn),
  }));
}

/* ------------------------------------------------------------------ */
/*  Helper: invoke the handler directly                                */
/* ------------------------------------------------------------------ */

function makeEvent(eventType: string, payload: Record<string, unknown> = {}) {
  return {
    data: {
      webhookRowId: 1,
      eventType,
      eventId: `evt-${eventType}`,
      payload: { data: payload },
    },
  };
}

async function runHandler(
  module: typeof import("@/inngest/functions/square-webhook"),
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<{ result: string; syncStatus: string }> {
  const fn = module.squareWebhook as any;
  const handler = fn?.handler ?? fn;
  return handler({ event: makeEvent(eventType, payload), step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("square-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlePaymentCompleted.mockResolvedValue("payment processed");
    mockHandlePaymentUpdated.mockResolvedValue("payment updated");
    mockHandleRefundEvent.mockResolvedValue("refund processed");
    mockHandleInvoicePaymentMade.mockResolvedValue("invoice processed");
    mockHandleSubscriptionUpdated.mockResolvedValue("subscription updated");
    mockHandleGiftCardActivity.mockResolvedValue("gift card processed");
    step.run.mockImplementation(async (_name: string, fn: () => Promise<any>) => fn());
  });

  it("payment.completed → calls payment handler, marks processed", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const mod = await import("@/inngest/functions/square-webhook");
    const result = await runHandler(mod, "payment.completed");

    expect(result.syncStatus).toBe("success");
    expect(result.result).toBe("payment processed");
    expect(mockHandlePaymentCompleted).toHaveBeenCalledOnce();
    // webhook_events marked as processed
    const processedUpdate = db._updateCalls.find((c) => c.values.isProcessed === true);
    expect(processedUpdate).toBeDefined();
    // sync_log written
    const syncInsert = db._insertCalls.find((c) => c.provider === "square");
    expect(syncInsert).toBeDefined();
    expect(syncInsert!.status).toBe("success");
  });

  it("refund.created → calls refund handler", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const mod = await import("@/inngest/functions/square-webhook");
    const result = await runHandler(mod, "refund.created");

    expect(result.syncStatus).toBe("success");
    expect(mockHandleRefundEvent).toHaveBeenCalledOnce();
    const syncInsert = db._insertCalls.find((c) => c.entityType === "refund");
    expect(syncInsert).toBeDefined();
  });

  it("invoice.payment_made → calls invoice handler", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const mod = await import("@/inngest/functions/square-webhook");
    const result = await runHandler(mod, "invoice.payment_made");

    expect(result.syncStatus).toBe("success");
    expect(mockHandleInvoicePaymentMade).toHaveBeenCalledOnce();
    const syncInsert = db._insertCalls.find((c) => c.entityType === "invoice");
    expect(syncInsert).toBeDefined();
  });

  it("gift_card.activity.created → calls gift card handler", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const mod = await import("@/inngest/functions/square-webhook");
    const result = await runHandler(mod, "gift_card.activity.created");

    expect(result.syncStatus).toBe("success");
    expect(mockHandleGiftCardActivity).toHaveBeenCalledOnce();
    const syncInsert = db._insertCalls.find((c) => c.entityType === "gift_card");
    expect(syncInsert).toBeDefined();
  });

  it("subscription.updated → calls subscription handler", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const mod = await import("@/inngest/functions/square-webhook");
    const result = await runHandler(mod, "subscription.updated");

    expect(result.syncStatus).toBe("success");
    expect(mockHandleSubscriptionUpdated).toHaveBeenCalledOnce();
    const syncInsert = db._insertCalls.find((c) => c.entityType === "subscription");
    expect(syncInsert).toBeDefined();
  });

  it("unknown event type → logged as skipped, no handler called", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const mod = await import("@/inngest/functions/square-webhook");
    const result = await runHandler(mod, "catalog.version.updated");

    expect(result.syncStatus).toBe("skipped");
    expect(result.result).toContain("not handled");
    expect(mockHandlePaymentCompleted).not.toHaveBeenCalled();
    expect(mockHandleRefundEvent).not.toHaveBeenCalled();
    // sync_log still written with skipped status
    const syncInsert = db._insertCalls.find((c) => c.provider === "square");
    expect(syncInsert).toBeDefined();
    expect(syncInsert!.status).toBe("skipped");
  });

  it("handler error → caught, webhook_events.is_processed stays false", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    mockHandlePaymentCompleted.mockRejectedValue(new Error("Square API timeout"));

    const mod = await import("@/inngest/functions/square-webhook");
    const result = await runHandler(mod, "payment.completed");

    expect(result.syncStatus).toBe("failed");
    expect(result.result).toBe("Square API timeout");
    expect(mockCaptureException).toHaveBeenCalledOnce();
    // webhook_events updated with error, not marked processed
    const errorUpdate = db._updateCalls.find((c) => c.values.errorMessage !== undefined);
    expect(errorUpdate).toBeDefined();
    expect(errorUpdate!.values.errorMessage).toBe("Square API timeout");
    // No isProcessed=true update
    const processedUpdate = db._updateCalls.find((c) => c.values.isProcessed === true);
    expect(processedUpdate).toBeUndefined();
    // sync_log records the failure
    const syncInsert = db._insertCalls.find((c) => c.provider === "square");
    expect(syncInsert).toBeDefined();
    expect(syncInsert!.status).toBe("failed");
  });

  it("success → webhook_events marked as processed with timestamp", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const mod = await import("@/inngest/functions/square-webhook");
    await runHandler(mod, "payment.completed");

    const processedUpdate = db._updateCalls.find((c) => c.values.isProcessed === true);
    expect(processedUpdate).toBeDefined();
    expect(processedUpdate!.values.processedAt).toBeInstanceOf(Date);
  });
});
