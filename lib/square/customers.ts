/**
 * Square Customers API — create, search, link, and card-on-file retrieval.
 * @module lib/square/customers
 */
import * as Sentry from "@sentry/nextjs";
import { squareClient, isSquareConfigured } from "./client";

/**
 * Retrieves the first stored card ID for a Square customer. Returns null
 * if no cards are on file or Square is not configured.
 */
export async function getSquareCardOnFile(squareCustomerId: string): Promise<string | null> {
  if (!isSquareConfigured()) return null;

  try {
    const response = await squareClient.cards.list({ customerId: squareCustomerId });
    const cards = response.data ?? [];
    const enabledCard = cards.find((c) => c.enabled);
    return enabledCard?.id ?? null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Creates a Square customer for a client profile. Returns the Square
 * customer ID on success, or null on failure. Idempotency key:
 * `customer-{profileId}` — safe to retry.
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
    const { db } = await import("@/db");
    const { profiles } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const [profile] = await db
      .select({ squareCustomerId: profiles.squareCustomerId })
      .from(profiles)
      .where(eq(profiles.id, params.profileId))
      .limit(1);

    if (profile?.squareCustomerId) return profile.squareCustomerId;

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
