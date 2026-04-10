import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    set: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockRequireAdmin = vi.fn();
const mockRevalidatePath = vi.fn();
const mockLogAction = vi.fn();
const mockInngestSend = vi.fn().mockResolvedValue(undefined);

function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    webhookEvents: {
      id: "id",
      provider: "provider",
      externalEventId: "external_event_id",
      eventType: "event_type",
      payload: "payload",
      isProcessed: "is_processed",
      processedAt: "processed_at",
      errorMessage: "error_message",
      attempts: "attempts",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    gt: vi.fn((...args: unknown[]) => ({ type: "gt", args })),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/inngest/client", () => ({ inngest: { send: mockInngestSend } }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("webhook-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
  });

  /* ---- getWebhookEvents ---- */

  describe("getWebhookEvents", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { getWebhookEvents } = await import("./webhook-actions");
      await expect(getWebhookEvents()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no events exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getWebhookEvents } = await import("./webhook-actions");
      const result = await getWebhookEvents();
      expect(result).toEqual([]);
    });

    it("returns events for 'all' status filter", async () => {
      vi.resetModules();
      const rows = [
        {
          id: 1,
          provider: "square",
          externalEventId: "evt_123",
          eventType: "payment.completed",
          isProcessed: true,
          attempts: 1,
          errorMessage: null,
          createdAt: new Date("2026-04-01"),
          processedAt: new Date("2026-04-01"),
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getWebhookEvents } = await import("./webhook-actions");
      const result = await getWebhookEvents({ status: "all" });
      expect(result).toEqual(rows);
    });

    it("returns events for 'failed' status filter", async () => {
      vi.resetModules();
      const failedRow = {
        id: 2,
        provider: "square",
        externalEventId: "evt_456",
        eventType: "payment.failed",
        isProcessed: false,
        attempts: 3,
        errorMessage: "Handler error",
        createdAt: new Date("2026-04-02"),
        processedAt: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([failedRow])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getWebhookEvents } = await import("./webhook-actions");
      const result = await getWebhookEvents({ status: "failed" });
      expect(result).toEqual([failedRow]);
    });

    it("returns events for 'pending' status filter", async () => {
      vi.resetModules();
      const pendingRow = {
        id: 3,
        provider: "square",
        externalEventId: "evt_789",
        eventType: "booking.created",
        isProcessed: false,
        attempts: 0,
        errorMessage: null,
        createdAt: new Date("2026-04-03"),
        processedAt: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([pendingRow])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getWebhookEvents } = await import("./webhook-actions");
      const result = await getWebhookEvents({ status: "pending" });
      expect(result).toEqual([pendingRow]);
    });
  });

  /* ---- getWebhookEventDetail ---- */

  describe("getWebhookEventDetail", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { getWebhookEventDetail } = await import("./webhook-actions");
      await expect(getWebhookEventDetail(1)).rejects.toThrow("Not authenticated");
    });

    it("returns null when event not found", async () => {
      vi.resetModules();
      setupMocks();
      const { getWebhookEventDetail } = await import("./webhook-actions");
      const result = await getWebhookEventDetail(999);
      expect(result).toBeNull();
    });

    it("returns full event detail including payload", async () => {
      vi.resetModules();
      const detail = {
        id: 1,
        provider: "square",
        externalEventId: "evt_123",
        eventType: "payment.completed",
        isProcessed: true,
        attempts: 1,
        errorMessage: null,
        createdAt: new Date("2026-04-01"),
        processedAt: new Date("2026-04-01"),
        payload: { type: "payment.completed", data: { id: "pay_1" } },
      };
      setupMocks({
        select: vi.fn(() => makeChain([detail])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getWebhookEventDetail } = await import("./webhook-actions");
      const result = await getWebhookEventDetail(1);
      expect(result).toEqual(detail);
      expect(result?.payload).toEqual({ type: "payment.completed", data: { id: "pay_1" } });
    });
  });

  /* ---- retryWebhookEvent ---- */

  describe("retryWebhookEvent", () => {
    it("returns error when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { retryWebhookEvent } = await import("./webhook-actions");
      const result = await retryWebhookEvent(1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authenticated");
      }
    });

    it("returns error when event not found", async () => {
      vi.resetModules();
      setupMocks();
      const { retryWebhookEvent } = await import("./webhook-actions");
      const result = await retryWebhookEvent(999);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Webhook event not found");
      }
    });

    it("resets the row and sends Inngest event", async () => {
      vi.resetModules();
      const eventRow = {
        id: 5,
        eventType: "payment.completed",
        externalEventId: "evt_abc",
        payload: { type: "payment.completed", data: { id: "pay_5" } },
      };
      const mockUpdate = vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([eventRow])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: mockUpdate,
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { retryWebhookEvent } = await import("./webhook-actions");
      const result = await retryWebhookEvent(5);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInngestSend).toHaveBeenCalledWith({
        name: "square/webhook.received",
        data: {
          webhookRowId: 5,
          eventType: "payment.completed",
          eventId: "evt_abc",
          payload: eventRow.payload,
        },
      });
    });

    it("logs the retry to audit log", async () => {
      vi.resetModules();
      const eventRow = {
        id: 7,
        eventType: "booking.updated",
        externalEventId: "evt_xyz",
        payload: { type: "booking.updated" },
      };
      setupMocks({
        select: vi.fn(() => makeChain([eventRow])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { retryWebhookEvent } = await import("./webhook-actions");
      await retryWebhookEvent(7);

      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "admin-1",
          action: "update",
          entityType: "webhook_event",
          entityId: "7",
        }),
      );
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      const eventRow = {
        id: 8,
        eventType: "payment.completed",
        externalEventId: "evt_reval",
        payload: {},
      };
      setupMocks({
        select: vi.fn(() => makeChain([eventRow])),
        insert: vi.fn(() => ({ values: vi.fn() })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { retryWebhookEvent } = await import("./webhook-actions");
      await retryWebhookEvent(8);

      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });
});
