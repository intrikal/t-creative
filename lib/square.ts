/**
 * Square SDK client — singleton for server-side use only.
 *
 * Initialises a single `SquareClient` instance for the Payments, Refunds,
 * and Customers APIs. The instance is module-scoped and reused across
 * requests, mirroring the pattern in `db/index.ts`.
 *
 * Graceful degradation: when Square env vars are missing the app still
 * boots (cash-only mode). Always check `isSquareConfigured()` before
 * calling any Square API.
 *
 * Required env vars:
 * - `SQUARE_ACCESS_TOKEN`  — from Square Developer Dashboard
 * - `SQUARE_LOCATION_ID`   — the location ID for Trini's studio
 * - `SQUARE_ENVIRONMENT`   — "sandbox" or "production"
 * - `SQUARE_WEBHOOK_SIGNATURE_KEY` — for webhook signature verification
 *
 * @module lib/square
 */
import * as Sentry from "@sentry/nextjs";
import { SquareClient, SquareEnvironment } from "square";

// Module-scoped env reads — evaluated once at import time.
// Defaults to Sandbox so a missing env var never accidentally hits production.
const accessToken = process.env.SQUARE_ACCESS_TOKEN;
const locationId = process.env.SQUARE_LOCATION_ID;
const environment =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

/** Square location ID for the studio. */
export const SQUARE_LOCATION_ID = locationId ?? "";

/** Webhook signature key for verifying inbound Square webhooks. */
export const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";

/** Whether Square credentials are configured (access token + location). */
export function isSquareConfigured(): boolean {
  return !!(accessToken && locationId);
}

/**
 * Shared Square SDK client instance.
 *
 * Instantiated eagerly (not lazy) because the SquareClient constructor
 * does not throw when the token is empty — it only fails on actual API
 * calls, which are always guarded by `isSquareConfigured()`.
 */
export const squareClient = new SquareClient({
  token: accessToken ?? "",
  environment,
});

/* ------------------------------------------------------------------ */
/*  Orders API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Creates a Square Order for a booking. The order's `referenceId` is set
 * to the booking ID so webhook payments can be matched back to bookings.
 *
 * Used when a booking is confirmed so the POS tablet can take payment
 * against this order, and the webhook handler can auto-link it.
 */
export async function createSquareOrder(params: {
  bookingId: number;
  serviceName: string;
  amountInCents: number;
  clientName?: string;
}): Promise<string> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  try {
    const response = await squareClient.orders.create({
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.bookingId),
        lineItems: [
          {
            name: params.serviceName,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(params.amountInCents),
              currency: "USD",
            },
          },
        ],
        metadata: {
          bookingId: String(params.bookingId),
          ...(params.clientName ? { clientName: params.clientName } : {}),
        },
      },
      // Random UUID is safe here — orders are not retried, so each call
      // should create a distinct order. For retryable paths see createSquarePayment
      // which accepts an idempotency key from the caller.
      idempotencyKey: crypto.randomUUID(),
    });

    const orderId = response.order?.id;
    if (!orderId) throw new Error("Square order creation failed — no order ID returned");
    return orderId;
  } catch (err) {
    // All Square functions report to Sentry then re-throw so the caller
    // (typically a server action) can surface a user-facing error message.
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Checkout API — Payment Links                                       */
/* ------------------------------------------------------------------ */

/**
 * Creates a Square payment link using Quick Pay. Returns the payment
 * link URL and the auto-created order ID (used for webhook matching).
 *
 * Supports both deposit and full-balance payments. The `paymentNote`
 * includes the booking ID so payments can be traced back.
 */
export async function createSquarePaymentLink(params: {
  bookingId: number;
  serviceName: string;
  amountInCents: number;
  type: "deposit" | "balance";
}): Promise<{ url: string; orderId: string }> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  const label = params.type === "deposit" ? `Deposit — ${params.serviceName}` : params.serviceName;

  try {
    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.bookingId),
        lineItems: [
          {
            name: label,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(params.amountInCents),
              currency: "USD",
            },
          },
        ],
        metadata: {
          bookingId: String(params.bookingId),
          paymentType: params.type,
        },
      },
      paymentNote: `Booking #${params.bookingId} (${params.type})`,
    });

    const link = response.paymentLink;
    if (!link?.url || !link?.orderId) {
      throw new Error("Payment link creation failed — no URL returned");
    }

    return { url: link.url, orderId: link.orderId };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Payments API — Inline card payment                                 */
