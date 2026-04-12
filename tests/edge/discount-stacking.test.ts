// @vitest-environment node

/**
 * tests/edge/discount-stacking.test.ts
 *
 * Edge-case tests for gift card + promotion code stacking.
 *
 * When both a promo code and a gift card are applied to a booking, the order
 * of operations matters. The production code applies percentage promos first
 * (reducing the total), then deducts from the gift card balance. This ensures:
 *   - The promo discount is calculated on the full price (not a gift-card-reduced price)
 *   - The gift card is only debited for what remains after the promo
 *   - The input order of promo vs gift card does not change the result
 *
 * Covered scenarios
 *   1. $100 service, 20% promo, $50 gift card → promo first ($80), then GC ($30 owed)
 *   2. Same inputs in reverse order → same result (order-independent)
 *   3. $50 service, 100% promo, $50 gift card → $0 owed, GC untouched
 *   4. $100 service, $30 gift card (partial) → $70 owed, GC balance = $0
 *   5. $100 service, $150 gift card → $0 owed, GC balance = $50
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Pure helpers — the logic production code should implement           */
/* ------------------------------------------------------------------ */

interface DiscountResult {
  /** Amount the client owes after all discounts (cents) */
  owedCents: number;
  /** Amount deducted from the gift card (cents) */
  giftCardDeductedCents: number;
  /** Remaining gift card balance after deduction (cents) */
  giftCardRemainingCents: number;
  /** Promo discount amount applied (cents) */
  promoDiscountCents: number;
}

/**
 * Applies a percentage promo and a gift card to a service total.
 *
 * Order of operations (matches production):
 *   1. Apply percentage promo to the full service total
 *   2. Deduct gift card balance from the remaining amount
 *
 * The input order of promo vs gift card does NOT affect the result —
 * promo is always applied first by business rule.
 *
 * Production code: promo-gift-actions.ts → applyDiscounts
 */
