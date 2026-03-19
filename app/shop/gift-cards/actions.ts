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
import { db } from "@/db";
import { giftCards, giftCardTransactions, profiles, syncLog } from "@/db/schema";
import { GiftCardDelivery } from "@/emails/GiftCardDelivery";
import { GiftCardPurchase } from "@/emails/GiftCardPurchase";
import { sendEmail } from "@/lib/resend";
import { getPublicBusinessProfile, getPublicInventoryConfig } from "@/app/dashboard/settings/settings-actions";
import { isSquareConfigured, squareClient, SQUARE_LOCATION_ID } from "@/lib/square";
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

export type PurchaseGiftCardInput = {
  amountInCents: number;
  recipientName?: string;
};

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

  if (input.amountInCents < 2500 || input.amountInCents > 50000) {
    return { success: false, error: "Amount must be between $25 and $500" };
  }

  // Read the configured gift card code prefix
  const inventoryConfig = await getPublicInventoryConfig();
  const prefix = inventoryConfig.giftCardCodePrefix;

  // Auto-generate next gift card code with retry on unique-constraint collision.
  // Two concurrent purchases can read the same lastCard and produce the same
  // code. The unique index on gift_cards.code prevents silent duplicates — we
  // catch the violation and retry with a fresh sequence read.
  const MAX_RETRIES = 5;
  let code = "";
  let newCard!: { id: number };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const [lastCard] = await db
      .select({ code: giftCards.code })
      .from(giftCards)
      .orderBy(desc(giftCards.id))
      .limit(1);

    const nextNum = lastCard
      ? String(parseInt(lastCard.code.replace(`${prefix}-`, ""), 10) + 1).padStart(3, "0")
      : "001";

    code = `${prefix}-${nextNum}`;

    try {
      const [inserted] = await db
        .insert(giftCards)
        .values({
          code,
          purchasedByClientId: user.id,
          recipientName: input.recipientName ?? null,
          originalAmountInCents: input.amountInCents,
          balanceInCents: input.amountInCents,
        })
        .returning({ id: giftCards.id });
      newCard = inserted;
      break;
    } catch (err: unknown) {
      const isDuplicate =
        err instanceof Error &&
        (err.message.includes("unique") ||
          err.message.includes("duplicate") ||
          err.message.includes("gift_cards_code_idx"));
      if (!isDuplicate || attempt === MAX_RETRIES - 1) throw err;
    }
  }

  // Record purchase transaction in the ledger
  await db.insert(giftCardTransactions).values({
    giftCardId: newCard.id,
    type: "purchase",
    amountInCents: input.amountInCents,
    balanceAfterInCents: input.amountInCents,
    performedBy: user.id,
  });

  // Create Square payment link (non-fatal if Square not configured)
  let paymentUrl: string | undefined;
  if (isSquareConfigured()) {
    try {
      const itemName = input.recipientName ? `Gift Card for ${input.recipientName}` : "Gift Card";

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
                amount: BigInt(input.amountInCents),
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

        await db.insert(syncLog).values({
          provider: "square",
          direction: "outbound",
          status: "success",
          entityType: "payment_link",
          localId: String(newCard.id),
          remoteId: link.orderId ?? null,
          message: `Created gift card payment link for ${code}`,
          payload: { url: paymentUrl, giftCardCode: code, amountInCents: input.amountInCents },
        });
      }
    } catch {
      // Non-fatal — gift card is created regardless; admin can follow up
    }
  }

  // Send emails (non-fatal)
  try {
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
          amountInCents: input.amountInCents,
          recipientName: input.recipientName ?? undefined,
          businessName: bp.businessName,
        }),
        entityType: "gift_card_purchase",
        localId: String(newCard.id),
      });

      if (input.recipientName) {
        await sendEmail({
          to: buyer.email,
          subject: `Gift card for ${input.recipientName} — ${bp.businessName}`,
          react: GiftCardDelivery({
            recipientName: input.recipientName,
            senderName: buyer.firstName,
            giftCardCode: code,
            amountInCents: input.amountInCents,
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

  return { success: true, giftCardCode: code, paymentUrl };
}
