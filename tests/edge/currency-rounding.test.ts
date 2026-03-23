// @vitest-environment node

/**
 * tests/edge/currency-rounding.test.ts
 *
 * Edge-case tests for currency rounding in the payment system.
 *
 * All monetary values are stored as integer cents.  Rounding errors that seem
 * small (±1¢) compound across multi-service bookings, discounts, commissions,
 * and split payments — or cause a refund to exceed what was actually paid.
 *
 * The production code uses Math.round() for percentage calculations.  These
 * tests document the correct expected values and flag the specific cases where
 * floor vs round produces a different result.
 *
 * Covered scenarios
 *   1. Multi-service total: three services that sum to exactly 10000 cents
 *      ($100.00) with an uneven split (3333 + 3333 + 3334).
 *   2. Percentage discount: 50% of 9999 cents — Math.round gives 5000
 *      (rounds up the 0.5 cent) vs Math.floor which gives 4999.
 *      Documents the production behaviour and why floor is safer for discounts.
 *   3. Commission: 15% of 8500 cents — both round and floor give 1275 cents
 *      (exact), and 15% of 8501 cents — round gives 1275, floor gives 1275.
 *      Covers a case where they diverge.
 *   4. Split payment: $60 card + $40 gift card totals exactly $100; no gap or
 *      double-charge from rounding.
 *   5. Refund of discounted booking: the refundable amount is what was
 *      actually paid (discounted total), not the original pre-discount price.
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Pure helpers — the logic production code should implement           */
/* ------------------------------------------------------------------ */

/**
 * Sums an array of cent values.  No rounding needed — integer addition is
 * always exact.
 */
function sumCents(amounts: number[]): number {
  return amounts.reduce((acc, n) => acc + n, 0);
}

/**
 * Applies a percentage discount to a cent amount.
 *
 * Production code (promo-gift-actions.ts line ~644):
 *   discountCents = Math.round(booking.totalInCents * (promo.discountValue / 100))
 *
 * For discounts it is safer to floor (never discount more than the exact
 * fractional cent), but the current implementation rounds.  Both behaviours
 * are documented here so a future change is a deliberate, tested decision.
 */
function applyPercentDiscountRound(totalCents: number, pct: number): number {
  return Math.round(totalCents * (pct / 100));
}

function applyPercentDiscountFloor(totalCents: number, pct: number): number {
  return Math.floor(totalCents * (pct / 100));
}

/**
 * Returns the effective (post-discount) amount owed in cents.
 * Clamps to zero — a discount can never exceed the total.
 */
function effectiveTotal(totalCents: number, discountCents: number): number {
  return Math.max(0, totalCents - discountCents);
}

/**
 * Calculates a staff commission in cents.
 *
 * Production code (staff-performance/actions.ts line ~342):
 *   serviceCut = Math.round(totalInCents * (rate / 100))
 */
function calcCommissionRound(totalCents: number, ratePercent: number): number {
  return Math.round(totalCents * (ratePercent / 100));
}

function calcCommissionFloor(totalCents: number, ratePercent: number): number {
  return Math.floor(totalCents * (ratePercent / 100));
}

/**
 * Validates a split payment: the sum of all payment method amounts must equal
 * the effective total exactly.
 */
function splitPaymentIsExact(parts: number[], expectedTotal: number): boolean {
  return sumCents(parts) === expectedTotal;
}

/**
 * Returns the maximum refundable amount for a payment.
 *
 * Production code (payment-actions.ts):
 *   refundable = payment.amountInCents - payment.refundedInCents
 *
 * The refundable amount is based on what was actually paid (amountInCents),
 * which is the discounted total — NOT the original pre-discount price.
 */
