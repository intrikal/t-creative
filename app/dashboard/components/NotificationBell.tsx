"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InboxItem } from "../notification-inbox";
import { getInboxSummary, markAllInboxRead } from "../notification-inbox";

const TYPE_LABELS: Record<string, string> = {
  booking_reminder: "Booking Reminder",
  booking_confirmation: "Booking Confirmed",
  booking_cancellation: "Booking Cancelled",
  review_request: "Review Request",
  waitlist_alert: "Waitlist Update",
  promotion: "Promotion",
  form_request: "Form Request",
  general: "Notification",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startTransition(async () => {
      try {
        const summary = await getInboxSummary();
        setUnreadCount(summary.unreadCount);
        setItems(summary.items);
      } catch {
        // No notifications or not authenticated — silently ignore
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleOpen() {
    setOpen((o) => !o);
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllInboxRead();
      setItems((prev) => prev.map((i) => ({ ...i, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    });
  }

  if (items.length === 0 && unreadCount === 0 && !isPending) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[9px] font-bold bg-accent text-white rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <p className="text-xs font-semibold text-foreground">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="text-[10px] text-accent hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Items */}
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted text-center">No notifications yet</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "px-3 py-2.5 border-b border-border/50 last:border-0 transition-colors",
                    item.readAt === null ? "bg-accent/5" : "bg-background",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground truncate">
                        {item.title}
                      </p>
                      {item.body && (
                        <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{item.body}</p>
                      )}
                      <p className="text-[9px] text-muted/70 mt-1">
                        {TYPE_LABELS[item.type] ?? item.type} · {timeAgo(item.createdAt)}
                      </p>
                    </div>
                    {item.readAt === null && (
                      <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
