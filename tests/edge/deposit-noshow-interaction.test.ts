// @vitest-environment node

/**
 * tests/edge/deposit-noshow-interaction.test.ts
 *
 * Edge-case tests for no-show fee + deposit interaction.
 *
 * When a client no-shows or late-cancels, a fee is assessed. If the client
 * previously paid a deposit for the booking, that deposit must be credited
 * against the fee — the client should never be double-charged for the same
 * booking.
 *
 * The production code calculates: additionalCharge = max(0, fee - depositPaid).
 * If the deposit already covers or exceeds the fee, no additional charge is
 * collected.
 *
 * Covered scenarios
 *   1. No-show fee on booking WITH deposit → deposit credited against fee.
 *   2. No-show fee on booking WITHOUT deposit → full fee charged.
 *   3. Late cancel fee (50%) on $100 service with $25 deposit → $25 additional.
 *   4. No-show fee (100%) on $100 service with $100 deposit → $0 additional.
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Pure helpers — the logic production code should implement           */
/* ------------------------------------------------------------------ */

/**
 * Calculates the no-show or late-cancel fee in cents.
 *
 * @param serviceTotalCents - The full price of the service in cents
 * @param feePercent - The fee percentage (e.g. 100 for no-show, 50 for late cancel)
 * @returns The fee amount in cents
 */
function calcFee(serviceTotalCents: number, feePercent: number): number {
  return Math.round(serviceTotalCents * (feePercent / 100));
}

/**
 * Calculates the additional amount the client owes after crediting their deposit
 * against the fee. The result is never negative — a deposit that exceeds the fee
 * simply means $0 additional charge (the excess stays credited or is refunded
 * separately).
 *
 * Production logic:
 *   additionalCharge = Math.max(0, feeInCents - depositPaidCents)
 */
function calcAdditionalCharge(feeInCents: number, depositPaidCents: number): number {
  return Math.max(0, feeInCents - depositPaidCents);
}

/**
 * Returns a breakdown of the fee interaction: fee, deposit credit, and
 * additional amount owed.
 */
