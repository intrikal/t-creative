/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { StaleWhileRevalidate, CacheFirst, NetworkFirst, ExpirationPlugin } from "serwist";
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

/* ------------------------------------------------------------------ */
/*  Runtime cache strategies                                           */
/* ------------------------------------------------------------------ */

/**
 * Public pages — stale-while-revalidate.
 * Serves the cached page instantly, fetches fresh HTML in background.
 * Excludes /dashboard and all /api routes (handled separately or not cached).
 * Max age 24 hours so stale content doesn't linger too long.
 */
const publicPageCache = {
  matcher: ({ request, url }: { request: Request; url: URL }) => {
    if (request.mode !== "navigate") return false;
    const p = url.pathname;
    // Never cache dashboard or auth routes
    if (p.startsWith("/dashboard") || p.startsWith("/auth") || p.startsWith("/login")) return false;
    return true;
  },
  handler: new StaleWhileRevalidate({
    cacheName: "tc-pages",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  }),
};

/**
 * /api/calendar/[profileId] — stale-while-revalidate.
 * The iCal feed URL contains an HMAC token so it's safe to cache per-URL.
 * Serves the cached .ics instantly, fetches fresh data in background.
 * Max age 15 minutes — calendar data changes often enough to stay fresh.
 */
const calendarApiCache = {
  matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/api/calendar/"),
  handler: new StaleWhileRevalidate({
    cacheName: "tc-calendar-api",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 60 * 15, // 15 minutes
      }),
    ],
  }),
};

/**
 * Static assets (images, fonts, icons) — cache-first.
 * These change only on deploy (content-hashed filenames) so aggressive
 * caching is safe. Serwist's defaultCache already handles _next/static;
 * this covers /icons/, /images/, and other public assets.
 */
const staticAssetCache = {
  matcher: ({ url }: { url: URL }) =>
    url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/"),
  handler: new CacheFirst({
    cacheName: "tc-static-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 64,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  }),
};

/**
 * Dashboard shell — NetworkFirst with 3s timeout.
 * Tries the network for fresh server-rendered HTML; falls back to the
 * last cached version when offline so users can still browse read-only.
 */
const dashboardShellCache = {
  matcher: ({ request, url }: { request: Request; url: URL }) => {
    if (request.mode !== "navigate") return false;
    return url.pathname.startsWith("/dashboard");
  },
  handler: new NetworkFirst({
    cacheName: "dashboard-shell",
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  }),
};

/**
 * Dashboard data fetches — NetworkFirst with 5s timeout.
 * Caches GET requests for RSC payloads / data so the dashboard can
 * render cached content when offline. POST mutations are never cached.
 */
const dashboardDataCache = {
  matcher: ({ request, url }: { request: Request; url: URL }) => {
    if (request.method !== "GET") return false;
    if (request.mode === "navigate") return false;
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return false;
    return url.pathname.startsWith("/dashboard");
  },
  handler: new NetworkFirst({
    cacheName: "dashboard-data",
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60, // 1 hour
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Order matters: more specific rules first, defaultCache last.
    dashboardShellCache,
    dashboardDataCache,
    calendarApiCache,
    staticAssetCache,
    publicPageCache,
    ...defaultCache,
  ],
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
/*  BackgroundSync — dashboard mutation queue                          */
/* ------------------------------------------------------------------ */

const MUTATION_SYNC_TAG = "dashboard-mutations";
const MUTATION_DB_NAME = "tc-mutation-sync";
const MUTATION_STORE_NAME = "pending-mutations";
const MUTATION_MAX_ENTRIES = 50;
const MUTATION_MAX_AGE_MS = 60 * 60 * 24 * 1000; // 24 hours

interface QueuedMutation {
  id: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

function openMutationDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(MUTATION_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(MUTATION_STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllMutations(db: IDBDatabase): Promise<QueuedMutation[]> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(MUTATION_STORE_NAME, "readonly")
      .objectStore(MUTATION_STORE_NAME)
      .getAll();
    req.onsuccess = () => resolve(req.result as QueuedMutation[]);
    req.onerror = () => reject(req.error);
  });
}

function deleteMutation(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(MUTATION_STORE_NAME, "readwrite")
      .objectStore(MUTATION_STORE_NAME)
      .delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function countMutations(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(MUTATION_STORE_NAME, "readonly")
      .objectStore(MUTATION_STORE_NAME)
      .count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function addMutation(db: IDBDatabase, entry: Omit<QueuedMutation, "id">): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(MUTATION_STORE_NAME, "readwrite")
      .objectStore(MUTATION_STORE_NAME)
      .add(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Broadcast pending mutation count to all open dashboard tabs. */
async function broadcastMutationCount(): Promise<void> {
  const db = await openMutationDb();
  const count = await countMutations(db);
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "MUTATION_QUEUE_COUNT", count });
  }
}

/**
 * Intercept failed POST requests to /dashboard paths and queue them
 * for replay when connectivity returns.
 */
self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST") return;
  if (!url.pathname.startsWith("/dashboard")) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request.clone());
      } catch {
        // Network failure — queue the mutation for background sync
        const body = await event.request.clone().text();
        const headers: Record<string, string> = {};
        event.request.headers.forEach((v, k) => {
          headers[k] = v;
        });

        const db = await openMutationDb();
        const count = await countMutations(db);
        if (count < MUTATION_MAX_ENTRIES) {
          await addMutation(db, {
            url: event.request.url,
            method: event.request.method,
            headers,
            body,
            timestamp: Date.now(),
          });
        }

        if ("sync" in self.registration) {
          await self.registration.sync.register(MUTATION_SYNC_TAG);
        }

        await broadcastMutationCount();

        return new Response(JSON.stringify({ queued: true }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
    })(),
  );
});

/** Replay queued mutations when the browser regains connectivity. */
self.addEventListener("sync", (event: SyncEvent) => {
  if (event.tag !== MUTATION_SYNC_TAG) return;

  event.waitUntil(
    (async () => {
      const db = await openMutationDb();
      const pending = await getAllMutations(db);
      const now = Date.now();

      for (const record of pending) {
        // Drop stale mutations older than 24 hours
        if (now - record.timestamp > MUTATION_MAX_AGE_MS) {
          await deleteMutation(db, record.id);
          continue;
        }

        try {
          const res = await fetch(record.url, {
            method: record.method,
            headers: record.headers,
            body: record.body,
          });

          if (res.ok) {
            await deleteMutation(db, record.id);
          }
          // Non-2xx — leave in queue for next sync attempt
        } catch {
          // Still offline — BackgroundSync will retry
        }
      }

      await broadcastMutationCount();

      // Notify clients that sync completed
      const clients = await self.clients.matchAll({ type: "window" });
      const db2 = await openMutationDb();
      const remaining = await countMutations(db2);
      for (const client of clients) {
        client.postMessage({
          type: remaining === 0 ? "MUTATION_SYNC_COMPLETE" : "MUTATION_SYNC_PARTIAL",
          count: remaining,
        });
      }
    })(),
  );
});

/** Respond to count queries from the client. */
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "GET_MUTATION_COUNT") {
    event.waitUntil(broadcastMutationCount());
  }
});

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
