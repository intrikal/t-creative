/**
 * lib/booking-sync-db.ts
 * IndexedDB helper for persisting pending guest booking requests
 * when the network is unavailable. The service worker reads from
 * this store during the "guest-booking-sync" BackgroundSync event.
 */

const DB_NAME = "tc-booking-sync";
const DB_VERSION = 1;
const STORE_NAME = "pending-bookings";

export interface PendingBookingRequest {
  id?: number;
  payload: Record<string, unknown>;
  queuedAt: number; // Date.now()
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, {
        keyPath: "id",
        autoIncrement: true,
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist a guest booking payload for later retry. Returns the assigned id. */
export async function enqueuePendingBooking(
  payload: Record<string, unknown>,
): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add({ payload, queuedAt: Date.now() } satisfies PendingBookingRequest);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve all pending booking requests. */
export async function getAllPendingBookings(): Promise<PendingBookingRequest[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as PendingBookingRequest[]);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a pending booking by id after a successful retry. */
export async function removePendingBooking(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
