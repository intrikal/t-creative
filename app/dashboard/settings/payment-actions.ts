"use server";

/**
 * payment-actions -- Server actions for client payment method management.
 *
 * Fetches saved cards from Square and handles card deletion and creation.
 * Card tokenization happens client-side via Square Web Payments SDK;
 * this module only vaults and retrieves the resulting tokens.
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { withRetry } from "@/lib/retry";
import { isSquareConfigured, squareClient } from "@/lib/square";
import { createSquareCustomer } from "@/lib/square/customers";
import type { PaymentMethod } from "./client-types";

const PATH = "/dashboard/settings";

/* ------------------------------------------------------------------ */
/*  Query                                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch saved cards from Square for the current authenticated client.
 * Returns an empty array when Square is not configured or the client
 * has no linked Square customer.
 */
export async function getSavedCards(): Promise<PaymentMethod[]> {
  try {
    if (!isSquareConfigured()) return [];

    const user = await getUser();

    const [profile] = await db
      .select({ squareCustomerId: profiles.squareCustomerId })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile?.squareCustomerId) return [];

    const response = await withRetry(
      () => squareClient.cards.list({ customerId: profile.squareCustomerId! }),
      { label: "square.cards.list" },
    );

    const cards = response.data ?? [];

    return cards
      .filter((c) => c.enabled)
      .map((c, i) => ({
        id: c.id ?? "",
        brand: c.cardBrand ?? "Unknown",
        last4: c.last4 ?? "????",
        expMonth: Number(c.expMonth ?? 0),
        expYear: Number(c.expYear ?? 0),
        isDefault: i === 0,
      }));
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Delete                                                             */
/* ------------------------------------------------------------------ */

const deleteCardSchema = z.object({
  cardId: z.string().min(1, "Card ID is required"),
});

export type DeleteCardResult = { success: true } | { success: false; error: string };

/**
 * Disable (remove) a saved card from the client's Square account.
 * Square does not hard-delete cards -- `disable` marks them inactive.
 */
export async function deleteCard(cardId: string): Promise<DeleteCardResult> {
  try {
    deleteCardSchema.parse({ cardId });
    await getUser();

    await withRetry(() => squareClient.cards.disable({ cardId }), {
      label: "square.cards.disable",
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    Sentry.captureException(err);
    if (err instanceof Error) return { success: false, error: err.message };
    return { success: false, error: "Failed to remove card" };
  }
}

/* ------------------------------------------------------------------ */
/*  Create                                                             */
/* ------------------------------------------------------------------ */

const saveCardSchema = z.object({
  token: z.string().min(1, "Card token is required"),
});

export type SaveCardResult =
  | { success: true; card: PaymentMethod }
  | { success: false; error: string };

/**
 * Vault a new card using a client-side payment token from the Square
 * Web Payments SDK. Creates a Square customer if one doesn't exist yet.
 */
export async function saveCardToken(token: string): Promise<SaveCardResult> {
  try {
    saveCardSchema.parse({ token });
    const user = await getUser();

    const [profile] = await db
      .select({
        squareCustomerId: profiles.squareCustomerId,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        phone: profiles.phone,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return { success: false, error: "Profile not found" };
    }

    let customerId = profile.squareCustomerId;

    if (!customerId) {
      customerId = await createSquareCustomer({
        profileId: user.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
      });

      if (!customerId) {
        return { success: false, error: "Failed to create Square customer" };
      }

      await db
        .update(profiles)
        .set({ squareCustomerId: customerId })
        .where(eq(profiles.id, user.id));
    }

    const response = await withRetry(
      () =>
        squareClient.cards.create({
          idempotencyKey: randomUUID(),
          sourceId: token,
          card: { customerId },
        }),
      { label: "square.cards.create" },
    );

    const created = response.card;
    if (!created?.id) {
      return { success: false, error: "Card was not saved" };
    }

    revalidatePath(PATH);

    return {
      success: true,
      card: {
        id: created.id,
        brand: created.cardBrand ?? "Unknown",
        last4: created.last4 ?? "????",
        expMonth: Number(created.expMonth ?? 0),
        expYear: Number(created.expYear ?? 0),
        isDefault: false,
      },
    };
  } catch (err) {
    Sentry.captureException(err);
    if (err instanceof Error) return { success: false, error: err.message };
    return { success: false, error: "Failed to save card" };
  }
}
