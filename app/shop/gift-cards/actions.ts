/**
 * Gift card purchase — client-facing server actions.
 *
 * Clients can purchase a gift card for themselves or for a recipient.
 * The card is created immediately in the DB (status: active) and a
 * Square payment link is generated for online payment.
 *
 * @module shop/gift-cards/actions
 */
"use server";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  getPublicBusinessProfile,
  getPublicInventoryConfig,
} from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { giftCards, giftCardTransactions, profiles, syncLog } from "@/db/schema";
import { GiftCardDelivery } from "@/emails/GiftCardDelivery";
import { GiftCardPurchase } from "@/emails/GiftCardPurchase";
import { getUser } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import {
  isSquareConfigured,
  squareClient,
  SQUARE_LOCATION_ID,
  createSquareGiftCard,
  linkGiftCardToCustomer,
} from "@/lib/square";

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

const purchaseGiftCardSchema = z.object({
  amountInCents: z.number().int().min(2500).max(50000),
  recipientName: z.string().min(1).optional(),
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PurchaseGiftCardInput = z.infer<typeof purchaseGiftCardSchema>;

export type PurchaseGiftCardResult = {
  success: boolean;
  giftCardCode?: string;
  paymentUrl?: string;
  error?: string;
};

/* ------------------------------------------------------------------ */
/*  Action                                                             */
/* ------------------------------------------------------------------ */

/**
 * Purchases a gift card for the logged-in client.
 *
 * Flow:
 * 1. Validate amount ($25–$500)
 * 2. Auto-generate next sequential code (TC-GC-XXX)
 * 3. Insert gift card + purchase transaction
 * 4. Create Square payment link
 * 5. Email purchase confirmation (and delivery email if recipient named)
 * 6. Return code + payment URL
 */
export async function purchaseGiftCard(
  input: PurchaseGiftCardInput,
): Promise<PurchaseGiftCardResult> {
  const user = await getUser();
  const validated = purchaseGiftCardSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: "Amount must be between $25 and $500" };
  }
  const { amountInCents, recipientName } = validated.data;

  // Primary: create gift card via Square (handles code generation + balance).
  // Fallback: custom sequential code if Square is not configured.
  let code: string;
  let squareGiftCardId: string | null = null;
  if (isSquareConfigured()) {
    const squareCard = await createSquareGiftCard({
      amountInCents,
      referenceId: `client-gc-${user.id}-${Date.now()}`,
    });

    if (squareCard) {
      code = squareCard.gan;
      squareGiftCardId = squareCard.squareGiftCardId;

      // Link to client's Square customer for POS visibility
      const [clientProfile] = await db
        .select({ squareCustomerId: profiles.squareCustomerId })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);

      if (clientProfile?.squareCustomerId) {
        linkGiftCardToCustomer(squareCard.squareGiftCardId, clientProfile.squareCustomerId).catch(
          () => {},
        );
      }
    } else {
      // Square failed — fall back to custom code
      const inventoryConfig = await getPublicInventoryConfig();
      const prefix = inventoryConfig.giftCardCodePrefix;
      const [lastCard] = await db
        .select({ code: giftCards.code })
        .from(giftCards)
        .orderBy(desc(giftCards.id))
        .limit(1);
      const nextNum = lastCard
        ? String(parseInt(lastCard.code.replace(`${prefix}-`, ""), 10) + 1).padStart(3, "0")
        : "001";
      code = `${prefix}-${nextNum}`;
    }
  } else {
    const inventoryConfig = await getPublicInventoryConfig();
    const prefix = inventoryConfig.giftCardCodePrefix;
    const [lastCard] = await db
      .select({ code: giftCards.code })
      .from(giftCards)
      .orderBy(desc(giftCards.id))
      .limit(1);
    const nextNum = lastCard
      ? String(parseInt(lastCard.code.replace(`${prefix}-`, ""), 10) + 1).padStart(3, "0")
      : "001";
    code = `${prefix}-${nextNum}`;
  }

  // Transaction: create local gift card + purchase transaction atomically.
  const [inserted] = await db.transaction(async (tx) => {
    const [card] = await tx
      .insert(giftCards)
      .values({
        code,
        squareGiftCardId,
        purchasedByClientId: user.id,
        recipientName: recipientName ?? null,
        originalAmountInCents: amountInCents,
        balanceInCents: amountInCents,
      })
      .returning({ id: giftCards.id });

    await tx.insert(giftCardTransactions).values({
      giftCardId: card.id,
      type: "purchase",
      amountInCents,
      balanceAfterInCents: amountInCents,
      performedBy: user.id,
    });

    return [card];
  });
  const newCard = inserted;

  // Create Square payment link (non-fatal if Square not configured)
  let paymentUrl: string | undefined;
  if (isSquareConfigured()) {
    try {
      const itemName = recipientName ? `Gift Card for ${recipientName}` : "Gift Card";

      const response = await squareClient.checkout.paymentLinks.create({
        idempotencyKey: crypto.randomUUID(),
        order: {
          locationId: SQUARE_LOCATION_ID,
          referenceId: String(newCard.id),
          lineItems: [
            {
              name: itemName,
              quantity: "1",
              basePriceMoney: {
                amount: BigInt(amountInCents),
                currency: "USD",
              },
            },
          ],
          metadata: {
            giftCardId: String(newCard.id),
            giftCardCode: code,
            source: "gift_card_purchase",
          },
        },
        paymentNote: `Gift Card ${code}`,
      });

      const link = response.paymentLink;
      if (link?.url) {
        paymentUrl = link.url;

        // MUTATION: Log the successful Square API call in the sync_log table.
        // Side-effects: Creates an audit row so admins can trace every outbound
        // integration call, including the payment URL and amount.
        await db.insert(syncLog).values({
          provider: "square",
          direction: "outbound",
          status: "success",
          entityType: "payment_link",
          localId: String(newCard.id),
          remoteId: link.orderId ?? null,
          message: `Created gift card payment link for ${code}`,
          payload: { url: paymentUrl, giftCardCode: code, amountInCents: amountInCents },
        });
      }
    } catch {
      // Non-fatal — gift card is created regardless; admin can follow up
    }
  }

  // Send emails (non-fatal)
  try {
    // QUERY: Fetch the buyer's email and first name for the confirmation email.
    // SELECT — Only email and firstName (the minimum needed for the email template).
    // FROM   — profiles table (one row per user, stores contact details).
    // WHERE  — Matches the authenticated user who is purchasing the gift card.
    const [buyer] = await db
      .select({ email: profiles.email, firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, user.id));

    if (buyer?.email) {
      const bp = await getPublicBusinessProfile();
      await sendEmail({
        to: buyer.email,
        subject: `Your gift card ${code} — ${bp.businessName}`,
        react: GiftCardPurchase({
          clientName: buyer.firstName,
          giftCardCode: code,
          amountInCents: amountInCents,
          recipientName: recipientName ?? undefined,
          businessName: bp.businessName,
        }),
        entityType: "gift_card_purchase",
        localId: String(newCard.id),
      });

      if (recipientName) {
        await sendEmail({
          to: buyer.email,
          subject: `Gift card for ${recipientName} — ${bp.businessName}`,
          react: GiftCardDelivery({
            recipientName: recipientName,
            senderName: buyer.firstName,
            giftCardCode: code,
            amountInCents: amountInCents,
            businessName: bp.businessName,
          }),
          entityType: "gift_card_delivery",
          localId: String(newCard.id),
        });
      }
    }
  } catch {
    // Non-fatal
  }

  trackEvent(user.id, "gift_card_purchased", {
    amountInCents,
    isGift: !!recipientName,
  });

  return { success: true, giftCardCode: code, paymentUrl };
}
