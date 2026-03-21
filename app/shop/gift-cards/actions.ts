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

import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { giftCards, giftCardTransactions, profiles, syncLog } from "@/db/schema";
import { GiftCardDelivery } from "@/emails/GiftCardDelivery";
import { GiftCardPurchase } from "@/emails/GiftCardPurchase";
import { getUser } from "@/lib/auth";
import { sendEmail } from "@/lib/resend";
import { getPublicBusinessProfile, getPublicInventoryConfig } from "@/app/dashboard/settings/settings-actions";
import { isSquareConfigured, squareClient, SQUARE_LOCATION_ID } from "@/lib/square";

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
    // QUERY: Find the most recently created gift card to determine the next code number.
    // SELECT   — Only the code column (e.g. "TC-GC-042").
    // FROM     — gift_cards table.
    // ORDER BY — Descending by id so the newest card (highest auto-increment) comes first.
    // LIMIT 1  — We only need the single latest card to extract its sequence number.
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
      // MUTATION: Insert a new gift card row with status "active" and full balance.
      // Side-effects: The card is immediately usable at checkout. If two concurrent
      // purchases generate the same code, the unique index on gift_cards.code will
      // throw a constraint violation — caught below to retry with a fresh sequence.
      // RETURNING — Gives us the auto-generated card ID for the transaction ledger
      // entry, Square payment link, and email sends that follow.
      const [inserted] = await db
        .insert(giftCards)
        .values({
          code,
          purchasedByClientId: user.id,
          recipientName: recipientName ?? null,
          originalAmountInCents: amountInCents,
          balanceInCents: amountInCents,
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
  // MUTATION: Insert a "purchase" row into gift_card_transactions.
  // Side-effects: Creates the first entry in this card's transaction history.
  // balanceAfterInCents equals the full amount because nothing has been spent yet.
  // performedBy records which user bought the card for audit purposes.
  await db.insert(giftCardTransactions).values({
    giftCardId: newCard.id,
    type: "purchase",
    amountInCents: amountInCents,
    balanceAfterInCents: amountInCents,
    performedBy: user.id,
  });

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

  return { success: true, giftCardCode: code, paymentUrl };
}
