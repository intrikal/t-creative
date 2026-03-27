/**
 * Shop server actions — public product queries and checkout mutations.
 *
 * Read actions (getPublishedProducts) are public — no auth required.
 * Write actions (placeOrder, getClientOrders) require authentication.
 *
 * @module shop/actions
 */
"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq, desc, sql, ilike, and, isNotNull } from "drizzle-orm";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import {
  products,
  orders,
  profiles,
  syncLog,
  giftCards,
  giftCardTransactions,
  wishlistItems,
  type ShippingAddress,
} from "@/db/schema";
import { OrderConfirmation } from "@/emails/OrderConfirmation";
import { getCurrentUser, getUser } from "@/lib/auth";
import { getShippingRates, isEasyPostConfigured } from "@/lib/easypost";
import type { ShipmentResult } from "@/lib/easypost";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import { isSquareConfigured, createSquareOrderPaymentLink } from "@/lib/square";
import { createZohoDeal } from "@/lib/zoho";
import { createZohoBooksInvoice } from "@/lib/zoho-books";

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
  fulfillmentMethod: "pickup_cash" | "pickup_online" | "ship_standard" | "ship_express";
  giftCardCode?: string;
  /** Required when fulfillmentMethod is ship_standard or ship_express. */
  shippingAddress?: ShippingAddress;
  /** EasyPost shipment ID from the rate fetch step. */
  easypostShipmentId?: string;
  /** Selected EasyPost rate ID. */
  easypostRateId?: string;
  /** Shipping cost in cents (from the selected rate). */
  shippingCostInCents?: number;
  /** Guest checkout — provided when the user is not logged in. */
  guestInfo?: {
    email: string;
    name: string;
    phone?: string;
  };
};

