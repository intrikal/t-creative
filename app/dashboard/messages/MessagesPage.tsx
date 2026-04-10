"use client";

import {
  useReducer,
  useState,
  useEffect,
  useRef,
  useOptimistic,
  useTransition,
  useCallback,
} from "react";
import { MessageSquare, PenSquare } from "lucide-react";
import { ComposeDialog } from "@/components/messages/ComposeDialog";
import { useRealtimeMessages } from "@/lib/hooks/useRealtimeMessages";
import { useRealtimeThreadList } from "@/lib/hooks/useRealtimeThreadList";
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
import { NotificationsPanel } from "./components/NotificationsPanel";
import { ThreadList } from "./components/ThreadList";
import { ThreadView } from "./components/ThreadView";

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

type MessagesState = {
  selectedId: number | null;
  msgs: MessageRow[];
  loadingMsgs: boolean;
  filter: "all" | "new" | "starred" | "archived";
  draft: string;
  sending: boolean;
  search: string;
  composeOpen: boolean;
  viewMode: "inbox" | "notifications";
};

type MessagesAction =
  | { type: "SELECT_THREAD"; id: number }
  | { type: "DESELECT_THREAD" }
  | { type: "SET_MESSAGES"; msgs: MessageRow[] }
  | { type: "APPEND_MESSAGE"; msg: MessageRow }
  | { type: "SET_FILTER"; filter: MessagesState["filter"] }
  | { type: "SET_SEARCH"; search: string }
  | { type: "SET_DRAFT"; draft: string }
  | { type: "START_SENDING" }
  | { type: "SEND_COMPLETE" }
  | { type: "SEND_FAILED" }
  | { type: "OPEN_COMPOSE" }
  | { type: "CLOSE_COMPOSE" }
  | { type: "SET_VIEW_MODE"; mode: MessagesState["viewMode"] };

