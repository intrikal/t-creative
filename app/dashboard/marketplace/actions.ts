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
import { eq, desc, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import { products, orders, supplies, profiles } from "@/db/schema";
import { OrderStatusUpdate } from "@/emails/OrderStatusUpdate";
import { sendEmail, getEmailRecipient } from "@/lib/resend";
import { createClient } from "@/utils/supabase/server";

const PATH = "/dashboard/marketplace";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ProductCategory = "lash-supplies" | "jewelry" | "crochet" | "aftercare" | "merch";
export type PricingType = "fixed" | "starting_at" | "range" | "custom_quote";
export type ProductStatus = "active" | "inactive" | "out_of_stock";

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

export type SupplyRow = {
  id: number;
  name: string;
  category: string;
  unit: string;
  stock: number;
  reorder: number;
  lastRestocked: string | null;
};

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

const LOW_STOCK_THRESHOLD = 5;

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

function deriveStatus(isPublished: boolean, availability: string): ProductStatus {
  if (!isPublished) return "inactive";
  if (availability === "out_of_stock") return "out_of_stock";
  return "active";
}

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

export async function getProducts(): Promise<ProductRow[]> {
  await getUser();

  // Batch 1: products
  const rows = await db
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
    .orderBy(desc(products.createdAt));

  // Batch 2: sales count per product (completed orders only)
  const salesRows = await db
    .select({
      productId: orders.productId,
      count: sql<number>`count(*)`,
    })
    .from(orders)
    .where(eq(orders.status, "completed"))
    .groupBy(orders.productId);

  const salesMap = new Map(
    salesRows.filter((r) => r.productId !== null).map((r) => [r.productId!, Number(r.count)]),
  );

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
}

export async function getSupplies(): Promise<SupplyRow[]> {
  await getUser();

  const rows = await db.select().from(supplies).orderBy(asc(supplies.category), asc(supplies.name));

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
}

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  await getUser();

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
}

/* ------------------------------------------------------------------ */
/*  Product mutations                                                  */
/* ------------------------------------------------------------------ */

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

export async function createProduct(form: ProductFormData) {
  await getUser();

  const dbPricing = PRICING_REVERSE[form.pricingType] as
    | "fixed_price"
    | "starting_at"
    | "price_range"
    | "contact_for_quote";

  await db.insert(products).values({
    title: form.name,
    slug: slugify(form.name),
    description: form.description || null,
    productType: form.stock !== undefined ? "ready_made" : "custom_order",
    category: form.category,
    pricingType: dbPricing,
    priceInCents: form.pricingType === "range" ? null : Math.round(form.price * 100),
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
  });

  revalidatePath(PATH);
}

export async function updateProduct(id: number, form: ProductFormData) {
  await getUser();

  const dbPricing = PRICING_REVERSE[form.pricingType] as
    | "fixed_price"
    | "starting_at"
    | "price_range"
    | "contact_for_quote";

  await db
    .update(products)
    .set({
      title: form.name,
      description: form.description || null,
      category: form.category,
      pricingType: dbPricing,
      priceInCents: form.pricingType === "range" ? null : Math.round(form.price * 100),
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
    .where(eq(products.id, id));

  revalidatePath(PATH);
}

export async function deleteProduct(id: number) {
  await getUser();
  await db.delete(products).where(eq(products.id, id));
  revalidatePath(PATH);
}

export async function toggleProductStatus(id: number) {
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
}

export async function adjustProductStock(id: number, delta: number) {
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
}

/* ------------------------------------------------------------------ */
/*  Supply mutations                                                   */
/* ------------------------------------------------------------------ */

export type SupplyFormData = {
  name: string;
  category: string;
  unit: string;
  stock: number;
  reorder: number;
};

export async function createSupply(form: SupplyFormData) {
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
}

export async function updateSupply(id: number, form: SupplyFormData) {
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
}

export async function deleteSupply(id: number) {
  await getUser();
  await db.delete(supplies).where(eq(supplies.id, id));
  revalidatePath(PATH);
}

export async function adjustSupplyStock(id: number, delta: number) {
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
        ...(delta > 0 ? { lastRestockedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(supplies.id, id));
  }

  revalidatePath(PATH);
}

/* ------------------------------------------------------------------ */
/*  Order status mutations                                             */
/* ------------------------------------------------------------------ */

export type OrderStatus =
  | "inquiry"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<void> {
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
}

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

    const recipient = await getEmailRecipient(order.clientId);
    if (!recipient) return;

    const subjectMap = {
      ready_for_pickup: `Order ${order.orderNumber} ready for pickup — T Creative`,
      completed: `Order ${order.orderNumber} completed — T Creative`,
    };

    await sendEmail({
      to: recipient.email,
      subject: subjectMap[status],
      react: OrderStatusUpdate({
        clientName: recipient.firstName,
        orderNumber: order.orderNumber,
        productTitle: order.title,
        status,
      }),
      entityType: "order_status_update",
      localId: String(orderId),
    });
  } catch {
    // Non-fatal
  }
}