export type GiftCardLookupResult = {
  id: number;
  balanceInCents: number;
  originalAmountInCents: number;
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
/*  Shipping rates                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fetches available shipping rates from EasyPost for the given address.
 * Called at checkout when the customer selects a shipping fulfillment method.
 */
export async function fetchShippingRates(address: ShippingAddress): Promise<ShipmentResult> {
  if (!isEasyPostConfigured()) {
    throw new Error("Shipping is not available at this time");
  }
  return getShippingRates(address);
}

/* ------------------------------------------------------------------ */
/*  Gift card lookup                                                   */
/* ------------------------------------------------------------------ */

/**
 * Validates a gift card code and returns its current balance.
 * Read-only — does not decrement the balance. Call placeOrder with the
 * code to perform the actual redemption atomically.
 */
export async function lookupGiftCard(code: string): Promise<GiftCardLookupResult> {
  // QUERY: Look up a single gift card by its code.
  // SELECT — Reads the card's id, current balance, original loaded amount, status, and expiry date.
  // FROM   — The gift_cards table which stores every issued gift card.
  // WHERE  — Case-insensitive match (ILIKE) on the trimmed code the user typed in.
  // LIMIT 1 — We only need one row; codes are unique but LIMIT guards against edge cases.
  const [card] = await db
    .select({
      id: giftCards.id,
      balanceInCents: giftCards.balanceInCents,
      originalAmountInCents: giftCards.originalAmountInCents,
      status: giftCards.status,
      expiresAt: giftCards.expiresAt,
    })
    .from(giftCards)
    .where(ilike(giftCards.code, code.trim()))
    .limit(1);

  if (!card) throw new Error("Gift card not found");
  if (card.status !== "active") throw new Error("This gift card has already been used");
  if (card.balanceInCents <= 0) throw new Error("This gift card has no remaining balance");
  if (card.expiresAt && card.expiresAt < new Date()) throw new Error("This gift card has expired");

  return {
    id: card.id,
    balanceInCents: card.balanceInCents,
    originalAmountInCents: card.originalAmountInCents,
  };
}

/* ------------------------------------------------------------------ */
/*  Public queries                                                     */
/* ------------------------------------------------------------------ */

// getPublishedProducts is now in ./queries.ts with "use cache"

/* ------------------------------------------------------------------ */
/*  Checkout                                                           */
/* ------------------------------------------------------------------ */

/**
 * Places an order for cart items. Creates one `orders` row per cart item,
 * decrements stock for in-stock products, and optionally generates a
 * Square payment link for online payments.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const currentUser = await getCurrentUser();
  const user = currentUser ? { id: currentUser.id, email: currentUser.email } : null;

  // Require either auth or guest info
  if (!user && !input.guestInfo?.email) {
    return { success: false, error: "Please log in or provide contact information." };
  }

  // Validate guest info
  if (!user && input.guestInfo) {
    if (!input.guestInfo.email.includes("@")) {
      return { success: false, error: "Please enter a valid email address." };
    }
    if (input.guestInfo.name.trim().length < 2) {
      return { success: false, error: "Please enter your name." };
    }
  }

  if (input.items.length === 0) {
    return { success: false, error: "Cart is empty" };
  }

  const isShipping =
    input.fulfillmentMethod === "ship_standard" || input.fulfillmentMethod === "ship_express";

  if (isShipping) {
    if (!input.shippingAddress) return { success: false, error: "Shipping address is required" };
    if (!input.easypostShipmentId || !input.easypostRateId) {
      return { success: false, error: "Shipping rate selection is required" };
    }
  }

  // Extract just the product IDs from the cart items so we can batch-fetch
  // them in a single SQL query (WHERE id = ANY(...)). Using .map() to pluck
  // one field is simpler than destructuring in a loop and produces the exact
  // number[] shape the ANY() operator needs.
  const productIds = input.items.map((i) => i.productId);
  // QUERY: Fetch every product referenced in the cart so we can validate price, stock, and status.
  // SELECT — Reads id, title, price, pricing type, availability status, stock count, and published flag.
  // FROM   — The products table (the full product catalog).
  // WHERE  — Uses Postgres ANY() to match all product IDs from the cart in a single round-trip.
  //          Equivalent to: WHERE id IN (1, 2, 3, ...).
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

  // Build a Map keyed by product ID for O(1) lookups in the validation loop
  // below. A Map is preferred over an object because the keys are numbers and
  // Map preserves key types without coercion. Using .map() inside the
  // constructor converts the flat array into [key, value] tuples in one pass.
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

    // MUTATION: Insert one order row per cart item into the orders table.
    // Each row gets a unique order number (e.g. "ord-abc123-7") combining the shared
    // order prefix with the product ID. Status starts as "accepted".
    // Side-effects: Creates a new row in the orders table. If the customer chose
    // shipping, the shipping address, EasyPost shipment ID, and cost are persisted
    // on the order row so fulfillment can reference them later.
    // RETURNING — Gives us the auto-generated order ID for downstream use
    // (Square link, sync log, email).
    const [inserted] = await db
      .insert(orders)
      .values({
        orderNumber: `${orderNumber}-${item.productId}`,
        clientId: user?.id ?? null,
        guestEmail: user ? null : input.guestInfo!.email,
        guestName: user ? null : input.guestInfo!.name,
        guestPhone: user ? null : (input.guestInfo!.phone ?? null),
        productId: item.productId,
        status: "accepted",
        title: product.title,
        quantity: item.quantity,
        finalInCents: itemTotal,
        fulfillmentMethod: input.fulfillmentMethod,
        ...(isShipping && {
          shippingAddress: input.shippingAddress,
          easypostShipmentId: input.easypostShipmentId,
          shippingCostInCents: input.shippingCostInCents ?? 0,
        }),
      })
      .returning({ id: orders.id });

    createdOrderIds.push(inserted.id);

    // Decrement stock for in-stock items
    // MUTATION: Reduce the product's stockCount by the purchased quantity.
    // Side-effects: If stock hits zero, the product's availability flips to
    // "out_of_stock" so the storefront hides the "Add to Cart" button.
    // updatedAt is set so admin dashboards reflect the last inventory change.
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

  // Apply gift card if provided — re-validate server-side and decrement balance
  let giftCardDiscountInCents = 0;
  if (input.giftCardCode) {
    // QUERY: Re-fetch the gift card at redemption time to guard against stale data.
    // The earlier lookupGiftCard call was read-only; between that call and now the
    // card could have been redeemed by another checkout, so we re-validate here.
    // SELECT — Reads id, current balance, status, and expiry.
    // FROM   — gift_cards table.
    // WHERE  — Case-insensitive match on the code (ILIKE).
    // LIMIT 1 — Codes are unique; limit is a safety net.
    const [card] = await db
      .select({
        id: giftCards.id,
        balanceInCents: giftCards.balanceInCents,
        status: giftCards.status,
        expiresAt: giftCards.expiresAt,
      })
      .from(giftCards)
      .where(ilike(giftCards.code, input.giftCardCode.trim()))
      .limit(1);

    if (
      card &&
      card.status === "active" &&
      card.balanceInCents > 0 &&
      (!card.expiresAt || card.expiresAt >= new Date())
    ) {
      giftCardDiscountInCents = Math.min(card.balanceInCents, totalInCents);
      const newBalance = card.balanceInCents - giftCardDiscountInCents;

      // MUTATION: Subtract the discount amount from the gift card's balance.
      // Side-effects: If the entire balance is consumed, status flips to "redeemed"
      // so the card cannot be used again. Otherwise it stays "active" with the
      // reduced balance available for future purchases.
      await db
        .update(giftCards)
        .set({ balanceInCents: newBalance, status: newBalance === 0 ? "redeemed" : "active" })
        .where(eq(giftCards.id, card.id));

      // MUTATION: Record the redemption in the gift_card_transactions ledger.
      // Side-effects: Creates an audit trail row with the amount deducted and
      // the balance remaining after this transaction. Used for admin reporting.
      await db.insert(giftCardTransactions).values({
        giftCardId: card.id,
        type: "redemption",
        amountInCents: giftCardDiscountInCents,
        balanceAfterInCents: newBalance,
        notes: `Redeemed on order ${orderNumber}`,
      });
    }
  }

  // Add shipping cost to the total
  const shippingInCents = isShipping ? (input.shippingCostInCents ?? 0) : 0;
  if (shippingInCents > 0) {
    lineItems.push({ name: "Shipping", quantity: 1, amountInCents: shippingInCents });
    totalInCents += shippingInCents;
  }

  const chargeInCents = totalInCents - giftCardDiscountInCents;

  // Generate Square payment link for online payments
  let paymentUrl: string | undefined;
  const requiresOnlinePayment = input.fulfillmentMethod === "pickup_online" || isShipping;

  if (requiresOnlinePayment && isSquareConfigured() && chargeInCents > 0) {
    try {
      // Reduce the Square charge by appending a negative line item for the gift card.
      const squareLineItems =
        giftCardDiscountInCents > 0
          ? [
              ...lineItems,
              { name: "Gift card", quantity: 1, amountInCents: -giftCardDiscountInCents },
            ]
          : lineItems;
      const { url, orderId: squareOrderId } = await createSquareOrderPaymentLink({
        orderId: createdOrderIds[0],
        orderNumber,
        lineItems: squareLineItems,
      });

      paymentUrl = url;

      // MUTATION: Persist the Square-generated order ID on every local order row
      // so we can reconcile payments when Square sends webhook callbacks.
      for (const id of createdOrderIds) {
        await db.update(orders).set({ squareOrderId }).where(eq(orders.id, id));
      }

      // MUTATION: Write a success entry to the sync_log table so admins can
      // audit every outbound integration call (provider, direction, payload).
      await db.insert(syncLog).values({
        provider: "square",
        direction: "outbound",
        status: "success",
        entityType: "payment_link",
        localId: String(createdOrderIds[0]),
        remoteId: squareOrderId,
        message: `Created payment link for order ${orderNumber}`,
        payload: { url, orderNumber, totalInCents, giftCardDiscountInCents, chargeInCents },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create payment link";
      // MUTATION: Log the failed Square API call so admins can diagnose and retry.
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
  // Resolve buyer contact info — from profile (authenticated) or guest input.
  let buyerEmail: string | undefined;
  let buyerName: string | undefined;

  if (user) {
    const [clientProfile] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, user.id));
    buyerEmail = clientProfile?.email;
    buyerName = clientProfile?.firstName;
  } else if (input.guestInfo) {
    buyerEmail = input.guestInfo.email;
    buyerName = input.guestInfo.name.split(" ")[0];
  }

  if (buyerEmail) {
    const bp = await getPublicBusinessProfile();
    await sendEmail({
      to: buyerEmail,
      subject: `Order ${orderNumber} confirmed — ${bp.businessName}`,
      react: OrderConfirmation({
        clientName: buyerName || "there",
        orderNumber,
        items: lineItems,
        totalInCents,
        fulfillmentMethod: input.fulfillmentMethod,
        paymentUrl,
        businessName: bp.businessName,
      }),
      entityType: "order_confirmation",
      localId: String(createdOrderIds[0]),
    });
  }

  trackEvent(user?.id ?? `guest-${input.guestInfo?.email}`, "order_placed", {
    orderNumber,
    itemCount: input.items.length,
    totalInCents,
    giftCardDiscountInCents,
    chargeInCents,
    fulfillmentMethod: input.fulfillmentMethod,
    hasPaymentLink: !!paymentUrl,
  });

  // Zoho CRM: create deal for shop order
  if (buyerEmail) {
    const itemNames = lineItems.map((i) => i.name).join(", ");
    createZohoDeal({
      contactEmail: buyerEmail,
      dealName: `Shop Order ${orderNumber} — ${itemNames}`,
      stage: "Closed Won",
      amountInCents: totalInCents,
      pipeline: "Shop",
      externalId: orderNumber,
    });

    // Zoho Books: create invoice for shop order (only for authenticated users with a profile)
    if (user) {
      createZohoBooksInvoice({
        entityType: "order",
        entityId: createdOrderIds[0],
        profileId: user.id,
        email: buyerEmail,
        firstName: buyerName,
        lineItems: lineItems.map((item) => ({
          name: item.name,
          rate: item.amountInCents / item.quantity,
          quantity: item.quantity,
        })),
      });
    }
  }

  updateTag("products");
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

  // QUERY: Fetch every order placed by the currently logged-in client.
  // SELECT   — Reads order id, order number, product title, status, quantity,
  //            final price, fulfillment method, and creation timestamp.
  // FROM     — The orders table (one row per line-item in a checkout).
  // WHERE    — Two conditions combined with AND:
  //            1. clientId matches the authenticated user (only show their orders).
  //            2. productId IS NOT NULL filters out non-shop orders (e.g. service
  //               bookings that also live in the orders table but have no product).
  // ORDER BY — Most recent orders first (descending by createdAt).
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
    .where(and(eq(orders.clientId, user.id), isNotNull(orders.productId)))
    .orderBy(desc(orders.createdAt));

  // Transform each order row by converting the Date object to a human-readable
  // string (e.g. "Mar 15, 2026"). Spread keeps all other fields intact. We
  // serialise the date here (server-side) rather than on the client because
  // server actions must return plain JSON — Date objects cannot cross the
  // RSC serialisation boundary.
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));
}

/* ------------------------------------------------------------------ */
/*  Wishlist                                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns the product IDs the logged-in client has saved to their wishlist.
 */
export async function getWishlistProductIds(): Promise<number[]> {
  const user = await getUser();

  // QUERY: Get every product ID the client has wishlisted.
  // SELECT — Only the productId column (we just need IDs to highlight hearts in the UI).
  // FROM   — The wishlist_items table (a join table linking clients to products).
  // WHERE  — Filters to rows belonging to the authenticated client.
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.clientId, user.id));

  // Pluck just the productId from each wishlist row, producing a flat number[]
  // the UI uses to check "is this product wishlisted?" via .includes(). A flat
  // array is cheaper to serialise and check than passing full row objects.
  return rows.map((r) => r.productId);
}

