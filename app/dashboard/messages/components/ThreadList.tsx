/**
 * ThreadList.tsx
 * Inbox sidebar: search, filters, and scrollable conversation list.
 */

import { useMemo } from "react";
import { Search, Star, Bell, PenSquare, Users, X, Inbox } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ThreadRow } from "../actions";
import { initials, timeAgo, STATUS_CFG } from "./helpers";

export interface ThreadListProps {
  filtered: ThreadRow[];
  selectedId: number | null;
  totalUnread: number;
  filter: "all" | "new" | "starred" | "archived";
  search: string;
  onSelectThread: (id: number) => void;
  onFilterChange: (f: "all" | "new" | "starred" | "archived") => void;
  onSearchChange: (value: string) => void;
  onComposeOpen: () => void;
  onViewNotifications: () => void;
  threadDisplayName: (t: ThreadRow) => string;
  hasSelected: boolean;
}

const EMPTY: Record<string, { title: string; desc: string }> = {
  all: {
    title: "No conversations yet",
    desc: "They\u2019ll appear here when clients reach out.",
  },
  new: { title: "All caught up", desc: "No new messages to review." },
  starred: {
    title: "No starred conversations",
    desc: "Star threads to find them quickly.",
  },
  archived: {
    title: "No archived conversations",
    desc: "Archived threads will show here.",
  },
};

export function ThreadList({
  filtered,
  selectedId,
  totalUnread,
  filter,
  search,
  onSelectThread,
  onFilterChange,
  onSearchChange,
  onComposeOpen,
  onViewNotifications,
  threadDisplayName,
  hasSelected,
}: ThreadListProps) {
  return (
    <div
      className={cn(
        "w-full lg:w-80 xl:w-96 border-r border-border flex flex-col shrink-0 min-h-0",
        hasSelected ? "hidden lg:flex" : "flex",
      )}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-foreground tracking-tight">Messages</h1>
            {totalUnread > 0 && (
              <span className="text-[10px] font-bold bg-blush text-white rounded-full px-1.5 py-0.5 leading-none">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onViewNotifications}
              className="p-2 rounded-lg hover:bg-foreground/5 text-muted hover:text-foreground transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={onComposeOpen}
              className="p-2 rounded-lg hover:bg-foreground/5 text-muted hover:text-foreground transition-colors"
              title="New message"
            >
              <PenSquare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full pl-8 py-1.5 text-sm bg-surface border border-border rounded-lg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30 transition-shadow",
              search ? "pr-8" : "pr-3",
            )}
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 mt-2.5 bg-surface/80 border border-border/50 rounded-lg p-0.5">
          {(["all", "new", "starred", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={cn(
                "flex-1 py-1 text-[11px] font-medium rounded-md capitalize transition-all duration-150",
                filter === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center mb-3">
              <Inbox className="w-5 h-5 text-muted/50" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {search
                ? "No results"
                : (EMPTY[filter] ?? EMPTY.all).title}
            </p>
            <p className="text-xs text-muted mt-1">
              {search
                ? `No conversations matching \u201c${search}\u201d`
                : (EMPTY[filter] ?? EMPTY.all).desc}
            </p>
          </div>
        )}
        {filtered.map((thread) => {
          const statusCfg = STATUS_CFG[thread.status] ?? STATUS_CFG.new;
          const isActive = selectedId === thread.id;

          // Preview text: show sender prefix only in group threads
          let preview = thread.lastMessageBody ?? thread.subject;
          if (
            thread.isGroup &&
            thread.lastMessageBody &&
            thread.clientId &&
            thread.lastMessageSenderId === thread.clientId &&
            thread.clientFirstName
          ) {
            preview = `${thread.clientFirstName}: ${thread.lastMessageBody}`;
          }
          if (preview.length > 55) preview = preview.slice(0, 55) + "\u2026";

          return (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                "w-full text-left px-4 py-3 flex gap-3 transition-colors border-b border-border/30",
                isActive
                  ? "bg-accent/5"
                  : "hover:bg-foreground/[0.03]",
              )}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                {thread.isGroup ? (
                  <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-accent" />
                  </div>
                ) : (
                  <Avatar size="sm" className="w-9 h-9">
                    <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold w-9 h-9">
                      {initials(thread.clientFirstName, thread.clientLastName)}
                    </AvatarFallback>
                  </Avatar>
                )}
                {thread.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blush text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                    {thread.unreadCount}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-[13px] truncate",
                      thread.unreadCount > 0
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground/80",
                    )}
                  >
                    {threadDisplayName(thread)}
                  </span>
                  <span className="text-[10px] text-muted shrink-0">
                    {timeAgo(thread.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusCfg.dot)}
                    title={statusCfg.label}
                  />
                  {thread.isStarred && (
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                  <p
                    className={cn(
                      "text-xs truncate",
                      thread.unreadCount > 0 ? "text-foreground/70" : "text-muted",
                    )}
                  >
                    {preview}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
