// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { PendingBookingRequest } from "./booking-sync-db";

/**
 * Tests for lib/booking-sync-db — IndexedDB helper for offline booking persistence.
 *
 * Covers:
 *  - enqueuePendingBooking: stores payload in the in-memory store and returns the auto-assigned id
 *  - getAllPendingBookings: returns all queued bookings
 *  - removePendingBooking: deletes a booking by id so it is no longer returned by getAll
 *  - dequeue pattern: enqueue → getAll → remove all → getAll returns empty
 *
 * Mocks: global indexedDB (jsdom does not implement IDB).
 * A minimal in-memory IDB is wired up in beforeEach so each test starts with a clean store.
 */

/* ------------------------------------------------------------------ */
/*  Minimal in-memory IndexedDB mock                                   */
/* ------------------------------------------------------------------ */

/** Creates a mock IDBRequest whose onsuccess fires after the current sync turn. */
function makeIDBRequest<T>(getResult: () => T): IDBRequest<T> {
  // Object starts empty; result is populated before onsuccess fires so that
  // `req.onsuccess = () => resolve(req.result)` (the pattern in the source)
  // captures the correct value.
  const req = {} as IDBRequest<T>;
  queueMicrotask(() => {
    (req as Record<string, unknown>).result = getResult();
    req.onsuccess?.({} as Event);
  });
  return req;
}

// Shared in-memory store and auto-increment counter — reset in beforeEach
let store: Map<number, PendingBookingRequest>;
let nextId: number;

const mockObjectStore = {
  add: vi.fn(),
  getAll: vi.fn(),
  delete: vi.fn(),
};

const mockTransaction = {
  objectStore: vi.fn(() => mockObjectStore),
};

const mockIDBDatabase = {
  transaction: vi.fn(() => mockTransaction),
  createObjectStore: vi.fn(),
};

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/booking-sync-db", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Fresh store for each test so tests are fully isolated
    store = new Map();
    nextId = 1;

    // Wire up the in-memory implementations on each mock function
    mockObjectStore.add.mockImplementation((item: Omit<PendingBookingRequest, "id">) => {
      const id = nextId++;
      store.set(id, { ...item, id });
      return makeIDBRequest(() => id);
    });

    mockObjectStore.getAll.mockImplementation(() =>
      makeIDBRequest(() => [...store.values()]),
    );

    mockObjectStore.delete.mockImplementation((id: number) => {
      store.delete(id);
      return makeIDBRequest(() => undefined);
    });

    // indexedDB.open() must return a new request object per call so that the
    // source code can set its own onsuccess/onupgradeneeded handlers before
    // the microtask fires.
    vi.stubGlobal("indexedDB", {
      open: vi.fn(() => {
        const req = {} as IDBOpenDBRequest;
        queueMicrotask(() => {
          (req as Record<string, unknown>).result = mockIDBDatabase;
          req.onsuccess?.({} as Event);
        });
        return req;
      }),
    });
  });

  describe("enqueuePendingBooking", () => {
    // The function must persist the payload along with a queuedAt timestamp
    it("stores the payload and returns the auto-assigned numeric id", async () => {
      const { enqueuePendingBooking } = await import("./booking-sync-db");

      const payload = { serviceId: 7, clientName: "Alice" };
      const id = await enqueuePendingBooking(payload);

      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThan(0);

      // The stored row must include the original payload and a queuedAt timestamp
      const stored = store.get(id)!;
      expect(stored.payload).toEqual(payload);
      expect(typeof stored.queuedAt).toBe("number");
    });

    // Each call must get a unique, incrementing id
    it("assigns distinct ids to multiple enqueued bookings", async () => {
      const { enqueuePendingBooking } = await import("./booking-sync-db");

      const id1 = await enqueuePendingBooking({ foo: 1 });
      const id2 = await enqueuePendingBooking({ foo: 2 });

      expect(id1).not.toBe(id2);
      expect(store.size).toBe(2);
    });
  });

  describe("getAllPendingBookings", () => {
    it("returns an empty array when no bookings have been enqueued", async () => {
      const { getAllPendingBookings } = await import("./booking-sync-db");

      const result = await getAllPendingBookings();
      expect(result).toEqual([]);
    });

    it("returns all enqueued bookings with their payloads", async () => {
      const { enqueuePendingBooking, getAllPendingBookings } = await import("./booking-sync-db");

      await enqueuePendingBooking({ service: "lash" });
      await enqueuePendingBooking({ service: "brow" });

      const result = await getAllPendingBookings();

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.payload)).toEqual(
        expect.arrayContaining([{ service: "lash" }, { service: "brow" }]),
      );
    });
  });

  describe("removePendingBooking", () => {
    // After removal the booking must no longer appear in getAllPendingBookings
    it("removes the booking by id so it no longer appears in getAll", async () => {
      const { enqueuePendingBooking, getAllPendingBookings, removePendingBooking } =
        await import("./booking-sync-db");

      const id = await enqueuePendingBooking({ service: "lash" });
      await removePendingBooking(id);

      const remaining = await getAllPendingBookings();
      expect(remaining).toHaveLength(0);
    });

    it("only removes the targeted booking, leaving others intact", async () => {
      const { enqueuePendingBooking, getAllPendingBookings, removePendingBooking } =
        await import("./booking-sync-db");

      const id1 = await enqueuePendingBooking({ seq: 1 });
      await enqueuePendingBooking({ seq: 2 });

      await removePendingBooking(id1);

      const remaining = await getAllPendingBookings();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].payload).toEqual({ seq: 2 });
    });
  });

  describe("dequeue pattern (enqueue → getAll → remove → empty)", () => {
    // Simulates the service worker's full offline-sync cycle
    it("returns and clears all pending bookings after processing", async () => {
      const { enqueuePendingBooking, getAllPendingBookings, removePendingBooking } =
        await import("./booking-sync-db");

      await enqueuePendingBooking({ attempt: 1 });
      await enqueuePendingBooking({ attempt: 2 });

      const pending = await getAllPendingBookings();
      expect(pending).toHaveLength(2);

      // Simulate service worker: process each, then remove
      for (const item of pending) {
        await removePendingBooking(item.id!);
      }

      const afterClear = await getAllPendingBookings();
      expect(afterClear).toHaveLength(0);
    });
  });
});
