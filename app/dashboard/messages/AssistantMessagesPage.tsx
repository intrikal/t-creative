"use client";

import { useReducer, useState, useRef, useEffect, useCallback } from "react";
import { Send, ArrowLeft, MessageSquare, PenSquare, Users } from "lucide-react";
import { ComposeDialog } from "@/components/messages/ComposeDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
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
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

type AssistantState = {
  selectedId: number | null;
  msgs: MessageRow[];
  loadingMsgs: boolean;
  draft: string;
  sending: boolean;
  composeOpen: boolean;
};

type AssistantAction =
  | { type: "SELECT_THREAD"; id: number }
  | { type: "DESELECT_THREAD" }
  | { type: "SET_MESSAGES"; msgs: MessageRow[] }
  | { type: "APPEND_MESSAGE"; msg: MessageRow }
  | { type: "SET_DRAFT"; draft: string }
  | { type: "START_SENDING" }
  | { type: "SEND_COMPLETE" }
  | { type: "SEND_FAILED" }
  | { type: "OPEN_COMPOSE" }
  | { type: "CLOSE_COMPOSE" };

function assistantReducer(state: AssistantState, action: AssistantAction): AssistantState {
  switch (action.type) {
    case "SELECT_THREAD":
      return { ...state, selectedId: action.id, msgs: [], loadingMsgs: true, draft: "" };
    case "DESELECT_THREAD":
      return { ...state, selectedId: null, msgs: [], loadingMsgs: false };
    case "SET_MESSAGES":
      return { ...state, msgs: action.msgs, loadingMsgs: false };
    case "APPEND_MESSAGE":
      if (state.msgs.some((m) => m.id === action.msg.id)) return state;
      return { ...state, msgs: [...state.msgs, action.msg] };
    case "SET_DRAFT":
      return { ...state, draft: action.draft };
    case "START_SENDING":
      return { ...state, sending: true };
    case "SEND_COMPLETE":
      return { ...state, sending: false, draft: "" };
    case "SEND_FAILED":
      return { ...state, sending: false };
    case "OPEN_COMPOSE":
      return { ...state, composeOpen: true };
    case "CLOSE_COMPOSE":
      return { ...state, composeOpen: false };
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AssistantMessagesPage({
  initialThreads,
  currentUserId,
}: {
  initialThreads: ThreadRow[];
  currentUserId: string;
}) {
  const [threadsList, setThreadsList] = useState(initialThreads);
  const [state, dispatch] = useReducer(assistantReducer, {
    selectedId: initialThreads.length > 0 ? initialThreads[0].id : null,
    msgs: [],
    loadingMsgs: initialThreads.length > 0,
    draft: "",
    sending: false,
    composeOpen: false,
  });

  const { selectedId, msgs, loadingMsgs, draft, sending, composeOpen } = state;
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = threadsList.find((t) => t.id === selectedId) ?? null;

  // Stable ref for Realtime callback
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const handleComposeClose = useCallback(() => {
    dispatch({ type: "CLOSE_COMPOSE" });
  }, []);

  function handleCreated(threadId: number) {
    getThreads().then((rows) => {
      setThreadsList(rows);
      dispatch({ type: "SELECT_THREAD", id: threadId });
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
    getThreadMessages(selectedId).then((rows) => {
      if (cancelled) return;
      dispatch({ type: "SET_MESSAGES", msgs: rows });
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

  // ---- Supabase Realtime ----
  // NOTE: Requires Supabase Realtime enabled on `messages` and `threads` tables.
  // Enable via Supabase Dashboard → Database → Replication → Enable for these tables.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("assistant-messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as {
            id: number;
            thread_id: number;
            sender_id: string;
            body: string;
            created_at: string;
          };

          if (newMsg.sender_id === currentUserId) return;

          const currentSelectedId = selectedIdRef.current;

          if (newMsg.thread_id === currentSelectedId) {
            getThreadMessages(newMsg.thread_id).then((rows) => {
              const fullMsg = rows.find((r) => r.id === newMsg.id);
              if (fullMsg) dispatch({ type: "APPEND_MESSAGE", msg: fullMsg });
              markThreadRead(newMsg.thread_id);
            });
          }

          setThreadsList((prev) =>
            prev.map((t) =>
              t.id === newMsg.thread_id
                ? {
                    ...t,
                    lastMessageBody: newMsg.body,
                    lastMessageAt: new Date(newMsg.created_at),
                    lastMessageSenderId: newMsg.sender_id,
                    unreadCount:
                      newMsg.thread_id === currentSelectedId ? t.unreadCount : t.unreadCount + 1,
                  }
                : t,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "threads" },
        (payload) => {
          const updated = payload.new as {
            id: number;
            is_starred: boolean;
            is_archived: boolean;
            is_closed: boolean;
            status: string;
            last_message_at: string;
          };
          setThreadsList((prev) =>
            prev.map((t) =>
              t.id === updated.id
                ? {
                    ...t,
                    isStarred: updated.is_starred,
                    isArchived: updated.is_archived,
                    isClosed: updated.is_closed,
                    status: updated.status,
                    lastMessageAt: new Date(updated.last_message_at),
                  }
                : t,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  async function handleSend() {
    if (!draft.trim() || !selectedId || sending) return;
    dispatch({ type: "START_SENDING" });
    try {
      const newMsg = await sendMessage(selectedId, draft.trim());
      dispatch({ type: "APPEND_MESSAGE", msg: newMsg });
      dispatch({ type: "SEND_COMPLETE" });
      setThreadsList((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? { ...t, lastMessageBody: newMsg.body, lastMessageAt: newMsg.createdAt }
            : t,
        ),
      );
    } catch {
      dispatch({ type: "SEND_FAILED" });
    }
  }

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
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
            onClick={() => dispatch({ type: "OPEN_COMPOSE" })}
            className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted hover:text-foreground transition-colors"
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
                onClick={() => dispatch({ type: "SELECT_THREAD", id: t.id })}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 border-b border-border/30 hover:bg-foreground/[0.03] transition-colors text-left",
                  selectedId === t.id && "bg-accent/5",
                )}
              >
                {t.isGroup ? (
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-accent" />
                  </div>
                ) : (
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] font-semibold bg-surface text-muted">
                      {initials(t.clientFirstName, t.clientLastName)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "text-xs truncate",
                        t.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/80",
                      )}
                    >
                      {threadDisplayName(t)}
                    </span>
                    <span className="text-[10px] text-muted shrink-0">
                      {timeAgo(t.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted truncate mt-0.5">
                    {t.lastMessageBody
                      ? t.lastMessageBody.length > 50
                        ? t.lastMessageBody.slice(0, 50) + "\u2026"
                        : t.lastMessageBody
                      : t.subject}
                  </p>
                </div>
                {t.unreadCount > 0 && (
                  <span className="shrink-0 w-4 h-4 rounded-full bg-blush text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
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
          <div className="px-4 sm:px-5 py-3 border-b border-border shrink-0 flex items-center gap-3">
            <button
              className="sm:hidden p-1.5 rounded-lg hover:bg-foreground/5 text-muted"
              onClick={() => dispatch({ type: "DESELECT_THREAD" })}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {selected.isGroup ? (
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-accent" />
              </div>
            ) : (
              <Avatar size="sm">
                <AvatarFallback className="text-[10px] font-semibold bg-surface text-muted">
                  {initials(selected.clientFirstName, selected.clientLastName)}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{threadDisplayName(selected)}</p>
              <p className="text-[10px] text-muted truncate">{selected.subject}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
            {loadingMsgs && (
              <div className="space-y-4 py-6">
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-surface animate-pulse shrink-0" />
                  <div className="space-y-1.5">
                    <div className="h-10 w-48 rounded-2xl rounded-tl-sm bg-surface animate-pulse" />
                    <div className="h-2.5 w-12 rounded bg-surface/60 animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="space-y-1.5 flex flex-col items-end">
                    <div className="h-8 w-36 rounded-2xl rounded-tr-sm bg-accent/12 animate-pulse" />
                    <div className="h-2.5 w-10 rounded bg-surface/60 animate-pulse" />
                  </div>
                </div>
              </div>
            )}
            {!loadingMsgs && msgs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center mb-3">
                  <MessageSquare className="w-5 h-5 text-muted" />
                </div>
                <p className="text-sm font-medium text-foreground">Start the conversation</p>
                <p className="text-xs text-muted mt-1">Send a message below to begin.</p>
              </div>
            )}
            {msgs.map((msg) => {
              const isMe = msg.senderRole !== "client";
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2.5", isMe ? "flex-row-reverse" : "flex-row")}
                >
                  <Avatar size="sm" className="shrink-0 mt-0.5 w-7 h-7">
                    <AvatarFallback
                      className={cn(
                        "text-[10px] font-semibold w-7 h-7",
                        isMe ? "bg-accent/10 text-accent" : "bg-surface text-muted",
                      )}
                    >
                      {initials(msg.senderFirstName, msg.senderLastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("max-w-[72%] flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap",
                        isMe
                          ? "bg-accent text-white rounded-tr-sm"
                          : "bg-surface border border-border text-foreground rounded-tl-sm",
                      )}
                    >
                      {msg.body}
                    </div>
                    <span className="text-[10px] text-muted/60 px-1">{fmtTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="flex justify-end">
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-muted animate-pulse" />
                    <span className="w-1 h-1 rounded-full bg-muted animate-pulse [animation-delay:150ms]" />
                    <span className="w-1 h-1 rounded-full bg-muted animate-pulse [animation-delay:300ms]" />
                  </span>
                  Sending...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 sm:px-5 py-3 border-t border-border shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => dispatch({ type: "SET_DRAFT", draft: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message ${threadDisplayName(selected)}...`}
                rows={1}
                className="flex-1 resize-none px-4 py-2.5 text-[13.5px] bg-surface border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30 max-h-32 overflow-y-auto transition"
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="p-2.5 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-colors disabled:opacity-40 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-muted/40 mt-1.5 px-1 hidden sm:block">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      ) : (
        <div className="hidden sm:flex flex-1 items-center justify-center text-center">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-muted" />
            </div>
            <p className="text-sm font-medium text-foreground">Select a conversation</p>
            <p className="text-xs text-muted mt-1">Choose a message from the list.</p>
          </div>
        </div>
      )}

      <ComposeDialog
        open={composeOpen}
        onClose={handleComposeClose}
        onCreated={handleCreated}
      />
    </div>
  );
}