/**
 * Adds a product to the logged-in client's wishlist.
 * Silently no-ops if the product is already saved.
 */
export async function addToWishlist(productId: number): Promise<void> {
  const user = await getUser();

  // QUERY: Check whether this product is already in the client's wishlist.
  // SELECT — Only the row ID (we don't need any data, just existence).
  // FROM   — wishlist_items table.
  // WHERE  — Both clientId AND productId must match (compound uniqueness check).
  // LIMIT 1 — Stop scanning after the first match.
  const [existing] = await db
    .select({ id: wishlistItems.id })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.clientId, user.id), eq(wishlistItems.productId, productId)))
    .limit(1);

  if (!existing) {
    // MUTATION: Insert a new wishlist row linking this client to this product.
    // Side-effects: The product will now appear in the client's wishlist page
    // and the heart icon will be filled on the shop grid.
    await db.insert(wishlistItems).values({ clientId: user.id, productId });
  }

  // Side-effect: Revalidates the shop page cache so the wishlist state is fresh.
  revalidatePath("/dashboard/shop");
}

/**
 * Removes a product from the logged-in client's wishlist.
 */
export async function removeFromWishlist(productId: number): Promise<void> {
  const user = await getUser();

  // MUTATION: Delete the wishlist row for this client + product combination.
  // WHERE — Both clientId AND productId must match so we only remove the
  //         specific product, not the client's entire wishlist.
  // Side-effects: The product disappears from the client's saved items and
  // the heart icon reverts to unfilled on the shop grid.
  await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.clientId, user.id), eq(wishlistItems.productId, productId)));

  // Side-effect: Revalidates the shop page cache so the UI reflects the removal.
  revalidatePath("/dashboard/shop");
}
