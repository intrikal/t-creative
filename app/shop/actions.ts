/**
 * Shop server actions — public product queries and checkout mutations.
 *
 * Read actions (getPublishedProducts) are public — no auth required.
 * Write actions (placeOrder, getClientOrders) require authentication.
 *
 * @module shop/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, orders, profiles, syncLog } from "@/db/schema";
import { OrderConfirmation } from "@/emails/OrderConfirmation";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import { isSquareConfigured, createSquareOrderPaymentLink } from "@/lib/square";
import { createZohoDeal } from "@/lib/zoho";
import { createZohoBooksInvoice } from "@/lib/zoho-books";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
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

export type ShopProduct = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  pricingType: "fixed_price" | "starting_at" | "price_range" | "contact_for_quote";
  priceInCents: number | null;
  priceMinInCents: number | null;
  priceMaxInCents: number | null;
  availability: string;
  stockCount: number;
  imageUrl: string | null;
  serviceId: number | null;
  tags: string[];
  isFeatured: boolean;
};

export type CartItemInput = {
  productId: number;
  quantity: number;
};

export type PlaceOrderInput = {
  items: CartItemInput[];
  fulfillmentMethod: "pickup_cash" | "pickup_online";
};

export type PlaceOrderResult = {
  success: boolean;
  orderNumber?: string;
  paymentUrl?: string;
  error?: string;
};

export type ClientOrder = {
  id: number;
  orderNumber: string;
  title: string;
  status: string;
  quantity: number;
  finalInCents: number | null;
  fulfillmentMethod: string | null;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Public queries                                                     */
/* ------------------------------------------------------------------ */

/**
 * Returns all published products for the shop.
 * No authentication required — this powers the public /shop page.
 */