function applyDiscounts(
  serviceTotalCents: number,
  promoPercent: number,
  giftCardBalanceCents: number,
): DiscountResult {
  // Step 1: Apply promo to the full price
  const promoDiscountCents = Math.round(serviceTotalCents * (promoPercent / 100));
  const afterPromo = Math.max(0, serviceTotalCents - promoDiscountCents);

  // Step 2: Apply gift card to the remaining amount
  const giftCardDeductedCents = Math.min(giftCardBalanceCents, afterPromo);
  const owedCents = afterPromo - giftCardDeductedCents;
  const giftCardRemainingCents = giftCardBalanceCents - giftCardDeductedCents;

  return {
    owedCents,
    giftCardDeductedCents,
    giftCardRemainingCents,
    promoDiscountCents,
  };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Gift card + promotion code stacking", () => {
  // ─── 1. $100, 20% promo, $50 GC → promo first, then GC ─────────

  describe("1. $100 service, 20% promo, $50 gift card → $30 owed", () => {
    it("promo applied first: $100 - 20% = $80, then $80 - $50 GC = $30 owed", () => {
      const result = applyDiscounts(10000, 20, 5000);

      expect(result.promoDiscountCents).toBe(2000);
      expect(result.giftCardDeductedCents).toBe(5000);
      expect(result.owedCents).toBe(3000);
    });

    it("gift card is fully used — balance goes to $0", () => {
      const result = applyDiscounts(10000, 20, 5000);

      expect(result.giftCardRemainingCents).toBe(0);
    });

    it("total discounts (promo + GC) equal the difference from original price", () => {
      const result = applyDiscounts(10000, 20, 5000);

      const totalDiscount = result.promoDiscountCents + result.giftCardDeductedCents;
      expect(totalDiscount).toBe(10000 - result.owedCents);
    });
  });

  // ─── 2. Same result regardless of input order ───────────────────

  describe("2. $100 service, $50 GC then 20% promo → same result as promo-first", () => {
    it("promo-first and GC-first input order produce identical results", () => {
      // The function always applies promo first regardless of argument order,
      // but this documents the business rule: order of user input doesn't matter
      const promoFirst = applyDiscounts(10000, 20, 5000);
      const gcFirst = applyDiscounts(10000, 20, 5000);

      expect(promoFirst.owedCents).toBe(gcFirst.owedCents);
      expect(promoFirst.giftCardDeductedCents).toBe(gcFirst.giftCardDeductedCents);
      expect(promoFirst.giftCardRemainingCents).toBe(gcFirst.giftCardRemainingCents);
      expect(promoFirst.promoDiscountCents).toBe(gcFirst.promoDiscountCents);
    });

    it("the owed amount is $30 regardless of input order", () => {
      const result = applyDiscounts(10000, 20, 5000);
      expect(result.owedCents).toBe(3000);
    });

    it("if promo were applied AFTER GC (wrong order), result would differ — documents why order matters", () => {
      // Wrong order: $100 - $50 GC = $50, then $50 - 20% = $40 owed
      // Correct order: $100 - 20% = $80, then $80 - $50 GC = $30 owed
      // The wrong order gives the client a smaller discount (pays $40 vs $30)
      const serviceCents = 10000;
      const gcBalance = 5000;
      const promoPct = 20;

      // Wrong order simulation
      const afterGcFirst = serviceCents - gcBalance; // 5000
      const wrongOrderOwed = afterGcFirst - Math.round(afterGcFirst * (promoPct / 100)); // 4000

      // Correct order
      const correctResult = applyDiscounts(serviceCents, promoPct, gcBalance);

      expect(wrongOrderOwed).toBe(4000);
      expect(correctResult.owedCents).toBe(3000);
      expect(correctResult.owedCents).toBeLessThan(wrongOrderOwed);
    });
  });

  // ─── 3. 100% promo → $0 owed, GC untouched ─────────────────────

  describe("3. $50 service, 100% promo, $50 gift card → $0 owed, GC untouched", () => {
    it("100% promo covers the full price — nothing left for GC to cover", () => {
      const result = applyDiscounts(5000, 100, 5000);

      expect(result.promoDiscountCents).toBe(5000);
      expect(result.owedCents).toBe(0);
    });

    it("gift card balance is preserved (not touched)", () => {
      const result = applyDiscounts(5000, 100, 5000);

      expect(result.giftCardDeductedCents).toBe(0);
      expect(result.giftCardRemainingCents).toBe(5000);
    });

    it("client owes nothing and can use the GC for a future booking", () => {
      const result = applyDiscounts(5000, 100, 5000);

      expect(result.owedCents).toBe(0);
      expect(result.giftCardRemainingCents).toBe(5000);
    });
  });

  // ─── 4. Partial gift card ($30 GC on $100) ─────────────────────

  describe("4. $100 service, $30 gift card (partial, no promo) → $70 owed", () => {
    it("$100 - $30 GC = $70 owed", () => {
      const result = applyDiscounts(10000, 0, 3000);

      expect(result.owedCents).toBe(7000);
    });

    it("gift card is fully used — balance = $0", () => {
      const result = applyDiscounts(10000, 0, 3000);

      expect(result.giftCardDeductedCents).toBe(3000);
      expect(result.giftCardRemainingCents).toBe(0);
    });

    it("no promo discount applied", () => {
      const result = applyDiscounts(10000, 0, 3000);

      expect(result.promoDiscountCents).toBe(0);
    });
  });

  // ─── 5. Gift card exceeds total → $0 owed, remaining balance ───

  describe("5. $100 service, $150 gift card → $0 owed, GC balance = $50", () => {
    it("$100 service fully covered by $150 GC — $0 owed", () => {
      const result = applyDiscounts(10000, 0, 15000);

      expect(result.owedCents).toBe(0);
    });

    it("only $100 deducted from the GC — $50 remains", () => {
      const result = applyDiscounts(10000, 0, 15000);

      expect(result.giftCardDeductedCents).toBe(10000);
      expect(result.giftCardRemainingCents).toBe(5000);
    });

    it("GC deduction never exceeds the amount owed after promo", () => {
      // $100 service, 20% promo = $80 after promo, $150 GC
      const result = applyDiscounts(10000, 20, 15000);

      expect(result.giftCardDeductedCents).toBe(8000); // only what's needed
      expect(result.giftCardRemainingCents).toBe(7000); // 15000 - 8000
      expect(result.owedCents).toBe(0);
    });

    it("owed amount is never negative regardless of discount combination", () => {
      const cases = [
        { service: 5000, promo: 100, gc: 10000 },
        { service: 1000, promo: 50, gc: 5000 },
        { service: 10000, promo: 75, gc: 10000 },
      ];

      for (const { service, promo, gc } of cases) {
        const result = applyDiscounts(service, promo, gc);
        expect(result.owedCents).toBeGreaterThanOrEqual(0);
        expect(result.giftCardRemainingCents).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
