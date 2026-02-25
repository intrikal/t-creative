"use client";

import { useState, useRef, useEffect } from "react";
import { Send, ArrowLeft, MessageSquare, PenSquare, Users } from "lucide-react";
import { ComposeDialog } from "@/components/messages/ComposeDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ThreadRow, MessageRow } from "./actions";
import { getThreads, getThreadMessages, sendMessage, markThreadRead } from "./actions";

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
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTime(date: Date) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AssistantMessagesPage({ initialThreads }: { initialThreads: ThreadRow[] }) {
  const [threadsList, setThreadsList] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialThreads.length > 0 ? initialThreads[0].id : null,
  );
  const [msgs, setMsgs] = useState<MessageRow[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = threadsList.find((t) => t.id === selectedId) ?? null;

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function handleSend() {
    if (!draft.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const newMsg = await sendMessage(selectedId, draft.trim());
      setMsgs((prev) => [...prev, newMsg]);
      setDraft("");
      setThreadsList((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? { ...t, lastMessageBody: newMsg.body, lastMessageAt: newMsg.createdAt }
            : t,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0" style={{ height: "calc(100vh - 48px)" }}>
      {/* Thread list */}
      <div
        className={cn(
          "w-64 shrink-0 border-r border-border flex flex-col",
          selected ? "hidden sm:flex" : "flex w-full sm:w-64",
        )}
      >
        <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-foreground">Messages</h1>
          <button
            onClick={() => setComposeOpen(true)}
            className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
            title="New message"
          >
            <PenSquare className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threadsList.length === 0 && (
            <p className="text-xs text-muted text-center py-8">No messages yet.</p>
          )}
          {threadsList
            .filter((t) => !t.isArchived)
            .map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 border-b border-border/40 hover:bg-surface/60 transition-colors text-left",
                  selectedId === t.id && "bg-surface/80",
                )}
              >
                {t.isGroup ? (
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-accent" />
                  </div>
                ) : (
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] font-bold bg-surface text-muted">
                      {initials(t.clientFirstName, t.clientLastName)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {threadDisplayName(t)}
                    </span>
                    <span className="text-[10px] text-muted/60 shrink-0">
                      {timeAgo(t.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted truncate mt-0.5">
                    {t.lastMessageBody
                      ? t.lastMessageBody.length > 50
                        ? t.lastMessageBody.slice(0, 50) + "..."
                        : t.lastMessageBody
                      : t.subject}
                  </p>
                </div>
                {t.unreadCount > 0 && (
                  <span className="shrink-0 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
                    {t.unreadCount}
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* Chat area */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-3">
            <button
              className="sm:hidden p-1.5 rounded-lg hover:bg-foreground/5 text-muted"
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
                <AvatarFallback className="text-[10px] font-bold bg-surface text-muted">
                  {initials(selected.clientFirstName, selected.clientLastName)}
                </AvatarFallback>
              </Avatar>
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">{threadDisplayName(selected)}</p>
              <p className="text-[10px] text-muted">{selected.subject}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loadingMsgs && <p className="text-sm text-muted text-center py-6">Loading...</p>}
            {msgs.map((msg) => {
              const isMe = msg.senderRole !== "client";
              return (
                <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-3.5 py-2.5",
                      isMe
                        ? "bg-accent text-white rounded-br-sm"
                        : "bg-surface border border-border text-foreground rounded-bl-sm",
                    )}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    <p
                      className={cn(
                        "text-[10px] mt-1",
                        isMe ? "text-white/60 text-right" : "text-muted",
                      )}
                    >
                      {fmtTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message ${threadDisplayName(selected)}...`}
                className="flex-1 px-3.5 py-2 text-sm bg-surface border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden sm:flex flex-1 items-center justify-center text-center">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-muted" />
            </div>
            <p className="text-sm font-medium text-foreground">Select a conversation</p>
          </div>
        </div>
      )}

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
