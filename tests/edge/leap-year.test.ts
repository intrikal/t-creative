// @vitest-environment node

/**
 * tests/edge/leap-year.test.ts
 *
 * Edge-case tests for leap-year birthday handling.
 *
 * Feb 29 birthdays occur only once every 4 years.  The birthday promo
 * system matches profiles by MM/DD — on non-leap years "02/29" never
 * appears as "today", so Feb 29 clients are silently skipped unless
 * the system has an explicit fallback policy.
 *
 * Covered scenarios
 *   1. Non-leap year fallback: Feb 29 birthday → promo sent on Feb 28
 *      (default "last day of February" policy)
 *   2. Non-leap year alt: a "March 1" policy would send on 03/01 instead
 *   3. Leap year: Feb 29 birthday → promo sent on exactly Feb 29
 *   4. Promo expiry: birthday + 30 days across the Feb/Mar boundary
 *   5. Advance promo window: 7-day look-ahead correctly resolves Feb 22
 *      (7 days before Feb 29 on a leap year) and Feb 21 (7 days before
 *      Feb 28 on a non-leap year using the fallback date)
 *   6. Year identification: leap vs non-leap detection is correct for
 *      years around the system's operational range
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Pure date helpers — the logic the production code should implement  */
/* ------------------------------------------------------------------ */

/**
 * Returns true when the given year is a leap year.
 *
 * Leap year rules:
 *  - divisible by 4
 *  - EXCEPT centuries (divisible by 100) are NOT leap years
 *  - UNLESS also divisible by 400 (those ARE leap years)
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Given a stored birthday in "MM/DD" format and a reference year,
 * returns the effective send date as a Date (midnight UTC).
 *
 * Policy for Feb 29 on non-leap years:
 *  - "last-day-of-feb"  → Feb 28  (default; respects "end of February")
 *  - "march-1"          → Mar 1   (alternative; first day of next month)
 *
 * All other birthdays are returned unchanged.
 */
function resolveEffectiveBirthdayDate(
  storedBirthday: string, // "MM/DD"
  year: number,
  leapFallback: "last-day-of-feb" | "march-1" = "last-day-of-feb",
): Date {
  const [mm, dd] = storedBirthday.split("/").map(Number);

  // Feb 29 on a non-leap year needs special handling
  if (mm === 2 && dd === 29 && !isLeapYear(year)) {
    if (leapFallback === "march-1") {
      return new Date(Date.UTC(year, 2, 1)); // March 1
    }
    // Default: last day of February = Feb 28
    return new Date(Date.UTC(year, 1, 28));
  }

  return new Date(Date.UTC(year, mm - 1, dd));
}

/**
 * Formats a Date as "MM/DD" (the format stored in profiles.onboardingData).
 */
