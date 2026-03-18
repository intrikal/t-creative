"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { ComposeDialog } from "@/components/messages/ComposeDialog";
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
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

type ViewMode = "inbox" | "notifications";

export function MessagesPage({
  initialThreads,
  clients,
}: {
  initialThreads: ThreadRow[];
  clients: { id: string; name: string }[];
}) {
  const [threadsList, setThreadsList] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<MessageRow[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "starred" | "archived">("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("inbox");
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
      {viewMode === "notifications" ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Notifications header */}
          <div className="px-4 pt-5 pb-3 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold text-foreground tracking-tight">
                Notifications
              </h1>
              <button
                onClick={() => setViewMode("inbox")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Inbox
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NotificationsPanel clients={clients} />
          </div>
        </div>
      ) : (
        <>
          <ThreadList
            filtered={filtered}
            selectedId={selectedId}
            totalUnread={totalUnread}
            filter={filter}
            search={search}
            onSelectThread={setSelectedId}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            onComposeOpen={() => setComposeOpen(true)}
            onViewNotifications={() => setViewMode("notifications")}
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
              onBack={() => setSelectedId(null)}
              onStar={handleStar}
              onArchive={handleArchive}
              onStatus={handleStatus}
              onSend={handleSend}
              onDraftChange={setDraft}
              threadDisplayName={threadDisplayName}
            />
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
        </>
      )}
    </div>
  );
}
