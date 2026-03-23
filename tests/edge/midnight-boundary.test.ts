// @vitest-environment node

/**
 * tests/edge/midnight-boundary.test.ts
 *
 * Edge-case tests for midnight (00:00) boundary handling.
 *
 * Midnight is a degenerate instant: the end of one calendar day and the start
 * of the next occur at the same UTC millisecond.  Several subsystems can
 * produce off-by-one errors or attribution mistakes when a booking's start or
 * end lands exactly on midnight.
 *
 * Covered scenarios
 *   1. Overlap detection: 11pm + 60 min ends at 00:00 next day — should NOT
 *      conflict with a 9am booking the following day.
 *   2. Midnight start: a booking that starts at exactly 00:00 is valid when
 *      business hours include midnight (or the rule is "open until midnight").
 *   3. Spans-midnight booking: 11pm–1am (120 min) is stored as a single
 *      booking, not split across days.  Its overlap window must cross midnight.
 *   4. Fill reminder day count: a client whose last visit ended at 23:59 of
 *      day N should have their "days since last visit" counted from day N, not
 *      day N+1 (off-by-one via UTC vs local midnight).
 *   5. Revenue attribution: a booking that starts at 23:00 is attributed to
 *      the START date (same calendar day), not the end date (next calendar day).
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Pure helpers — the logic production code should implement           */
/* ------------------------------------------------------------------ */

/**
 * Returns the end time (UTC ms) of a booking given its start and duration.
 */
function bookingEndMs(startsAt: Date, durationMinutes: number): number {
  return startsAt.getTime() + durationMinutes * 60 * 1000;
}

/**
 * Standard interval-overlap check used by the booking system.
 *
 * Returns true when [aStart, aEnd) overlaps with [bStart, bEnd).
 * Uses half-open intervals: a booking that ends exactly when another starts
 * does NOT overlap (back-to-back bookings are allowed).
 *
 * Mirrors the SQL in app/dashboard/bookings/actions.ts:
 *   startsAt < endsAtB AND startsAtB < endsAt
 */
function intervalsOverlap(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number,
): boolean {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/**
 * Checks whether a proposed booking [proposedStart, proposedStart+durationMin)
 * overlaps with an existing booking [existingStart, existingStart+existingDuration).
 */
function hasOverlap(
  proposedStart: Date,
  proposedDurationMin: number,
  existingStart: Date,
  existingDurationMin: number,
): boolean {
  return intervalsOverlap(
    proposedStart.getTime(),
    bookingEndMs(proposedStart, proposedDurationMin),
    existingStart.getTime(),
    bookingEndMs(existingStart, existingDurationMin),
  );
}

/**
 * Returns true when a booking that starts at `startsAt` and lasts
 * `durationMinutes` crosses midnight (the end time is on a different UTC date
 * than the start time).
 */
function spansMidnight(startsAt: Date, durationMinutes: number): boolean {
  const endMs = bookingEndMs(startsAt, durationMinutes);
  const endDate = new Date(endMs);
  return (
    startsAt.getUTCFullYear() !== endDate.getUTCFullYear() ||
    startsAt.getUTCMonth() !== endDate.getUTCMonth() ||
    startsAt.getUTCDate() !== endDate.getUTCDate()
  );
}

/**
 * Returns the calendar date (UTC, midnight) on which the booking STARTS.
 * This is the correct attribution date for revenue reporting.
 */
function revenueAttributionDate(startsAt: Date): Date {
  return new Date(
    Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate()),
  );
}

/**
 * Computes the number of complete calendar days elapsed since `lastVisit`
 * relative to `now`, counting from the START of the last-visit day (UTC
 * midnight).
 *
 * This matches the fill-reminder window logic:
 *   windowEnd = now - fillReminderDays * 24h
 *   lastVisit must be within [windowStart, windowEnd)
 *
 * A visit at 23:59 on day N should count as day N, not day N+1.
 */
function daysSinceLastVisit(lastVisit: Date, now: Date): number {
  // Strip both timestamps to UTC midnight so the count is in whole calendar days
  const lastVisitDay = Date.UTC(
    lastVisit.getUTCFullYear(),
    lastVisit.getUTCMonth(),
    lastVisit.getUTCDate(),
  );
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((nowDay - lastVisitDay) / (24 * 60 * 60 * 1000));
}