/* ------------------------------------------------------------------ */

/**
 * Charges a card using a Web Payments SDK token (nonce).
 *
 * Creates an order first (for webhook matching), then creates a payment
 * against that order. Returns the Square payment ID, order ID, and
 * receipt URL.
 *
 * Used for inline deposit collection during the public booking flow.
 */
export async function createSquarePayment(params: {
  bookingId: number;
  serviceName: string;
  amountInCents: number;
  sourceId: string; // Web Payments SDK nonce
  idempotencyKey: string;
  note?: string;
}): Promise<{ paymentId: string; orderId: string; receiptUrl: string | null }> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  try {
    // Two-step flow: order first, then payment against the order.
    // This ensures the payment shows up on the POS linked to the order,
    // and the webhook handler can match payments to bookings via referenceId.
    const orderResponse = await squareClient.orders.create({
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.bookingId),
        lineItems: [
          {
            name: `Deposit — ${params.serviceName}`,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(params.amountInCents),
              currency: "USD",
            },
          },
        ],
        metadata: {
          bookingId: String(params.bookingId),
          paymentType: "deposit",
        },
      },
      // Suffix the caller's key with "-order" so the order and payment
      // get distinct idempotency keys from a single caller-provided value.
      idempotencyKey: `${params.idempotencyKey}-order`,
    });

    const orderId = orderResponse.order?.id;
    if (!orderId) throw new Error("Square order creation failed");

    // 2. Charge the card against the order
    const paymentResponse = await squareClient.payments.create({
      sourceId: params.sourceId,
      amountMoney: {
        amount: BigInt(params.amountInCents),
        currency: "USD",
      },
      orderId,
      locationId: SQUARE_LOCATION_ID,
      idempotencyKey: params.idempotencyKey,
      note: params.note ?? `Booking #${params.bookingId} (deposit)`,
      // autocomplete: true captures the payment immediately instead of
      // creating a hold that requires a separate capture step.
      autocomplete: true,
    });

    const payment = paymentResponse.payment;
    if (!payment?.id) throw new Error("Square payment creation failed");

    return {
      paymentId: payment.id,
      orderId,
      receiptUrl: payment.receiptUrl ?? null,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Checkout API — Product Order Payment Links                         */
/* ------------------------------------------------------------------ */

/**
 * Creates a Square payment link for a product order with multiple line items.
 * Unlike `createSquarePaymentLink` (which uses quickPay for single items),
 * this creates an order-based checkout link with inline line items.
 *
 * The `referenceId` is set to the local order ID for webhook matching.
 */
export async function createSquareOrderPaymentLink(params: {
  orderId: number;
  orderNumber: string;
  lineItems: Array<{ name: string; quantity: number; amountInCents: number }>;
}): Promise<{ url: string; orderId: string }> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  try {
    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.orderId),
        // Square expects per-unit price, but callers pass total per line item.
        // Divide by quantity to get the unit price Square expects.
        lineItems: params.lineItems.map((item) => ({
          name: item.name,
          quantity: String(item.quantity),
          basePriceMoney: {
            amount: BigInt(item.amountInCents / item.quantity),
            currency: "USD",
          },
        })),
        metadata: {
          orderNumber: params.orderNumber,
          source: "shop",
        },
      },
      paymentNote: `Order ${params.orderNumber}`,
    });

    const link = response.paymentLink;
    if (!link?.url || !link?.orderId) {
      throw new Error("Payment link creation failed — no URL returned");
    }

    return { url: link.url, orderId: link.orderId };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Customers API — Card on file                                       */
/* ------------------------------------------------------------------ */

/**
 * Retrieves the first stored card ID for a Square customer. Returns null
 * if no cards are on file or Square is not configured.
 *
 * Returns null (rather than throwing) on failure so callers can fall back
 * to invoice-based collection for no-show / cancellation fees.
 */
