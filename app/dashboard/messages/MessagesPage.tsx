"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Send,
  Paperclip,
  ArrowLeft,
  Star,
  Archive,
  CheckCircle2,
  XCircle,
  MessageSquare,
  PenSquare,
  Users,
} from "lucide-react";
import { ComposeDialog } from "@/components/messages/ComposeDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ThreadRow, MessageRow } from "./actions";
import {
  getThreads,
  getThreadMessages,
  sendMessage,
  markThreadRead,
  updateThreadStatus,
  toggleThreadStar,
  archiveThread,
} from "./actions";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function initials(first: string | null, last: string | null) {
  return `${(first ?? "G").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase();
}

function timeAgo(date: Date) {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const STATUS_CFG: Record<string, { label: string; dot: string }> = {
  new: { label: "New", dot: "bg-blush" },
  pending: { label: "Pending", dot: "bg-amber-500" },
  contacted: { label: "Contacted", dot: "bg-foreground/20" },
  approved: { label: "Approved", dot: "bg-[#4e6b51]" },
  rejected: { label: "Rejected", dot: "bg-destructive" },
  resolved: { label: "Resolved", dot: "bg-foreground/20" },
};

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  request: { label: "Request", className: "bg-blush/12 text-[#96604a] border-blush/20" },
  inquiry: { label: "Inquiry", className: "bg-amber-50 text-amber-700 border-amber-100" },
  booking: { label: "Booking", className: "bg-blue-50 text-blue-700 border-blue-100" },
  confirmation: {
    label: "Confirmed",
    className: "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20",
  },
  reminder: { label: "Reminder", className: "bg-purple-50 text-purple-700 border-purple-100" },
  general: { label: "General", className: "bg-foreground/8 text-muted border-foreground/12" },
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function MessagesPage({ initialThreads }: { initialThreads: ThreadRow[] }) {
  const [threadsList, setThreadsList] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<MessageRow[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "starred" | "archived">("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = threadsList.find((t) => t.id === selectedId) ?? null;

  // Filter threads
  const filtered = threadsList.filter((t) => {
    if (filter === "new" && t.status !== "new") return false;
    if (filter === "starred" && !t.isStarred) return false;
    if (filter === "archived" && !t.isArchived) return false;
    if (filter !== "archived" && t.isArchived) return false;
    if (
      search &&
      !`${t.clientFirstName ?? ""} ${t.clientLastName ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      !t.subject.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const totalUnread = threadsList.reduce((sum, t) => sum + t.unreadCount, 0);

  // Load messages when a thread is selected
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoadingMsgs(true);
    getThreadMessages(selectedId).then((rows) => {
      if (cancelled) return;
      setMsgs(rows);
      setLoadingMsgs(false);
      markThreadRead(selectedId).then(() => {
        setThreadsList((prev) =>
          prev.map((t) => (t.id === selectedId ? { ...t, unreadCount: 0 } : t)),
        );
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function handleSend() {
    if (!draft.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const newMsg = await sendMessage(selectedId, draft.trim());
      setMsgs((prev) => [...prev, newMsg]);
      setDraft("");
      // Update thread preview
      setThreadsList((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? {
                ...t,
                lastMessageBody: newMsg.body,
                lastMessageAt: newMsg.createdAt,
                lastMessageSenderId: newMsg.senderId,
              }
            : t,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  async function handleStar() {
    if (!selectedId) return;
    await toggleThreadStar(selectedId);
    setThreadsList((prev) =>
      prev.map((t) => (t.id === selectedId ? { ...t, isStarred: !t.isStarred } : t)),
    );
  }

  async function handleArchive() {
    if (!selectedId) return;
    await archiveThread(selectedId);
    setThreadsList((prev) =>
      prev.map((t) => (t.id === selectedId ? { ...t, isArchived: true } : t)),
    );
    setSelectedId(null);
  }

  async function handleStatus(status: "approved" | "rejected" | "resolved") {
    if (!selectedId) return;
    await updateThreadStatus(selectedId, status);
    setThreadsList((prev) => prev.map((t) => (t.id === selectedId ? { ...t, status } : t)));
  }

  function handleCreated(threadId: number) {
    getThreads().then((rows) => {
      setThreadsList(rows);
      setSelectedId(threadId);
    });
  }

  function threadDisplayName(t: ThreadRow) {
    if (t.isGroup) return t.subject;
    if (t.clientFirstName) return `${t.clientFirstName} ${t.clientLastName ?? ""}`.trim();
    return t.subject;
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Inbox list ────────────────────────────────────────────── */}
      <div
        className={cn(
          "w-full lg:w-80 xl:w-96 border-r border-border flex flex-col shrink-0",
          selected ? "hidden lg:flex" : "flex",
        )}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">Messages</h1>
              {totalUnread > 0 && <p className="text-xs text-muted mt-0.5">{totalUnread} unread</p>}
            </div>
            <button
              onClick={() => setComposeOpen(true)}
              className="p-2 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
              title="New message"
            >
              <PenSquare className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-3">
            {(["all", "new", "starred", "archived"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
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
                onClick={() => setSelectedId(thread.id)}
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

      {/* ── Thread view ───────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-foreground/5 text-muted"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {selected.isGroup ? (
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-accent" />
              </div>
            ) : (
              <Avatar size="sm">
                <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                  {initials(selected.clientFirstName, selected.clientLastName)}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{threadDisplayName(selected)}</p>
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    "border text-[10px] px-1.5 py-0.5",
                    (TYPE_BADGE[selected.threadType] ?? TYPE_BADGE.general).className,
                  )}
                >
                  {(TYPE_BADGE[selected.threadType] ?? TYPE_BADGE.general).label}
                </Badge>
                <span className="text-xs text-muted capitalize">
                  {(STATUS_CFG[selected.status] ?? STATUS_CFG.new).label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleStar}
                className="p-2 rounded-lg hover:bg-foreground/5 text-muted transition-colors"
                title={selected.isStarred ? "Unstar" : "Star"}
              >
                <Star
                  className={cn("w-4 h-4", selected.isStarred && "text-amber-500 fill-amber-500")}
                />
              </button>
              {selected.threadType === "request" && selected.status !== "approved" && (
                <button
                  onClick={() => handleStatus("approved")}
                  className="p-2 rounded-lg hover:bg-[#4e6b51]/10 text-[#4e6b51] transition-colors"
                  title="Approve"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
              {selected.threadType === "request" && selected.status !== "rejected" && (
                <button
                  onClick={() => handleStatus("rejected")}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                  title="Decline"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleArchive}
                className="p-2 rounded-lg hover:bg-foreground/5 text-muted transition-colors"
                title="Archive"
              >
                <Archive className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loadingMsgs && (
              <p className="text-sm text-muted text-center py-6">Loading messages...</p>
            )}
            {!loadingMsgs && msgs.length === 0 && (
              <p className="text-sm text-muted text-center py-6">
                No messages yet. Send a message to start the conversation.
              </p>
            )}
            {msgs.map((msg) => {
              const isStudio = msg.senderRole !== "client";
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2.5", isStudio ? "flex-row-reverse" : "flex-row")}
                >
                  {!isStudio && (
                    <Avatar size="sm" className="shrink-0 mt-0.5">
                      <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                        {initials(msg.senderFirstName, msg.senderLastName)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[72%] flex flex-col gap-1",
                      isStudio ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                        isStudio
                          ? "bg-accent text-white rounded-tr-sm"
                          : "bg-surface text-foreground rounded-tl-sm border border-border",
                      )}
                    >
                      {msg.body}
                    </div>
                    <span className="text-[10px] text-muted px-1">{fmtTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose */}
          <div className="px-5 py-4 border-t border-border">
            <div className="flex items-end gap-2">
              <button className="p-2 text-muted hover:text-foreground transition-colors shrink-0">
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 resize-none bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30 max-h-32 overflow-y-auto"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="p-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state on desktop */
        <div className="hidden lg:flex flex-1 items-center justify-center text-center">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-muted" />
            </div>
            <p className="text-sm font-medium text-foreground">Select a conversation</p>
            <p className="text-xs text-muted mt-1">
              Choose a message from the inbox to read and reply.
            </p>
          </div>
        </div>
      )}

      {/* Compose dialog */}
      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