function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case "SELECT_THREAD":
      return { ...state, selectedId: action.id, msgs: [], loadingMsgs: true, draft: "" };
    case "DESELECT_THREAD":
      return { ...state, selectedId: null, msgs: [], loadingMsgs: false };
    case "SET_MESSAGES":
      return { ...state, msgs: action.msgs, loadingMsgs: false };
    case "APPEND_MESSAGE":
      // Dedup by id
      if (state.msgs.some((m) => m.id === action.msg.id)) return state;
      return { ...state, msgs: [...state.msgs, action.msg] };
    case "SET_FILTER":
      return { ...state, filter: action.filter };
    case "SET_SEARCH":
      return { ...state, search: action.search };
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
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function MessagesPage({
  initialThreads,
  clients,
  currentUserId,
}: {
  initialThreads: ThreadRow[];
  clients: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [state, dispatch] = useReducer(messagesReducer, {
    selectedId: null,
    msgs: [],
    loadingMsgs: false,
    filter: "all" as const,
    draft: "",
    sending: false,
    search: "",
    composeOpen: false,
    viewMode: "inbox" as const,
  });

  const { selectedId, msgs, loadingMsgs, filter, draft, sending, search, composeOpen, viewMode } =
    state;

  const [baseThreads, setBaseThreads] = useState(initialThreads);
  const [, startTransition] = useTransition();
  const [threadsList, updateThreads] = useOptimistic<
    ThreadRow[],
    | { type: "mark_read"; id: number }
    | { type: "update_last_message"; id: number; body: string; at: Date; senderId: string }
    | { type: "star"; id: number }
    | { type: "archive"; id: number }
    | { type: "status"; id: number; status: string }
  >(baseThreads, (state, action) => {
    switch (action.type) {
      case "mark_read":
        return state.map((t) => (t.id === action.id ? { ...t, unreadCount: 0 } : t));
      case "update_last_message":
        return state.map((t) =>
          t.id === action.id
            ? {
                ...t,
                lastMessageBody: action.body,
                lastMessageAt: action.at,
                lastMessageSenderId: action.senderId,
              }
            : t,
        );
      case "star":
        return state.map((t) => (t.id === action.id ? { ...t, isStarred: !t.isStarred } : t));
      case "archive":
        return state.map((t) => (t.id === action.id ? { ...t, isArchived: true } : t));
      case "status":
        return state.map((t) => (t.id === action.id ? { ...t, status: action.status } : t));
    }
  });

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
    getThreadMessages(selectedId).then((rows) => {
      if (cancelled) return;
      dispatch({ type: "SET_MESSAGES", msgs: rows });
      startTransition(async () => {
        updateThreads({ type: "mark_read", id: selectedId });
        await markThreadRead(selectedId);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, updateThreads]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // ---- Supabase Realtime ----
  useRealtimeMessages({
    threadId: selectedId,
    currentUserId,
    onNewMessage: useCallback((newMsg) => {
      getThreadMessages(newMsg.thread_id).then((rows) => {
        const fullMsg = rows.find((r) => r.id === newMsg.id);
        if (fullMsg) dispatch({ type: "APPEND_MESSAGE", msg: fullMsg });
        markThreadRead(newMsg.thread_id);
      });
    }, []),
  });

  useRealtimeThreadList({
    currentUserId,
    selectedThreadId: selectedId,
    setThreads: setBaseThreads,
  });

  // ---- Handlers ----

  const handleSelectThread = useCallback((id: number | null) => {
    if (id === null) {
      dispatch({ type: "DESELECT_THREAD" });
    } else {
      dispatch({ type: "SELECT_THREAD", id });
    }
  }, []);

  const handleFilterChange = useCallback((f: "all" | "new" | "starred" | "archived") => {
    dispatch({ type: "SET_FILTER", filter: f });
  }, []);

  const handleSearchChange = useCallback((s: string) => {
    dispatch({ type: "SET_SEARCH", search: s });
  }, []);

  const handleDraftChange = useCallback((d: string) => {
    dispatch({ type: "SET_DRAFT", draft: d });
  }, []);

  const handleComposeOpen = useCallback(() => {
    dispatch({ type: "OPEN_COMPOSE" });
  }, []);

  const handleComposeClose = useCallback(() => {
    dispatch({ type: "CLOSE_COMPOSE" });
  }, []);

  const handleViewNotifications = useCallback(() => {
    dispatch({ type: "SET_VIEW_MODE", mode: "notifications" });
  }, []);

  async function handleSend() {
    if (!draft.trim() || !selectedId || sending) return;
    dispatch({ type: "START_SENDING" });
    try {
      const newMsg = await sendMessage(selectedId, draft.trim());
      dispatch({ type: "APPEND_MESSAGE", msg: newMsg });
      dispatch({ type: "SEND_COMPLETE" });
      setBaseThreads((prev) =>
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
    } catch {
      dispatch({ type: "SEND_FAILED" });
    }
  }

  function handleStar() {
    if (!selectedId) return;
    startTransition(async () => {
      updateThreads({ type: "star", id: selectedId });
      await toggleThreadStar(selectedId);
    });
  }

  function handleArchive() {
    if (!selectedId) return;
    // Fix: deselect INSIDE the transition to avoid race condition
    startTransition(async () => {
      updateThreads({ type: "archive", id: selectedId });
      dispatch({ type: "DESELECT_THREAD" });
      await archiveThread(selectedId);
    });
  }

  function handleStatus(status: "approved" | "rejected" | "resolved") {
    if (!selectedId) return;
    startTransition(async () => {
      updateThreads({ type: "status", id: selectedId, status });
      await updateThreadStatus(selectedId, status);
    });
  }

  function handleCreated(threadId: number) {
    // Wrap in startTransition so the thread list refetch doesn't flash
    startTransition(async () => {
      const rows = await getThreads();
      setBaseThreads(rows);
      dispatch({ type: "SELECT_THREAD", id: threadId });
    });
  }

  function threadDisplayName(t: ThreadRow) {
    if (t.isGroup) return t.subject;
    if (t.clientFirstName) return `${t.clientFirstName} ${t.clientLastName ?? ""}`.trim();
    return t.subject;
  }

  const isNotifications = viewMode === "notifications";

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
      {/* Notifications view — kept mounted so data persists */}
      <div
        className={cn("flex-1 flex flex-col min-w-0 min-h-0", isNotifications ? "flex" : "hidden")}
      >
        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h1 className="text-base font-semibold text-foreground tracking-tight">Notifications</h1>
          <button
            onClick={() => dispatch({ type: "SET_VIEW_MODE", mode: "inbox" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-foreground/5 border border-border transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Back to Inbox
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <NotificationsPanel clients={clients} />
        </div>
      </div>

      {/* Inbox view */}
      <div
        className={cn("flex flex-1 min-h-0 overflow-hidden", isNotifications ? "hidden" : "flex")}
      >
        <ThreadList
          filtered={filtered}
          selectedId={selectedId}
          totalUnread={totalUnread}
          filter={filter}
          search={search}
          onSelectThread={handleSelectThread}
          onFilterChange={handleFilterChange}
          onSearchChange={handleSearchChange}
          onComposeOpen={handleComposeOpen}
          onViewNotifications={handleViewNotifications}
          threadDisplayName={threadDisplayName}
          hasSelected={!!selected}
        />

        {selected ? (
          <ThreadView
            selected={selected}
            msgs={msgs}
            loadingMsgs={loadingMsgs}
            draft={draft}
            sending={sending}
            messagesEndRef={messagesEndRef}
            onBack={() => dispatch({ type: "DESELECT_THREAD" })}
            onStar={handleStar}
            onArchive={handleArchive}
            onStatus={handleStatus}
            onSend={handleSend}
            onDraftChange={handleDraftChange}
            threadDisplayName={threadDisplayName}
          />
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center text-center">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-muted" />
              </div>
              <p className="text-sm font-medium text-foreground">Select a conversation</p>
              <p className="text-xs text-muted mt-1 mb-4">
                Choose a message from the inbox to read and reply.
              </p>
              <button
                onClick={handleComposeOpen}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
              >
                <PenSquare className="w-3.5 h-3.5" />
                New Message
              </button>
            </div>
          </div>
        )}

        <ComposeDialog open={composeOpen} onClose={handleComposeClose} onCreated={handleCreated} />
      </div>
    </div>
  );
}
