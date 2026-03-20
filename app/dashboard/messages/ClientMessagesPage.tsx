"use client";

import { useReducer, useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  CalendarDays,
  RefreshCw,
  Heart,
  Gift,
  Star,
  MessageCircle,
  PenSquare,
  ArrowLeft,
  Users,
} from "lucide-react";
import { ComposeDialog } from "@/components/messages/ComposeDialog";
import { TCLogo } from "@/components/TCLogo";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import type { MessageRow, ThreadRow } from "./actions";
import { getClientThreads, getThreadMessages, sendMessage, markThreadRead } from "./actions";

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

type ClientState = {
  selectedId: number | null;
  msgs: MessageRow[];
  draft: string;
  sending: boolean;
  composeOpen: boolean;
};

type ClientAction =
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

function clientReducer(state: ClientState, action: ClientAction): ClientState {
  switch (action.type) {
    case "SELECT_THREAD":
      return { ...state, selectedId: action.id, msgs: [], draft: "" };
    case "DESELECT_THREAD":
      return { ...state, selectedId: null, msgs: [] };
    case "SET_MESSAGES":
      return { ...state, msgs: action.msgs };
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

export function ClientMessagesPage({ currentUserId }: { currentUserId: string }) {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, dispatch] = useReducer(clientReducer, {
    selectedId: null,
    msgs: [],
    draft: "",
    sending: false,
    composeOpen: false,
  });
  const { selectedId, msgs, draft, sending, composeOpen } = state;
  const bottomRef = useRef<HTMLDivElement>(null);

  // Stable ref for Realtime callback
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Load threads on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await getClientThreads();
      if (cancelled) return;
      setThreads(rows);
      if (rows.length > 0) {
        dispatch({ type: "SELECT_THREAD", id: rows[0].id });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load messages when thread changes
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      const rows = await getThreadMessages(selectedId);
      if (!cancelled) dispatch({ type: "SET_MESSAGES", msgs: rows });
      await markThreadRead(selectedId);
      if (!cancelled) {
        setThreads((prev) => prev.map((t) => (t.id === selectedId ? { ...t, unreadCount: 0 } : t)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // ---- Supabase Realtime ----
  // NOTE: Requires Supabase Realtime enabled on `messages` and `threads` tables.
  // Enable via Supabase Dashboard → Database → Replication → Enable for these tables.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("client-messages-realtime")
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

          setThreads((prev) =>
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const QUICK_OPTIONS = [
    { label: "Book an appointment", desc: "Schedule your next visit", icon: CalendarDays },
    { label: "Rebook last service", desc: "Quick rebook in one tap", icon: RefreshCw },
    { label: "Refer a friend", desc: "Share the love & earn", icon: Heart },
    { label: "Packages & deals", desc: "Bundles, promos & more", icon: Gift },
    { label: "My loyalty points", desc: "Check your rewards", icon: Star },
    { label: "Send a message", desc: "Ask us anything", icon: MessageCircle },
  ] as const;

  const showQuickReplies = !loading && selectedId && msgs.length === 0;
  const hasMultipleThreads = threads.length > 1;

  async function handleQuickReply(text: string) {
    if (!selectedId || sending) return;
    dispatch({ type: "START_SENDING" });
    try {
      const newMsg = await sendMessage(selectedId, text);
      dispatch({ type: "APPEND_MESSAGE", msg: newMsg });
      dispatch({ type: "SEND_COMPLETE" });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? {
                ...t,
                lastMessageBody: newMsg.body,
                lastMessageSenderId: newMsg.senderId,
                lastMessageAt: newMsg.createdAt,
              }
            : t,
        ),
      );
    } catch {
      dispatch({ type: "SEND_FAILED" });
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !selectedId || sending) return;
    dispatch({ type: "START_SENDING" });
    try {
      const newMsg = await sendMessage(selectedId, text);
      dispatch({ type: "APPEND_MESSAGE", msg: newMsg });
      dispatch({ type: "SEND_COMPLETE" });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? {
                ...t,
                lastMessageBody: newMsg.body,
                lastMessageSenderId: newMsg.senderId,
                lastMessageAt: newMsg.createdAt,
              }
            : t,
        ),
      );
    } catch {
      dispatch({ type: "SEND_FAILED" });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function fmtTime(date: Date) {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function timeAgo(date: Date) {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }

  const handleComposeClose = useCallback(() => {
    dispatch({ type: "CLOSE_COMPOSE" });
  }, []);

  function handleCreated(threadId: number) {
    getClientThreads().then((rows) => {
      setThreads(rows);
      dispatch({ type: "SELECT_THREAD", id: threadId });
    });
  }

  const selected = threads.find((t) => t.id === selectedId);

  return (
    <div className="flex h-full max-h-screen">
      {/* Thread list sidebar — only if multiple threads */}
      {(hasMultipleThreads || threads.length === 0) && (
        <div
          className={cn(
            "w-72 border-r border-border bg-background flex flex-col shrink-0",
            selectedId && "hidden lg:flex",
          )}
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <p className="text-sm font-semibold text-foreground">Messages</p>
            <button
              onClick={() => dispatch({ type: "OPEN_COMPOSE" })}
              className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
              title="New message"
            >
              <PenSquare className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => dispatch({ type: "SELECT_THREAD", id: t.id })}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-foreground/5 transition-colors",
                  t.id === selectedId && "bg-foreground/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                    {t.isGroup && <Users className="w-3.5 h-3.5 text-muted shrink-0" />}
                    {t.subject}
                  </p>
                  <span className="text-[10px] text-muted shrink-0">
                    {timeAgo(t.lastMessageAt)}
                  </span>
                </div>
                {t.lastMessageBody && (
                  <p className="text-xs text-muted truncate mt-0.5">
                    {t.lastMessageBody.slice(0, 60)}
                  </p>
                )}
                {t.unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-accent rounded-full mt-1">
                    {t.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-3">
            {hasMultipleThreads && (
              <button
                onClick={() => dispatch({ type: "DESELECT_THREAD" })}
                className="lg:hidden p-1 rounded-lg hover:bg-foreground/8 text-muted"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {selected?.isGroup ? (
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-accent" />
              </div>
            ) : (
              <TCLogo size={32} className="text-accent shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">
                {selected?.subject ?? "T Creative Studio"}
              </p>
              {!selected?.isGroup && <p className="text-[11px] text-muted">Trini · Studio owner</p>}
            </div>
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && (
            <div className="flex flex-col items-center justify-center flex-1">
              <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          )}
          {showQuickReplies && (
            <div className="flex flex-col items-center justify-center flex-1 space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">How can we help you?</p>
                <p className="text-xs text-muted">Pick an option or type a message below.</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
                {QUICK_OPTIONS.map(({ label, desc, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => handleQuickReply(label)}
                    disabled={sending}
                    className="flex flex-col items-start gap-1.5 p-3 bg-surface border border-border rounded-xl hover:bg-foreground/5 hover:border-accent/30 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground leading-tight">
                        {label}
                      </p>
                      <p className="text-[11px] text-muted leading-snug">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((msg) => {
            const isClient = msg.senderRole === "client";
            return (
              <div
                key={msg.id}
                className={cn("flex gap-2", isClient ? "flex-row-reverse" : "flex-row")}
              >
                {!isClient && (
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <TCLogo size={16} className="text-accent" />
                  </div>
                )}
                <div
                  className={cn("max-w-[75%] space-y-1", isClient ? "items-end" : "items-start")}
                >
                  {selected?.isGroup && !isClient && (
                    <p className="text-[10px] text-muted px-1">
                      {msg.senderFirstName} {msg.senderLastName}
                    </p>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap",
                      isClient
                        ? "bg-accent text-white rounded-tr-sm"
                        : "bg-surface border border-border text-foreground rounded-tl-sm",
                    )}
                  >
                    {msg.body}
                  </div>
                  <p
                    className={cn(
                      "text-[10px] text-muted/60 px-1",
                      isClient ? "text-right" : "text-left",
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

        {/* Compose */}
        {selectedId && (
          <div className="px-4 py-3 border-t border-border bg-background shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => dispatch({ type: "SET_DRAFT", draft: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Message T Creative Studio..."
                rows={1}
                className="flex-1 resize-none text-[13.5px] text-foreground placeholder:text-muted/50 bg-surface border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-accent/40 max-h-32"
                style={{ overflow: "hidden" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  draft.trim() && !sending
                    ? "bg-accent text-white hover:bg-accent/90"
                    : "bg-foreground/5 text-muted cursor-not-allowed",
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-muted/50 mt-1.5 px-1">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        )}
      </div>

      {/* Compose dialog */}
      <ComposeDialog
        open={composeOpen}
        onClose={handleComposeClose}
        onCreated={handleCreated}
      />
    </div>
  );
}
