// @vitest-environment node

/**
 * tests/edge/concurrent-booking.test.ts
 *
 * Edge-case tests for concurrent booking creation serialization.
 *
 * When two clients (or the same client in two tabs) attempt to book the same
 * staff member at the same time, the system must ensure only one booking
 * succeeds. The production code uses pg_advisory_xact_lock(staffId) inside
 * a transaction to serialise booking creation per-staff.
 *
 * Because these are unit-level tests against pure helpers (not integration
 * tests against a real DB), the advisory lock is simulated with an in-memory
 * per-staff mutex — the same serialisation guarantee that
 * pg_advisory_xact_lock provides.
 *
 * Covered scenarios
 *   1. Two createBooking calls for the same staff + time → only one succeeds
 *   2. Two createBooking calls for different staff + same time → both succeed
 *   3. Two createBooking calls for same staff + adjacent times with buffer →
 *      one succeeds, other gets overlap error if within buffer
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  In-memory booking store + per-staff advisory lock                   */
/* ------------------------------------------------------------------ */

interface Booking {
  id: string;
  staffId: string;
  startMs: number;
  endMs: number;
}

/**
 * A simple async mutex — only one holder at a time.
 * Models the serialisation guarantee of pg_advisory_xact_lock(staffId).
 */
class Mutex {
  private _queue: Array<() => void> = [];
  private _locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (!this._locked) {
          this._locked = true;
          resolve(() => {
            this._locked = false;
            const next = this._queue.shift();
            if (next) next();
          });
        } else {
          this._queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
}

/**
 * In-memory booking store with per-staff advisory locks.
 * Mirrors the pg_advisory_xact_lock-based serialisation in production.
 */
function createBookingStore(bufferMs: number = 0) {
  const bookings: Booking[] = [];
  const locks = new Map<string, Mutex>();
  let nextId = 1;

  function getLock(staffId: string): Mutex {
    let mutex = locks.get(staffId);
    if (!mutex) {
      mutex = new Mutex();
      locks.set(staffId, mutex);
    }
    return mutex;
  }

  /**
   * Checks whether a new booking overlaps any existing booking for the
   * same staff, considering an optional buffer between bookings.
   */
  function hasOverlap(staffId: string, startMs: number, endMs: number): boolean {
    return bookings.some((b) => {
      if (b.staffId !== staffId) return false;
      const effectiveEnd = b.endMs + bufferMs;
      const effectiveStart = b.startMs - bufferMs;
      return startMs < effectiveEnd && endMs > effectiveStart;
    });
  }

  /**
   * Creates a booking inside a per-staff advisory lock.
   * Throws if the time slot overlaps with an existing booking.
   */
  async function createBooking(
    staffId: string,
    startMs: number,
    endMs: number,
  ): Promise<Booking> {
    const mutex = getLock(staffId);
    const release = await mutex.acquire();
    try {
      if (hasOverlap(staffId, startMs, endMs)) {
        throw new Error("Time slot overlaps with an existing booking");
      }
      const booking: Booking = {
        id: `booking-${nextId++}`,
        staffId,
        startMs,
        endMs,
      };
      bookings.push(booking);
      return booking;
    } finally {
      release();
    }
  }

  return { bookings, createBooking };
}

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

function timeAt(hour: number, minute: number = 0): number {
  return new Date(2026, 3, 15, hour, minute).getTime();
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Concurrent booking creation serialization", () => {
  // ─── 1. Same staff + same time → only one succeeds ──────────────

  describe("1. Two createBooking calls for same staff + time → one succeeds, one gets overlap error", () => {
    it("exactly one of the two concurrent bookings succeeds", async () => {
      const store = createBookingStore();

      const results = await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });

    it("the failing booking gets an overlap error", async () => {
      const store = createBookingStore();

      const results = await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
      ]);

      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason.message).toBe("Time slot overlaps with an existing booking");
    });

    it("only one booking is persisted in the store", async () => {
      const store = createBookingStore();

      await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
      ]);

      const staffBookings = store.bookings.filter((b) => b.staffId === "staff-1");
      expect(staffBookings).toHaveLength(1);
    });

    it("partial overlap also causes rejection (2:30pm overlaps with 2:00-3:00pm)", async () => {
      const store = createBookingStore();

      const results = await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        store.createBooking("staff-1", timeAt(14, 30), timeAt(15, 30)),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded).toHaveLength(1);
    });
  });

  // ─── 2. Different staff + same time → both succeed ──────────────

  describe("2. Two createBooking calls for different staff + same time → both succeed", () => {
    it("both bookings succeed for different staff at the same time", async () => {
      const store = createBookingStore();

      const results = await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        store.createBooking("staff-2", timeAt(14, 0), timeAt(15, 0)),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded).toHaveLength(2);
    });

    it("two bookings are persisted, one per staff", async () => {
      const store = createBookingStore();

      await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        store.createBooking("staff-2", timeAt(14, 0), timeAt(15, 0)),
      ]);

      expect(store.bookings).toHaveLength(2);
      expect(store.bookings.map((b) => b.staffId).sort()).toEqual(["staff-1", "staff-2"]);
    });

    it("per-staff lock does not block unrelated staff", async () => {
      const store = createBookingStore();

      // Three different staff at the same time should all succeed
      const results = await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        store.createBooking("staff-2", timeAt(14, 0), timeAt(15, 0)),
        store.createBooking("staff-3", timeAt(14, 0), timeAt(15, 0)),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded).toHaveLength(3);
    });
  });

  // ─── 3. Same staff + adjacent times with buffer → overlap error ─

  describe("3. Same staff + adjacent times with buffer → one succeeds, other gets overlap error", () => {
    it("adjacent bookings within 15-min buffer: second booking rejected", async () => {
      const FIFTEEN_MIN_MS = 15 * 60 * 1000;
      const store = createBookingStore(FIFTEEN_MIN_MS);

      const results = await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        // Starts at 3:00pm — exactly at end of first, but within 15-min buffer
        store.createBooking("staff-1", timeAt(15, 0), timeAt(16, 0)),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded).toHaveLength(1);
    });

    it("adjacent bookings outside buffer: both succeed", async () => {
      const FIFTEEN_MIN_MS = 15 * 60 * 1000;
      const store = createBookingStore(FIFTEEN_MIN_MS);

      const results = await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        // Starts at 3:15pm — exactly at buffer boundary (15 min after end)
        store.createBooking("staff-1", timeAt(15, 15), timeAt(16, 15)),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded).toHaveLength(2);
    });

    it("no buffer (0ms): adjacent bookings both succeed", async () => {
      const store = createBookingStore(0);

      const results = await Promise.allSettled([
        store.createBooking("staff-1", timeAt(14, 0), timeAt(15, 0)),
        store.createBooking("staff-1", timeAt(15, 0), timeAt(16, 0)),
      ]);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded).toHaveLength(2);
    });
  });
});
