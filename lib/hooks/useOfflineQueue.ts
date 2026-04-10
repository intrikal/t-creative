"use client";

/**
 * useOfflineQueue — tracks the number of pending mutations queued for
 * background sync by the service worker, plus sync lifecycle status.
 *
 * Communicates with the SW via `postMessage` / `onmessage` to read the
 * IndexedDB queue count without the client touching IndexedDB directly.
 */

import { useCallback, useEffect, useState } from "react";

type SyncStatus = "idle" | "syncing" | "synced";

interface OfflineQueueState {
  pendingCount: number;
  isOnline: boolean;
  syncStatus: SyncStatus;
}

export function useOfflineQueue(): OfflineQueueState {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  const requestCount = useCallback(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "GET_MUTATION_COUNT" });
  }, []);

  useEffect(() => {
    const goOffline = () => setIsOnline(false);
    const goOnline = () => {
      setIsOnline(true);
      // When we come back online, check if there are pending mutations
      requestCount();
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    const handleMessage = (event: MessageEvent) => {
      const { data } = event;
      if (!data || typeof data !== "object") return;

      switch (data.type) {
        case "MUTATION_QUEUE_COUNT":
          setPendingCount(data.count as number);
          if ((data.count as number) > 0 && navigator.onLine) {
            setSyncStatus("syncing");
          }
          break;
        case "MUTATION_SYNC_COMPLETE":
          setPendingCount(0);
          setSyncStatus("synced");
          // Reset to idle after showing the success message
          setTimeout(() => setSyncStatus("idle"), 3000);
          break;
        case "MUTATION_SYNC_PARTIAL":
          setPendingCount(data.count as number);
          setSyncStatus("idle");
          break;
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleMessage);

    // Request initial count
    requestCount();

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, [requestCount]);

  return { pendingCount, isOnline, syncStatus };
}
