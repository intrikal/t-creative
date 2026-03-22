/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** BackgroundSync SyncEvent — not yet in all TS lib.webworker definitions. */
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/",
        matcher({ request }) {
          return request.mode === "navigate";
        },
      },
    ],
  },
});

serwist.addEventListeners();

/* ------------------------------------------------------------------ */
/*  BackgroundSync — guest booking retry                               */
/* ------------------------------------------------------------------ */

const SYNC_TAG = "guest-booking-sync";
const DB_NAME = "tc-booking-sync";
const STORE_NAME = "pending-bookings";

/** Minimal IndexedDB helpers — no module imports in SW context. */
function openSyncDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllPending(db: IDBDatabase): Promise<Array<{ id: number; payload: unknown }>> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as Array<{ id: number; payload: unknown }>);
    req.onerror = () => reject(req.error);
  });
}

function deleteRecord(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

self.addEventListener("sync", (event: SyncEvent) => {
  if (event.tag !== SYNC_TAG) return;

  event.waitUntil(
    (async () => {
      const db = await openSyncDb();
      const pending = await getAllPending(db);

      for (const record of pending) {
        try {
          const res = await fetch("/api/book/guest-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(record.payload),
          });

          if (res.ok) {
            await deleteRecord(db, record.id);
            // Notify all open clients that the queued booking went through
            const clients = await self.clients.matchAll({ type: "window" });
            for (const client of clients) {
              client.postMessage({ type: "BOOKING_SYNC_SUCCESS" });
            }
          }
          // Non-2xx (server error) — leave in queue; will retry on next sync
        } catch {
          // Network still down — BackgroundSync will retry automatically
        }
      }
    })(),
  );
});

/* ------------------------------------------------------------------ */
/*  Web Push notifications                                             */
/* ------------------------------------------------------------------ */

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  try {
    const data = event.data.json() as {
      title?: string;
      body?: string;
      url?: string;
      icon?: string;
      badge?: string;
    };

    const title = data.title ?? "T Creative Studio";
    const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
      body: data.body ?? "",
      icon: data.icon ?? "/icons/icon-192x192.png",
      badge: data.badge ?? "/icons/icon-72x72.png",
      data: { url: data.url ?? "/" },
      vibrate: [100, 50, 100],
      tag: "t-creative",
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // Malformed payload — ignore
  }
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string })?.url ?? "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if one is already open
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(url);
    }),
  );
});