function maxRefundable(paidCents: number, alreadyRefundedCents: number): number {
  return Math.max(0, paidCents - alreadyRefundedCents);
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Currency rounding edge cases", () => {
  // ─── 1. Multi-service total ────────────────────────────────────────

  describe("1. Multi-service total — uneven three-way split sums exactly to 10000 cents", () => {
    // $100 split across three services: two at $33.33 and one at $33.34.
    // The individual prices must be set such that they sum to exactly 10000.
    const SERVICE_PRICES = [3333, 3333, 3334]; // cents

    it("sum of [3333, 3333, 3334] = 10000 cents exactly", () => {
      expect(sumCents(SERVICE_PRICES)).toBe(10000);
    });

    it("integer cent addition has no rounding error", () => {
      // All three are integers — addition is exact, never ±1
      const total = sumCents(SERVICE_PRICES);
      expect(Number.isInteger(total)).toBe(true);
      expect(total).toBe(10000);
    });

    it("order of addition does not change the total", () => {
      const fwd = sumCents([3333, 3333, 3334]);
      const rev = sumCents([3334, 3333, 3333]);
      const mixed = sumCents([3333, 3334, 3333]);
      expect(fwd).toBe(rev);
      expect(fwd).toBe(mixed);
      expect(fwd).toBe(10000);
    });

    it("a naive floating-point split (0.1 + 0.2) demonstrates float imprecision (documents the hazard)", () => {
      // Classic IEEE 754 float hazard: 0.1 + 0.2 ≠ 0.3 exactly
      const floatSum = 0.1 + 0.2;
      expect(floatSum).not.toBe(0.3); // 0.30000000000000004
      // Integer cents are immune: 10 + 20 = 30 exactly
      expect(sumCents([10, 20])).toBe(30);
      // And the three-service split in cents is exact
      expect(sumCents([3333, 3333, 3334])).toBe(10000);
    });

    it("adding a fourth $0 service does not change the total", () => {
      expect(sumCents([3333, 3333, 3334, 0])).toBe(10000);
    });
  });

  // ─── 2. Percentage discount rounding ──────────────────────────────

  describe("2. Percentage discount — 50% of 9999 cents: floor=4999, round=5000", () => {
    const TOTAL = 9999; // cents
    const PCT = 50;

    it("Math.floor(9999 * 0.5) = 4999 — never discounts the fractional cent", () => {
      expect(applyPercentDiscountFloor(TOTAL, PCT)).toBe(4999);
    });

    it("Math.round(9999 * 0.5) = 5000 — rounds the 0.5 cent up", () => {
      // 9999 * 0.50 = 4999.5 — Math.round rounds up to 5000
      expect(applyPercentDiscountRound(TOTAL, PCT)).toBe(5000);
    });

    it("floor and round diverge by exactly 1 cent on odd totals with 50% discount", () => {
      const floor = applyPercentDiscountFloor(TOTAL, PCT);
      const round = applyPercentDiscountRound(TOTAL, PCT);
      expect(round - floor).toBe(1);
    });

    it("floor discount leaves a higher effective total (client pays more, business receives more)", () => {
      const discountFloor = applyPercentDiscountFloor(TOTAL, PCT);
      const discountRound = applyPercentDiscountRound(TOTAL, PCT);

      const paidWithFloor = effectiveTotal(TOTAL, discountFloor); // 9999 - 4999 = 5000
      const paidWithRound = effectiveTotal(TOTAL, discountRound); // 9999 - 5000 = 4999

      expect(paidWithFloor).toBe(5000);
      expect(paidWithRound).toBe(4999);
      expect(paidWithFloor).toBeGreaterThan(paidWithRound);
    });

    it("50% of an even total (10000 cents) gives the same result with floor and round", () => {
      expect(applyPercentDiscountFloor(10000, 50)).toBe(5000);
      expect(applyPercentDiscountRound(10000, 50)).toBe(5000);
    });

    it("discount can never exceed the total (clamped to zero effective)", () => {
      // A 100% discount on any total leaves 0 cents owed
      const discount = applyPercentDiscountFloor(9999, 100);
      expect(effectiveTotal(9999, discount)).toBe(0);
    });

    it("a fixed discount larger than the total is clamped to the total", () => {
      // Fixed discount of $150 on a $99.99 booking → effective total is 0
      const fixedDiscount = Math.min(15000, TOTAL); // cap at total
      expect(effectiveTotal(TOTAL, fixedDiscount)).toBe(0);
    });
  });

  // ─── 3. Commission calculation ────────────────────────────────────

  describe("3. Commission — 15% of 8500 cents = 1275 cents (exact, no rounding difference)", () => {
    it("15% of 8500 cents = 1275 cents exactly (floor and round agree)", () => {
      // 8500 * 0.15 = 1275.0 — no fractional cent, both methods agree
      expect(calcCommissionRound(8500, 15)).toBe(1275);
      expect(calcCommissionFloor(8500, 15)).toBe(1275);
    });

    it("15% of 8501 cents: floor=1275, round=1275 (both floor the 0.15 fraction)", () => {
      // 8501 * 0.15 = 1275.15 — Math.floor=1275, Math.round=1275
      expect(calcCommissionFloor(8501, 15)).toBe(1275);
      expect(calcCommissionRound(8501, 15)).toBe(1275);
    });

    it("15% of 8503 cents: floor=1275, round=1275 (fraction still below 0.5)", () => {
      // 8503 * 0.15 = 1275.45 — both still floor to 1275
      expect(calcCommissionFloor(8503, 15)).toBe(1275);
      expect(calcCommissionRound(8503, 15)).toBe(1275);
    });

    it("15% of 8504 cents: floor=1275, round=1276 — floor and round diverge at 0.6 fraction", () => {
      // 8504 * 0.15 = 1275.60 — Math.floor=1275, Math.round=1276
      expect(calcCommissionFloor(8504, 15)).toBe(1275);
      expect(calcCommissionRound(8504, 15)).toBe(1276);
    });

    it("commission is always a non-negative integer", () => {
      expect(Number.isInteger(calcCommissionRound(8500, 15))).toBe(true);
      expect(calcCommissionRound(8500, 15)).toBeGreaterThanOrEqual(0);
    });

    it("0% commission on any total = 0 cents", () => {
      expect(calcCommissionRound(8500, 0)).toBe(0);
      expect(calcCommissionFloor(8500, 0)).toBe(0);
    });

    it("100% commission on 8500 cents = 8500 cents", () => {
      expect(calcCommissionRound(8500, 100)).toBe(8500);
      expect(calcCommissionFloor(8500, 100)).toBe(8500);
    });
  });

  // ─── 4. Split payment ─────────────────────────────────────────────

  describe("4. Split payment — $60 card + $40 gift card = $100 exactly, no gap", () => {
    const TOTAL_CENTS = 10000; // $100.00

    it("6000 + 4000 = 10000 cents exactly", () => {
      expect(splitPaymentIsExact([6000, 4000], TOTAL_CENTS)).toBe(true);
    });

    it("split parts sum to the effective (post-discount) total, not the original total", () => {
      // Original: $120, gift card covers $20 discount, client pays $100
      const originalTotal = 12000;
      const giftCardDiscount = 2000;
      const effective = effectiveTotal(originalTotal, giftCardDiscount); // 10000

      // Client pays remaining $100 via card
      const cardAmount = 10000;
      expect(splitPaymentIsExact([cardAmount], effective)).toBe(true);
    });

    it("gift card partial redemption: $40 gift card + $60 card on a $100 booking", () => {
      const giftCardPart = 4000; // $40 gift card
      const cardPart = 6000; // $60 card

      expect(splitPaymentIsExact([giftCardPart, cardPart], TOTAL_CENTS)).toBe(true);
    });

    it("overpaying is detected: $61 card + $40 gift card ≠ $100", () => {
      expect(splitPaymentIsExact([6100, 4000], TOTAL_CENTS)).toBe(false);
    });

    it("underpaying is detected: $59 card + $40 gift card ≠ $100", () => {
      expect(splitPaymentIsExact([5900, 4000], TOTAL_CENTS)).toBe(false);
    });

    it("a single card payment for the full amount is also exact", () => {
      expect(splitPaymentIsExact([10000], TOTAL_CENTS)).toBe(true);
    });

    it("three-way split (card + gift card + cash) still sums exactly", () => {
      // $50 card + $30 gift card + $20 cash = $100
      expect(splitPaymentIsExact([5000, 3000, 2000], TOTAL_CENTS)).toBe(true);
    });
  });

  // ─── 5. Refund of discounted booking ──────────────────────────────

  describe("5. Refund — refund is capped at what was actually paid (discounted total)", () => {
    it("full refund of a discounted booking: refund = paid amount, not original price", () => {
      const originalTotal = 12000; // $120 original
      const discountCents = 2000; // $20 discount
      const paidCents = effectiveTotal(originalTotal, discountCents); // $100 paid

      // The maximum refundable is what was paid, not the original price
      expect(maxRefundable(paidCents, 0)).toBe(10000);
      expect(maxRefundable(paidCents, 0)).not.toBe(originalTotal);
    });

    it("cannot refund more than the paid amount", () => {
      const paidCents = 10000;
      const requestedRefund = 12000; // more than paid

      // The refundable cap prevents over-refunding
      const refundable = maxRefundable(paidCents, 0);
      expect(requestedRefund).toBeGreaterThan(refundable);
      // The actual refund should be capped
      const actualRefund = Math.min(requestedRefund, refundable);
      expect(actualRefund).toBe(10000);
    });

    it("partial refund reduces the remaining refundable amount", () => {
      const paidCents = 10000;
      const firstRefund = 3000; // $30 partial refund

      const remainingRefundable = maxRefundable(paidCents, firstRefund);
      expect(remainingRefundable).toBe(7000); // $70 remaining
    });

    it("after a full refund, no further refund is possible", () => {
      const paidCents = 10000;
      const fullRefund = 10000;

      expect(maxRefundable(paidCents, fullRefund)).toBe(0);
    });

    it("refund of a BOGO-discounted booking uses the paid amount (50% of total)", () => {
      const totalCents = 9999;
      // BOGO discount — production uses Math.round
      const bogoDiscount = applyPercentDiscountRound(totalCents, 50); // 5000
      const paidCents = effectiveTotal(totalCents, bogoDiscount); // 4999

      // Refund is capped at what was paid: 4999, not the original 9999
      expect(maxRefundable(paidCents, 0)).toBe(4999);
      expect(maxRefundable(paidCents, 0)).not.toBe(totalCents);
    });

    it("refund of a discounted booking never exceeds the discounted (paid) amount", () => {
      const cases = [
        { total: 10000, discountPct: 20 }, // $80 paid
        { total: 5000, discountPct: 10 }, // $45 paid
        { total: 9999, discountPct: 50 }, // $4999 paid (round)
        { total: 1000, discountPct: 100 }, // $0 paid
      ];

      for (const { total, discountPct } of cases) {
        const discount = applyPercentDiscountRound(total, discountPct);
        const paid = effectiveTotal(total, discount);
        const refundable = maxRefundable(paid, 0);

        expect(refundable).toBeLessThanOrEqual(paid);
        expect(refundable).toBeLessThanOrEqual(total);
      }
    });

    it("a $0 paid booking (100% discount) has $0 refundable", () => {
      const paidCents = 0;
      expect(maxRefundable(paidCents, 0)).toBe(0);
    });
  });
});
