/**
 * Client component for `/dashboard/notifications`.
 *
 * Displays the user's internal notification inbox with type filtering,
 * pagination, and mark-as-read functionality.
 *
 * @module notifications/NotificationsPage
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Calendar,
  CalendarCheck,
  CalendarX,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Megaphone,
  MessageSquare,
  Star,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InboxItem, InboxPageResult } from "../notification-inbox";
import { markOneRead, markAllInboxRead } from "../notification-inbox";

/* ------------------------------------------------------------------ */
/*  Type config                                                        */
/* ------------------------------------------------------------------ */

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  booking_reminder: {
    label: "Reminder",
    icon: <Calendar className="w-4 h-4" />,
    color: "bg-[#c4907a]/12 text-[#96604a]",
  },
  booking_confirmation: {
    label: "Confirmed",
    icon: <CalendarCheck className="w-4 h-4" />,
    color: "bg-[#4e6b51]/12 text-[#4e6b51]",
  },
  booking_cancellation: {
    label: "Cancelled",
    icon: <CalendarX className="w-4 h-4" />,
    color: "bg-red-500/10 text-red-600",
  },
  review_request: {
    label: "Review",
    icon: <Star className="w-4 h-4" />,
    color: "bg-[#d4a574]/12 text-[#a07040]",
  },
  waitlist_alert: {
    label: "Waitlist",
    icon: <Users className="w-4 h-4" />,
    color: "bg-[#5b8a8a]/12 text-[#3d6464]",
  },
  promotion: {
    label: "Promo",
    icon: <Megaphone className="w-4 h-4" />,
    color: "bg-[#6b5b95]/12 text-[#4a3d6e]",
  },
  form_request: {
    label: "Form",
    icon: <FileText className="w-4 h-4" />,
    color: "bg-[#7ba3a3]/12 text-[#5b8a8a]",
  },
  general: {
    label: "General",
    icon: <MessageSquare className="w-4 h-4" />,
    color: "bg-foreground/8 text-muted",
  },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "booking_reminder", label: "Reminders" },
  { key: "booking_confirmation", label: "Confirmed" },
  { key: "booking_cancellation", label: "Cancelled" },
  { key: "review_request", label: "Reviews" },
  { key: "waitlist_alert", label: "Waitlist" },
  { key: "promotion", label: "Promos" },
  { key: "form_request", label: "Forms" },
  { key: "general", label: "General" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

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
    startTransition(() => {
      router.push(`/dashboard/notifications${sp.size ? `?${sp}` : ""}`);
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllInboxRead();
    });
  }

  function handleMarkOneRead(id: number, item: InboxItem) {
    if (item.readAt !== null) return;
    startTransition(async () => {
      await markOneRead(id);
    });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Notifications</h1>
          <p className="text-sm text-muted mt-0.5">
            {total} notification{total !== 1 ? "s" : ""}
            {unreadCount > 0 && (
              <span className="text-accent"> &middot; {unreadCount} unread</span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent/8 hover:bg-accent/15 rounded-lg transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="gap-0 py-4">
          <div className="px-4">
            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">Total</p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">{total}</p>
            <p className="text-xs text-muted mt-1">All notifications</p>
          </div>
        </Card>
        <Card className="gap-0 py-4">
          <div className="px-4">
            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">Unread</p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">
              {unreadCount}
            </p>
            <p className={cn("text-xs mt-1", unreadCount > 0 ? "text-accent" : "text-muted")}>
              {unreadCount > 0 ? "Needs attention" : "All caught up"}
            </p>
          </div>
        </Card>
        <Card className="gap-0 py-4">
          <div className="px-4">
            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
              This Page
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">
              {items.length}
            </p>
            <p className="text-xs text-muted mt-1">of {total} total</p>
          </div>
        </Card>
        <Card className="gap-0 py-4">
          <div className="px-4">
            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">Filter</p>
            <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">
              {activeType ? TYPE_CONFIG[activeType]?.label ?? activeType : "All"}
            </p>
            <p className="text-xs text-muted mt-1">Active filter</p>
          </div>
        </Card>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => navigate({ type: key === "all" ? null : key, page: 1 })}
            disabled={isPending}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              (key === "all" && !activeType) || activeType === key
                ? "bg-foreground text-background"
                : "bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
              <BellOff className="w-5 h-5 text-muted" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No notifications</p>
            <p className="text-xs text-muted text-center max-w-xs">
              {activeType
                ? `No ${TYPE_CONFIG[activeType]?.label.toLowerCase() ?? activeType} notifications yet.`
                : "You're all caught up. New notifications will appear here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.general;
              const isUnread = item.readAt === null;

              return (
                <li
                  key={item.id}
                  onClick={() => handleMarkOneRead(item.id, item)}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5 transition-colors group",
                    isUnread
                      ? "bg-accent/[0.04] hover:bg-accent/[0.07] cursor-pointer"
                      : "hover:bg-foreground/[0.02]",
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      config.color,
                    )}
                  >
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-[13px] leading-tight truncate",
                          isUnread ? "font-semibold text-foreground" : "font-medium text-foreground",
                        )}
                      >
                        {item.title}
                      </p>
                      {isUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      )}
                    </div>
                    {item.body && (
                      <p className="text-xs text-muted mt-0.5 line-clamp-1">{item.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                          config.color,
                        )}
                      >
                        {config.label}
                      </span>
                      <span className="text-[10px] text-muted/60">{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Mark read action */}
                  {isUnread && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkOneRead(item.id, item);
                      }}
                      disabled={isPending}
                      title="Mark as read"
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-muted hover:text-foreground transition-all shrink-0 mt-1"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate({ page: page - 1 })}
            disabled={page <= 1 || isPending}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              page <= 1
                ? "text-muted/30 cursor-not-allowed"
                : "text-muted hover:text-foreground hover:bg-foreground/5",
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <p className="text-xs text-muted tabular-nums">
            Page {page} of {totalPages}
          </p>
          <button
            onClick={() => navigate({ page: page + 1 })}
            disabled={page >= totalPages || isPending}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              page >= totalPages
                ? "text-muted/30 cursor-not-allowed"
                : "text-muted hover:text-foreground hover:bg-foreground/5",
            )}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
