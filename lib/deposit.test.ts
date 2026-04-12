/**
 * Tests for the combo deposit calculation module.
 *
 * Covers:
 *  - "sum" mode: sums all individual service deposits
 *  - "highest" mode: returns only the highest deposit
 *  - "fixed" mode: returns the configured flat amount
 *  - Empty array → 0
 *  - Single service → returns that service's deposit regardless of mode
 *  - Null/undefined deposits in array behavior
 *
 * No mocks needed — pure arithmetic logic.
 */
import { describe, it, expect } from "vitest";
import { calculateComboDeposit } from "./deposit";

describe("lib/deposit", () => {
  describe("calculateComboDeposit()", () => {
    const services = [
      { depositInCents: 1000 },
      { depositInCents: 2000 },
      { depositInCents: 3000 },
    ];

    it('sums all deposits in "sum" mode', () => {
      expect(calculateComboDeposit(services, "sum")).toBe(6000);
    });

    it('returns the highest deposit in "highest" mode', () => {
      expect(calculateComboDeposit(services, "highest")).toBe(3000);
    });

    it('returns the fixed amount in "fixed" mode', () => {
      expect(calculateComboDeposit(services, "fixed", 7500)).toBe(7500);
    });

    it('uses default fixedAmount (5000) when not provided in "fixed" mode', () => {
      expect(calculateComboDeposit(services, "fixed")).toBe(5000);
    });

    it("returns 0 for an empty array regardless of mode", () => {
      expect(calculateComboDeposit([], "sum")).toBe(0);
      expect(calculateComboDeposit([], "highest")).toBe(0);
      expect(calculateComboDeposit([], "fixed", 9999)).toBe(0);
    });

    it("returns the single service deposit regardless of mode", () => {
      const single = [{ depositInCents: 2500 }];
      expect(calculateComboDeposit(single, "sum")).toBe(2500);
      expect(calculateComboDeposit(single, "highest")).toBe(2500);
      expect(calculateComboDeposit(single, "fixed", 9999)).toBe(2500);
    });

    it("treats null deposits as 0 via JS coercion in sum mode", () => {
      const withNull = [
        { depositInCents: 1000 },
        { depositInCents: null as unknown as number },
        { depositInCents: 3000 },
      ];
      // JS coerces null to 0 in addition: 1000 + 0 + 3000 = 4000
      expect(calculateComboDeposit(withNull, "sum")).toBe(4000);
    });

    it("treats undefined deposits as NaN in sum mode (no coercion to 0)", () => {
      const withUndefined = [
        { depositInCents: 1000 },
        { depositInCents: undefined as unknown as number },
        { depositInCents: 3000 },
      ];
      // JS coerces undefined to NaN in addition
      expect(calculateComboDeposit(withUndefined, "sum")).toBeNaN();
    });
  });
});