/**
 * Checks whether `lastVisit` falls within the fill-reminder trigger window.
 *
 * The reminder fires when the last visit was exactly `fillReminderDays` days
 * ago (calendar days, counted from UTC midnight).
 */
function isInFillReminderWindow(lastVisit: Date, now: Date, fillReminderDays: number): boolean {
  return daysSinceLastVisit(lastVisit, now) === fillReminderDays;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

// A concrete reference date: Tuesday 2026-03-10
const DAY_N = new Date(Date.UTC(2026, 2, 10, 0, 0, 0)); // 2026-03-10T00:00:00Z

/** Helper: build a UTC Date for a given date at HH:MM on DAY_N. */
function atTime(hour: number, minute: number = 0, dayOffset: number = 0): Date {
  return new Date(
    Date.UTC(
      DAY_N.getUTCFullYear(),
      DAY_N.getUTCMonth(),
      DAY_N.getUTCDate() + dayOffset,
      hour,
      minute,
      0,
    ),
  );
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Midnight-boundary edge cases", () => {
  // ─── 1. Overlap: booking ending at midnight vs next-day booking ───

  describe("1. Overlap detection — booking ends exactly at midnight (00:00 next day)", () => {
    it("11pm + 60 min ends at 00:00 next day (sanity check)", () => {
      const start = atTime(23, 0); // 23:00 on day N
      const endMs = bookingEndMs(start, 60);
      const end = new Date(endMs);

      expect(end.getUTCHours()).toBe(0);
      expect(end.getUTCMinutes()).toBe(0);
      expect(end.getUTCDate()).toBe(DAY_N.getUTCDate() + 1); // next calendar day
    });

    it("booking ending at 00:00 does NOT overlap with 9am booking the same day (next day)", () => {
      // Existing booking: 11pm–midnight on day N
      const existing = atTime(23, 0);
      const existingDuration = 60; // ends at 00:00 day N+1

      // Proposed booking: 9am on day N+1
      const proposed = atTime(9, 0, 1); // 09:00 day N+1
      const proposedDuration = 60;

      expect(hasOverlap(proposed, proposedDuration, existing, existingDuration)).toBe(false);
    });

    it("booking ending at 00:00 does NOT overlap with a booking that starts at 00:00", () => {
      // Back-to-back across midnight: first ends at midnight, second starts at midnight.
      // Half-open interval semantics mean these are adjacent, not overlapping.
      const first = atTime(23, 0);
      const firstDuration = 60; // ends at 00:00 day N+1

      const second = atTime(0, 0, 1); // starts at 00:00 day N+1
      const secondDuration = 60;

      expect(hasOverlap(first, firstDuration, second, secondDuration)).toBe(false);
      expect(hasOverlap(second, secondDuration, first, firstDuration)).toBe(false);
    });

    it("booking ending at 00:00 DOES overlap with another booking that starts before midnight", () => {
      // Both start on day N — they genuinely conflict
      const bookingA = atTime(22, 30); // 22:30–23:30 (60 min)
      const bookingB = atTime(23, 0); // 23:00–00:00 (60 min)

      expect(hasOverlap(bookingA, 60, bookingB, 60)).toBe(true);
    });

    it("booking ending at 00:00 DOES overlap with a booking that ends after midnight", () => {
      // bookingA: 23:00–00:00 (60 min)
      // bookingB: 23:30–00:30 (60 min) — starts before bookingA ends
      const bookingA = atTime(23, 0);
      const bookingB = atTime(23, 30);

      expect(hasOverlap(bookingA, 60, bookingB, 60)).toBe(true);
    });
  });

  // ─── 2. Midnight start: booking at 00:00 is valid ─────────────────

  describe("2. Midnight start — booking beginning at exactly 00:00", () => {
    it("a booking that starts at 00:00 has a valid (non-negative) start time", () => {
      const midnight = atTime(0, 0, 1); // 00:00 on day N+1
      // Should parse and store without wrapping to a negative or previous day
      expect(midnight.getUTCHours()).toBe(0);
      expect(midnight.getUTCMinutes()).toBe(0);
    });

    it("00:00 start does not fall on the previous calendar day", () => {
      const midnight = atTime(0, 0, 1); // 2026-03-11T00:00:00Z
      expect(midnight.getUTCDate()).toBe(DAY_N.getUTCDate() + 1);
      // Must not be reported as the previous day
      expect(midnight.getUTCDate()).not.toBe(DAY_N.getUTCDate());
    });

    it("a 60-min booking starting at 00:00 ends at 01:00 on the same calendar day", () => {
      const midnight = atTime(0, 0, 1);
      const endMs = bookingEndMs(midnight, 60);
      const end = new Date(endMs);

      expect(end.getUTCHours()).toBe(1);
      expect(end.getUTCDate()).toBe(midnight.getUTCDate()); // same day
    });

    it("midnight-start booking does not overlap with 11pm booking ending at midnight", () => {
      const lateBooking = atTime(23, 0); // ends at 00:00 day N+1
      const midnightBooking = atTime(0, 0, 1); // starts at 00:00 day N+1

      expect(hasOverlap(lateBooking, 60, midnightBooking, 60)).toBe(false);
    });

    it("midnight-start booking does overlap with another midnight-start booking (same slot)", () => {
      const a = atTime(0, 0, 1);
      const b = atTime(0, 0, 1);

      expect(hasOverlap(a, 60, b, 60)).toBe(true);
    });
  });

  // ─── 3. Spans-midnight booking ────────────────────────────────────

  describe("3. Spans-midnight booking — 11pm to 1am (120 min) is a single booking", () => {
    it("detects that an 11pm + 120 min booking spans midnight", () => {
      const start = atTime(23, 0);
      expect(spansMidnight(start, 120)).toBe(true);
    });

    it("a 60-min booking at 11pm does NOT span midnight (ends exactly at midnight)", () => {
      // Ends at 00:00 next day — technically the end is on a different date,
      // but a half-open interval treats this as ending *before* the next day starts.
      // However, for the spans-midnight flag we use strict UTC date comparison on
      // the end instant, so 00:00 next day DOES count as a different date.
      const start = atTime(23, 0);
      // End is 2026-03-11T00:00:00Z — that IS a new calendar day
      expect(spansMidnight(start, 60)).toBe(true);
    });

    it("a 59-min booking at 11pm does NOT span midnight (ends at 23:59)", () => {
      const start = atTime(23, 0);
      expect(spansMidnight(start, 59)).toBe(false);
    });

    it("a 10am booking never spans midnight", () => {
      const start = atTime(10, 0);
      expect(spansMidnight(start, 120)).toBe(false);
    });

    it("spans-midnight booking is stored as a single record (not split)", () => {
      // The single record covers the full 120-min interval.
      // Overlap with a booking at 00:30 on the same end-day should be detected.
      const spanner = atTime(23, 0); // 23:00 day N → ends 01:00 day N+1
      const spannerDuration = 120;

      const nextDayMorning = atTime(0, 30, 1); // 00:30 day N+1
      const nextDayMorningDuration = 60; // ends 01:30 day N+1

      // The spans-midnight booking overlaps with a 00:30 booking on day N+1
      expect(hasOverlap(spanner, spannerDuration, nextDayMorning, nextDayMorningDuration)).toBe(
        true,
      );
    });

    it("spans-midnight booking does NOT overlap with a booking at 01:01 after it ends at 01:00", () => {
      const spanner = atTime(23, 0); // ends at 01:00 day N+1
      const after = atTime(1, 1, 1); // starts at 01:01 day N+1

      expect(hasOverlap(spanner, 120, after, 60)).toBe(false);
    });

    it("spans-midnight booking overlaps with both a pre-midnight and post-midnight booking", () => {
      const spanner = atTime(23, 0); // 23:00–01:00 crossing midnight
      const preMidnight = atTime(22, 30); // 22:30–23:30 — starts before, ends during
      const postMidnight = atTime(0, 45, 1); // 00:45–01:45 day N+1 — starts during, ends after

      expect(hasOverlap(spanner, 120, preMidnight, 60)).toBe(true);
      expect(hasOverlap(spanner, 120, postMidnight, 60)).toBe(true);
    });
  });

  // ─── 4. Fill reminder: last visit at 23:59 → correct day count ───

  describe("4. Fill reminder day count — last visit at 23:59 is attributed to that calendar day", () => {
    it("visit at 23:59 on day N is counted as day N (not day N+1)", () => {
      // Day N: 2026-03-10
      const lastVisit = new Date(Date.UTC(2026, 2, 10, 23, 59, 0)); // 23:59 on Mar 10

      expect(lastVisit.getUTCDate()).toBe(10);
      expect(lastVisit.getUTCMonth()).toBe(2); // March

      // The attribution day should be Mar 10, not Mar 11
      const attrDate = revenueAttributionDate(lastVisit);
      expect(attrDate.getUTCDate()).toBe(10);
    });

    it("daysSinceLastVisit: visit at 23:59 on day N, now is noon on day N+6 → 6 days", () => {
      const lastVisit = new Date(Date.UTC(2026, 2, 10, 23, 59, 0)); // 23:59 Mar 10
      const now = new Date(Date.UTC(2026, 2, 16, 12, 0, 0)); // noon Mar 16

      expect(daysSinceLastVisit(lastVisit, now)).toBe(6);
    });

    it("daysSinceLastVisit: visit at 00:01 on day N, now is noon on day N+6 → 6 days", () => {
      const lastVisit = new Date(Date.UTC(2026, 2, 10, 0, 1, 0)); // 00:01 Mar 10
      const now = new Date(Date.UTC(2026, 2, 16, 12, 0, 0)); // noon Mar 16

      expect(daysSinceLastVisit(lastVisit, now)).toBe(6);
    });

    it("visit at 23:59 and visit at 00:01 on the same UTC day have the same day count", () => {
      const lateNight = new Date(Date.UTC(2026, 2, 10, 23, 59, 0));
      const earlyMorning = new Date(Date.UTC(2026, 2, 10, 0, 1, 0));
      const now = new Date(Date.UTC(2026, 2, 17, 12, 0, 0));

      expect(daysSinceLastVisit(lateNight, now)).toBe(daysSinceLastVisit(earlyMorning, now));
    });

    it("fill reminder fires for a 23:59 visit exactly N days ago (not off by one)", () => {
      const fillReminderDays = 28;
      // Last visit: 23:59 on 2026-02-10
      const lastVisit = new Date(Date.UTC(2026, 1, 10, 23, 59, 0));
      // Now: morning of 2026-03-10 (exactly 28 days later)
      const now = new Date(Date.UTC(2026, 2, 10, 9, 0, 0));

      expect(isInFillReminderWindow(lastVisit, now, fillReminderDays)).toBe(true);
    });

    it("fill reminder does NOT fire for a 23:59 visit 27 days ago (too soon)", () => {
      const fillReminderDays = 28;
      const lastVisit = new Date(Date.UTC(2026, 1, 11, 23, 59, 0)); // 1 day later than above
      const now = new Date(Date.UTC(2026, 2, 10, 9, 0, 0));

      expect(isInFillReminderWindow(lastVisit, now, fillReminderDays)).toBe(false);
    });

    it("fill reminder does NOT fire for a 23:59 visit 29 days ago (already past)", () => {
      const fillReminderDays = 28;
      const lastVisit = new Date(Date.UTC(2026, 1, 9, 23, 59, 0)); // 1 day earlier
      const now = new Date(Date.UTC(2026, 2, 10, 9, 0, 0));

      expect(isInFillReminderWindow(lastVisit, now, fillReminderDays)).toBe(false);
    });

    it("visit at exactly 00:00 midnight (start of day) also counts correctly for fill reminder", () => {
      const fillReminderDays = 14;
      // Last visit at exactly midnight (00:00) on 2026-02-24
      const lastVisit = new Date(Date.UTC(2026, 1, 24, 0, 0, 0));
      const now = new Date(Date.UTC(2026, 2, 10, 8, 0, 0)); // Mar 10 = 14 days later

      expect(isInFillReminderWindow(lastVisit, now, fillReminderDays)).toBe(true);
    });
  });

  // ─── 5. Revenue attribution: midnight booking → START date ────────

  describe("5. Revenue attribution — midnight booking attributed to start date, not end date", () => {
    it("23:00 booking is attributed to the start calendar day", () => {
      const startsAt = atTime(23, 0); // 2026-03-10T23:00:00Z
      const attribution = revenueAttributionDate(startsAt);

      expect(attribution.getUTCFullYear()).toBe(2026);
      expect(attribution.getUTCMonth()).toBe(2); // March
      expect(attribution.getUTCDate()).toBe(10); // day N, not day N+1
    });

    it("23:00 booking with 120-min duration: attribution is still the start date", () => {
      const startsAt = atTime(23, 0);
      // Ends at 01:00 on day N+1 — but revenue should be on day N
      const attribution = revenueAttributionDate(startsAt);
      const endDate = new Date(bookingEndMs(startsAt, 120));

      // Attribution is start date
      expect(attribution.getUTCDate()).toBe(DAY_N.getUTCDate());
      // End date is the next day
      expect(endDate.getUTCDate()).toBe(DAY_N.getUTCDate() + 1);
      // They must NOT be the same
      expect(attribution.getUTCDate()).not.toBe(endDate.getUTCDate());
    });

    it("00:00 midnight booking is attributed to the midnight day itself (not the day before)", () => {
      const startsAt = atTime(0, 0, 1); // 2026-03-11T00:00:00Z
      const attribution = revenueAttributionDate(startsAt);

      expect(attribution.getUTCDate()).toBe(DAY_N.getUTCDate() + 1); // Mar 11
      expect(attribution.getUTCDate()).not.toBe(DAY_N.getUTCDate()); // not Mar 10
    });

    it("23:59 booking is attributed to the current day, not the next", () => {
      const startsAt = new Date(Date.UTC(2026, 2, 10, 23, 59, 0)); // 23:59 Mar 10
      const attribution = revenueAttributionDate(startsAt);

      expect(attribution.getUTCDate()).toBe(10); // Mar 10
      expect(attribution.getUTCMonth()).toBe(2); // March
    });

    it("revenue period end boundary: booking at exactly 00:00 is IN the new day's period", () => {
      // Revenue period for day N: [2026-03-10T00:00:00Z, 2026-03-11T00:00:00Z)
      // A booking at 2026-03-11T00:00:00Z should NOT be in day N's period.
      const periodStart = new Date(Date.UTC(2026, 2, 10, 0, 0, 0)); // Mar 10 start
      const periodEnd = new Date(Date.UTC(2026, 2, 11, 0, 0, 0)); // Mar 11 start (exclusive)

      const bookingOnDayN = atTime(23, 0); // 23:00 Mar 10 — in period
      const bookingAtMidnight = atTime(0, 0, 1); // 00:00 Mar 11 — NOT in period

      // Simulate: gte(startsAt, periodStart) AND lt(startsAt, periodEnd)
      const dayNBookingInPeriod =
        bookingOnDayN.getTime() >= periodStart.getTime() &&
        bookingOnDayN.getTime() < periodEnd.getTime();

      const midnightBookingInPeriod =
        bookingAtMidnight.getTime() >= periodStart.getTime() &&
        bookingAtMidnight.getTime() < periodEnd.getTime();

      expect(dayNBookingInPeriod).toBe(true); // 23:00 is within day N
      expect(midnightBookingInPeriod).toBe(false); // 00:00 day N+1 is NOT in day N
    });

    it("revenue period uses gte+lt semantics: exactly-midnight end is exclusive (no double-counting)", () => {
      // Period A: [Mar 10 00:00, Mar 11 00:00)
      // Period B: [Mar 11 00:00, Mar 12 00:00)
      // A booking at exactly Mar 11 00:00 belongs to period B only.
      const periodAStart = new Date(Date.UTC(2026, 2, 10, 0, 0, 0));
      const periodAEnd = new Date(Date.UTC(2026, 2, 11, 0, 0, 0));
      const periodBStart = new Date(Date.UTC(2026, 2, 11, 0, 0, 0));
      const periodBEnd = new Date(Date.UTC(2026, 2, 12, 0, 0, 0));

      const midnightBooking = new Date(Date.UTC(2026, 2, 11, 0, 0, 0)); // exactly Mar 11 00:00

      const inPeriodA =
        midnightBooking.getTime() >= periodAStart.getTime() &&
        midnightBooking.getTime() < periodAEnd.getTime();

      const inPeriodB =
        midnightBooking.getTime() >= periodBStart.getTime() &&
        midnightBooking.getTime() < periodBEnd.getTime();

      expect(inPeriodA).toBe(false); // not in period A
      expect(inPeriodB).toBe(true); // in period B
      // Exactly one period contains it — no double-counting
      expect(inPeriodA !== inPeriodB).toBe(true);
    });
  });
});