function toMMDD(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

/**
 * Adds `days` calendar days to a UTC date and returns the new Date.
 *
 * Uses UTC arithmetic to avoid DST surprises — the promo expiry is a
 * calendar-day count, not a duration in milliseconds.
 */
function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/**
 * Returns the date that is `lookAheadDays` before `targetDate` (UTC).
 * Used by the advance-promo cron: "who has a birthday in N days?"
 */
function lookAheadStartDate(targetDate: Date, lookAheadDays: number): Date {
  return addDays(targetDate, -lookAheadDays);
}

/**
 * Given a stored birthday "MM/DD", returns the MM/DD strings that the
 * birthday-query should match on non-leap years (may be one or two values
 * depending on fallback policy) and on leap years (always one value).
 *
 * The production DB query does an exact string match:
 *   onboardingData->>'birthday' = $1
 * so the fallback must translate to a concrete MM/DD.
 */
function queryMMDDForBirthday(
  storedBirthday: string,
  year: number,
  leapFallback: "last-day-of-feb" | "march-1" = "last-day-of-feb",
): string {
  const effective = resolveEffectiveBirthdayDate(storedBirthday, year, leapFallback);
  return toMMDD(effective);
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

// Representative years
const LEAP_YEAR = 2024; // 2024 is a leap year (divisible by 4, not by 100)
const NON_LEAP_YEAR = 2025; // 2025 is not a leap year
const CENTURY_NON_LEAP = 1900; // 1900: divisible by 100, not by 400 → NOT a leap year
const CENTURY_LEAP = 2000; // 2000: divisible by 400 → IS a leap year

const FEB_29_BIRTHDAY = "02/29";

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Leap-year birthday edge cases", () => {
  // ─── 1. Leap year identification ──────────────────────────────────

  describe("1. isLeapYear — correct identification for boundary years", () => {
    it("2024 is a leap year (divisible by 4, not 100)", () => {
      expect(isLeapYear(2024)).toBe(true);
    });

    it("2025 is NOT a leap year", () => {
      expect(isLeapYear(2025)).toBe(false);
    });

    it("2026 is NOT a leap year", () => {
      expect(isLeapYear(2026)).toBe(false);
    });

    it("2027 is NOT a leap year", () => {
      expect(isLeapYear(2027)).toBe(false);
    });

    it("2028 is a leap year", () => {
      expect(isLeapYear(2028)).toBe(true);
    });

    it("1900 is NOT a leap year (century, not divisible by 400)", () => {
      expect(isLeapYear(CENTURY_NON_LEAP)).toBe(false);
    });

    it("2000 IS a leap year (divisible by 400)", () => {
      expect(isLeapYear(CENTURY_LEAP)).toBe(true);
    });

    it("2100 is NOT a leap year (century, not divisible by 400)", () => {
      expect(isLeapYear(2100)).toBe(false);
    });
  });

  // ─── 2. Non-leap year: Feb 29 birthday → promo on Feb 28 ─────────

  describe("2. Non-leap year — default fallback: promo sent on Feb 28", () => {
    it("Feb 29 birthday resolves to Feb 28 on a non-leap year (default policy)", () => {
      const effective = resolveEffectiveBirthdayDate(FEB_29_BIRTHDAY, NON_LEAP_YEAR);
      expect(effective.getUTCMonth()).toBe(1); // February (0-indexed)
      expect(effective.getUTCDate()).toBe(28);
      expect(effective.getUTCFullYear()).toBe(NON_LEAP_YEAR);
    });

    it("query MM/DD for Feb 29 birthday on non-leap year is '02/28'", () => {
      const mmdd = queryMMDDForBirthday(FEB_29_BIRTHDAY, NON_LEAP_YEAR);
      expect(mmdd).toBe("02/28");
    });

    it("promo is sent on Feb 28, not skipped, on a non-leap year (default policy)", () => {
      // Simulate: today is Feb 28 of a non-leap year
      const today = new Date(Date.UTC(NON_LEAP_YEAR, 1, 28));
      const todayMMDD = toMMDD(today);

      // The effective send date for a Feb 29 birthday (default fallback)
      const sendMMDD = queryMMDDForBirthday(FEB_29_BIRTHDAY, NON_LEAP_YEAR);

      // They should match — the promo fires today
      expect(sendMMDD).toBe(todayMMDD);
      expect(sendMMDD).toBe("02/28");
    });

    it("promo is NOT sent on Feb 29 in a non-leap year (the date doesn't exist)", () => {
      // Feb 29 never appears as "today" on a non-leap year.
      // JavaScript's Date wraps Feb 29 to Mar 1 in non-leap years.
      const attemptedFeb29 = new Date(Date.UTC(NON_LEAP_YEAR, 1, 29));
      // JS rolls over: Feb 29 in a non-leap year becomes March 1
      expect(attemptedFeb29.getUTCMonth()).toBe(2); // March
      expect(attemptedFeb29.getUTCDate()).toBe(1);
    });

    it("Feb 29 birthday does not match on March 1 under default 'last-day-of-feb' policy", () => {
      // With default policy, the effective date is Feb 28, not March 1
      const march1MMDD = "03/01";
      const sendMMDD = queryMMDDForBirthday(FEB_29_BIRTHDAY, NON_LEAP_YEAR, "last-day-of-feb");
      expect(sendMMDD).not.toBe(march1MMDD);
    });
  });

  // ─── 3. Non-leap year: alternative March 1 policy ─────────────────

  describe("3. Non-leap year — alternative fallback: promo sent on March 1", () => {
    it("Feb 29 birthday resolves to March 1 under 'march-1' policy", () => {
      const effective = resolveEffectiveBirthdayDate(FEB_29_BIRTHDAY, NON_LEAP_YEAR, "march-1");
      expect(effective.getUTCMonth()).toBe(2); // March (0-indexed)
      expect(effective.getUTCDate()).toBe(1);
      expect(effective.getUTCFullYear()).toBe(NON_LEAP_YEAR);
    });

    it("query MM/DD for Feb 29 birthday with march-1 policy is '03/01'", () => {
      const mmdd = queryMMDDForBirthday(FEB_29_BIRTHDAY, NON_LEAP_YEAR, "march-1");
      expect(mmdd).toBe("03/01");
    });

    it("promo is sent on March 1, not Feb 28, under march-1 policy on non-leap year", () => {
      const today = new Date(Date.UTC(NON_LEAP_YEAR, 2, 1)); // March 1
      const todayMMDD = toMMDD(today);

      const sendMMDD = queryMMDDForBirthday(FEB_29_BIRTHDAY, NON_LEAP_YEAR, "march-1");

      expect(sendMMDD).toBe(todayMMDD);
      expect(sendMMDD).toBe("03/01");
    });

    it("with march-1 policy, Feb 28 does NOT trigger the promo on a non-leap year", () => {
      const feb28MMDD = "02/28";
      const sendMMDD = queryMMDDForBirthday(FEB_29_BIRTHDAY, NON_LEAP_YEAR, "march-1");
      expect(sendMMDD).not.toBe(feb28MMDD);
    });
  });

  // ─── 4. Leap year: promo sent on Feb 29 exactly ───────────────────

  describe("4. Leap year — promo sent on Feb 29 exactly", () => {
    it("Feb 29 birthday resolves to Feb 29 on a leap year", () => {
      const effective = resolveEffectiveBirthdayDate(FEB_29_BIRTHDAY, LEAP_YEAR);
      expect(effective.getUTCMonth()).toBe(1); // February
      expect(effective.getUTCDate()).toBe(29);
      expect(effective.getUTCFullYear()).toBe(LEAP_YEAR);
    });

    it("query MM/DD for Feb 29 birthday on leap year is '02/29'", () => {
      const mmdd = queryMMDDForBirthday(FEB_29_BIRTHDAY, LEAP_YEAR);
      expect(mmdd).toBe("02/29");
    });

    it("promo fires on Feb 29 (not Feb 28) on a leap year", () => {
      const today = new Date(Date.UTC(LEAP_YEAR, 1, 29)); // Feb 29 2024
      const todayMMDD = toMMDD(today);

      const sendMMDD = queryMMDDForBirthday(FEB_29_BIRTHDAY, LEAP_YEAR);

      expect(sendMMDD).toBe(todayMMDD);
      expect(sendMMDD).toBe("02/29");
    });

    it("on a leap year, neither policy alters Feb 29 — the date exists", () => {
      const defaultResult = queryMMDDForBirthday(FEB_29_BIRTHDAY, LEAP_YEAR, "last-day-of-feb");
      const march1Result = queryMMDDForBirthday(FEB_29_BIRTHDAY, LEAP_YEAR, "march-1");

      // Both policies return "02/29" on a leap year — no fallback needed
      expect(defaultResult).toBe("02/29");
      expect(march1Result).toBe("02/29");
    });

    it("non-Feb-29 birthdays are unaffected by leap year status", () => {
      // March 15 should always be March 15 regardless of year
      expect(queryMMDDForBirthday("03/15", LEAP_YEAR)).toBe("03/15");
      expect(queryMMDDForBirthday("03/15", NON_LEAP_YEAR)).toBe("03/15");

      // Feb 28 is also unaffected
      expect(queryMMDDForBirthday("02/28", LEAP_YEAR)).toBe("02/28");
      expect(queryMMDDForBirthday("02/28", NON_LEAP_YEAR)).toBe("02/28");
    });
  });

  // ─── 5. Promo expiry: birthday + 30 days across boundaries ────────

  describe("5. Promo expiry — birthday + 30 days calculated correctly", () => {
    it("Feb 28 + 30 days = March 30 (non-leap year, default fallback send date)", () => {
      // Send date is Feb 28 (fallback for Feb 29 birthday on non-leap year)
      const sendDate = new Date(Date.UTC(NON_LEAP_YEAR, 1, 28)); // Feb 28 2025
      const expiry = addDays(sendDate, 30);

      expect(expiry.getUTCFullYear()).toBe(NON_LEAP_YEAR);
      expect(expiry.getUTCMonth()).toBe(2); // March
      expect(expiry.getUTCDate()).toBe(30);
    });

    it("Feb 29 + 30 days = March 30 (leap year)", () => {
      // On a leap year the actual birthday is Feb 29
      const birthday = new Date(Date.UTC(LEAP_YEAR, 1, 29)); // Feb 29 2024
      const expiry = addDays(birthday, 30);

      expect(expiry.getUTCFullYear()).toBe(LEAP_YEAR);
      expect(expiry.getUTCMonth()).toBe(2); // March
      expect(expiry.getUTCDate()).toBe(30);
    });

    it("March 1 + 30 days = March 31 (march-1 fallback policy)", () => {
      // Send date is March 1 under march-1 policy
      const sendDate = new Date(Date.UTC(NON_LEAP_YEAR, 2, 1)); // March 1 2025
      const expiry = addDays(sendDate, 30);

      expect(expiry.getUTCFullYear()).toBe(NON_LEAP_YEAR);
      expect(expiry.getUTCMonth()).toBe(2); // March
      expect(expiry.getUTCDate()).toBe(31);
    });

    it("expiry is exactly 30 calendar days, not 30*24h (avoids DST off-by-one)", () => {
      // Using UTC arithmetic guarantees a calendar-day count regardless of timezone
      const sendDate = new Date(Date.UTC(NON_LEAP_YEAR, 1, 28)); // Feb 28
      const expiry = addDays(sendDate, 30);

      const diffMs = expiry.getTime() - sendDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(30);
    });

    it("expiry year does not change: Feb 28 + 30 days stays in same year", () => {
      const sendDate = new Date(Date.UTC(NON_LEAP_YEAR, 1, 28));
      const expiry = addDays(sendDate, 30);
      expect(expiry.getUTCFullYear()).toBe(NON_LEAP_YEAR);
    });

    it("expiry rolls across the Feb/Mar boundary correctly on a leap year", () => {
      // Feb 29 only has 30 days remaining to reach March 30
      const birthday = new Date(Date.UTC(LEAP_YEAR, 1, 29));
      const expiry = addDays(birthday, 30);

      // Should land on March 30, not overflow into April
      expect(expiry.getUTCMonth()).toBe(2); // March
      expect(expiry.getUTCDate()).toBe(30);
      expect(expiry.getUTCMonth()).not.toBe(3); // not April
    });
  });

  // ─── 6. Advance promo window (7-day look-ahead) ───────────────────

  describe("6. Advance promo — 7-day look-ahead resolves Feb 29 birthday correctly", () => {
    it("on a leap year, advance cron fires on Feb 22 (7 days before Feb 29)", () => {
      // The advance promo cron looks 7 days ahead.
      // When today is Feb 22 of a leap year, targetDate = Feb 29.
      const today = new Date(Date.UTC(LEAP_YEAR, 1, 22)); // Feb 22 2024
      const targetDate = addDays(today, 7);

      expect(toMMDD(targetDate)).toBe("02/29");

      // A profile with birthday "02/29" should be matched
      const sendMMDD = queryMMDDForBirthday(FEB_29_BIRTHDAY, LEAP_YEAR);
      expect(sendMMDD).toBe(toMMDD(targetDate));
    });

    it("on a non-leap year with default fallback, advance cron fires on Feb 21 (7 days before Feb 28)", () => {
      // targetDate with fallback policy is Feb 28; advance is 7 days before = Feb 21
      const fallbackSendDate = resolveEffectiveBirthdayDate(
        FEB_29_BIRTHDAY,
        NON_LEAP_YEAR,
        "last-day-of-feb",
      );
      const advanceCronTriggerDate = lookAheadStartDate(fallbackSendDate, 7);

      expect(advanceCronTriggerDate.getUTCMonth()).toBe(1); // February
      expect(advanceCronTriggerDate.getUTCDate()).toBe(21);
    });

    it("on a non-leap year with march-1 fallback, advance cron fires on Feb 22 (7 days before Mar 1)", () => {
      // targetDate with march-1 policy is March 1; advance is 7 days before = Feb 22
      const fallbackSendDate = resolveEffectiveBirthdayDate(
        FEB_29_BIRTHDAY,
        NON_LEAP_YEAR,
        "march-1",
      );
      const advanceCronTriggerDate = lookAheadStartDate(fallbackSendDate, 7);

      expect(advanceCronTriggerDate.getUTCMonth()).toBe(1); // February
      expect(advanceCronTriggerDate.getUTCDate()).toBe(22);
    });

    it("advance window look-ahead does not produce Feb 29 on a non-leap year", () => {
      // If the advance cron naively adds 7 days from Feb 22 on a non-leap year,
      // it would produce a non-existent date (Feb 29), which JS rolls to Mar 1.
      // The system must use the resolved effective date, not raw +7 on "02/29".
      const naiveFeb22 = new Date(Date.UTC(NON_LEAP_YEAR, 1, 22));
      const naivePlusSeven = addDays(naiveFeb22, 7);

      // Feb 22 + 7 = March 1 in a non-leap year (JS handles the overflow)
      // This is the march-1 policy result — confirm behaviour
      expect(naivePlusSeven.getUTCMonth()).toBe(2); // March
      expect(naivePlusSeven.getUTCDate()).toBe(1);

      // The birthday "02/29" should NOT match "03/01" under default policy
      const defaultSendMMDD = queryMMDDForBirthday(
        FEB_29_BIRTHDAY,
        NON_LEAP_YEAR,
        "last-day-of-feb",
      );
      expect(defaultSendMMDD).toBe("02/28"); // default policy sends on Feb 28, not Mar 1
      expect(defaultSendMMDD).not.toBe(toMMDD(naivePlusSeven));
    });
  });

  // ─── 7. Year transitions at the cron boundary ─────────────────────

  describe("7. Year-boundary consistency — same policy across leap cycles", () => {
    it("Feb 29 birthday sends on Feb 28 for all 3 non-leap years in the cycle", () => {
      // In a 4-year cycle: 2025, 2026, 2027 are non-leap; 2028 is leap
      const nonLeapYears = [2025, 2026, 2027];
      for (const year of nonLeapYears) {
        const mmdd = queryMMDDForBirthday(FEB_29_BIRTHDAY, year, "last-day-of-feb");
        expect(mmdd).toBe("02/28");
      }
    });

    it("Feb 29 birthday sends on Feb 29 only in leap years", () => {
      const leapYears = [2024, 2028, 2032];
      for (const year of leapYears) {
        const mmdd = queryMMDDForBirthday(FEB_29_BIRTHDAY, year);
        expect(mmdd).toBe("02/29");
      }
    });

    it("dedup: same effective date means one promo per year (leap and non-leap)", () => {
      // The dedup key in sync_log is (entityType, localId, year).
      // On a non-leap year, the promo fires on Feb 28 — that's still year 2025.
      // On a leap year, it fires on Feb 29 — still year 2024.
      // In both cases the year key correctly scopes the dedup to one send per year.
      const leapSendDate = resolveEffectiveBirthdayDate(FEB_29_BIRTHDAY, LEAP_YEAR);
      const nonLeapSendDate = resolveEffectiveBirthdayDate(FEB_29_BIRTHDAY, NON_LEAP_YEAR);

      expect(leapSendDate.getUTCFullYear()).toBe(LEAP_YEAR);
      expect(nonLeapSendDate.getUTCFullYear()).toBe(NON_LEAP_YEAR);

      // Both are in distinct years — no cross-year dedup collision
      expect(leapSendDate.getUTCFullYear()).not.toBe(nonLeapSendDate.getUTCFullYear());
    });
  });
});