export async function getSquareCardOnFile(squareCustomerId: string): Promise<string | null> {
  if (!isSquareConfigured()) return null;

  try {
    const response = await squareClient.cards.list({ customerId: squareCustomerId });
    const cards = response.data ?? [];
    // Only return cards that are still active — Square keeps disabled/expired
    // cards in the list.
    const enabledCard = cards.find((c) => c.enabled);
    return enabledCard?.id ?? null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Charges a client's card on file for a no-show or late cancellation fee.
 *
 * Creates an order labelled as a fee, then charges the stored card against
 * it. Returns payment details on success, or null if the charge fails
 * (caller should fall back to creating an invoice).
 */
/* ------------------------------------------------------------------ */
/*  Catalog API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Upserts a single item in the Square Catalog via batchUpsert.
 *
 * - If `existingSquareCatalogId` is provided the call updates the existing
 *   item's name, description, and price in place (fetches current version
 *   first — Square requires the version field for updates).
 * - If it is null/undefined a new ITEM + ITEM_VARIATION is created using
 *   temp IDs (prefixed with `#`) that Square resolves to real IDs.
 *
 * The idempotency key is deterministic: `catalog-{type}-{localId}` so
 * re-calling with the same arguments on retry is safe — Square deduplicates
 * within 24 hours using the same key.
 *
 * Returns the Square Catalog Object ID to be stored in the local DB so
 * future calls can update instead of create.
 */
export async function upsertCatalogItem(params: {
  /** "service" or "product" — used to namespace the idempotency key. */
  type: "service" | "product";
  /** Local DB primary key — used to namespace the idempotency key. */
  localId: number;
  name: string;
  description?: string | null;
  /** Price in cents. Pass 0 for free/contact-for-quote items. */
  priceInCents: number;
  /** If the item already exists in Square, pass its catalog object ID to update it. */
  existingSquareCatalogId?: string | null;
}): Promise<string> {
  if (!isSquareConfigured()) throw new Error("Square not configured");

  // Deterministic idempotency key so retries don't create duplicates.
  const idempotencyKey = `catalog-${params.type}-${params.localId}`;

  try {
    let itemId = `#${idempotencyKey}`;
    let variationId = `#${idempotencyKey}-var`;
    let itemVersion: bigint | undefined;
    let variationVersion: bigint | undefined;

    if (params.existingSquareCatalogId) {
      // Fetch current version — Square requires it for updates.
      const existing = await squareClient.catalog.object.get({
        objectId: params.existingSquareCatalogId,
      });
      const obj = existing.object;
      // CatalogObject is a discriminated union; narrow to Item.
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

    const response = await squareClient.catalog.batchUpsert({
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
    });

    // Square resolves temp IDs in idMappings — use that to get the real ID.
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
 * products, compares them against the live Square Catalog, and pushes any
 * that are missing or whose name or price has drifted.
 *
 * Called by the daily `catalog-sync` cron. Returns a summary of how many
 * items were created, updated, and skipped (already in sync).
 *
 * Skips items where `priceInCents` is null (contact-for-quote) because
 * Square requires a price for FIXED_PRICING variations.
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

  // Fetch ALL ITEM objects from the Square catalog for drift detection.
  // Map Square catalog ID → { name, priceInCents } for O(1) comparison.
  // catalog.list() returns an async-iterable Page — iterate with for-await.
  const squareItems = new Map<string, { name: string; priceInCents: number }>();
  try {
    for await (const obj of await squareClient.catalog.list({ types: "ITEM" })) {
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

  // Process services
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
        // Write Square catalog ID back to DB (inline import avoids circular dep
        // since lib/square.ts must not depend on @/db at module load time).
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

  // Process products
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

/* ------------------------------------------------------------------ */
/*  Customers API                                                      */
/* ------------------------------------------------------------------ */

/**
 * Creates a Square customer for a client profile. Returns the Square
 * customer ID on success, or null if Square is not configured or the
 * call fails. The idempotency key is deterministic (`customer-{profileId}`)
 * so retries are safe.
 */
export async function createSquareCustomer(params: {
  profileId: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
}): Promise<string | null> {
  if (!isSquareConfigured()) return null;

  try {
    const response = await squareClient.customers.create({
      idempotencyKey: `customer-${params.profileId}`,
      givenName: params.firstName,
      familyName: params.lastName || undefined,
      emailAddress: params.email,
      phoneNumber: params.phone || undefined,
      referenceId: params.profileId,
    });

    return response.customer?.id ?? null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Links a Square customer ID to a local profile. Creates the Square
 * customer if one doesn't already exist, then stores the ID on the
 * profiles table. Non-fatal — returns the customer ID or null.
 */
export async function linkSquareCustomer(params: {
  profileId: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
}): Promise<string | null> {
  if (!isSquareConfigured()) return null;

  try {
    // Check if the profile already has a Square customer ID
    const { db } = await import("@/db");
    const { profiles } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const [profile] = await db
      .select({ squareCustomerId: profiles.squareCustomerId })
      .from(profiles)
      .where(eq(profiles.id, params.profileId))
      .limit(1);

    if (profile?.squareCustomerId) return profile.squareCustomerId;

    // Search Square for an existing customer by email before creating
    let squareCustomerId: string | null = null;

    try {
      const searchResponse = await squareClient.customers.search({
        query: {
          filter: {
            emailAddress: { exact: params.email },
          },
        },
      });
      squareCustomerId = searchResponse.customers?.[0]?.id ?? null;
    } catch {
      // Search failed — will create a new customer below
    }

    if (!squareCustomerId) {
      squareCustomerId = await createSquareCustomer(params);
    }

    if (squareCustomerId) {
      await db
        .update(profiles)
        .set({ squareCustomerId })
        .where(eq(profiles.id, params.profileId));
    }

    return squareCustomerId;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Subscriptions API                                                  */
/* ------------------------------------------------------------------ */

/**
 * Maps a cycleIntervalDays value to a Square subscription cadence.
 * Square supports: DAILY, WEEKLY, EVERY_TWO_WEEKS, THIRTY_DAYS,
 * SIXTY_DAYS, NINETY_DAYS, MONTHLY, EVERY_TWO_MONTHS, QUARTERLY,
 * EVERY_FOUR_MONTHS, EVERY_SIX_MONTHS, ANNUAL, EVERY_TWO_YEARS.
 */
function mapCadence(
  days: number,
): "DAILY" | "WEEKLY" | "EVERY_TWO_WEEKS" | "THIRTY_DAYS" | "SIXTY_DAYS" | "NINETY_DAYS" | "MONTHLY" | "QUARTERLY" | "ANNUAL" {
  if (days <= 1) return "DAILY";
  if (days <= 7) return "WEEKLY";
  if (days <= 14) return "EVERY_TWO_WEEKS";
  if (days <= 31) return "MONTHLY";
  if (days <= 60) return "SIXTY_DAYS";
  if (days <= 90) return "QUARTERLY";
  return "ANNUAL";
}

/**
 * Creates a Square Catalog SUBSCRIPTION_PLAN for a membership plan.
 * Returns the subscription plan variation ID (used when creating
 * individual subscriptions), or null on failure.
 *
 * Idempotency key: `sub-plan-{localPlanId}` — safe to retry.
 */
export async function createSquareSubscriptionPlan(params: {
  localPlanId: number;
  name: string;
  priceInCents: number;
  cycleIntervalDays: number;
}): Promise<{ planVariationId: string; catalogObjectId: string } | null> {
  if (!isSquareConfigured()) return null;

  try {
    const cadence = mapCadence(params.cycleIntervalDays);

    const response = await squareClient.catalog.batchUpsert({
      idempotencyKey: `sub-plan-${params.localPlanId}`,
      batches: [
        {
          objects: [
            {
              type: "SUBSCRIPTION_PLAN",
              id: `#sub-plan-${params.localPlanId}`,
              subscriptionPlanData: {
                name: params.name,
                phases: [
                  {
                    cadence,
                    recurringPriceMoney: {
                      amount: BigInt(params.priceInCents),
                      currency: "USD",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    // The response maps temp IDs (#sub-plan-X) to real IDs.
    const mapping = response.idMappings?.[0];
    const catalogObjectId = mapping?.objectId ?? null;

    // The plan variation ID is on the created object's phases.
    // We need to retrieve the object to get the variation ID.
    if (catalogObjectId) {
      const objectResp = await squareClient.catalog.getObject({
        objectId: catalogObjectId,
        includeRelatedObjects: true,
      });

      const planObj = objectResp.object;
      const variationId =
        planObj?.subscriptionPlanData?.phases?.[0]?.uid ?? catalogObjectId;

      return { planVariationId: variationId, catalogObjectId };
    }

    return null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Creates a Square Subscription for a client. Requires the client to
 * have a squareCustomerId and a card on file. Returns the Square
 * subscription ID, or null on failure.
 */
export async function createSquareSubscription(params: {
  squareCustomerId: string;
  planVariationId: string;
  cardId: string;
  localSubscriptionId: string;
  startDate?: string;
}): Promise<string | null> {
  if (!isSquareConfigured()) return null;

  try {
    const response = await squareClient.subscriptions.create({
      idempotencyKey: `sub-${params.localSubscriptionId}`,
      locationId: SQUARE_LOCATION_ID,
      customerId: params.squareCustomerId,
      planVariationId: params.planVariationId,
      cardId: params.cardId,
      startDate: params.startDate,
    });

    return response.subscription?.id ?? null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Cancels a Square Subscription. The subscription stops billing at the
 * end of the current period.
 */
export async function cancelSquareSubscription(
  subscriptionId: string,
): Promise<boolean> {
  if (!isSquareConfigured()) return false;

  try {
    await squareClient.subscriptions.cancel({ subscriptionId });
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/**
 * Pauses a Square Subscription. Billing stops until resumed.
 */
export async function pauseSquareSubscription(
  subscriptionId: string,
): Promise<boolean> {
  if (!isSquareConfigured()) return false;

  try {
    await squareClient.subscriptions.pause({
      subscriptionId,
      pauseReason: "Paused by admin",
    });
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/**
 * Resumes a paused Square Subscription.
 */
export async function resumeSquareSubscription(
  subscriptionId: string,
): Promise<boolean> {
  if (!isSquareConfigured()) return false;

  try {
    await squareClient.subscriptions.resume({
      subscriptionId,
    });
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/**
 * Retrieves the current status of a Square Subscription.
 */
export async function getSquareSubscriptionStatus(
  subscriptionId: string,
): Promise<{ status: string; paidThroughDate?: string; chargedThroughDate?: string } | null> {
  if (!isSquareConfigured()) return null;

  try {
    const response = await squareClient.subscriptions.retrieve({ subscriptionId });
    const sub = response.subscription;
    if (!sub) return null;

    return {
      status: sub.status ?? "UNKNOWN",
      paidThroughDate: sub.paidUntilDate ?? undefined,
      chargedThroughDate: sub.chargedThroughDate ?? undefined,
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Card-on-File API                                                   */
/* ------------------------------------------------------------------ */

export async function chargeCardOnFile(params: {
  bookingId: number;
  squareCustomerId: string;
  cardId: string;
  amountInCents: number;
  feeType: "no_show" | "late_cancellation";
  serviceName: string;
}): Promise<{ paymentId: string; orderId: string; receiptUrl: string | null } | null> {
  if (!isSquareConfigured()) return null;

  const label =
    params.feeType === "no_show"
      ? `No-Show Fee — ${params.serviceName}`
      : `Late Cancellation Fee — ${params.serviceName}`;

  const idempotencyKey = crypto.randomUUID();

  try {
    // 1. Create an order for the fee
    const orderResponse = await squareClient.orders.create({
      order: {
        locationId: SQUARE_LOCATION_ID,
        referenceId: String(params.bookingId),
        lineItems: [
          {
            name: label,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(params.amountInCents),
              currency: "USD",
            },
          },
        ],
        metadata: {
          bookingId: String(params.bookingId),
          paymentType: params.feeType,
        },
      },
      idempotencyKey: `${idempotencyKey}-order`,
    });

    const orderId = orderResponse.order?.id;
    if (!orderId) throw new Error("Square order creation failed for fee");

    // 2. Charge the stored card
    const paymentResponse = await squareClient.payments.create({
      sourceId: params.cardId,
      amountMoney: {
        amount: BigInt(params.amountInCents),
        currency: "USD",
      },
      customerId: params.squareCustomerId,
      orderId,
      locationId: SQUARE_LOCATION_ID,
      idempotencyKey,
      note: `Booking #${params.bookingId} (${params.feeType.replace("_", " ")})`,
      autocomplete: true,
    });

    const payment = paymentResponse.payment;
    if (!payment?.id) throw new Error("Square fee payment creation failed");

    return {
      paymentId: payment.id,
      orderId,
      receiptUrl: payment.receiptUrl ?? null,
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}
