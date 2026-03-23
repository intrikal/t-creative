// @vitest-environment node

/**
 * tests/edge/overlap-buffer.test.ts
 *
 * Edge-case tests for the per-staff booking buffer enforcement.
 *
 * The booking system stores a `bufferMinutes` setting (default: 15) in
 * BookingRulesConfig.  The buffer is the required gap between consecutive
 * appointments for the same staff member — cleaning time, transition time,
 * or just breathing room.
 *
 * The current `hasOverlappingBooking()` implementation in
 * app/dashboard/bookings/actions.ts performs a raw interval-overlap check
 * and does NOT yet apply the buffer.  These tests document the CONTRACT
 * that the buffer-aware overlap check must satisfy.
 *
 * The buffer is modelled by expanding the "effective end" of an existing
 * booking before the overlap test:
 *   effectiveEnd = startsAt + durationMinutes + bufferMinutes
 *
 * A proposed booking is rejected when:
 *   proposedStart < effectiveEnd  AND  existingStart < proposedEnd
 *
 * Covered scenarios
 *   1. Buffer = 15 min: booking ending at 2pm blocks the 2pm slot; 2:15pm is
 *      the earliest accepted start.
 *   2. Booking at exactly 2:15pm is accepted (buffer satisfied exactly).
 *   3. Buffer = 0: back-to-back bookings are allowed (2pm end, 2pm start).
 *   4. Multi-service 90-min combo ending at 3pm + 15-min buffer: next
 *      available is 3:15pm, not 3pm.
 *   5. Different staff members: buffer applies per-staff, not globally.
 *      Staff A's buffer does not block Staff B's slots.
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface Booking {
  staffId: string;
  startsAtMs: number; // UTC milliseconds
  durationMinutes: number;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers — the logic the production code should implement       */
/* ------------------------------------------------------------------ */

/** Returns the UTC ms at which a booking ends (exclusive). */
function bookingEndMs(b: Booking): number {
  return b.startsAtMs + b.durationMinutes * 60_000;
}

/**
 * Returns the UTC ms at which the buffer zone following a booking ends.
 * A new booking must start at or after this instant.
 *
 * Production equivalent: the expanded "effective end" used in the
 * buffer-aware overlap check.
 */
function effectiveEndMs(b: Booking, bufferMinutes: number): number {
  return bookingEndMs(b) + bufferMinutes * 60_000;
}

/**
 * Buffer-aware overlap check.
 *
 * Returns true when `proposed` conflicts with `existing` given `bufferMinutes`
 * of required gap AFTER `existing`.
 *
 * The standard interval overlap test is run against the *effective* end of
 * `existing` (booking end + buffer) rather than the raw end:
 *   proposed.start < effectiveEnd(existing)  AND  existing.start < proposed.end
 *
 * Note: the buffer is one-directional — it extends the end of `existing`,
 * not the start.  A booking inserted BEFORE `existing` only needs the
 * standard overlap check (the buffer after the new booking will be
 * validated when that booking becomes the "existing" one).
 */
function hasConflict(existing: Booking, proposed: Booking, bufferMinutes: number): boolean {
  if (existing.staffId !== proposed.staffId) return false;

  const existingEffectiveEnd = effectiveEndMs(existing, bufferMinutes);
  const proposedEnd = bookingEndMs(proposed);

  return proposed.startsAtMs < existingEffectiveEnd && existing.startsAtMs < proposedEnd;
}

/**
 * Returns the earliest UTC ms at which a new booking of `durationMinutes`
 * can start for the same staff member, given the list of existing bookings
 * and the required buffer.
 *
 * Scans all existing bookings for the same staff member and returns the
 * maximum of all effective-end timestamps that fall after `notBefore`.
 */