function feeBreakdown(
  serviceTotalCents: number,
  feePercent: number,
  depositPaidCents: number,
): { feeCents: number; depositCreditCents: number; additionalChargeCents: number } {
  const feeCents = calcFee(serviceTotalCents, feePercent);
  const depositCreditCents = Math.min(depositPaidCents, feeCents);
  const additionalChargeCents = calcAdditionalCharge(feeCents, depositPaidCents);
  return { feeCents, depositCreditCents, additionalChargeCents };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("No-show fee + deposit interaction", () => {
  // ─── 1. No-show fee on booking WITH deposit ──────────────────────

  describe("1. No-show fee on booking WITH deposit — deposit credited against fee", () => {
    it("$100 service, 100% no-show fee, $50 deposit → fee=$100, deposit credited=$50, owes=$50", () => {
      const breakdown = feeBreakdown(10000, 100, 5000);

      expect(breakdown.feeCents).toBe(10000);
      expect(breakdown.depositCreditCents).toBe(5000);
      expect(breakdown.additionalChargeCents).toBe(5000);
    });

    it("deposit is fully credited — client is never double-charged", () => {
      const breakdown = feeBreakdown(10000, 100, 5000);

      // The total the client pays is deposit + additional, which should equal the fee
      const totalClientPays = breakdown.depositCreditCents + breakdown.additionalChargeCents;
      expect(totalClientPays).toBe(breakdown.feeCents);
    });

    it("if deposit >= fee, no additional charge is collected", () => {
      // $100 service, 50% fee = $50, deposit = $75
      const breakdown = feeBreakdown(10000, 50, 7500);

      expect(breakdown.feeCents).toBe(5000);
      expect(breakdown.additionalChargeCents).toBe(0);
      expect(breakdown.depositCreditCents).toBe(5000); // only fee amount credited
    });

    it("additional charge is never negative regardless of deposit size", () => {
      const cases = [
        { service: 10000, feePct: 100, deposit: 15000 }, // deposit exceeds service
        { service: 5000, feePct: 50, deposit: 5000 }, // deposit exceeds fee
        { service: 10000, feePct: 25, deposit: 10000 }, // deposit far exceeds fee
      ];

      for (const { service, feePct, deposit } of cases) {
        const breakdown = feeBreakdown(service, feePct, deposit);
        expect(breakdown.additionalChargeCents).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ─── 2. No-show fee on booking WITHOUT deposit ───────────────────

  describe("2. No-show fee on booking WITHOUT deposit — full fee charged", () => {
    it("$100 service, 100% no-show fee, $0 deposit → owes $100", () => {
      const breakdown = feeBreakdown(10000, 100, 0);

      expect(breakdown.feeCents).toBe(10000);
      expect(breakdown.depositCreditCents).toBe(0);
      expect(breakdown.additionalChargeCents).toBe(10000);
    });

    it("$80 service, 50% late-cancel fee, $0 deposit → owes $40", () => {
      const breakdown = feeBreakdown(8000, 50, 0);

      expect(breakdown.feeCents).toBe(4000);
      expect(breakdown.depositCreditCents).toBe(0);
      expect(breakdown.additionalChargeCents).toBe(4000);
    });

    it("with no deposit, additional charge always equals the full fee", () => {
      for (const feePct of [25, 50, 75, 100]) {
        const breakdown = feeBreakdown(10000, feePct, 0);
        expect(breakdown.additionalChargeCents).toBe(breakdown.feeCents);
      }
    });
  });

  // ─── 3. Late cancel fee (50%) with partial deposit ───────────────

  describe("3. Late cancel fee (50%) on $100 service with $25 deposit → $25 additional", () => {
    it("fee=$50, deposit credit=$25, additional=$25", () => {
      const breakdown = feeBreakdown(10000, 50, 2500);

      expect(breakdown.feeCents).toBe(5000);
      expect(breakdown.depositCreditCents).toBe(2500);
      expect(breakdown.additionalChargeCents).toBe(2500);
    });

    it("total collected from client (deposit + additional) equals the fee exactly", () => {
      const breakdown = feeBreakdown(10000, 50, 2500);

      const totalCollected = breakdown.depositCreditCents + breakdown.additionalChargeCents;
      expect(totalCollected).toBe(breakdown.feeCents);
    });

    it("late cancel fee with odd-cent rounding: 50% of $99.99 service", () => {
      // 9999 * 0.50 = 4999.5 → Math.round = 5000
      const breakdown = feeBreakdown(9999, 50, 2500);

      expect(breakdown.feeCents).toBe(5000);
      expect(breakdown.depositCreditCents).toBe(2500);
      expect(breakdown.additionalChargeCents).toBe(2500);
    });
  });

  // ─── 4. No-show fee (100%) with full deposit ────────────────────

  describe("4. No-show fee (100%) on $100 service with $100 deposit → $0 additional", () => {
    it("fee=$100, deposit credit=$100, additional=$0", () => {
      const breakdown = feeBreakdown(10000, 100, 10000);

      expect(breakdown.feeCents).toBe(10000);
      expect(breakdown.depositCreditCents).toBe(10000);
      expect(breakdown.additionalChargeCents).toBe(0);
    });

    it("client already paid the full amount as deposit — nothing more owed", () => {
      const additional = calcAdditionalCharge(10000, 10000);
      expect(additional).toBe(0);
    });

    it("deposit exceeding the service price still results in $0 additional", () => {
      // Edge: deposit was $120 on a $100 service (overpayment scenario)
      const breakdown = feeBreakdown(10000, 100, 12000);

      expect(breakdown.additionalChargeCents).toBe(0);
      // Only fee amount is credited, not the full deposit
      expect(breakdown.depositCreditCents).toBe(10000);
    });

    it("0% fee with any deposit → $0 fee, $0 additional, $0 credited", () => {
      const breakdown = feeBreakdown(10000, 0, 5000);

      expect(breakdown.feeCents).toBe(0);
      expect(breakdown.depositCreditCents).toBe(0);
      expect(breakdown.additionalChargeCents).toBe(0);
    });
  });
});
