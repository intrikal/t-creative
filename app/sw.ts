import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Service worker event types not included in the DOM lib.
interface PushMessageData { json(): unknown; text(): string }
interface PushEvent extends Event { data: PushMessageData | null; waitUntil(f: Promise<unknown>): void }
interface NotifEvent extends Event { notification: Notification & { data?: unknown }; waitUntil(f: Promise<unknown>): void }
interface WindowClient { focus(): Promise<WindowClient>; navigate(url: string): Promise<WindowClient> }

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    addEventListener(type: "push", listener: (ev: PushEvent) => void): void;
    addEventListener(type: "notificationclick", listener: (ev: NotifEvent) => void): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    registration: ServiceWorkerRegistration;
    clients: { matchAll(opts?: { type?: string; includeUncontrolled?: boolean }): Promise<WindowClient[]>; openWindow(url: string): Promise<WindowClient | null> };
  }
}

declare const self: ServiceWorkerGlobalScope;

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
/*  Web Push notifications                                             */
/* ------------------------------------------------------------------ */

self.addEventListener("push", (event) => {
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

    event.waitUntil(
      self.registration.showNotification(title, {
        body: data.body ?? "",
        icon: data.icon ?? "/icons/icon-192x192.png",
        badge: data.badge ?? "/icons/icon-72x72.png",
        data: { url: data.url ?? "/" },
        tag: "t-creative",
      }),
    );
  } catch {
    // Malformed payload — ignore
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string })?.url ?? "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: WindowClient[]) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
