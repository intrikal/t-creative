"use client";

/**
 * OfflineBanner -- fixed banner displayed when the browser loses connectivity.
 *
 * Uses the useOfflineQueue hook to track network state and pending mutations.
 * Shows contextual messages: offline status, pending mutation count while
 * offline, syncing state when reconnected, and a success confirmation.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useOfflineQueue } from "@/lib/hooks/useOfflineQueue";

export function OfflineBanner() {
  const { pendingCount, isOnline, syncStatus } = useOfflineQueue();
  const [dismissed, setDismissed] = useState(false);

  const showOffline = !isOnline;
  const showSyncing = isOnline && syncStatus === "syncing" && pendingCount > 0;
  const showSynced = isOnline && syncStatus === "synced";

  const visible = (showOffline || showSyncing || showSynced) && !dismissed;

  const message = showSynced
    ? "All changes synced \u2713"
    : showSyncing
      ? `Syncing ${pendingCount} change${pendingCount === 1 ? "" : "s"}\u2026`
      : pendingCount > 0
        ? `You\u2019re offline \u2014 showing cached data. ${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when you reconnect.`
        : "You\u2019re offline \u2014 showing cached data";

  const bgClass = showSynced ? "bg-green-500 text-green-950" : "bg-amber-500 text-amber-950";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed top-14 inset-x-0 z-40 flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium ${bgClass}`}
        >
          <span>{message}</span>
          <button
            type="button"
            aria-label="Dismiss offline banner"
            onClick={() => setDismissed(true)}
            className="rounded p-0.5 hover:bg-black/10"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
