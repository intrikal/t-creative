/**
 * Server actions for the Marketplace dashboard (`/dashboard/marketplace`).
 *
 * Products tab: CRUD against `products` table, sales from `orders`.
 * Inventory tab: stock adjustment on products.
 * Supplies tab: CRUD against `supplies` table.
 *
 * @module marketplace/actions
 * @see {@link ./MarketplacePage.tsx} — client component
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, sql, asc } from "drizzle-orm";
import { z } from "zod";
import {
  getPublicBusinessProfile,
  getPublicInventoryConfig,
} from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { products, orders, supplies, profiles } from "@/db/schema";
import { CommissionQuote } from "@/emails/CommissionQuote";
import { OrderStatusUpdate } from "@/emails/OrderStatusUpdate";
import { requireAdmin } from "@/lib/auth";
import { sendEmail, getEmailRecipient } from "@/lib/resend";
import { upsertCatalogItem, isSquareConfigured } from "@/lib/square";

const PATH = "/dashboard/marketplace";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * UI-facing product category strings. These map 1:1 to the free-form
 * `category` varchar on the products table — not the 4 service-zone enums.
 */
export type ProductCategory = "lash-supplies" | "jewelry" | "crochet" | "aftercare" | "merch";

/**
 * UI pricing model. Mapped to/from the DB's `pricing_type` enum via
 * PRICING_MAP / PRICING_REVERSE because the DB uses snake_case enum
 * values while the UI uses shorter labels.
 */
export type PricingType = "fixed" | "starting_at" | "range" | "custom_quote";

/**
 * Derived status — not stored directly. Computed from `isPublished` +
 * `availability` in `deriveStatus()` so the UI has a single status badge.
 */
export type ProductStatus = "active" | "inactive" | "out_of_stock";

/**
 * Shape returned to the Products tab grid. Prices are in dollars
 * (not cents) because the UI never needs sub-cent precision and
 * converting here avoids repeated `/100` in every cell renderer.
 */
export type ProductRow = {
  id: number;
  name: string;
  category: ProductCategory;
  description: string;
  pricingType: PricingType;
  price: number;
  priceMax?: number;
  stock?: number;
  status: ProductStatus;
  tags: string[];
  sales: number;
  serviceId: number | null;
};

/** Shape returned to the Supplies tab grid. Dates pre-formatted for display. */
export type SupplyRow = {
  id: number;
  name: string;
  category: string;
  unit: string;
  stock: number;
  reorder: number;
  lastRestocked: string | null;
};

/** Aggregate counts for the stat cards at the top of the Marketplace dashboard. */
export type MarketplaceStats = {
  activeCount: number;
  totalProducts: number;
  totalSales: number;
  lowStockCount: number;
  outOfStockCount: number;
};

/* ------------------------------------------------------------------ */
/*  Mapping helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Default low-stock threshold. Overridden at runtime from the
 * admin inventory settings so Trini can tune it without a deploy.
 */
let LOW_STOCK_THRESHOLD = 5;

/** DB pricing enum → UI string */
const PRICING_MAP: Record<string, PricingType> = {
  fixed_price: "fixed",
  starting_at: "starting_at",
  price_range: "range",
  contact_for_quote: "custom_quote",
};

/** UI pricing string → DB enum */
const PRICING_REVERSE: Record<PricingType, string> = {
  fixed: "fixed_price",
  starting_at: "starting_at",
  range: "price_range",
  custom_quote: "contact_for_quote",
};

/**
 * Collapse two DB fields into a single UI status. The DB stores
 * `isPublished` and `availability` separately because they serve
 * different purposes (visibility vs. stock state), but the product
 * grid only shows one badge per row.
 */
function deriveStatus(isPublished: boolean, availability: string): ProductStatus {
  if (!isPublished) return "inactive";
  if (availability === "out_of_stock") return "out_of_stock";
  return "active";
}

/**
 * Append a timestamp to guarantee uniqueness — two products with
 * the same title (e.g. "Custom Blanket") won't collide on slug.
 */
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 200) + `-${Date.now()}`
  );
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch every product with its completed-order count for the Products tab.
 *
 * Products and sales are queried in parallel to avoid a sequential
 * round-trip. Sales are aggregated from the orders table (status =
 * "completed") and joined client-side via a Map because the ORM
 * doesn't support left-join aggregation cleanly with Drizzle.
 */
