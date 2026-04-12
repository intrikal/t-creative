// @vitest-environment node

/**
 * inngest/functions/catalog-sync.test.ts
 *
 * Unit tests for the catalog-sync Inngest function.
 * Verifies: calling syncCatalogFromSquare with fetched data when Square
 * is configured, and returning a skip result when Square is not configured.
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

const mockSyncCatalog = vi.fn().mockResolvedValue({ created: 1, updated: 0, skipped: 2 });
const mockIsSquareConfigured = vi.fn().mockReturnValue(true);

const SERVICES = [{ id: "s1", name: "Headshot", description: null, priceInCents: 15000, isActive: true, squareCatalogId: null }];
const PRODUCTS = [{ id: "pr1", title: "Canvas", description: null, priceInCents: 5000, isPublished: true, squareCatalogId: null }];

function makeDb(selectRows: Record<string, unknown>[][]) {
  let idx = 0;

  function makeChain(rows: Record<string, unknown>[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  return { select: vi.fn(() => makeChain(selectRows[idx++] ?? [])) };
}

function setupMocks(selectRows: Record<string, unknown>[][], squareConfigured = true) {
  const db = makeDb(selectRows);
  mockIsSquareConfigured.mockReturnValue(squareConfigured);

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    services: {
      id: "id",
      name: "name",
      description: "description",
      priceInCents: "priceInCents",
      isActive: "isActive",
      squareCatalogId: "squareCatalogId",
    },
    products: {
      id: "id",
      title: "title",
      description: "description",
      priceInCents: "priceInCents",
      isPublished: "isPublished",
      squareCatalogId: "squareCatalogId",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
  }));
  vi.doMock("@/lib/square", () => ({
    syncCatalogFromSquare: mockSyncCatalog,
    isSquareConfigured: mockIsSquareConfigured,
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: vi.fn((_config: any, handler: any) => ({ handler })),
    },
  }));
}

async function runHandler() {
  const mod = await import("@/inngest/functions/catalog-sync");
  const fn = (mod.catalogSync as any)?.handler ?? mod.catalogSync;
  return fn({ step });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("catalog-sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls syncCatalogFromSquare with services and products when Square is configured", async () => {
    // Two parallel selects inside Promise.all: services then products
    setupMocks([SERVICES, PRODUCTS]);

    const result = await runHandler();

    expect(mockSyncCatalog).toHaveBeenCalledOnce();
    expect(mockSyncCatalog).toHaveBeenCalledWith(SERVICES, PRODUCTS);
    expect(result).toEqual({ created: 1, updated: 0, skipped: 2 });
  });

  it("returns { skipped: true } when Square is not configured", async () => {
    setupMocks([], false);

    const result = await runHandler();

    expect(mockSyncCatalog).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: true, reason: "Square not configured" });
  });
});
