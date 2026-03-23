/**
 * Square gift card activity webhook handler.
 *
 * Syncs balance changes from Square POS terminal transactions
 * (swipe/scan redemptions) back to the local gift_cards table.
 *
 * @module api/webhooks/square/handlers/gift-card
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { giftCards, giftCardTransactions } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { trackEvent } from "@/lib/posthog";
import { getSquareGiftCardBalance } from "@/lib/square";

/**
 * Handles gift_card.activity.created events from Square.
 *
 * When a gift card is redeemed at the POS terminal, Square fires this event.
 * We sync the balance back to the local DB so the dashboard shows the
 * correct remaining balance.
 *
 * Activity types we care about:
 *   REDEEM     — balance deducted at terminal
 *   REFUND     — balance credited back
 *   ADJUST     — manual balance adjustment by admin in Square Dashboard
 *   ACTIVATE   — initial funding (may already be tracked from our create flow)
 */
export async function handleGiftCardActivity(
  data: Record<string, unknown> | undefined,
): Promise<string> {
  const activityObj = (data as Record<string, unknown>)?.object as
    | Record<string, unknown>
    | undefined;
  const activity = (activityObj as Record<string, unknown>)?.gift_card_activity as
    | Record<string, unknown>
    | undefined;

  if (!activity) return "No gift_card_activity in event";

  const squareGiftCardId = activity.gift_card_id as string | undefined;
  const activityType = activity.type as string | undefined;

  if (!squareGiftCardId) return "No gift_card_id in activity";

  // Find the local gift card by Square ID
  const [localCard] = await db
    .select({
      id: giftCards.id,
      balanceInCents: giftCards.balanceInCents,
      status: giftCards.status,
    })
    .from(giftCards)
    .where(eq(giftCards.squareGiftCardId, squareGiftCardId))
    .limit(1);

  if (!localCard) {
    return `No local gift card found for Square gift card ${squareGiftCardId}`;
  }

  // Fetch the authoritative balance from Square
  const squareBalance = await getSquareGiftCardBalance(squareGiftCardId);
  if (!squareBalance) {
    return `Could not fetch balance for Square gift card ${squareGiftCardId}`;
  }

  const newBalance = squareBalance.balanceInCents;
  const balanceDelta = localCard.balanceInCents - newBalance;

  // Update local balance to match Square's authoritative balance
  await db
    .update(giftCards)
    .set({
      balanceInCents: newBalance,
      status: newBalance === 0 ? "redeemed" : "active",
    })
    .where(eq(giftCards.id, localCard.id));

  // Record the transaction in the ledger if balance changed
  if (balanceDelta !== 0) {
    const txType = balanceDelta > 0 ? "redemption" : "refund";

    await db.insert(giftCardTransactions).values({
      giftCardId: localCard.id,
      type: txType,
      amountInCents: -balanceDelta,
      balanceAfterInCents: newBalance,
      notes: `Synced from Square POS (${activityType ?? "unknown"})`,
    });

    if (txType === "redemption") {
      trackEvent(`gift_card:${localCard.id}`, "gift_card_redeemed", {
        amountInCents: balanceDelta,
        remainingBalance: newBalance,
      });
    }
  }

  await logAction({
    actorId: "system",
    action: "update",
    entityType: "gift_card",
    entityId: String(localCard.id),
    description: `Gift card balance synced from Square: $${(newBalance / 100).toFixed(2)} (${activityType})`,
    metadata: {
      squareGiftCardId,
      activityType,
      previousBalance: localCard.balanceInCents,
      newBalance,
    },
  });

  return `Gift card ${localCard.id} balance synced: $${(newBalance / 100).toFixed(2)} (${activityType})`;
}
