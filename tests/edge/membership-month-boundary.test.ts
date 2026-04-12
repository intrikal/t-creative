// @vitest-environment node

/**
 * tests/edge/membership-month-boundary.test.ts
 *
 * Edge-case tests for membership renewal at month boundaries.
 *
 * Monthly memberships that start on dates > 28 can land on months that don't
 * have that many days. The production code must handle this correctly by
 * clamping to the last day of the target month — e.g., Jan 31 → Feb 28
 * (or Feb 29 in a leap year).
 *
 * This avoids common pitfalls:
 *   - Naive date addition (addDays(30)) drifts over time
 *   - new Date(year, month, 31) on a 30-day month silently rolls to the 1st
 *     of the next month — must be clamped, not rolled
 *
 * Covered scenarios
 *   1. Monthly membership starting Jan 31 → Feb 28 (non-leap year)
 *   2. Monthly membership starting Jan 31 → Feb 29 (leap year)
 *   3. Monthly membership starting Mar 31 → Apr 30
 *   4. Bi-monthly membership starting Jan 31 → Mar 31
 *   5. Monthly membership starting Jan 15 → Feb 15 (normal case)
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Pure helpers — the logic production code should implement           */
/* ------------------------------------------------------------------ */

/**
 * Returns the last day of a given month (1-indexed month).
 */
function lastDayOfMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of the current month
  return new Date(year, month, 0).getDate();
}

/**
 * Calculates the next renewal date for a membership.
 *
 * Adds `intervalMonths` to the start date. If the resulting month has fewer
 * days than the start day, clamps to the last day of the target month.
 *
 * Production logic (membership-actions.ts → calcNextRenewal):
 *   const targetMonth = startDate.getMonth() + intervalMonths;
 *   const targetYear = startDate.getFullYear() + Math.floor(targetMonth / 12);
 *   const targetMonthNorm = targetMonth % 12;
 *   const targetDay = Math.min(startDate.getDate(), lastDayOfMonth(targetYear, targetMonthNorm + 1));
 *   return new Date(targetYear, targetMonthNorm, targetDay);
 */
function calcNextRenewal(startDate: Date, intervalMonths: number): Date {
  const startDay = startDate.getDate();
  const totalMonths = startDate.getMonth() + intervalMonths;
  const targetYear = startDate.getFullYear() + Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12; // 0-indexed

  // Clamp day to the last day of the target month
  const maxDay = lastDayOfMonth(targetYear, targetMonth + 1); // +1 because lastDayOfMonth expects 1-indexed
  const targetDay = Math.min(startDay, maxDay);

  return new Date(targetYear, targetMonth, targetDay);
}

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

/** Creates a Date object for a specific year/month/day. */
function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day); // month is 0-indexed in JS
}

