/**
 * Modal for subscribing to a calendar feed of upcoming bookings.
 *
 * Related: app/dashboard/bookings/ClientBookingsPage.tsx
 */
"use client";

import { useState } from "react";
import { X, Copy, Check, Rss } from "lucide-react";

export function CalendarSubscribeModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const webcalUrl = url.replace(/^https?:/, "webcal:");

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Subscribe to My Bookings</p>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-muted">
            Add your upcoming appointments to Google Calendar, Apple Calendar, or any app that
            supports calendar subscriptions.
          </p>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Calendar URL</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                className="flex-1 min-w-0 text-[11px] text-muted bg-surface border border-border rounded-lg px-3 py-2 focus:outline-none truncate"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-surface transition-colors"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[#4e6b51]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <a
            href={webcalUrl}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Rss className="w-3.5 h-3.5" />
            Open in Calendar App
          </a>
        </div>
      </div>
    </div>
  );
}
