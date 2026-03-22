/**
 * Square Gift Cards API — create, activate, redeem, and check balance.
 *
 * Replaces custom code generation and balance tracking. Square handles:
 * - GAN (gift card account number) generation
 * - Balance management
 * - POS integration (swipe/scan at terminal)
 *
 * @module lib/square/gift-cards
 */
import * as Sentry from "@sentry/nextjs";
import { squareClient, SQUARE_LOCATION_ID, isSquareConfigured } from "./client";

/**
 * Creates a Square gift card and activates it with the given amount.
 *
 * Two-step flow:
 *   1. `giftCards.create()` — creates a DIGITAL card in PENDING state
 *   2. `giftCards.activities.create(ACTIVATE)` — funds it
 *
 * Returns the Square gift card ID and GAN (the code clients use at POS).
 */
export async function createSquareGiftCard(params: {
  amountInCents: number;
  buyerPaymentId?: string;
  referenceId?: string;
}): Promise<{
  squareGiftCardId: string;
  gan: string;
  balanceInCents: number;
} | null> {
  if (!isSquareConfigured()) return null;

  try {
    // 1. Create the gift card
    const createResponse = await squareClient.giftCards.create({
      idempotencyKey: params.referenceId
        ? `gc-create-${params.referenceId}`
        : crypto.randomUUID(),
      locationId: SQUARE_LOCATION_ID,
      giftCard: {
        type: "DIGITAL",
      },
    });

    const giftCard = createResponse.giftCard;
    if (!giftCard?.id || !giftCard?.gan) {
      throw new Error("Square gift card creation failed — no ID or GAN returned");
    }

    // 2. Activate (fund) the gift card
    await squareClient.giftCards.activities.create({
      idempotencyKey: params.referenceId
        ? `gc-activate-${params.referenceId}`
        : crypto.randomUUID(),
      giftCardActivity: {
        giftCardId: giftCard.id,
        type: "ACTIVATE",
        locationId: SQUARE_LOCATION_ID,
        activateActivityDetails: {
          amountMoney: {
            amount: BigInt(params.amountInCents),
            currency: "USD",
          },
          buyerPaymentInstrumentIds: params.buyerPaymentId
            ? [params.buyerPaymentId]
            : undefined,
          referenceId: params.referenceId,
        },
      },
    });

    return {
      squareGiftCardId: giftCard.id,
      gan: giftCard.gan,
      balanceInCents: params.amountInCents,
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Retrieves the current balance of a Square gift card.
 */
export async function getSquareGiftCardBalance(
  squareGiftCardId: string,
): Promise<{ balanceInCents: number; state: string } | null> {
  if (!isSquareConfigured()) return null;

  try {
    const response = await squareClient.giftCards.get({
      id: squareGiftCardId,
    });

    const card = response.giftCard;
    if (!card) return null;

    return {
      balanceInCents: Number(card.balanceMoney?.amount ?? 0),
      state: card.state ?? "UNKNOWN",
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Redeems (deducts) an amount from a Square gift card.
 * Square handles balance validation — throws if insufficient.
 */
export async function redeemSquareGiftCard(params: {
  squareGiftCardId: string;
  amountInCents: number;
  referenceId?: string;
}): Promise<{ balanceAfterInCents: number } | null> {
  if (!isSquareConfigured()) return null;

  try {
    const response = await squareClient.giftCards.activities.create({
      idempotencyKey: params.referenceId
        ? `gc-redeem-${params.referenceId}`
        : crypto.randomUUID(),
      giftCardActivity: {
        giftCardId: params.squareGiftCardId,
        type: "REDEEM",
        locationId: SQUARE_LOCATION_ID,
        redeemActivityDetails: {
          amountMoney: {
            amount: BigInt(params.amountInCents),
            currency: "USD",
          },
          referenceId: params.referenceId,
        },
      },
    });

    const balanceAfter = response.giftCardActivity?.giftCardBalanceMoney?.amount;
    return {
      balanceAfterInCents: Number(balanceAfter ?? 0),
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Links a Square gift card to a Square customer so it appears
 * in their card-on-file list on the POS terminal.
 */
export async function linkGiftCardToCustomer(
  squareGiftCardId: string,
  squareCustomerId: string,
): Promise<boolean> {
  if (!isSquareConfigured()) return false;

  try {
    await squareClient.giftCards.linkCustomer({
      giftCardId: squareGiftCardId,
      customerId: squareCustomerId,
    });
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}
