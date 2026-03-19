/**
 * app/dashboard/financial/promo-gift-actions.ts — Gift card and promotion actions.
 *
 * CRUD and business logic for gift cards, promotions, redemption,
 * and promo code validation/application.
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import {
  giftCards,
  giftCardTransactions,
  promotions,
  bookings,
  services,
  profiles,
} from "@/db/schema";
import { getPublicBusinessProfile, getPublicInventoryConfig } from "@/app/dashboard/settings/settings-actions";
import { GiftCardDelivery } from "@/emails/GiftCardDelivery";
import { GiftCardPurchase } from "@/emails/GiftCardPurchase";
import { logAction } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getEmailRecipient, sendEmail } from "@/lib/resend";

const getUser = requireAdmin;

/* ------------------------------------------------------------------ */
/*  Zod schemas                                                        */
/* ------------------------------------------------------------------ */

const CreateGiftCardSchema = z.object({
  purchasedByClientId: z.string().optional(),
  recipientName: z.string().optional(),
  amountInCents: z.number().int().positive(),
  expiresAt: z.string().optional(),
  notes: z.string().optional(),
});

const CreatePromotionSchema = z.object({
  code: z.string().min(1),
  discountType: z.enum(["percent", "fixed", "bogo"]),
  discountValue: z.number().positive(),
  description: z.string().optional(),
  appliesTo: z.enum(["lash", "jewelry", "crochet", "consulting"]).optional(),
  maxUses: z.number().int().positive().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

const RedeemGiftCardSchema = z.object({
  bookingId: z.number().int().positive(),
  giftCardId: z.number().int().positive(),
  amountInCents: z.number().int().positive(),
});

const RecordRedemptionSchema = z.object({
  giftCardId: z.number().int().positive(),
  bookingId: z.number().int().positive(),
  amountInCents: z.number().int().positive(),
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GiftCardRow = {
  id: number;
  code: string;
  purchasedBy: string | null;
  recipientName: string | null;
  originalAmount: number;
  balance: number;
  status: string;
  purchasedAt: string;
  expiresAt: string | null;
};

export type PromotionRow = {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  description: string | null;
  appliesTo: string | null;
  maxUses: number | null;
  redemptionCount: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export type GiftCardTxRow = {
  id: number;
  type: "purchase" | "redemption" | "refund" | "adjustment";
  amount: number;
  balanceAfter: number;
  bookingService: string | null;
  performedByName: string | null;
  notes: string | null;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Gift Cards                                                         */
/* ------------------------------------------------------------------ */

const gcClient = alias(profiles, "gcClient");

export async function getGiftCards(): Promise<GiftCardRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: giftCards.id,
        code: giftCards.code,
        clientFirstName: gcClient.firstName,
        clientLastName: gcClient.lastName,
        recipientName: giftCards.recipientName,
        originalAmountInCents: giftCards.originalAmountInCents,
        balanceInCents: giftCards.balanceInCents,
        status: giftCards.status,
        purchasedAt: giftCards.purchasedAt,
        expiresAt: giftCards.expiresAt,
      })
      .from(giftCards)
      .leftJoin(gcClient, eq(giftCards.purchasedByClientId, gcClient.id))
      .orderBy(desc(giftCards.purchasedAt));

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      purchasedBy: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" ") || null,
      recipientName: r.recipientName,
      originalAmount: Math.round(r.originalAmountInCents / 100),
      balance: Math.round(r.balanceInCents / 100),
      status: r.status,
      purchasedAt: r.purchasedAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      expiresAt:
        r.expiresAt?.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) ?? null,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function createGiftCard(input: {
  purchasedByClientId?: string;
  recipientName?: string;
  amountInCents: number;
  expiresAt?: string;
  notes?: string;
}) {
  try {
    CreateGiftCardSchema.parse(input);

    const user = await getUser();

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

    const code = `${prefix}-${nextNum}`;

    const [newCard] = await db
      .insert(giftCards)
      .values({
        code,
        purchasedByClientId: input.purchasedByClientId ?? null,
        recipientName: input.recipientName ?? null,
        originalAmountInCents: input.amountInCents,
        balanceInCents: input.amountInCents,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        notes: input.notes ?? null,
      })
      .returning({ id: giftCards.id });

    await db.insert(giftCardTransactions).values({
      giftCardId: newCard.id,
      type: "purchase",
      amountInCents: input.amountInCents,
      balanceAfterInCents: input.amountInCents,
      performedBy: user.id,
      notes: input.notes ?? null,
    });

    await logAction({
      actorId: user.id,
      action: "create",
      entityType: "gift_card",
      entityId: String(newCard.id),
      description: `Gift card ${code} created`,
      metadata: { amountInCents: input.amountInCents, recipientName: input.recipientName ?? null },
    });

    if (input.purchasedByClientId) {
      const [buyer, bp] = await Promise.all([
        getEmailRecipient(input.purchasedByClientId),
        getPublicBusinessProfile(),
      ]);
      if (buyer) {
        const expiresFormatted = input.expiresAt
          ? new Date(input.expiresAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : undefined;

        await sendEmail({
          to: buyer.email,
          subject: `Gift card purchased — TC-GC-${nextNum} — ${bp.businessName}`,
          react: GiftCardPurchase({
            clientName: buyer.firstName,
            giftCardCode: code,
            amountInCents: input.amountInCents,
            recipientName: input.recipientName ?? undefined,
            expiresAt: expiresFormatted,
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
              expiresAt: expiresFormatted,
              businessName: bp.businessName,
            }),
            entityType: "gift_card_delivery",
            localId: String(newCard.id),
          });
        }
      }
    }

    revalidatePath("/dashboard/financial");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Promotions                                                         */
/* ------------------------------------------------------------------ */

export async function getPromotions(): Promise<PromotionRow[]> {
  try {
    await getUser();

    const rows = await db.select().from(promotions).orderBy(desc(promotions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      discountType: r.discountType,
      discountValue: r.discountValue,
      description: r.description,
      appliesTo: r.appliesTo,
      maxUses: r.maxUses,
      redemptionCount: r.redemptionCount,
      isActive: r.isActive,
      startsAt:
        r.startsAt?.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) ?? null,
      endsAt:
        r.endsAt?.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) ?? null,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function createPromotion(input: {
  code: string;
  discountType: "percent" | "fixed" | "bogo";
  discountValue: number;
  description?: string;
  appliesTo?: "lash" | "jewelry" | "crochet" | "consulting";
  maxUses?: number;
  startsAt?: string;
  endsAt?: string;
}) {
  try {
    CreatePromotionSchema.parse(input);

    await getUser();

    await db.insert(promotions).values({
      code: input.code.toUpperCase(),
      discountType: input.discountType,
      discountValue: input.discountValue,
      description: input.description ?? null,
      appliesTo: input.appliesTo ?? null,
      maxUses: input.maxUses ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    });

    revalidatePath("/dashboard/financial");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Gift Card Redemption                                               */
/* ------------------------------------------------------------------ */

export async function redeemGiftCard(input: {
  bookingId: number;
  giftCardId: number;
  amountInCents: number;
}) {
  try {
    RedeemGiftCardSchema.parse(input);

    await getUser();

    const [card] = await db.select().from(giftCards).where(eq(giftCards.id, input.giftCardId));
    if (!card) throw new Error("Gift card not found");
    if (card.status !== "active") throw new Error("Gift card is not active");
    if (card.balanceInCents < input.amountInCents)
      throw new Error("Insufficient gift card balance");

    const newBalance = card.balanceInCents - input.amountInCents;

    await db
      .update(giftCards)
      .set({
        balanceInCents: newBalance,
        status: newBalance === 0 ? "redeemed" : "active",
      })
      .where(eq(giftCards.id, input.giftCardId));

    await db
      .update(bookings)
      .set({
        giftCardId: input.giftCardId,
        discountInCents: input.amountInCents,
      })
      .where(eq(bookings.id, input.bookingId));

    revalidatePath("/dashboard/financial");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Gift Card Transaction History                                      */
/* ------------------------------------------------------------------ */

const txPerformer = alias(profiles, "txPerformer");

export async function getGiftCardHistory(cardId: number): Promise<GiftCardTxRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: giftCardTransactions.id,
        type: giftCardTransactions.type,
        amountInCents: giftCardTransactions.amountInCents,
        balanceAfterInCents: giftCardTransactions.balanceAfterInCents,
        bookingId: giftCardTransactions.bookingId,
        serviceName: services.name,
        performedByFirst: txPerformer.firstName,
        performedByLast: txPerformer.lastName,
        notes: giftCardTransactions.notes,
        createdAt: giftCardTransactions.createdAt,
      })
      .from(giftCardTransactions)
      .leftJoin(bookings, eq(giftCardTransactions.bookingId, bookings.id))
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(txPerformer, eq(giftCardTransactions.performedBy, txPerformer.id))
      .where(eq(giftCardTransactions.giftCardId, cardId))
      .orderBy(desc(giftCardTransactions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amountInCents / 100,
      balanceAfter: r.balanceAfterInCents / 100,
      bookingService: r.serviceName ?? null,
      performedByName: [r.performedByFirst, r.performedByLast].filter(Boolean).join(" ") || null,
      notes: r.notes,
      createdAt: r.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function recordRedemption(input: {
  giftCardId: number;
  bookingId: number;
  amountInCents: number;
}): Promise<void> {
  try {
    RecordRedemptionSchema.parse(input);

    const user = await getUser();

    const [card] = await db.select().from(giftCards).where(eq(giftCards.id, input.giftCardId));
    if (!card) throw new Error("Gift card not found");
    if (card.status !== "active") throw new Error("Gift card is not active");
    if (card.balanceInCents < input.amountInCents)
      throw new Error("Insufficient gift card balance");

    const newBalance = card.balanceInCents - input.amountInCents;

    await db
      .update(giftCards)
      .set({
        balanceInCents: newBalance,
        status: newBalance === 0 ? "redeemed" : "active",
      })
      .where(eq(giftCards.id, input.giftCardId));

    await db.insert(giftCardTransactions).values({
      giftCardId: input.giftCardId,
      type: "redemption",
      amountInCents: -input.amountInCents,
      balanceAfterInCents: newBalance,
      bookingId: input.bookingId,
      performedBy: user.id,
    });

    await db
      .update(bookings)
      .set({
        giftCardId: input.giftCardId,
        discountInCents: input.amountInCents,
      })
      .where(eq(bookings.id, input.bookingId));

    revalidatePath("/dashboard/financial");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Promo Code Validation & Application                                */
/* ------------------------------------------------------------------ */

export async function validatePromoCode(
  code: string,
  serviceCategory?: string,
): Promise<{ valid: boolean; message: string; discountType?: string; discountValue?: number }> {
  try {
    await getUser();

    const [promo] = await db
      .select()
      .from(promotions)
      .where(eq(promotions.code, code.toUpperCase()));
    if (!promo) return { valid: false, message: "Promo code not found" };
    if (!promo.isActive) return { valid: false, message: "Promo code is no longer active" };
    if (promo.endsAt && promo.endsAt < new Date())
      return { valid: false, message: "Promo code has expired" };
    if (promo.startsAt && promo.startsAt > new Date())
      return { valid: false, message: "Promo code is not yet active" };
    if (promo.maxUses && promo.redemptionCount >= promo.maxUses)
      return { valid: false, message: "Promo code has reached max uses" };
    if (promo.appliesTo && serviceCategory && promo.appliesTo !== serviceCategory) {
      return { valid: false, message: `This promo only applies to ${promo.appliesTo} services` };
    }

    return {
      valid: true,
      message: "Promo code is valid",
      discountType: promo.discountType,
      discountValue: promo.discountValue,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function applyPromoCode(bookingId: number, promoCode: string) {
  try {
    z.number().int().positive().parse(bookingId);
    z.string().min(1).parse(promoCode);

    await getUser();

    await db.transaction(async (tx) => {
      const [promo] = await tx
        .select()
        .from(promotions)
        .where(eq(promotions.code, promoCode.toUpperCase()));
      if (!promo) throw new Error("Promo code not found");

      if (promo.maxUses && promo.redemptionCount >= promo.maxUses) {
        throw new Error("Promo code has reached max uses");
      }

      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
      if (!booking) throw new Error("Booking not found");

      let discountCents = 0;
      if (promo.discountType === "percent") {
        discountCents = Math.round(booking.totalInCents * (promo.discountValue / 100));
      } else if (promo.discountType === "fixed") {
        discountCents = Math.min(promo.discountValue, booking.totalInCents);
      } else if (promo.discountType === "bogo") {
        discountCents = Math.round(booking.totalInCents / 2);
      }

      await tx
        .update(bookings)
        .set({
          promotionId: promo.id,
          discountInCents: discountCents,
        })
        .where(eq(bookings.id, bookingId));

      await tx
        .update(promotions)
        .set({
          redemptionCount: sql`${promotions.redemptionCount} + 1`,
        })
        .where(eq(promotions.id, promo.id));
    });

    revalidatePath("/dashboard/financial");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
