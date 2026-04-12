// @vitest-environment node

/**
 * tests/edge/multi-location-conflicts.test.ts
 *
 * Edge-case tests for multi-location booking conflicts.
 *
 * A staff member can only be at one location at a time. When a booking is
 * requested at Location B, the system must check whether the staff member
 * already has a booking at Location A (or any other location) that overlaps
 * with the requested time — including travel/buffer time between locations.
 *
 * The production overlap check considers:
 *   - Same staff at different locations at overlapping times → REJECTED
 *   - Different staff at overlapping times → ACCEPTED (no conflict)
 *   - Buffer time between locations for travel → extends the conflict window
 *
 * Covered scenarios
 *   1. Same staff booked at Location A at 2pm → Location B at 2pm REJECTED
 *   2. Different staff at Location B at 2pm → ACCEPTED
 *   3. Staff booking ending at 2pm → Location B at 2pm with 15-min buffer REJECTED
 *   4. Staff booking ending at 2pm → Location B at 2:15pm with 15-min buffer ACCEPTED
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Types                                                                */
/* ------------------------------------------------------------------ */

interface Booking {
  staffId: string;
  locationId: string;
  /** Start time as epoch ms */
  startMs: number;
  /** End time as epoch ms */
  endMs: number;
}

interface BookingRequest {
  staffId: string;
  locationId: string;
  startMs: number;
  endMs: number;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers — the logic production code should implement           */
/* ------------------------------------------------------------------ */

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/**
 * Checks whether two time ranges overlap.
 *
 * Two ranges [s1, e1) and [s2, e2) overlap iff s1 < e2 AND s2 < e1.
 */
function rangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number,
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Returns whether a booking request conflicts with an existing booking
 * for the same staff member. When the request is at a different location,
 * a travel buffer is added to the existing booking's end time.
 *
 * Production logic (booking-actions.ts):
 *   If same staff and overlapping (with buffer for cross-location) → conflict.
 */
function hasConflict(
  existing: Booking,
  request: BookingRequest,
  bufferMs: number = 0,
): boolean {
  // Different staff → no conflict
  if (existing.staffId !== request.staffId) return false;

  // Same location → simple overlap check, no buffer needed
  const effectiveEnd =
    existing.locationId !== request.locationId
      ? existing.endMs + bufferMs
      : existing.endMs;

  return rangesOverlap(existing.startMs, effectiveEnd, request.startMs, request.endMs);
}

/**
 * Checks a booking request against all existing bookings.
 * Returns the first conflicting booking, or null if no conflict.
 */
function findConflict(
  existingBookings: Booking[],
  request: BookingRequest,
  bufferMs: number = 0,
): Booking | null {
  return existingBookings.find((b) => hasConflict(b, request, bufferMs)) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

/** Creates a date at a specific hour and minute on a fixed day. */
function timeAt(hour: number, minute: number = 0): number {
  return new Date(2026, 3, 15, hour, minute).getTime(); // Apr 15, 2026
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Multi-location booking conflicts", () => {
  const STAFF_ALICE = "staff-alice";
  const STAFF_BOB = "staff-bob";
  const LOC_A = "location-a";
  const LOC_B = "location-b";

  // ─── 1. Same staff, same time, different locations → REJECTED ────

  describe("1. Staff booked at Location A at 2pm → Location B at 2pm REJECTED", () => {
    const existingBooking: Booking = {
      staffId: STAFF_ALICE,
      locationId: LOC_A,
      startMs: timeAt(14, 0), // 2:00 PM
      endMs: timeAt(15, 0), // 3:00 PM
    };

    it("booking at Location B at 2pm for the same staff is rejected", () => {
      const request: BookingRequest = {
        staffId: STAFF_ALICE,
        locationId: LOC_B,
        startMs: timeAt(14, 0),
        endMs: timeAt(15, 0),
      };

      const conflict = findConflict([existingBooking], request);
      expect(conflict).not.toBeNull();
    });

    it("partial overlap (2:30pm start) at Location B is also rejected", () => {
      const request: BookingRequest = {
        staffId: STAFF_ALICE,
        locationId: LOC_B,
        startMs: timeAt(14, 30),
        endMs: timeAt(15, 30),
      };

      const conflict = findConflict([existingBooking], request);
      expect(conflict).not.toBeNull();
    });

    it("booking at Location B starting exactly when Location A ends (3pm) is accepted", () => {
      const request: BookingRequest = {
        staffId: STAFF_ALICE,
        locationId: LOC_B,
        startMs: timeAt(15, 0), // starts exactly at existing end
        endMs: timeAt(16, 0),
      };

      // No buffer → adjacent is fine
      const conflict = findConflict([existingBooking], request, 0);
      expect(conflict).toBeNull();
    });
  });

  // ─── 2. Different staff, same time → ACCEPTED ───────────────────

  describe("2. Different staff at Location B at 2pm → ACCEPTED", () => {
    const existingBooking: Booking = {
      staffId: STAFF_ALICE,
      locationId: LOC_A,
      startMs: timeAt(14, 0),
      endMs: timeAt(15, 0),
    };

    it("different staff member at Location B at the same time is accepted", () => {
      const request: BookingRequest = {
        staffId: STAFF_BOB,
        locationId: LOC_B,
        startMs: timeAt(14, 0),
        endMs: timeAt(15, 0),
      };

      const conflict = findConflict([existingBooking], request);
      expect(conflict).toBeNull();
    });

    it("different staff at the same location at the same time is also accepted", () => {
      const request: BookingRequest = {
        staffId: STAFF_BOB,
        locationId: LOC_A, // same location, different staff
        startMs: timeAt(14, 0),
        endMs: timeAt(15, 0),
      };

      const conflict = findConflict([existingBooking], request);
      expect(conflict).toBeNull();
    });

    it("multiple staff can be booked at different locations simultaneously", () => {
      const existing: Booking[] = [
        { staffId: STAFF_ALICE, locationId: LOC_A, startMs: timeAt(14, 0), endMs: timeAt(15, 0) },
        { staffId: STAFF_BOB, locationId: LOC_B, startMs: timeAt(14, 0), endMs: timeAt(15, 0) },
      ];

      const request: BookingRequest = {
        staffId: "staff-charlie",
        locationId: LOC_A,
        startMs: timeAt(14, 0),
        endMs: timeAt(15, 0),
      };

      const conflict = findConflict(existing, request);
      expect(conflict).toBeNull();
    });
  });

  // ─── 3. Buffer: ends 2pm, Location B at 2pm, 15-min buffer → REJECTED

  describe("3. Staff booking ending 2pm → Location B at 2pm with 15-min buffer REJECTED", () => {
    const existingBooking: Booking = {
      staffId: STAFF_ALICE,
      locationId: LOC_A,
      startMs: timeAt(13, 0), // 1:00 PM
      endMs: timeAt(14, 0), // 2:00 PM
    };

    it("Location B at 2pm with 15-min travel buffer is rejected", () => {
      const request: BookingRequest = {
        staffId: STAFF_ALICE,
        locationId: LOC_B,
        startMs: timeAt(14, 0), // exactly at existing end
        endMs: timeAt(15, 0),
      };

      // With 15-min buffer, the existing booking's effective end becomes 2:15pm
      // so 2:00pm start overlaps with [1:00pm, 2:15pm)
      const conflict = findConflict([existingBooking], request, FIFTEEN_MIN_MS);
      expect(conflict).not.toBeNull();
    });

    it("Location B at 2:10pm with 15-min buffer is still rejected (within buffer)", () => {
      const request: BookingRequest = {
        staffId: STAFF_ALICE,
        locationId: LOC_B,
        startMs: timeAt(14, 10),
        endMs: timeAt(15, 10),
      };

      const conflict = findConflict([existingBooking], request, FIFTEEN_MIN_MS);
      expect(conflict).not.toBeNull();
    });

    it("same location at 2pm with 15-min buffer is accepted (no travel needed)", () => {
      const request: BookingRequest = {
        staffId: STAFF_ALICE,
        locationId: LOC_A, // same location — buffer not applied
        startMs: timeAt(14, 0),
        endMs: timeAt(15, 0),
      };

      const conflict = findConflict([existingBooking], request, FIFTEEN_MIN_MS);
      expect(conflict).toBeNull();
    });
  });

  // ─── 4. Buffer: ends 2pm, Location B at 2:15pm, 15-min buffer → ACCEPTED

  describe("4. Staff booking ending 2pm → Location B at 2:15pm with 15-min buffer ACCEPTED", () => {
    const existingBooking: Booking = {
      staffId: STAFF_ALICE,
      locationId: LOC_A,
      startMs: timeAt(13, 0),
      endMs: timeAt(14, 0),
    };

    it("Location B at 2:15pm with 15-min buffer is accepted (exactly at buffer boundary)", () => {
      const request: BookingRequest = {
        staffId: STAFF_ALICE,
        locationId: LOC_B,
        startMs: timeAt(14, 15), // existing end (2pm) + 15min buffer = 2:15pm
        endMs: timeAt(15, 15),
      };

      // Effective end = 2:15pm, request starts at 2:15pm → no overlap ([start, end) is half-open)
      const conflict = findConflict([existingBooking], request, FIFTEEN_MIN_MS);
      expect(conflict).toBeNull();
    });

    it("Location B at 2:30pm with 15-min buffer is accepted (well past buffer)", () => {
      const request: BookingRequest = {
        staffId: STAFF_ALICE,
        locationId: LOC_B,
        startMs: timeAt(14, 30),
        endMs: timeAt(15, 30),
      };

      const conflict = findConflict([existingBooking], request, FIFTEEN_MIN_MS);
      expect(conflict).toBeNull();
    });

    it("buffer is directional — only extends forward from the existing booking's end", () => {
      // Booking at Location B ending 1pm, request at Location A starting 1pm
      const earlyBooking: Booking = {
        staffId: STAFF_ALICE,
        locationId: LOC_B,
        startMs: timeAt(12, 0),
        endMs: timeAt(13, 0), // ends 1pm
      };

      const request: BookingRequest = {
        staffId: STAFF_ALICE,
        locationId: LOC_A,
        startMs: timeAt(13, 15), // 1:15pm, exactly at buffer boundary
        endMs: timeAt(14, 15),
      };

      const conflict = findConflict([earlyBooking], request, FIFTEEN_MIN_MS);
      expect(conflict).toBeNull();
    });
  });
});
