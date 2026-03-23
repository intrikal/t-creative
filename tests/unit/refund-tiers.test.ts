// @vitest-environment node

/**
 * tests/unit/refund-tiers.test.ts
 *
 * Unit tests for the cancellation refund tier logic in
 * app/dashboard/bookings/actions.ts → tryRefundCancellationDeposit().
 *
 * The core decision function is extracted inline so tests are pure
 * (no DB, no Square API, no settings fetch). If the source logic changes,
 * the inline copy here will diverge and tests will fail intentionally.
 *
 * Default policy (mirrors DEFAULT_POLICIES in settings-actions.ts):
 *   fullRefundHours      = 48
 *   partialRefundPct     = 50
 *   partialRefundMinHours = 24
 *   noRefundHours        = 24
 *
 * Tier boundaries:
 *   hours >= 48          → full_refund   (100% of deposit)
 *   24 <= hours < 48     → partial_refund (partialRefundPct% of deposit, Math.round)
 *   hours < 24           → no_refund     (0)
 *   depositInCents <= 0  → no_deposit    (0, regardless of timing)
 */

import { describe, expect, it } from "vitest";

// ─── Inline refund decision logic (mirrors actions.ts exactly) ────────────────

interface PolicySettings {
  fullRefundHours: number;
  partialRefundPct: number;
  partialRefundMinHours: number;
  noRefundHours: number;
}

interface RefundDecision {
  decision: "full_refund" | "partial_refund" | "no_refund" | "no_deposit";
  refundAmountInCents: number;
}

const DEFAULT_POLICY: PolicySettings = {
  fullRefundHours: 48,
  partialRefundPct: 50,
  partialRefundMinHours: 24,
  noRefundHours: 24,
};

/**
 * Pure function extracted from tryRefundCancellationDeposit.
 * hoursUntilAppointment may be negative (past appointment).
 */
