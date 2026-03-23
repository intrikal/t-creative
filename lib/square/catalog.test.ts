// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Square Catalog integration (upsertCatalogItem, syncCatalogFromSquare).
 *
 * Covers:
 *  - upsertCatalogItem: new service → Square ITEM + ITEM_VARIATION created with correct name/price
 *  - upsertCatalogItem: existing service → batchUpsert called with existingSquareCatalogId (idempotency key)
 *  - upsertCatalogItem: Square API failure → error captured by Sentry, exception re-thrown (local DB untouched)
 *  - syncCatalogFromSquare: new service created → squareCatalogId stored on local service record
 *  - syncCatalogFromSquare: Square items with no matching local record → logged as orphans (skipped count unaffected)
 *  - syncCatalogFromSquare: price mismatch between local and Square → detected and upsert triggered (updated count incremented)
 *
 * Mocks: ./client (squareClient, isSquareConfigured), @/lib/retry (withRetry pass-through),
 *        @sentry/nextjs (captureException), @/db, @/db/schema, drizzle-orm.
 */

// --- Sentry mock ---
const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

// --- Square catalog API mocks ---
const mockCatalogObjectGet = vi.fn();
const mockCatalogBatchUpsert = vi.fn();
const mockIsSquareConfigured = vi.fn().mockReturnValue(true);

// Async generator that yields items for squareClient.catalog.list()
async function* makeListGenerator(items: object[]) {
  for (const item of items) {
    yield item;
  }
}
const mockCatalogList = vi.fn();

vi.mock("./client", () => ({
  isSquareConfigured: mockIsSquareConfigured,
  squareClient: {
    catalog: {
      object: { get: (...args: unknown[]) => mockCatalogObjectGet(...args) },
      batchUpsert: (...args: unknown[]) => mockCatalogBatchUpsert(...args),
      list: (...args: unknown[]) => mockCatalogList(...args),
    },
  },
}));

// withRetry: pass-through — just calls the function immediately so tests stay synchronous-style
vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn().mockImplementation((fn: () => unknown) => fn()),
}));