export async function getProducts(): Promise<ProductRow[]> {
  try {
    await getUser();

    // Promise.all runs the products query and sales aggregation concurrently —
    // they're independent reads, so parallel execution cuts total latency in half.
    const [rows, salesRows] = await Promise.all([
      db
        .select({
          id: products.id,
          title: products.title,
          category: products.category,
          description: products.description,
          pricingType: products.pricingType,
          priceInCents: products.priceInCents,
          priceMinInCents: products.priceMinInCents,
          priceMaxInCents: products.priceMaxInCents,
          stockCount: products.stockCount,
          availability: products.availability,
          isPublished: products.isPublished,
          tags: products.tags,
          serviceId: products.serviceId,
        })
        .from(products)
        .orderBy(desc(products.createdAt)),
      db
        .select({
          productId: orders.productId,
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .where(eq(orders.status, "completed"))
        .groupBy(orders.productId),
    ]);

    // Build a Map<productId, salesCount> for O(1) lookup when enriching each
    // product row below. Filter out null productIds (orphaned orders), then
    // map to [key, value] tuples for the Map constructor. A Map is preferred
    // over an object here because product IDs are numbers, not strings.
    const salesMap = new Map(
      salesRows.filter((r) => r.productId !== null).map((r) => [r.productId!, Number(r.count)]),
    );

    // Transform each DB product row into the UI-facing ProductRow shape:
    // map pricing types, convert cents→dollars, derive status, parse tags.
    // .map() gives a 1:1 conversion — every product becomes one grid row.
    return rows.map((r) => {
      const pt = PRICING_MAP[r.pricingType] ?? "fixed";
      let price = 0;
      let priceMax: number | undefined;

      if (pt === "range") {
        price = (r.priceMinInCents ?? 0) / 100;
        priceMax = (r.priceMaxInCents ?? 0) / 100;
      } else {
        price = (r.priceInCents ?? r.priceMinInCents ?? 0) / 100;
      }

      /* Only show stock count for inventory-tracked items; made-to-order products have no stock concept. */
      const needsStock = r.availability === "in_stock" || r.availability === "pre_order";

      return {
        id: r.id,
        name: r.title,
        category: (r.category ?? "merch") as ProductCategory,
        description: r.description ?? "",
        pricingType: pt,
        price,
        priceMax,
        stock: needsStock ? r.stockCount : undefined,
        status: deriveStatus(r.isPublished, r.availability),
        // Parse the comma-separated tags string into a clean string array.
        // split→map(trim)→filter(Boolean) handles whitespace and trailing
        // commas (e.g. "foo, bar, " → ["foo", "bar"]). Ternary guards
        // against null tags producing [""] from "".split(",").
        tags: r.tags
          ? r.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        sales: salesMap.get(r.id) ?? 0,
        serviceId: r.serviceId ?? null,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Fetch all craft supplies for the Supplies tab, sorted by category then name. */
export async function getSupplies(): Promise<SupplyRow[]> {
  try {
    await getUser();

    const rows = await db
      .select()
      .from(supplies)
      .orderBy(asc(supplies.category), asc(supplies.name));

    // Transform supply DB rows to SupplyRow shape, formatting the restock
    // date for display. .map() is a 1:1 conversion — every supply row becomes
    // one grid row.
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category ?? "Other",
      unit: r.unit,
      stock: r.stockCount,
      reorder: r.reorderPoint,
      lastRestocked: r.lastRestockedAt
        ? new Date(r.lastRestockedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : null,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Aggregate counts for the dashboard stat cards (Active, Total, Sales,
 * Low Stock, Out of Stock). Uses Postgres `filter (where ...)` to compute
 * all counts in a single table scan instead of multiple queries.
 */
export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  try {
    await getUser();

    /* Pull the admin-configured threshold so stats match the Inventory tab. */
    const inventoryConfig = await getPublicInventoryConfig();
    LOW_STOCK_THRESHOLD = inventoryConfig.lowStockThreshold;

    // Promise.all runs product stats and sales count concurrently — they
    // query different tables and don't depend on each other's results.
    const [[productStats], [salesStats]] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`count(*) filter (where ${products.isPublished} = true and ${products.availability} != 'out_of_stock')`,
          lowStock: sql<number>`count(*) filter (where ${products.stockCount} > 0 and ${products.stockCount} <= ${LOW_STOCK_THRESHOLD} and ${products.availability} = 'in_stock')`,
          outOfStock: sql<number>`count(*) filter (where ${products.availability} = 'out_of_stock')`,
        })
        .from(products),
      db
        .select({
          totalSales: sql<number>`coalesce(count(*), 0)`,
        })
        .from(orders)
        .where(eq(orders.status, "completed")),
    ]);

    return {
      activeCount: Number(productStats.active),
      totalProducts: Number(productStats.total),
      totalSales: Number(salesStats.totalSales),
      lowStockCount: Number(productStats.lowStock),
      outOfStockCount: Number(productStats.outOfStock),
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Product mutations                                                  */
/* ------------------------------------------------------------------ */

/** Inbound shape from the "Create / Edit Product" modal form. */
export type ProductFormData = {
  name: string;
  category: ProductCategory;
  description: string;
  pricingType: PricingType;
  price: number;
  priceMax?: number;
  stock?: number;
  status: ProductStatus;
  tags: string;
  serviceId?: number | null;
};

const ProductFormSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["lash-supplies", "jewelry", "crochet", "aftercare", "merch"]),
  description: z.string(),
  pricingType: z.enum(["fixed", "starting_at", "range", "custom_quote"]),
  price: z.number().nonnegative(),
  priceMax: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  status: z.enum(["active", "inactive", "out_of_stock"]),
  tags: z.string(),
  serviceId: z.number().int().positive().nullish(),
});

/**
 * Insert a new product. Infers `productType` from whether stock is
 * provided: if the form includes a stock value it's ready-made
 * inventory; otherwise it's custom/made-to-order.
 */
export async function createProduct(form: ProductFormData) {
  try {
    ProductFormSchema.parse(form);
    await getUser();

    const dbPricing = PRICING_REVERSE[form.pricingType] as
      | "fixed_price"
      | "starting_at"
      | "price_range"
      | "contact_for_quote";

    const priceInCents = form.pricingType === "range" ? null : Math.round(form.price * 100);

    const [newProduct] = await db
      .insert(products)
      .values({
        title: form.name,
        slug: slugify(form.name),
        description: form.description || null,
        productType: form.stock !== undefined ? "ready_made" : "custom_order",
        category: form.category,
        pricingType: dbPricing,
        priceInCents,
        priceMinInCents: form.pricingType === "range" ? Math.round(form.price * 100) : null,
        priceMaxInCents:
          form.pricingType === "range" && form.priceMax ? Math.round(form.priceMax * 100) : null,
        stockCount: form.stock ?? 0,
        availability:
          form.status === "out_of_stock"
            ? "out_of_stock"
            : form.stock !== undefined
              ? "in_stock"
              : "made_to_order",
        isPublished: form.status !== "inactive",
        tags: form.tags || null,
        serviceId: form.serviceId ?? null,
      })
      .returning({ id: products.id });

    // Push to Square Catalog (non-fatal).
    if (isSquareConfigured() && priceInCents != null && priceInCents > 0) {
      try {
        const squareCatalogId = await upsertCatalogItem({
          type: "product",
          localId: newProduct.id,
          name: form.name,
          description: form.description || null,
          priceInCents,
        });
        await db.update(products).set({ squareCatalogId }).where(eq(products.id, newProduct.id));
      } catch {
        // Logged by upsertCatalogItem via Sentry — don't rethrow
      }
    }

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Update an existing product. Does not re-generate the slug to preserve existing URLs. */
export async function updateProduct(id: number, form: ProductFormData) {
  try {
    z.number().int().positive().parse(id);
    ProductFormSchema.parse(form);
    await getUser();

    const dbPricing = PRICING_REVERSE[form.pricingType] as
      | "fixed_price"
      | "starting_at"
      | "price_range"
      | "contact_for_quote";

    const priceInCents = form.pricingType === "range" ? null : Math.round(form.price * 100);

    const [updated] = await db
      .update(products)
      .set({
        title: form.name,
        description: form.description || null,
        category: form.category,
        pricingType: dbPricing,
        priceInCents,
        priceMinInCents: form.pricingType === "range" ? Math.round(form.price * 100) : null,
        priceMaxInCents:
          form.pricingType === "range" && form.priceMax ? Math.round(form.priceMax * 100) : null,
        stockCount: form.stock ?? 0,
        availability:
          form.status === "out_of_stock"
            ? "out_of_stock"
            : form.stock !== undefined
              ? "in_stock"
              : "made_to_order",
        isPublished: form.status !== "inactive",
        tags: form.tags || null,
        serviceId: form.serviceId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning({ squareCatalogId: products.squareCatalogId });

    // Sync updated name/price to Square Catalog (non-fatal).
    if (isSquareConfigured() && priceInCents != null && priceInCents > 0) {
      try {
        const squareCatalogId = await upsertCatalogItem({
          type: "product",
          localId: id,
          name: form.name,
          description: form.description || null,
          priceInCents,
          existingSquareCatalogId: updated?.squareCatalogId,
        });
        if (!updated?.squareCatalogId) {
          await db.update(products).set({ squareCatalogId }).where(eq(products.id, id));
        }
      } catch {
        // Logged by upsertCatalogItem via Sentry — don't rethrow
      }
    }

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Hard-delete a product. Orders referencing it use `onDelete: "set null"` so they survive. */
export async function deleteProduct(id: number) {
  try {
    z.number().int().positive().parse(id);
    await getUser();
    await db.delete(products).where(eq(products.id, id));
    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Toggle published/unpublished. Used by the status switch on each product row. */
export async function toggleProductStatus(id: number) {
  try {
    z.number().int().positive().parse(id);
    await getUser();

    const [row] = await db
      .select({ isPublished: products.isPublished })
      .from(products)
      .where(eq(products.id, id));

    if (row) {
      await db
        .update(products)
        .set({ isPublished: !row.isPublished, updatedAt: new Date() })
        .where(eq(products.id, id));
    }

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Increment or decrement stock by `delta`. Clamps to zero — negative
 * inventory is never allowed. Automatically flips availability to
 * "out_of_stock" when count hits 0, and back to "in_stock" otherwise.
 */
export async function adjustProductStock(id: number, delta: number) {
  try {
    z.number().int().positive().parse(id);
    z.number().int().parse(delta);
    await getUser();

    const [row] = await db
      .select({ stockCount: products.stockCount })
      .from(products)
      .where(eq(products.id, id));

    if (row) {
      const newStock = Math.max(0, row.stockCount + delta);
      await db
        .update(products)
        .set({
          stockCount: newStock,
          availability: newStock === 0 ? "out_of_stock" : "in_stock",
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));
    }

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Supply mutations                                                   */
/* ------------------------------------------------------------------ */

/** Inbound shape from the "Create / Edit Supply" modal form. */
export type SupplyFormData = {
  name: string;
  category: string;
  unit: string;
  stock: number;
  reorder: number;
};

const SupplyFormSchema = z.object({
  name: z.string().min(1),
  category: z.string(),
  unit: z.string().min(1),
  stock: z.number().int().nonnegative(),
  reorder: z.number().int().nonnegative(),
});

/** Insert a new craft supply. Sets `lastRestockedAt` only if initial stock > 0. */
export async function createSupply(form: SupplyFormData) {
  try {
    SupplyFormSchema.parse(form);
    await getUser();

    await db.insert(supplies).values({
      name: form.name,
      category: form.category || null,
      unit: form.unit,
      stockCount: form.stock,
      reorderPoint: form.reorder,
      lastRestockedAt: form.stock > 0 ? new Date() : null,
    });

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Update supply details. Does not touch `lastRestockedAt` — use `adjustSupplyStock` for that. */
export async function updateSupply(id: number, form: SupplyFormData) {
  try {
    z.number().int().positive().parse(id);
    SupplyFormSchema.parse(form);
    await getUser();

    await db
      .update(supplies)
      .set({
        name: form.name,
        category: form.category || null,
        unit: form.unit,
        stockCount: form.stock,
        reorderPoint: form.reorder,
        updatedAt: new Date(),
      })
      .where(eq(supplies.id, id));

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/** Hard-delete a supply row. No soft-delete — supplies have no downstream references. */
export async function deleteSupply(id: number) {
  try {
    z.number().int().positive().parse(id);
    await getUser();
    await db.delete(supplies).where(eq(supplies.id, id));
    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Adjust supply stock by `delta`. Only positive deltas update
 * `lastRestockedAt` — decrements (usage) shouldn't reset the
 * restock date shown in the Supplies tab.
 */
export async function adjustSupplyStock(id: number, delta: number) {
  try {
    z.number().int().positive().parse(id);
    z.number().int().parse(delta);
    await getUser();

    const [row] = await db
      .select({ stockCount: supplies.stockCount })
      .from(supplies)
      .where(eq(supplies.id, id));

    if (row) {
      const newStock = Math.max(0, row.stockCount + delta);
      await db
        .update(supplies)
        .set({
          stockCount: newStock,
          // Conditional spread: only update lastRestockedAt for positive deltas
          // (restocking). Decrements (usage) should not reset the restock date.
          // Spreading an empty object is a no-op that omits the field.
          ...(delta > 0 ? { lastRestockedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(supplies.id, id));
    }

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Order status mutations                                             */
/* ------------------------------------------------------------------ */

/**
 * Order lifecycle: inquiry → quoted → accepted → in_progress →
 * ready_for_pickup → completed. "cancelled" is a terminal state
 * reachable from any step. Customer-facing emails fire on
 * "quoted" (CommissionQuote), "ready_for_pickup", and "completed"
 * (OrderStatusUpdate).
 */
export type OrderStatus =
  | "inquiry"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

/**
 * Sends a quote for a custom commission order (status: "inquiry" → "quoted").
 * Sets the quoted price, optional completion estimate and internal notes,
 * then emails the client with a link to accept/decline in their dashboard.
 */
export async function quoteCommission(
  id: number,
  amountInCents: number,
  options: { estimatedCompletionAt?: Date; notes?: string } = {},
): Promise<void> {
  z.number().int().positive().parse(id);
  z.number().int().nonnegative().parse(amountInCents);
  z.object({
    estimatedCompletionAt: z.date().optional(),
    notes: z.string().optional(),
  }).parse(options);

  const user = await getUser();

  await db
    .update(orders)
    .set({
      quotedInCents: amountInCents,
      status: "quoted",
      // Conditional spreads: only include optional fields when provided.
      // This avoids setting columns to null/undefined when the admin didn't
      // supply them, preserving any existing values in the DB row.
      ...(options.estimatedCompletionAt
        ? { estimatedCompletionAt: options.estimatedCompletionAt }
        : {}),
      ...(options.notes ? { internalNotes: options.notes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));

  /* Best-effort email — separate try/catch so the quote is saved even if Resend fails. */
  try {
    const [order] = await db
      .select({
        clientId: orders.clientId,
        orderNumber: orders.orderNumber,
        title: orders.title,
        estimatedCompletionAt: orders.estimatedCompletionAt,
      })
      .from(orders)
      .where(eq(orders.id, id));

    if (!order) return;

    const [profile] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, order.clientId));

    if (profile?.email) {
      const bp = await getPublicBusinessProfile();
      await sendEmail({
        to: profile.email,
        subject: `Your commission quote is ready — ${bp.businessName}`,
        react: CommissionQuote({
          clientName: profile.firstName,
          orderNumber: order.orderNumber,
          title: order.title,
          quotedAmountInCents: amountInCents,
          estimatedCompletion: order.estimatedCompletionAt
            ? order.estimatedCompletionAt.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : undefined,
          notes: options.notes,
          businessName: bp.businessName,
        }),
        entityType: "commission_quote",
        localId: String(id),
      });
    }
  } catch {
    // Non-fatal
  }

  revalidatePath(PATH);
}

/**
 * Transition an order to a new status. Terminal states ("completed",
 * "cancelled") stamp their respective timestamp columns so the
 * dashboard can show when an order was finished or dropped.
 *
 * Emails are sent only for customer-visible milestones (pickup
 * ready, completed) — intermediate status changes are internal.
 */
export async function updateOrderStatus(id: number, status: OrderStatus): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    z.enum([
      "inquiry",
      "quoted",
      "accepted",
      "in_progress",
      "ready_for_pickup",
      "completed",
      "cancelled",
    ]).parse(status);
    await getUser();

    const updates: Record<string, unknown> = { status, updatedAt: new Date() };
    if (status === "completed") updates.completedAt = new Date();
    if (status === "cancelled") updates.cancelledAt = new Date();

    await db.update(orders).set(updates).where(eq(orders.id, id));

    // Send email for ready_for_pickup and completed
    if (status === "ready_for_pickup" || status === "completed") {
      await trySendOrderStatusEmail(id, status);
    }

    revalidatePath(PATH);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Best-effort email dispatch for order status changes. Wrapped in
 * try/catch so a Resend outage never blocks the status update itself.
 * Uses `getEmailRecipient` to resolve the client's current email from
 * their profile (handles cases where email changed after order creation).
 */
async function trySendOrderStatusEmail(
  orderId: number,
  status: "ready_for_pickup" | "completed",
): Promise<void> {
  try {
    const [order] = await db
      .select({
        clientId: orders.clientId,
        orderNumber: orders.orderNumber,
        title: orders.title,
      })
      .from(orders)
      .where(eq(orders.id, orderId));

    if (!order) return;

    const [recipient, bp] = await Promise.all([
      getEmailRecipient(order.clientId),
      getPublicBusinessProfile(),
    ]);
    if (!recipient) return;

    const subjectMap = {
      ready_for_pickup: `Order ${order.orderNumber} ready for pickup — ${bp.businessName}`,
      completed: `Order ${order.orderNumber} completed — ${bp.businessName}`,
    };

    await sendEmail({
      to: recipient.email,
      subject: subjectMap[status],
      react: OrderStatusUpdate({
        clientName: recipient.firstName,
        orderNumber: order.orderNumber,
        productTitle: order.title,
        status,
        businessName: bp.businessName,
      }),
      entityType: "order_status_update",
      localId: String(orderId),
    });
  } catch {
    // Non-fatal
  }
}
