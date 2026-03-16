"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { InboxItem, InboxPageResult } from "../notification-inbox";
import { markOneRead, markAllInboxRead } from "../notification-inbox";

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
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationsPage({
  initialData,
  initialType,
}: {
  initialData: InboxPageResult;
  initialType?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { items, total, page, pageSize } = initialData;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const unreadCount = items.filter((i) => i.readAt === null).length;
  const activeType = initialType && initialType !== "all" ? initialType : undefined;

  function navigate(params: { page?: number; type?: string | null }) {
    const sp = new URLSearchParams();
    const newType = params.type !== undefined ? params.type : activeType;
    const newPage = params.page ?? 1;
    if (newType) sp.set("type", newType);
    if (newPage > 1) sp.set("page", String(newPage));
    router.push(`/dashboard/notifications${sp.size ? `?${sp}` : ""}`);
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllInboxRead();
      router.refresh();
    });
  }

  function handleMarkOneRead(id: number, item: InboxItem) {
    if (item.readAt !== null) return;
    startTransition(async () => {
      await markOneRead(id);
      router.refresh();
    });
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
          <p className="text-xs text-muted mt-0.5">
            {total} notification{total !== 1 ? "s" : ""}
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <button
          onClick={() => navigate({ type: null, page: 1 })}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
            !activeType
              ? "bg-accent text-white"
              : "bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground",
          )}
        >
          All
        </button>
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => navigate({ type: key, page: 1 })}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
              activeType === key
                ? "bg-accent text-white"
                : "bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="border border-border rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted text-center">No notifications yet</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "px-4 py-3 border-b border-border/50 last:border-0 transition-colors",
                item.readAt === null ? "bg-accent/5" : "bg-background",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                  {item.body && (
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">{item.body}</p>
                  )}
                  <p className="text-[10px] text-muted/70 mt-1">
                    {TYPE_LABELS[item.type] ?? item.type} · {timeAgo(item.createdAt)}
                  </p>
                </div>
                {item.readAt === null && (
                  <button
                    onClick={() => handleMarkOneRead(item.id, item)}
                    disabled={isPending}
                    title="Mark as read"
                    className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1 hover:scale-125 transition-transform disabled:opacity-50"
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => navigate({ page: page - 1 })}
            disabled={page <= 1 || isPending}
            className="text-xs text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <p className="text-[11px] text-muted">
            Page {page} of {totalPages}
          </p>
          <button
            onClick={() => navigate({ page: page + 1 })}
            disabled={page >= totalPages || isPending}
            className="text-xs text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
