/**
 * @file actions.test.ts
 * @description Unit tests for commissions/actions server actions (client commissions,
 * submit request, accept/decline quotes, file upload).
 *
 * Testing utilities: describe, it, expect, vi, vi.doMock, vi.resetModules,
 * vi.clearAllMocks, beforeEach — see aftercare tests for full descriptions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a chainable mock that mimics Drizzle's query-builder API.
 * Every method returns the same chain; the chain is thenable, resolving to `rows`.
 */
function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
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

/** Stub for supabase auth.getUser — controls whether the request is authenticated. */
const mockGetUser = vi.fn();
/** Captures PostHog trackEvent calls for analytics assertion. */
const mockTrackEvent = vi.fn();
/** Captures Resend sendEmail calls; resolves to true by default (email sent OK). */
const mockSendEmail = vi.fn().mockResolvedValue(true);
/** Captures revalidatePath calls so tests can verify correct cache invalidation. */
const mockRevalidatePath = vi.fn();

/**
 * Registers all module mocks needed by the actions under test.
 * Accepts an optional custom db; falls back to empty-result defaults.
 */
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    orders: {
      id: "id",
      orderNumber: "orderNumber",
      clientId: "clientId",
      productId: "productId",
      status: "status",
      category: "category",
      title: "title",
      description: "description",
      quantity: "quantity",
      quotedInCents: "quotedInCents",
      estimatedCompletionAt: "estimatedCompletionAt",
      metadata: "metadata",
      createdAt: "createdAt",
      cancelledAt: "cancelledAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/emails/CommissionReceived", () => ({ CommissionReceived: vi.fn(() => null) }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("commissions/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getClientCommissions ---- */

  describe("getClientCommissions", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientCommissions } = await import("./actions");
      await expect(getClientCommissions()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no commissions", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientCommissions } = await import("./actions");
      const result = await getClientCommissions();
      expect(result).toEqual([]);
    });

    it("maps commission rows to ClientCommission shape", async () => {
      vi.resetModules();
      const row = {
        id: 42,
        orderNumber: "com-abc123",
        category: "crochet",
        title: "Custom blanket",
        description: "A cozy blanket",
        quantity: 1,
        status: "inquiry",
        quotedInCents: null,
        estimatedCompletionAt: null,
        metadata: null,
        createdAt: new Date("2026-02-01"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientCommissions } = await import("./actions");
      const result = await getClientCommissions();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 42,
        orderNumber: "com-abc123",
        category: "crochet",
        title: "Custom blanket",
        status: "inquiry",
      });
      expect(typeof result[0].createdAt).toBe("string");
    });

    it("formats estimatedCompletionAt when present", async () => {
      vi.resetModules();
      const row = {
        id: 1,
        orderNumber: "com-x",
        category: "3d_printing",
        title: "3D model",
        description: null,
        quantity: 2,
        status: "in_progress",
        quotedInCents: 5000,
        estimatedCompletionAt: new Date("2026-05-15"),
        metadata: null,
        createdAt: new Date("2026-03-01"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientCommissions } = await import("./actions");
      const result = await getClientCommissions();
      expect(result[0].estimatedCompletionAt).not.toBeNull();
      expect(typeof result[0].estimatedCompletionAt).toBe("string");
    });
  });

  /* ---- submitCommissionRequest ---- */

  describe("submitCommissionRequest", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { submitCommissionRequest } = await import("./actions");
      await expect(
        submitCommissionRequest({
          category: "crochet",
          title: "Blanket",
          description: "Cozy",
          quantity: 1,
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts order with status 'inquiry'", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitCommissionRequest } = await import("./actions");
      await submitCommissionRequest({
        category: "crochet",
        title: "Blanket",
        description: "Cozy",
        quantity: 1,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "inquiry",
          category: "crochet",
          title: "Blanket",
          clientId: "user-1",
        }),
      );
    });

    it("returns success with orderNumber", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 10 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitCommissionRequest } = await import("./actions");
      const result = await submitCommissionRequest({
        category: "3d_printing",
        title: "Figurine",
        description: "Character",
        quantity: 2,
      });
      expect(result.success).toBe(true);
      expect(result.orderNumber).toMatch(/^com-/);
    });

    it("fires trackEvent with commission_request_submitted", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitCommissionRequest } = await import("./actions");
      await submitCommissionRequest({
        category: "crochet",
        title: "Test",
        description: "Desc",
        quantity: 1,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "commission_request_submitted",
        expect.objectContaining({ category: "crochet" }),
      );
    });

    it("sends confirmation email when client profile has email", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1)
            return makeChain([{ email: "client@example.com", firstName: "Jane" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitCommissionRequest } = await import("./actions");
      await submitCommissionRequest({
        category: "crochet",
        title: "Hat",
        description: "Warm",
        quantity: 1,
      });
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "client@example.com", entityType: "commission_received" }),
      );
    });

    it("does not throw when email sending fails (non-fatal)", async () => {
      vi.resetModules();
      mockSendEmail.mockRejectedValueOnce(new Error("Email failed"));
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1)
            return makeChain([{ email: "client@example.com", firstName: "Jane" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitCommissionRequest } = await import("./actions");
      await expect(
        submitCommissionRequest({
          category: "crochet",
          title: "Hat",
          description: "Warm",
          quantity: 1,
        }),
      ).resolves.toMatchObject({ success: true });
    });

    it("revalidates /dashboard/shop", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitCommissionRequest } = await import("./actions");
      await submitCommissionRequest({
        category: "crochet",
        title: "Hat",
        description: "Warm",
        quantity: 1,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/shop");
    });
  });

  /* ---- acceptQuote ---- */

  describe("acceptQuote", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { acceptQuote } = await import("./actions");
      await expect(acceptQuote(1)).rejects.toThrow("Not authenticated");
    });

    it("throws when order not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { acceptQuote } = await import("./actions");
      await expect(acceptQuote(99)).rejects.toThrow("Order not found");
    });

    it("throws when order belongs to different client", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "other-user", status: "quoted" }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { acceptQuote } = await import("./actions");
      await expect(acceptQuote(1)).rejects.toThrow("Order not found");
    });

    it("throws when order is not in 'quoted' status", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "user-1", status: "inquiry" }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { acceptQuote } = await import("./actions");
      await expect(acceptQuote(1)).rejects.toThrow("Order is not awaiting acceptance");
    });

    it("updates order status to 'accepted'", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "user-1", status: "quoted" }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { acceptQuote } = await import("./actions");
      await acceptQuote(5);
      expect(mockUpdateSet).toHaveBeenCalledWith({ status: "accepted" });
    });

    it("fires trackEvent commission_quote_accepted", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "user-1", status: "quoted" }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { acceptQuote } = await import("./actions");
      await acceptQuote(5);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "commission_quote_accepted",
        expect.objectContaining({ orderId: 5 }),
      );
    });

    it("revalidates /dashboard/shop", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "user-1", status: "quoted" }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { acceptQuote } = await import("./actions");
      await acceptQuote(5);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/shop");
    });
  });

  /* ---- declineQuote ---- */

  describe("declineQuote", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { declineQuote } = await import("./actions");
      await expect(declineQuote(1)).rejects.toThrow("Not authenticated");
    });

    it("throws when order not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { declineQuote } = await import("./actions");
      await expect(declineQuote(99)).rejects.toThrow("Order not found");
    });

    it("throws when order is not in 'quoted' status", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "user-1", status: "in_progress" }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { declineQuote } = await import("./actions");
      await expect(declineQuote(1)).rejects.toThrow("Order is not awaiting acceptance");
    });

    it("updates order to status 'cancelled' with cancelledAt timestamp", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "user-1", status: "quoted" }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { declineQuote } = await import("./actions");
      await declineQuote(7);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled", cancelledAt: expect.any(Date) }),
      );
    });

    it("fires trackEvent commission_quote_declined", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "user-1", status: "quoted" }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { declineQuote } = await import("./actions");
      await declineQuote(7);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "commission_quote_declined",
        expect.objectContaining({ orderId: 7 }),
      );
    });

    it("revalidates /dashboard/shop", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ clientId: "user-1", status: "quoted" }])),
        insert: vi.fn(),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { declineQuote } = await import("./actions");
      await declineQuote(7);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/shop");
    });
  });

  /* ---- uploadCommissionFile ---- */

  describe("uploadCommissionFile", () => {
    it("throws when not authenticated", async () => {
      vi.resetModules();
      const mockStorage = {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://cdn.example.com/file.png" } })),
        })),
      };
      vi.doMock("@/db", () => ({ db: {} }));
      vi.doMock("@/db/schema", () => ({ orders: {}, profiles: {} }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        desc: vi.fn(),
        and: vi.fn(),
        isNull: vi.fn(),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
          storage: mockStorage,
        })),
      }));
      vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
      vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
      vi.doMock("@/emails/CommissionReceived", () => ({ CommissionReceived: vi.fn(() => null) }));

      const { uploadCommissionFile } = await import("./actions");
      const fd = new FormData();
      fd.append("file", new File(["data"], "test.png", { type: "image/png" }));
      await expect(uploadCommissionFile(fd)).rejects.toThrow("Not authenticated");
    });

    it("throws when no file provided", async () => {
      vi.resetModules();
      const mockStorage = {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://cdn.example.com/file.png" } })),
        })),
      };
      vi.doMock("@/db", () => ({ db: {} }));
      vi.doMock("@/db/schema", () => ({ orders: {}, profiles: {} }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        desc: vi.fn(),
        and: vi.fn(),
        isNull: vi.fn(),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
          storage: mockStorage,
        })),
      }));
      vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
      vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
      vi.doMock("@/emails/CommissionReceived", () => ({ CommissionReceived: vi.fn(() => null) }));

      const { uploadCommissionFile } = await import("./actions");
      const fd = new FormData(); // no file
      await expect(uploadCommissionFile(fd)).rejects.toThrow("No file provided");
    });

    it("throws for unsupported file type", async () => {
      vi.resetModules();
      const mockStorage = {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://cdn.example.com/file.txt" } })),
        })),
      };
      vi.doMock("@/db", () => ({ db: {} }));
      vi.doMock("@/db/schema", () => ({ orders: {}, profiles: {} }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        desc: vi.fn(),
        and: vi.fn(),
        isNull: vi.fn(),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
          storage: mockStorage,
        })),
      }));
      vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
      vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
      vi.doMock("@/emails/CommissionReceived", () => ({ CommissionReceived: vi.fn(() => null) }));

      const { uploadCommissionFile } = await import("./actions");
      const fd = new FormData();
      fd.append("file", new File(["data"], "doc.txt", { type: "text/plain" }));
      await expect(uploadCommissionFile(fd)).rejects.toThrow("Unsupported file type");
    });

    it("returns url and isDesignFile=false for an image upload", async () => {
      vi.resetModules();
      const publicUrl = "https://cdn.example.com/image.png";
      const mockStorage = {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl } })),
        })),
      };
      vi.doMock("@/db", () => ({ db: {} }));
      vi.doMock("@/db/schema", () => ({ orders: {}, profiles: {} }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        desc: vi.fn(),
        and: vi.fn(),
        isNull: vi.fn(),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
          storage: mockStorage,
        })),
      }));
      vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
      vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
      vi.doMock("@/emails/CommissionReceived", () => ({ CommissionReceived: vi.fn(() => null) }));

      const { uploadCommissionFile } = await import("./actions");
      const fd = new FormData();
      fd.append("file", new File(["data"], "photo.png", { type: "image/png" }));
      const result = await uploadCommissionFile(fd);
      expect(result).toMatchObject({ url: publicUrl, filename: "photo.png", isDesignFile: false });
    });

    it("returns isDesignFile=true for an STL file", async () => {
      vi.resetModules();
      const mockStorage = {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://cdn.example.com/model.stl" } })),
        })),
      };
      vi.doMock("@/db", () => ({ db: {} }));
      vi.doMock("@/db/schema", () => ({ orders: {}, profiles: {} }));
      vi.doMock("drizzle-orm", () => ({
        eq: vi.fn(),
        desc: vi.fn(),
        and: vi.fn(),
        isNull: vi.fn(),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
      vi.doMock("@/utils/supabase/server", () => ({
        createClient: vi.fn(async () => ({
          auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
          storage: mockStorage,
        })),
      }));
      vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
      vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
      vi.doMock("@/emails/CommissionReceived", () => ({ CommissionReceived: vi.fn(() => null) }));

      const { uploadCommissionFile } = await import("./actions");
      const fd = new FormData();
      fd.append("file", new File(["stl-data"], "model.stl", { type: "application/octet-stream" }));
      const result = await uploadCommissionFile(fd);
      expect(result.isDesignFile).toBe(true);
    });
  });
});