export async function getPublishedProducts(): Promise<ShopProduct[]> {
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

/* ------------------------------------------------------------------ */
/*  Checkout                                                           */
/* ------------------------------------------------------------------ */

/**
 * Places an order for cart items. Creates one `orders` row per cart item,
 * decrements stock for in-stock products, and optionally generates a
 * Square payment link for online payments.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const user = await getUser();

  if (input.items.length === 0) {
    return { success: false, error: "Cart is empty" };
  }

  // Validate all products exist and are purchasable
  const productIds = input.items.map((i) => i.productId);
  const productRows = await db
    .select({
      id: products.id,
      title: products.title,
      priceInCents: products.priceInCents,
      pricingType: products.pricingType,
      availability: products.availability,
      stockCount: products.stockCount,
      isPublished: products.isPublished,
    })
    .from(products)
    .where(sql`${products.id} = ANY(${productIds})`);

  const productMap = new Map(productRows.map((r) => [r.id, r]));

  // Validate each item
  const lineItems: Array<{ name: string; quantity: number; amountInCents: number }> = [];
  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product) return { success: false, error: `Product not found: ${item.productId}` };
    if (!product.isPublished)
      return { success: false, error: `${product.title} is no longer available` };
    if (product.pricingType !== "fixed_price" || !product.priceInCents) {
      return { success: false, error: `${product.title} requires a quote — cannot add to cart` };
    }
    if (product.availability === "out_of_stock") {
      return { success: false, error: `${product.title} is out of stock` };
    }
    if (product.availability === "in_stock" && product.stockCount < item.quantity) {
      return { success: false, error: `Only ${product.stockCount} of ${product.title} in stock` };
    }
    lineItems.push({
      name: product.title,
      quantity: item.quantity,
      amountInCents: product.priceInCents * item.quantity,
    });
  }

  // Generate order number
  const orderNumber = `ord-${Date.now().toString(36)}`;

  // Create order rows and decrement stock
  let totalInCents = 0;
  const createdOrderIds: number[] = [];

  for (const item of input.items) {
    const product = productMap.get(item.productId)!;
    const itemTotal = product.priceInCents! * item.quantity;
    totalInCents += itemTotal;

    const [inserted] = await db
      .insert(orders)
      .values({
        orderNumber: `${orderNumber}-${item.productId}`,
        clientId: user.id,
        productId: item.productId,
        status: "accepted",
        title: product.title,
        quantity: item.quantity,
        finalInCents: itemTotal,
        fulfillmentMethod: input.fulfillmentMethod,
      })
      .returning({ id: orders.id });

    createdOrderIds.push(inserted.id);

    // Decrement stock for in-stock items
    if (product.availability === "in_stock") {
      const newStock = Math.max(0, product.stockCount - item.quantity);
      await db
        .update(products)
        .set({
          stockCount: newStock,
          availability: newStock === 0 ? "out_of_stock" : "in_stock",
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
    }
  }

  // Generate Square payment link for online payments
  let paymentUrl: string | undefined;
  if (input.fulfillmentMethod === "pickup_online" && isSquareConfigured()) {
    try {
      const { url, orderId: squareOrderId } = await createSquareOrderPaymentLink({
        orderId: createdOrderIds[0],
        orderNumber,
        lineItems,
      });

      paymentUrl = url;

      // Store Square order ID on all order rows
      for (const id of createdOrderIds) {
        await db.update(orders).set({ squareOrderId }).where(eq(orders.id, id));
      }

      await db.insert(syncLog).values({
        provider: "square",
        direction: "outbound",
        status: "success",
        entityType: "payment_link",
        localId: String(createdOrderIds[0]),
        remoteId: squareOrderId,
        message: `Created payment link for order ${orderNumber}`,
        payload: { url, orderNumber, totalInCents },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create payment link";
      await db.insert(syncLog).values({
        provider: "square",
        direction: "outbound",
        status: "failed",
        entityType: "payment_link",
        localId: String(createdOrderIds[0]),
        message: "Failed to create payment link for order",
        errorMessage: message,
      });
      // Non-fatal — order is still created, client can pay later
    }
  }

  // Send order confirmation email (non-fatal)
  const [clientProfile] = await db
    .select({ email: profiles.email, firstName: profiles.firstName })
    .from(profiles)
    .where(eq(profiles.id, user.id));

  if (clientProfile?.email) {
    await sendEmail({
      to: clientProfile.email,
      subject: `Order ${orderNumber} confirmed — T Creative`,
      react: OrderConfirmation({
        clientName: clientProfile.firstName,
        orderNumber,
        items: lineItems,
        totalInCents,
        fulfillmentMethod: input.fulfillmentMethod,
        paymentUrl,
      }),
      entityType: "order_confirmation",
      localId: String(createdOrderIds[0]),
    });
  }

  trackEvent(user.id, "order_placed", {
    orderNumber,
    itemCount: input.items.length,
    totalInCents,
    fulfillmentMethod: input.fulfillmentMethod,
    hasPaymentLink: !!paymentUrl,
  });

  // Zoho CRM: create deal for shop order
  if (clientProfile?.email) {
    const itemNames = lineItems.map((i) => i.name).join(", ");
    createZohoDeal({
      contactEmail: clientProfile.email,
      dealName: `Shop Order ${orderNumber} — ${itemNames}`,
      stage: "Closed Won",
      amountInCents: totalInCents,
      pipeline: "Shop",
      externalId: orderNumber,
    });

    // Zoho Books: create invoice for shop order
    createZohoBooksInvoice({
      entityType: "order",
      entityId: createdOrderIds[0],
      profileId: user.id,
      email: clientProfile.email,
      firstName: clientProfile.firstName,
      lineItems: lineItems.map((item) => ({
        name: item.name,
        rate: item.amountInCents / item.quantity,
        quantity: item.quantity,
      })),
    });
  }

  revalidatePath("/shop");
  revalidatePath("/dashboard/marketplace");

  return { success: true, orderNumber, paymentUrl };
}

/* ------------------------------------------------------------------ */
/*  Client order history                                               */
/* ------------------------------------------------------------------ */

/**
 * Returns the logged-in client's order history.
 */
export async function getClientOrders(): Promise<ClientOrder[]> {
  const user = await getUser();

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      title: orders.title,
      status: orders.status,
      quantity: orders.quantity,
      finalInCents: orders.finalInCents,
      fulfillmentMethod: orders.fulfillmentMethod,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.clientId, user.id))
    .orderBy(desc(orders.createdAt));

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));
}
