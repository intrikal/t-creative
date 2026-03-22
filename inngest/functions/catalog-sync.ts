/**
 * Inngest function — Daily Square Catalog reconciliation.
 *
 * Replaces GET /api/cron/catalog-sync. Walks all active services and published
 * products, compares them against the live Square Catalog, and pushes any that
 * are missing or whose name or price has drifted.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services, products } from "@/db/schema";
import { syncCatalogFromSquare, isSquareConfigured } from "@/lib/square";
import { inngest } from "../client";

export const catalogSync = inngest.createFunction(
  { id: "catalog-sync", retries: 3, triggers: [{ event: "cron/catalog-sync" }] },
  async ({ step }) => {
    const configured = await step.run("check-config", async () => {
      return isSquareConfigured();
    });

    if (!configured) {
      return { skipped: true, reason: "Square not configured" };
    }

    const { allServices, allProducts } = await step.run("query-records", async () => {
      const [svcRows, prodRows] = await Promise.all([
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

      return { allServices: svcRows, allProducts: prodRows };
    });

    const result = await step.run("sync-catalog", async () => {
      return syncCatalogFromSquare(allServices, allProducts);
    });

    return result;
  },
);