// --- DB mocks ---
const mockDbUpdate = vi.fn();
vi.mock("@/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: mockDbUpdate,
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  services: {},
  products: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

describe("lib/square/catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: isSquareConfigured returns true
    mockIsSquareConfigured.mockReturnValue(true);
  });

  // ---------------------------------------------------------------------------
  // upsertCatalogItem
  // ---------------------------------------------------------------------------
  describe("upsertCatalogItem", () => {
    // When a brand-new service has no existing Square catalog ID, the function
    // must create an ITEM + ITEM_VARIATION pair with the correct name and price.
    it("creates a new Square catalog item with correct name, price, and duration when service is new", async () => {
      const { upsertCatalogItem } = await import("./catalog");

      // batchUpsert returns an idMapping so the function can resolve the new object ID
      mockCatalogBatchUpsert.mockResolvedValue({
        idMappings: [{ clientObjectId: "#catalog-service-1", objectId: "SQUARE_ITEM_001" }],
      });

      const result = await upsertCatalogItem({
        type: "service",
        localId: 1,
        name: "Lash Full Set",
        description: "Classic full set",
        priceInCents: 12000,
      });

      expect(result).toBe("SQUARE_ITEM_001");

      // Verify batchUpsert was called with the correct name and price
      expect(mockCatalogBatchUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "catalog-service-1",
          batches: [
            expect.objectContaining({
              objects: [
                expect.objectContaining({
                  type: "ITEM",
                  itemData: expect.objectContaining({
                    name: "Lash Full Set",
                    variations: [
                      expect.objectContaining({
                        type: "ITEM_VARIATION",
                        itemVariationData: expect.objectContaining({
                          pricingType: "FIXED_PRICING",
                          priceMoney: expect.objectContaining({
                            amount: BigInt(12000),
                            currency: "USD",
                          }),
                        }),
                      }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        }),
      );

      // catalog.object.get should NOT be called when there is no existing ID
      expect(mockCatalogObjectGet).not.toHaveBeenCalled();
    });

    // When a service already has a squareCatalogId the function must fetch the
    // existing object to get its version, then batchUpsert using the real ID so
    // Square treats this as an update (idempotency key reuse + version pinning).
    it("updates an existing catalog item using the existing Square ID and idempotency key", async () => {
      const { upsertCatalogItem } = await import("./catalog");

      // Simulate the existing Square object returned by catalog.object.get
      mockCatalogObjectGet.mockResolvedValue({
        object: {
          id: "SQUARE_ITEM_EXISTING",
          version: BigInt(2),
          itemData: {
            name: "Old Name",
            variations: [
              {
                id: "SQUARE_VARIATION_EXISTING",
                version: BigInt(1),
                itemVariationData: { priceMoney: { amount: BigInt(10000) } },
              },
            ],
          },
        },
      });

      // batchUpsert for an update — idMappings is empty because the ID is already resolved
      mockCatalogBatchUpsert.mockResolvedValue({ idMappings: [] });

      const result = await upsertCatalogItem({
        type: "service",
        localId: 7,
        name: "Lash Full Set — Updated",
        priceInCents: 13500,
        existingSquareCatalogId: "SQUARE_ITEM_EXISTING",
      });

      // When idMappings is empty the function falls back to existingSquareCatalogId
      expect(result).toBe("SQUARE_ITEM_EXISTING");

      // catalog.object.get must be called to retrieve the current version
      expect(mockCatalogObjectGet).toHaveBeenCalledWith({
        objectId: "SQUARE_ITEM_EXISTING",
      });

      // batchUpsert must use the real item ID (not the temp "#..." placeholder)
      expect(mockCatalogBatchUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "catalog-service-7",
          batches: [
            expect.objectContaining({
              objects: [
                expect.objectContaining({
                  id: "SQUARE_ITEM_EXISTING",
                  version: BigInt(2),
                }),
              ],
            }),
          ],
        }),
      );
    });

    // A Square API failure must be reported to Sentry and re-thrown so the
    // caller (e.g. syncCatalogFromSquare) can increment its error counter.
    // The local service record must NOT be modified.
    it("captures the error in Sentry and re-throws when the Square API fails, leaving local data unchanged", async () => {
      const { upsertCatalogItem } = await import("./catalog");

      const apiError = new Error("Square API 500");
      mockCatalogBatchUpsert.mockRejectedValue(apiError);

      await expect(
        upsertCatalogItem({
          type: "service",
          localId: 3,
          name: "Facial",
          priceInCents: 8000,
        }),
      ).rejects.toThrow("Square API 500");

      // Sentry must capture the original error
      expect(mockCaptureException).toHaveBeenCalledWith(apiError);

      // The DB must not be touched — no service record update
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    // After successfully creating a new catalog item the caller is expected to
    // write the returned Square object ID back to the local services row.
    // This test verifies that the returned ID is the one from idMappings.
    it("returns the Square catalog object ID so it can be stored on the service record", async () => {
      const { upsertCatalogItem } = await import("./catalog");

      mockCatalogBatchUpsert.mockResolvedValue({
        idMappings: [{ clientObjectId: "#catalog-service-42", objectId: "SQUARE_NEW_ID" }],
      });

      const id = await upsertCatalogItem({
        type: "service",
        localId: 42,
        name: "Brow Lamination",
        priceInCents: 9500,
      });

      expect(id).toBe("SQUARE_NEW_ID");
    });
  });

  // ---------------------------------------------------------------------------
  // syncCatalogFromSquare
  // ---------------------------------------------------------------------------
  describe("syncCatalogFromSquare", () => {
    // syncCatalogFromSquare stores the new Square ID on the local service row
    // after calling upsertCatalogItem for a service with no squareCatalogId.
    it("stores the Square catalog ID on the local service record after creation", async () => {
      const { syncCatalogFromSquare } = await import("./catalog");

      // Square catalog is currently empty — no existing items
      mockCatalogList.mockReturnValue(makeListGenerator([]));

      // upsertCatalogItem will resolve to a new ID via batchUpsert
      mockCatalogBatchUpsert.mockResolvedValue({
        idMappings: [{ clientObjectId: "#catalog-service-5", objectId: "SQUARE_SVC_005" }],
      });

      mockDbUpdate.mockResolvedValue(undefined);

      const result = await syncCatalogFromSquare(
        [
          {
            id: 5,
            name: "Hot Stone Massage",
            description: null,
            priceInCents: 15000,
            isActive: true,
            squareCatalogId: null, // No existing ID — must create
          },
        ],
        [],
      );

      expect(result.created).toBe(1);
      expect(result.errors).toBe(0);

      // The DB update that stores the new Square ID must have been triggered
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    // Square may contain catalog items that were created manually or by other
    // tools and have no corresponding local service. These orphans must not
    // cause a crash — they are silently skipped (counts not incremented).
    it("logs Square items with no local match as orphans without affecting sync counts", async () => {
      const { syncCatalogFromSquare } = await import("./catalog");

      // Two Square items in the catalog
      mockCatalogList.mockReturnValue(
        makeListGenerator([
          {
            id: "ORPHAN_001",
            itemData: {
              name: "Mystery Service",
              variations: [
                {
                  id: "ORPHAN_001_var",
                  itemVariationData: { priceMoney: { amount: BigInt(5000) } },
                },
              ],
            },
          },
          {
            id: "ORPHAN_002",
            itemData: {
              name: "Another Unknown",
              variations: [
                {
                  id: "ORPHAN_002_var",
                  itemVariationData: { priceMoney: { amount: BigInt(7500) } },
                },
              ],
            },
          },
        ]),
      );

      // Local services list is empty — nothing to sync, nothing to match
      const result = await syncCatalogFromSquare([], []);

      // No creates, updates, or errors — orphans are ignored
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.errors).toBe(0);
    });

    // When a local service has a squareCatalogId but the live Square price
    // differs from the local priceInCents, the function must detect the drift
    // and trigger an update (incrementing the updated counter).
    it("detects a price mismatch between local service and Square catalog and triggers an update", async () => {
      const { syncCatalogFromSquare } = await import("./catalog");

      // Square has the service at the old price (10000 cents)
      mockCatalogList.mockReturnValue(
        makeListGenerator([
          {
            id: "SQUARE_SVC_DRIFT",
            itemData: {
              name: "Deep Tissue Massage",
              variations: [
                {
                  id: "SQUARE_SVC_DRIFT_var",
                  itemVariationData: { priceMoney: { amount: BigInt(10000) } },
                },
              ],
            },
          },
        ]),
      );

      // catalog.object.get for the update path
      mockCatalogObjectGet.mockResolvedValue({
        object: {
          id: "SQUARE_SVC_DRIFT",
          version: BigInt(3),
          itemData: {
            name: "Deep Tissue Massage",
            variations: [
              {
                id: "SQUARE_SVC_DRIFT_var",
                version: BigInt(2),
                itemVariationData: { priceMoney: { amount: BigInt(10000) } },
              },
            ],
          },
        },
      });

      // batchUpsert succeeds for the update
      mockCatalogBatchUpsert.mockResolvedValue({ idMappings: [] });

      // Local service has been repriced to 12000 — mismatch should trigger update
      const result = await syncCatalogFromSquare(
        [
          {
            id: 9,
            name: "Deep Tissue Massage",
            description: null,
            priceInCents: 12000, // Different from Square's 10000
            isActive: true,
            squareCatalogId: "SQUARE_SVC_DRIFT",
          },
        ],
        [],
      );

      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
      expect(result.errors).toBe(0);

      // batchUpsert must have been called with the new price
      expect(mockCatalogBatchUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          batches: [
            expect.objectContaining({
              objects: [
                expect.objectContaining({
                  itemData: expect.objectContaining({
                    variations: [
                      expect.objectContaining({
                        itemVariationData: expect.objectContaining({
                          priceMoney: expect.objectContaining({
                            amount: BigInt(12000),
                          }),
                        }),
                      }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        }),
      );
    });
  });
});