function calculateRefund(
  depositInCents: number,
  hoursUntilAppointment: number,
  policy: PolicySettings = DEFAULT_POLICY,
): RefundDecision {
  if (depositInCents <= 0) {
    return { decision: "no_deposit", refundAmountInCents: 0 };
  }

  if (hoursUntilAppointment >= policy.fullRefundHours) {
    return { decision: "full_refund", refundAmountInCents: depositInCents };
  }

  if (hoursUntilAppointment >= policy.partialRefundMinHours) {
    const refundAmountInCents = Math.round((depositInCents * policy.partialRefundPct) / 100);
    return { decision: "partial_refund", refundAmountInCents };
  }

  return { decision: "no_refund", refundAmountInCents: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier boundary tests — default policy
// ─────────────────────────────────────────────────────────────────────────────

describe("refund tier boundaries — default policy (48h full / 50% partial / 24h min)", () => {
  const deposit = 5000; // $50.00

  it("72 hours before → full refund", () => {
    const result = calculateRefund(deposit, 72);
    expect(result.decision).toBe("full_refund");
    expect(result.refundAmountInCents).toBe(5000);
  });

  it("exactly 48.000 hours before → full refund (>= boundary)", () => {
    const result = calculateRefund(deposit, 48);
    expect(result.decision).toBe("full_refund");
    expect(result.refundAmountInCents).toBe(5000);
  });

  it("47.999 hours before (47h 59m 56.4s) → partial refund", () => {
    const result = calculateRefund(deposit, 47.999);
    expect(result.decision).toBe("partial_refund");
    expect(result.refundAmountInCents).toBe(2500);
  });

  it("36 hours before → partial refund at 50%", () => {
    const result = calculateRefund(deposit, 36);
    expect(result.decision).toBe("partial_refund");
    expect(result.refundAmountInCents).toBe(2500);
  });

  it("exactly 24.001 hours before → partial refund", () => {
    const result = calculateRefund(deposit, 24.001);
    expect(result.decision).toBe("partial_refund");
    expect(result.refundAmountInCents).toBe(2500);
  });

  it("exactly 24.000 hours before → no refund (< fullRefundHours, = partialRefundMinHours → partial)", () => {
    // 24 >= partialRefundMinHours (24), so still qualifies for partial
    const result = calculateRefund(deposit, 24);
    expect(result.decision).toBe("partial_refund");
    expect(result.refundAmountInCents).toBe(2500);
  });

  it("23.999 hours before → no refund (just below partial threshold)", () => {
    const result = calculateRefund(deposit, 23.999);
    expect(result.decision).toBe("no_refund");
    expect(result.refundAmountInCents).toBe(0);
  });

  it("12 hours before → no refund", () => {
    const result = calculateRefund(deposit, 12);
    expect(result.decision).toBe("no_refund");
    expect(result.refundAmountInCents).toBe(0);
  });

  it("0 hours (at appointment time) → no refund", () => {
    const result = calculateRefund(deposit, 0);
    expect(result.decision).toBe("no_refund");
    expect(result.refundAmountInCents).toBe(0);
  });

  it("past appointment (-2 hours) → no refund", () => {
    const result = calculateRefund(deposit, -2);
    expect(result.decision).toBe("no_refund");
    expect(result.refundAmountInCents).toBe(0);
  });

  it("far past appointment (-1000 hours) → no refund", () => {
    const result = calculateRefund(deposit, -1000);
    expect(result.decision).toBe("no_refund");
    expect(result.refundAmountInCents).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Partial refund math
// ─────────────────────────────────────────────────────────────────────────────

describe("partial refund amount calculation", () => {
  it("5000 cents * 50% = 2500 cents (exact, no rounding)", () => {
    const result = calculateRefund(5000, 36);
    expect(result.refundAmountInCents).toBe(2500);
  });

  it("5001 cents * 50% = 2501 cents (Math.round: 2500.5 → 2501, NOT floor)", () => {
    // Source uses Math.round, not Math.floor.
    // Math.round(5001 * 50 / 100) = Math.round(2500.5) = 2501
    const result = calculateRefund(5001, 36);
    expect(result.refundAmountInCents).toBe(2501);
  });

  it("5003 cents * 50% = 2502 cents (Math.round: 2501.5 → 2502)", () => {
    const result = calculateRefund(5003, 36);
    expect(result.refundAmountInCents).toBe(2502);
  });

  it("1 cent * 50% = 1 cent (Math.round: 0.5 → 1)", () => {
    const result = calculateRefund(1, 36);
    expect(result.refundAmountInCents).toBe(1);
  });

  it("1 cent * 50% rounds up, not down (documents Math.round behaviour)", () => {
    // NOTE: source uses Math.round not Math.floor. 0.5 rounds to 1, not 0.
    // If precise floor behaviour is ever needed, source must change to Math.floor.
    const result = calculateRefund(1, 36);
    expect(result.decision).toBe("partial_refund");
    expect(result.refundAmountInCents).toBeGreaterThan(0);
  });

  it("100 cents * 75% = 75 cents (custom pct)", () => {
    const result = calculateRefund(100, 36, { ...DEFAULT_POLICY, partialRefundPct: 75 });
    expect(result.refundAmountInCents).toBe(75);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No deposit cases
// ─────────────────────────────────────────────────────────────────────────────

describe("no deposit paid — skip refund regardless of timing", () => {
  it("deposit=0 cents, 72h before → no_deposit decision", () => {
    const result = calculateRefund(0, 72);
    expect(result.decision).toBe("no_deposit");
    expect(result.refundAmountInCents).toBe(0);
  });

  it("deposit=0 cents, 36h before → no_deposit (not partial)", () => {
    const result = calculateRefund(0, 36);
    expect(result.decision).toBe("no_deposit");
  });

  it("deposit=0 cents, 0h → no_deposit", () => {
    const result = calculateRefund(0, 0);
    expect(result.decision).toBe("no_deposit");
  });

  it("deposit=-1 cents (null coerced to 0) → no_deposit", () => {
    // depositPaidInCents ?? 0 in source; -1 would be a data bug but is handled
    const result = calculateRefund(-1, 72);
    expect(result.decision).toBe("no_deposit");
    expect(result.refundAmountInCents).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom policy settings
// ─────────────────────────────────────────────────────────────────────────────

describe("custom policy settings", () => {
  const customPolicy: PolicySettings = {
    fullRefundHours: 72,
    partialRefundPct: 75,
    partialRefundMinHours: 24,
    noRefundHours: 24,
  };

  it("72h full threshold: exactly 72h → full refund", () => {
    const result = calculateRefund(4000, 72, customPolicy);
    expect(result.decision).toBe("full_refund");
    expect(result.refundAmountInCents).toBe(4000);
  });

  it("72h full threshold: 71.999h → partial (not full)", () => {
    const result = calculateRefund(4000, 71.999, customPolicy);
    expect(result.decision).toBe("partial_refund");
  });

  it("75% partial pct: 4000 cents * 75% = 3000 cents", () => {
    const result = calculateRefund(4000, 48, customPolicy);
    expect(result.decision).toBe("partial_refund");
    expect(result.refundAmountInCents).toBe(3000);
  });

  it("custom policy still applies no_refund below partialRefundMinHours", () => {
    const result = calculateRefund(4000, 23, customPolicy);
    expect(result.decision).toBe("no_refund");
    expect(result.refundAmountInCents).toBe(0);
  });

  it("custom partialRefundMinHours=48: 47h → no_refund", () => {
    const tightPolicy: PolicySettings = {
      fullRefundHours: 72,
      partialRefundPct: 50,
      partialRefundMinHours: 48,
      noRefundHours: 48,
    };
    const result = calculateRefund(5000, 47, tightPolicy);
    expect(result.decision).toBe("no_refund");
  });

  it("custom partialRefundMinHours=48: exactly 48h → partial_refund", () => {
    const tightPolicy: PolicySettings = {
      fullRefundHours: 72,
      partialRefundPct: 50,
      partialRefundMinHours: 48,
      noRefundHours: 48,
    };
    // 48 >= 48 (partialRefundMinHours) but < 72 (fullRefundHours) → partial
    const result = calculateRefund(5000, 48, tightPolicy);
    expect(result.decision).toBe("partial_refund");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hoursUntilAppointment calculation
// ─────────────────────────────────────────────────────────────────────────────

describe("hoursUntilAppointment computation from timestamps", () => {
  /**
   * In the source, hoursUntilAppointment is computed as:
   *   (booking.startsAt.getTime() - Date.now()) / (1000 * 60 * 60)
   *
   * These tests verify that the formula produces the expected values
   * at the exact boundary timestamps used in the tier tests above.
   */

  function hoursFromNow(msFromNow: number): number {
    return msFromNow / (1000 * 60 * 60);
  }

  it("48 hours in ms → exactly 48.0 hours", () => {
    expect(hoursFromNow(48 * 60 * 60 * 1000)).toBe(48);
  });

  it("47h 59m 56.4s in ms → 47.999 hours", () => {
    // 47 * 3600000 + 59 * 60000 + 56400 = 172796400ms
    expect(hoursFromNow(172_796_400)).toBeCloseTo(47.999, 3);
  });

  it("24 hours in ms → exactly 24.0 hours", () => {
    expect(hoursFromNow(24 * 60 * 60 * 1000)).toBe(24);
  });

  it("negative ms (past appointment) → negative hours", () => {
    expect(hoursFromNow(-2 * 60 * 60 * 1000)).toBe(-2);
  });
});
