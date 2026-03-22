/**
 * GET /api/cron/catalog-sync — Daily Square Catalog reconciliation.
 *
 * Walks all active services and published products, compares them against
 * the live Square Catalog, and pushes any that are missing or whose name
 * or price has drifted. This is the backstop that catches any items that
 * were created/updated while Square was temporarily unreachable.
 *
 * The Square Catalog API is idempotent — items with an existing
 * squareCatalogId are updated in place; items without one are created.
 * The deterministic idempotency key pattern (`catalog-{type}-{id}`)
 * ensures retries never create duplicates.
 *
 * Runs daily at 3:30 AM so the terminal always shows current pricing
 * before the studio opens without Trini having to manually update Square.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services, products } from "@/db/schema";
import { syncCatalogFromSquare, isSquareConfigured } from "@/lib/square";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSquareConfigured()) {
    return NextResponse.json({ skipped: true, reason: "Square not configured" });
  }

  const [allServices, allProducts] = await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        priceInCents: services.priceInCents,
        isActive: services.isActive,
        squareCatalogId: services.squareCatalogId,
      })
      .from(services),
    db
      .select({
        id: products.id,
        title: products.title,
        description: products.description,
        priceInCents: products.priceInCents,
        isPublished: products.isPublished,
        squareCatalogId: products.squareCatalogId,
      })
      .from(products)
      .where(eq(products.isPublished, true)),
  ]);

  const result = await syncCatalogFromSquare(allServices, allProducts);

  return NextResponse.json(result, {
    status: result.errors > 0 ? 207 : 200,
  });
}
