// @vitest-environment node

/**
 * inngest/functions/low-stock-alert.test.ts
 *
 * Unit tests for the low-stock-alert Inngest function.
 * Verifies skipping when stock is fine, sending an email when items
 * are low, and gracefully skipping the email when Resend is not configured.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Step stub                                                           */
/* ------------------------------------------------------------------ */

const step = {
  run: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
};

/* ------------------------------------------------------------------ */
/*  Shared mocks                                                        */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockIsResendConfigured = vi.fn().mockReturnValue(true);

const LOW_STOCK_ITEMS = [
  { id: "p1", title: "Canvas Print", sku: "CP-01", stockCount: 2, lowStockThreshold: 5, reorderQuantity: 20 },
];
const ADMIN_ROW = [{ email: "admin@studio.com", firstName: "Admin" }];

function makeDb(selectRows: Record<string, unknown>[][]) {
  let idx = 0;

  function makeChain(rows: Record<string, unknown>[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  return {
    select: vi.fn(() => makeChain(selectRows[idx++] ?? [])),
  };
}

function setupMocks(selectRows: Record<string, unknown>[][], resendConfigured = true) {
  const db = makeDb(selectRows);
  mockIsResendConfigured.mockReturnValue(resendConfigured);

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    products: {
      id: "id",
      title: "title",
      sku: "sku",
      stockCount: "stockCount",
      lowStockThreshold: "lowStockThreshold",
      reorderQuantity: "reorderQuantity",
      isPublished: "isPublished",
    },
    profiles: { email: "email", firstName: "firstName", role: "role" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    lte: vi.fn((...a: unknown[]) => ({ type: "lte", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      { raw: vi.fn((q: string) => ({ type: "sql_raw", q })), join: vi.fn() },
    ),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    isResendConfigured: mockIsResendConfigured,
  }));
  vi.doMock("react", () => ({
    createElement: vi.fn((...args: unknown[]) => ({ type: "div", props: args[1] })),
    default: { createElement: vi.fn() },
    cache: vi.fn((fn: any) => fn),
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
}

async function runHandler() {
  const mod = await import("@/inngest/functions/low-stock-alert");
  const fn = (mod.lowStockAlert as any)?.handler ?? mod.lowStockAlert;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("low-stock-alert", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns { skipped: true } when no items are low on stock", async () => {
    setupMocks([[]]); // empty product query

    const result = await runHandler();

    expect(result).toEqual({ skipped: true, reason: "No low stock items" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends an alert email to admin when low stock items are found", async () => {
    setupMocks([LOW_STOCK_ITEMS, ADMIN_ROW]);

    const result = await runHandler();

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const callArgs = mockSendEmail.mock.calls[0][0];
    expect(callArgs.to).toBe("admin@studio.com");
    expect(callArgs.subject).toContain("Low Stock Alert");
    expect(result).toMatchObject({ alerted: 1 });
    expect(result.items).toContain("Canvas Print: 2");
  });

  it("skips email but still returns count when Resend is not configured", async () => {
    setupMocks([LOW_STOCK_ITEMS], false); // resendConfigured = false

    const result = await runHandler();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ alerted: 1 });
  });

  it("skips email when admin has no email address", async () => {
    setupMocks([LOW_STOCK_ITEMS, [{ email: null, firstName: "Admin" }]]);

    const result = await runHandler();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ alerted: 1 });
  });
});
