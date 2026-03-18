/**
 * ThreadList.tsx
 * Inbox sidebar panel: search bar, filter tabs, and scrollable conversation list.
 */

import { Search, Star, Bell, PenSquare, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ThreadRow } from "../actions";
import { initials, timeAgo, STATUS_CFG, TYPE_BADGE } from "./helpers";

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
        "w-full lg:w-80 xl:w-96 border-r border-border flex flex-col shrink-0",
        hasSelected ? "hidden lg:flex" : "flex",
      )}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Messages</h1>
            {totalUnread > 0 && <p className="text-xs text-muted mt-0.5">{totalUnread} unread</p>}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onViewNotifications}
              className="p-2 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={onComposeOpen}
              className="p-2 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
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
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3">
          {(["all", "new", "starred", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={cn(
                "flex-1 py-1 text-[11px] font-medium rounded-md capitalize transition-colors",
                filter === f
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/50">
        {filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-muted">
              {filter === "all" && !search
                ? "No conversations yet. They'll appear here when clients reach out."
                : "No conversations found."}
            </p>
          </div>
        )}
        {filtered.map((thread) => {
          const typeBadge = TYPE_BADGE[thread.threadType] ?? TYPE_BADGE.general;
          const statusCfg = STATUS_CFG[thread.status] ?? STATUS_CFG.new;
          return (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                "w-full text-left px-4 py-3.5 hover:bg-foreground/3 transition-colors flex gap-3",
                selectedId === thread.id && "bg-foreground/5",
              )}
            >
              <div className="relative shrink-0 mt-0.5">
                {thread.isGroup ? (
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-accent" />
                  </div>
                ) : (
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                      {initials(thread.clientFirstName, thread.clientLastName)}
                    </AvatarFallback>
                  </Avatar>
                )}
                {thread.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blush text-white text-[9px] font-bold flex items-center justify-center">
                    {thread.unreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium truncate",
                      thread.unreadCount > 0 ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {threadDisplayName(thread)}
                  </span>
                  <span className="text-[10px] text-muted shrink-0">
                    {timeAgo(thread.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusCfg.dot)} />
                  <Badge
                    className={cn(
                      "border text-[9px] px-1 py-0 leading-4 shrink-0",
                      typeBadge.className,
                    )}
                  >
                    {typeBadge.label}
                  </Badge>
                  {thread.isStarred && (
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                  <p className="text-xs text-muted truncate">
                    {thread.lastMessageBody
                      ? thread.lastMessageBody.length > 60
                        ? thread.lastMessageBody.slice(0, 60) + "..."
                        : thread.lastMessageBody
                      : thread.subject}
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
