/**
 * Square Subscriptions API — automated membership billing.
 * @module lib/square/subscriptions
 */
import * as Sentry from "@sentry/nextjs";
import { squareClient, SQUARE_LOCATION_ID, isSquareConfigured } from "./client";
import { withRetry } from "@/lib/retry";

/** Maps cycleIntervalDays to a Square subscription cadence. */
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
 * Returns the plan variation ID, or null on failure.
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

    const response = await withRetry(
      () => squareClient.catalog.batchUpsert({
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
      }),
      { label: "square.catalog.batchUpsert(subscription-plan)" },
    );

    const mapping = response.idMappings?.[0];
    const catalogObjectId = mapping?.objectId ?? null;

    if (catalogObjectId) {
      return { planVariationId: catalogObjectId, catalogObjectId };
    }

    return null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Creates a Square Subscription for a client. Requires squareCustomerId
 * and a card on file.
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
    const response = await withRetry(
      () => squareClient.subscriptions.create({
        idempotencyKey: `sub-${params.localSubscriptionId}`,
        locationId: SQUARE_LOCATION_ID,
        customerId: params.squareCustomerId,
        planVariationId: params.planVariationId,
        cardId: params.cardId,
        startDate: params.startDate,
      }),
      { label: "square.subscriptions.create" },
    );

    return response.subscription?.id ?? null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/** Cancels a Square Subscription at end of current period. */
export async function cancelSquareSubscription(subscriptionId: string): Promise<boolean> {
  if (!isSquareConfigured()) return false;

  try {
    await withRetry(
      () => squareClient.subscriptions.cancel({ subscriptionId }),
      { label: "square.subscriptions.cancel" },
    );
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/** Pauses a Square Subscription. Billing stops until resumed. */
export async function pauseSquareSubscription(subscriptionId: string): Promise<boolean> {
  if (!isSquareConfigured()) return false;

  try {
    await withRetry(
      () => squareClient.subscriptions.pause({
        subscriptionId,
        pauseReason: "Paused by admin",
      }),
      { label: "square.subscriptions.pause" },
    );
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/** Resumes a paused Square Subscription. */
export async function resumeSquareSubscription(subscriptionId: string): Promise<boolean> {
  if (!isSquareConfigured()) return false;

  try {
    await withRetry(
      () => squareClient.subscriptions.resume({ subscriptionId }),
      { label: "square.subscriptions.resume" },
    );
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/** Retrieves the current status of a Square Subscription. */
export async function getSquareSubscriptionStatus(
  subscriptionId: string,
): Promise<{ status: string; chargedThroughDate?: string } | null> {
  if (!isSquareConfigured()) return null;

  try {
    const response = await withRetry(
      () => squareClient.subscriptions.get({ subscriptionId }),
      { label: "square.subscriptions.get" },
    );
    const sub = response.subscription;
    if (!sub) return null;

    return {
      status: sub.status ?? "UNKNOWN",
      chargedThroughDate: sub.chargedThroughDate ?? undefined,
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}
