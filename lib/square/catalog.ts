/**
 * Square Catalog API — sync services and products to Square Catalog.
 * @module lib/square/catalog
 */
import * as Sentry from "@sentry/nextjs";
import { squareClient, isSquareConfigured } from "./client";
import { withRetry } from "@/lib/retry";

/**
 * Upserts a single item in the Square Catalog via batchUpsert.
 *
 * If `existingSquareCatalogId` is provided, updates the existing item.
 * Otherwise creates a new ITEM + ITEM_VARIATION.
 *
 * Returns the Square Catalog Object ID.
 */
export async function upsertCatalogItem(params: {
  type: "service" | "product";
  localId: number;
  name: string;
  description?: string | null;
  priceInCents: number;
  existingSquareCatalogId?: string | null;
}): Promise<string> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  const idempotencyKey = `catalog-${params.type}-${params.localId}`;

  try {
    let itemId = `#${idempotencyKey}`;
    let variationId = `#${idempotencyKey}-var`;
    let itemVersion: bigint | undefined;
    let variationVersion: bigint | undefined;

    if (params.existingSquareCatalogId) {
      const existing = await withRetry(
        () => squareClient.catalog.object.get({
          objectId: params.existingSquareCatalogId!,
        }),
        { label: "square.catalog.object.get" },
      );
      const obj = existing.object;
      if (obj && "itemData" in obj) {
        itemId = params.existingSquareCatalogId;
        itemVersion = obj.version;
        const firstVariation = obj.itemData?.variations?.[0];
        if (firstVariation && "itemVariationData" in firstVariation) {
          variationId = firstVariation.id ?? variationId;
          variationVersion = firstVariation.version;
        }
      }
    }

    const response = await withRetry(
      () => squareClient.catalog.batchUpsert({
        idempotencyKey,
        batches: [
          {
            objects: [
              {
                type: "ITEM",
                id: itemId,
                version: itemVersion,
                itemData: {
                  name: params.name,
                  description: params.description ?? undefined,
                  variations: [
                    {
                      type: "ITEM_VARIATION",
                      id: variationId,
                      version: variationVersion,
                      itemVariationData: {
                        name: "Regular",
                        pricingType: "FIXED_PRICING",
                        priceMoney: {
                          amount: BigInt(params.priceInCents),
                          currency: "USD",
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
      { label: "square.catalog.batchUpsert(item)" },
    );

    const idMappings = response.idMappings ?? [];
    const tempItemId = `#${idempotencyKey}`;
    const mapping = idMappings.find((m) => m.clientObjectId === tempItemId);
    const resolvedId = mapping?.objectId ?? params.existingSquareCatalogId;

    if (!resolvedId) throw new Error("Square catalog batchUpsert returned no object ID");
    return resolvedId;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Full catalog reconciliation — walks all active services and published
 * products, compares them against the live Square Catalog, and pushes
 * any that are missing or whose name or price has drifted.
 */
export async function syncCatalogFromSquare(
  allServices: Array<{
    id: number;
    name: string;
    description: string | null;
    priceInCents: number | null;
    isActive: boolean;
    squareCatalogId: string | null;
  }>,
  allProducts: Array<{
    id: number;
    title: string;
    description: string | null;
    priceInCents: number | null;
    isPublished: boolean;
    squareCatalogId: string | null;
  }>,
): Promise<{ created: number; updated: number; skipped: number; errors: number }> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const squareItems = new Map<string, { name: string; priceInCents: number }>();
  try {
    for await (const obj of await withRetry(
      () => squareClient.catalog.list({ types: "ITEM" }),
      { label: "square.catalog.list" },
    )) {
      if (!obj.id || !("itemData" in obj)) continue;
      const variation = obj.itemData?.variations?.[0];
      const price =
        variation && "itemVariationData" in variation
          ? Number(variation.itemVariationData?.priceMoney?.amount ?? 0)
          : 0;
      squareItems.set(obj.id, {
        name: obj.itemData?.name ?? "",
        priceInCents: price,
      });
    }
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }

  for (const svc of allServices) {
    if (!svc.isActive || svc.priceInCents == null) {
      skipped++;
      continue;
    }
    try {
      if (svc.squareCatalogId) {
        const existing = squareItems.get(svc.squareCatalogId);
        if (existing && existing.name === svc.name && existing.priceInCents === svc.priceInCents) {
          skipped++;
          continue;
        }
        await upsertCatalogItem({
          type: "service",
          localId: svc.id,
          name: svc.name,
          description: svc.description,
          priceInCents: svc.priceInCents,
          existingSquareCatalogId: svc.squareCatalogId,
        });
        updated++;
      } else {
        const newId = await upsertCatalogItem({
          type: "service",
          localId: svc.id,
          name: svc.name,
          description: svc.description,
          priceInCents: svc.priceInCents,
        });
        const { db } = await import("@/db");
        const { services } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(services).set({ squareCatalogId: newId }).where(eq(services.id, svc.id));
        created++;
      }
    } catch (err) {
      Sentry.captureException(err);
      errors++;
    }
  }

  for (const prod of allProducts) {
    if (!prod.isPublished || prod.priceInCents == null) {
      skipped++;
      continue;
    }
    try {
      if (prod.squareCatalogId) {
        const existing = squareItems.get(prod.squareCatalogId);
        if (
          existing &&
          existing.name === prod.title &&
          existing.priceInCents === prod.priceInCents
        ) {
          skipped++;
          continue;
        }
        await upsertCatalogItem({
          type: "product",
          localId: prod.id,
          name: prod.title,
          description: prod.description,
          priceInCents: prod.priceInCents,
          existingSquareCatalogId: prod.squareCatalogId,
        });
        updated++;
      } else {
        const newId = await upsertCatalogItem({
          type: "product",
          localId: prod.id,
          name: prod.title,
          description: prod.description,
          priceInCents: prod.priceInCents,
        });
        const { db } = await import("@/db");
        const { products } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(products).set({ squareCatalogId: newId }).where(eq(products.id, prod.id));
        created++;
      }
    } catch (err) {
      Sentry.captureException(err);
      errors++;
    }
  }

  return { created, updated, skipped, errors };
}
