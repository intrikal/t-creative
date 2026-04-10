/**
 * BulkActionBar — Floating action bar shown when rows are selected.
 *
 * Slides up from the bottom of the screen with a count badge and
 * action buttons. Animates in/out with Framer Motion.
 */
"use client";

import { AnimatePresence, m } from "framer-motion";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  children: React.ReactNode;
}

export function BulkActionBar({ selectedCount, onClear, children }: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <m.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
            "flex items-center gap-3 rounded-full",
            "bg-foreground text-background px-5 py-2.5",
            "shadow-lg shadow-black/20",
          )}
        >
          <span className="text-sm font-medium tabular-nums">{selectedCount} selected</span>

          <div className="h-4 w-px bg-background/20" />

          <div className="flex items-center gap-2">{children}</div>

          <div className="h-4 w-px bg-background/20" />

          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-background/70 hover:text-background transition-colors"
          >
            Clear
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