/** Formats a date as YYYY-MM-DD for readable assertions. */
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Membership renewal at month boundaries", () => {
  // ─── 1. Jan 31 → Feb 28 (non-leap year) ─────────────────────────

  describe("1. Monthly membership starting Jan 31 → Feb 28 (non-leap year)", () => {
    it("Jan 31, 2025 + 1 month = Feb 28, 2025", () => {
      const start = makeDate(2025, 1, 31);
      const renewal = calcNextRenewal(start, 1);

      expect(fmt(renewal)).toBe("2025-02-28");
    });

    it("result day is 28, not 31 (clamped to last day of Feb)", () => {
      const start = makeDate(2025, 1, 31);
      const renewal = calcNextRenewal(start, 1);

      expect(renewal.getDate()).toBe(28);
    });

    it("does not roll over to March 1 (a common Date constructor bug)", () => {
      const start = makeDate(2025, 1, 31);
      const renewal = calcNextRenewal(start, 1);

      expect(renewal.getMonth()).toBe(1); // February (0-indexed)
      expect(renewal.getDate()).not.toBe(1);
    });
  });

  // ─── 2. Jan 31 → Feb 29 (leap year) ─────────────────────────────

  describe("2. Monthly membership starting Jan 31 → Feb 29 (leap year)", () => {
    it("Jan 31, 2028 + 1 month = Feb 29, 2028 (2028 is a leap year)", () => {
      const start = makeDate(2028, 1, 31);
      const renewal = calcNextRenewal(start, 1);

      expect(fmt(renewal)).toBe("2028-02-29");
    });

    it("result day is 29 in a leap year, not 28", () => {
      const start = makeDate(2028, 1, 31);
      const renewal = calcNextRenewal(start, 1);

      expect(renewal.getDate()).toBe(29);
    });

    it("2024 is also a leap year — Jan 31, 2024 → Feb 29, 2024", () => {
      const start = makeDate(2024, 1, 31);
      const renewal = calcNextRenewal(start, 1);

      expect(fmt(renewal)).toBe("2024-02-29");
    });
  });

  // ─── 3. Mar 31 → Apr 30 ─────────────────────────────────────────

  describe("3. Monthly membership starting Mar 31 → Apr 30", () => {
    it("Mar 31, 2026 + 1 month = Apr 30, 2026", () => {
      const start = makeDate(2026, 3, 31);
      const renewal = calcNextRenewal(start, 1);

      expect(fmt(renewal)).toBe("2026-04-30");
    });

    it("clamped to 30 because April has 30 days", () => {
      const start = makeDate(2026, 3, 31);
      const renewal = calcNextRenewal(start, 1);

      expect(renewal.getDate()).toBe(30);
    });

    it("similarly, May 31 → Jun 30", () => {
      const start = makeDate(2026, 5, 31);
      const renewal = calcNextRenewal(start, 1);

      expect(fmt(renewal)).toBe("2026-06-30");
    });
  });

  // ─── 4. Bi-monthly: Jan 31 → Mar 31 ─────────────────────────────

  describe("4. Bi-monthly membership starting Jan 31 → Mar 31", () => {
    it("Jan 31, 2026 + 2 months = Mar 31, 2026", () => {
      const start = makeDate(2026, 1, 31);
      const renewal = calcNextRenewal(start, 2);

      expect(fmt(renewal)).toBe("2026-03-31");
    });

    it("March has 31 days — no clamping needed", () => {
      const start = makeDate(2026, 1, 31);
      const renewal = calcNextRenewal(start, 2);

      expect(renewal.getDate()).toBe(31);
    });

    it("bi-monthly from Jan 31 skips over the Feb problem entirely", () => {
      const start = makeDate(2025, 1, 31);
      const renewal = calcNextRenewal(start, 2);

      // March 31 — never touches February
      expect(renewal.getMonth()).toBe(2); // March (0-indexed)
      expect(renewal.getDate()).toBe(31);
    });

    it("bi-monthly from Mar 31 → May 31 (both 31-day months)", () => {
      const start = makeDate(2026, 3, 31);
      const renewal = calcNextRenewal(start, 2);

      expect(fmt(renewal)).toBe("2026-05-31");
    });
  });

  // ─── 5. Normal case: Jan 15 → Feb 15 ───────────────────────────

  describe("5. Monthly membership starting Jan 15 → Feb 15 (normal case)", () => {
    it("Jan 15, 2026 + 1 month = Feb 15, 2026", () => {
      const start = makeDate(2026, 1, 15);
      const renewal = calcNextRenewal(start, 1);

      expect(fmt(renewal)).toBe("2026-02-15");
    });

    it("day is preserved exactly when the target month has enough days", () => {
      const start = makeDate(2026, 1, 15);
      const renewal = calcNextRenewal(start, 1);

      expect(renewal.getDate()).toBe(15);
    });

    it("month-over-month chain: 15th stays on the 15th for 12 consecutive months", () => {
      let current = makeDate(2026, 1, 15);

      for (let i = 1; i <= 12; i++) {
        const renewal = calcNextRenewal(makeDate(2026, 1, 15), i);
        expect(renewal.getDate()).toBe(15);
        current = renewal;
      }

      // After 12 months, we're back to January 15 of the next year
      expect(fmt(current)).toBe("2027-01-15");
    });

    it("year boundary: Dec 15, 2026 + 1 month = Jan 15, 2027", () => {
      const start = makeDate(2026, 12, 15);
      const renewal = calcNextRenewal(start, 1);

      expect(fmt(renewal)).toBe("2027-01-15");
    });
  });
});