function earliestAvailableMs(
  existing: Booking[],
  staffId: string,
  durationMinutes: number,
  bufferMinutes: number,
  notBefore: number = 0,
): number {
  let earliest = notBefore;

  for (const b of existing) {
    if (b.staffId !== staffId) continue;
    const effEnd = effectiveEndMs(b, bufferMinutes);
    if (effEnd > earliest) earliest = effEnd;
  }

  return earliest;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const STAFF_A = "staff-a";
const STAFF_B = "staff-b";

/** 2pm UTC on a fixed reference date. */
const TWO_PM = new Date("2026-04-01T14:00:00.000Z").getTime();
/** 1 minute in milliseconds. */
const MIN = 60_000;

/** Builds a booking starting at `startMs` for `staffId`. */
function booking(staffId: string, startMs: number, durationMinutes: number): Booking {
  return { staffId, startsAtMs: startMs, durationMinutes };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Overlap buffer edge cases", () => {
  // ─── 1. Buffer = 15 min: 2pm end blocks 2pm slot ──────────────────

  describe("1. Buffer = 15 min — booking ending at 2pm rejects a 2pm start", () => {
    const BUFFER = 15;
    // Existing booking: 1pm–2pm (60 min)
    const existing = booking(STAFF_A, TWO_PM - 60 * MIN, 60);

    it("existing booking ends at exactly 2pm (sanity check)", () => {
      expect(bookingEndMs(existing)).toBe(TWO_PM);
    });

    it("effective end with 15-min buffer is 2:15pm", () => {
      expect(effectiveEndMs(existing, BUFFER)).toBe(TWO_PM + 15 * MIN);
    });

    it("proposed booking at 2:00pm is rejected (inside buffer zone)", () => {
      const proposed = booking(STAFF_A, TWO_PM, 60);
      expect(hasConflict(existing, proposed, BUFFER)).toBe(true);
    });

    it("proposed booking at 2:05pm is rejected (still inside buffer zone)", () => {
      const proposed = booking(STAFF_A, TWO_PM + 5 * MIN, 60);
      expect(hasConflict(existing, proposed, BUFFER)).toBe(true);
    });

    it("proposed booking at 2:14pm is rejected (1 min inside buffer zone)", () => {
      const proposed = booking(STAFF_A, TWO_PM + 14 * MIN, 60);
      expect(hasConflict(existing, proposed, BUFFER)).toBe(true);
    });

    it("proposed booking at 1:30pm is rejected (overlaps before end, no buffer needed)", () => {
      // Starts before existing ends — raw overlap, not even buffer-related
      const proposed = booking(STAFF_A, TWO_PM - 30 * MIN, 60);
      expect(hasConflict(existing, proposed, BUFFER)).toBe(true);
    });
  });

  // ─── 2. Booking at exactly 2:15pm is accepted ─────────────────────

  describe("2. Buffer = 15 min — booking at exactly 2:15pm is accepted", () => {
    const BUFFER = 15;
    const existing = booking(STAFF_A, TWO_PM - 60 * MIN, 60); // 1pm–2pm

    it("proposed booking at exactly 2:15pm is accepted (buffer satisfied exactly)", () => {
      const proposed = booking(STAFF_A, TWO_PM + 15 * MIN, 60);
      expect(hasConflict(existing, proposed, BUFFER)).toBe(false);
    });

    it("proposed booking at 2:16pm is also accepted (past buffer)", () => {
      const proposed = booking(STAFF_A, TWO_PM + 16 * MIN, 60);
      expect(hasConflict(existing, proposed, BUFFER)).toBe(false);
    });

    it("proposed booking at 3pm is accepted (well past buffer)", () => {
      const proposed = booking(STAFF_A, TWO_PM + 60 * MIN, 60);
      expect(hasConflict(existing, proposed, BUFFER)).toBe(false);
    });

    it("earliestAvailableMs returns 2:15pm when buffer is 15 min", () => {
      const earliest = earliestAvailableMs([existing], STAFF_A, 60, BUFFER, TWO_PM - 60 * MIN);
      expect(earliest).toBe(TWO_PM + 15 * MIN);
    });
  });

  // ─── 3. Buffer = 0: back-to-back bookings allowed ─────────────────

  describe("3. Buffer = 0 — back-to-back bookings are allowed", () => {
    const BUFFER = 0;
    const existing = booking(STAFF_A, TWO_PM - 60 * MIN, 60); // 1pm–2pm

    it("with buffer=0, effective end equals booking end (2pm)", () => {
      expect(effectiveEndMs(existing, BUFFER)).toBe(TWO_PM);
    });

    it("proposed booking at exactly 2pm is accepted when buffer=0", () => {
      const proposed = booking(STAFF_A, TWO_PM, 60);
      expect(hasConflict(existing, proposed, BUFFER)).toBe(false);
    });

    it("proposed booking at 1:59pm is still rejected when buffer=0 (direct overlap)", () => {
      const proposed = booking(STAFF_A, TWO_PM - 1 * MIN, 60);
      expect(hasConflict(existing, proposed, BUFFER)).toBe(true);
    });

    it("earliestAvailableMs with buffer=0 returns the booking end time (2pm)", () => {
      const earliest = earliestAvailableMs([existing], STAFF_A, 60, BUFFER);
      expect(earliest).toBe(TWO_PM);
    });

    it("multiple back-to-back bookings with buffer=0 are all compatible", () => {
      const b1 = booking(STAFF_A, TWO_PM, 60); // 2pm–3pm
      const b2 = booking(STAFF_A, TWO_PM + 60 * MIN, 60); // 3pm–4pm
      const b3 = booking(STAFF_A, TWO_PM + 120 * MIN, 60); // 4pm–5pm

      expect(hasConflict(b1, b2, BUFFER)).toBe(false);
      expect(hasConflict(b2, b3, BUFFER)).toBe(false);
      expect(hasConflict(b1, b3, BUFFER)).toBe(false);
    });
  });

  // ─── 4. Multi-service 90-min combo + 15-min buffer ────────────────

  describe("4. Multi-service combo — 90-min booking ending at 3pm + 15-min buffer = 3:15pm earliest", () => {
    const BUFFER = 15;
    const THREE_PM = TWO_PM + 60 * MIN; // 3pm UTC
    // Combo booking: 1:30pm–3pm (90 min)
    const combo = booking(STAFF_A, THREE_PM - 90 * MIN, 90);

    it("combo booking lasts 90 min and ends at 3pm (sanity check)", () => {
      expect(bookingEndMs(combo)).toBe(THREE_PM);
    });

    it("effective end of 90-min combo with 15-min buffer is 3:15pm", () => {
      expect(effectiveEndMs(combo, BUFFER)).toBe(THREE_PM + 15 * MIN);
    });

    it("proposed booking at 3pm is rejected (inside combo buffer)", () => {
      const proposed = booking(STAFF_A, THREE_PM, 60);
      expect(hasConflict(combo, proposed, BUFFER)).toBe(true);
    });

    it("proposed booking at 3:10pm is rejected (still inside 15-min buffer)", () => {
      const proposed = booking(STAFF_A, THREE_PM + 10 * MIN, 60);
      expect(hasConflict(combo, proposed, BUFFER)).toBe(true);
    });

    it("proposed booking at 3:15pm is accepted (buffer satisfied exactly)", () => {
      const proposed = booking(STAFF_A, THREE_PM + 15 * MIN, 60);
      expect(hasConflict(combo, proposed, BUFFER)).toBe(false);
    });

    it("earliestAvailableMs after a 90-min combo is 3:15pm", () => {
      const earliest = earliestAvailableMs([combo], STAFF_A, 60, BUFFER);
      expect(earliest).toBe(THREE_PM + 15 * MIN);
    });

    it("a second combo back-to-back with the same buffer: first 90-min ends 3pm, next starts 3:15pm", () => {
      const nextStart = effectiveEndMs(combo, BUFFER); // 3:15pm
      const secondCombo = booking(STAFF_A, nextStart, 90);
      // The second combo should not conflict with the first
      expect(hasConflict(combo, secondCombo, BUFFER)).toBe(false);
    });
  });

  // ─── 5. Different staff: buffer is per-staff, not global ──────────

  describe("5. Per-staff buffer — Staff A's buffer does not affect Staff B's slots", () => {
    const BUFFER = 15;
    // Staff A has a booking 1pm–2pm
    const staffABooking = booking(STAFF_A, TWO_PM - 60 * MIN, 60);

    it("Staff B can start at exactly 2pm despite Staff A's 15-min buffer", () => {
      const staffBProposed = booking(STAFF_B, TWO_PM, 60);
      expect(hasConflict(staffABooking, staffBProposed, BUFFER)).toBe(false);
    });

    it("Staff B can start at 2:05pm (inside Staff A's buffer zone) without conflict", () => {
      const staffBProposed = booking(STAFF_B, TWO_PM + 5 * MIN, 60);
      expect(hasConflict(staffABooking, staffBProposed, BUFFER)).toBe(false);
    });

    it("Staff A is still blocked at 2:05pm (their own buffer applies)", () => {
      const staffAProposed = booking(STAFF_A, TWO_PM + 5 * MIN, 60);
      expect(hasConflict(staffABooking, staffAProposed, BUFFER)).toBe(true);
    });

    it("earliestAvailableMs for Staff B is unaffected by Staff A's bookings", () => {
      const earliest = earliestAvailableMs([staffABooking], STAFF_B, 60, BUFFER);
      // Staff A's bookings don't push Staff B's availability
      expect(earliest).toBe(0); // no constraint from Staff B's own bookings
    });

    it("earliestAvailableMs for Staff A accounts for buffer, Staff B does not", () => {
      const bookings = [
        booking(STAFF_A, TWO_PM - 60 * MIN, 60), // Staff A: 1pm–2pm
        booking(STAFF_B, TWO_PM - 30 * MIN, 30), // Staff B: 1:30pm–2pm
      ];

      const staffAEarliest = earliestAvailableMs(bookings, STAFF_A, 60, BUFFER);
      const staffBEarliest = earliestAvailableMs(bookings, STAFF_B, 60, BUFFER);

      // Staff A: 1pm–2pm + 15min buffer → 2:15pm
      expect(staffAEarliest).toBe(TWO_PM + 15 * MIN);
      // Staff B: 1:30pm–2pm + 15min buffer → 2:15pm
      expect(staffBEarliest).toBe(TWO_PM + 15 * MIN);
      // They're independent — neither affects the other
    });

    it("two staff members can have overlapping buffer zones without conflict", () => {
      // Staff A: 2pm–3pm; Staff B: 2pm–3pm — same slot, different staff, no conflict
      const bA = booking(STAFF_A, TWO_PM, 60);
      const bB = booking(STAFF_B, TWO_PM, 60);
      expect(hasConflict(bA, bB, BUFFER)).toBe(false);
      expect(hasConflict(bB, bA, BUFFER)).toBe(false);
    });
  });
});
