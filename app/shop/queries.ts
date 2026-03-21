/**
 * Public cached queries for the /shop page.
 * No authentication required — reads only published products.
 */
import { cacheTag, cacheLife } from "next/cache";
import { eq, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import type { ShopProduct } from "./actions";

export async function getPublishedProducts(): Promise<ShopProduct[]> {
  "use cache";
  cacheTag("products");
  cacheLife("hours");

  const rows = await db
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      description: products.description,
      category: products.category,
      pricingType: products.pricingType,
      priceInCents: products.priceInCents,
      priceMinInCents: products.priceMinInCents,
      priceMaxInCents: products.priceMaxInCents,
      availability: products.availability,
      stockCount: products.stockCount,
      imageUrl: products.imageUrl,
      serviceId: products.serviceId,
      tags: products.tags,
      isFeatured: products.isFeatured,
    })
    .from(products)
    .where(eq(products.isPublished, true))
    .orderBy(asc(products.sortOrder), desc(products.createdAt));

  return rows.map((r) => ({
    ...r,
    tags: r.tags
      ? r.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
  }));
}
