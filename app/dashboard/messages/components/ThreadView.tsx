/**
 * ThreadView.tsx
 * Thread detail view: header with actions, message bubbles with date
 * separators, skeleton loading, sending indicator, and compose input.
 */

import { RefObject, useMemo, useState } from "react";
import {
  Send,
  ArrowLeft,
  Star,
  Archive,
  CheckCircle2,
  XCircle,
  Users,
  MessageSquare,
  CheckCheck,
  MoreHorizontal,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ThreadRow, MessageRow } from "../actions";
import { initials, fmtTime, STATUS_CFG, TYPE_BADGE } from "./helpers";

export interface ThreadViewProps {
  selected: ThreadRow;
  msgs: MessageRow[];
  loadingMsgs: boolean;
  draft: string;
  sending: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onStar: () => void;
  onArchive: () => void;
  onStatus: (status: "approved" | "rejected" | "resolved") => void;
  onSend: () => void;
  onDraftChange: (value: string) => void;
  threadDisplayName: (t: ThreadRow) => string;
}

/* ---- Date separator helper ---- */

function fmtDateSeparator(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  if (d >= today) return "Today";
  if (d >= yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" });
}

function getDateKey(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/* ---- Skeleton loading ---- */

function MessageSkeleton() {
  return (
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
      <div className="flex gap-2.5">
        <div className="w-7 h-7 rounded-full bg-surface animate-pulse shrink-0" />
        <div className="space-y-1.5">
          <div className="h-14 w-56 rounded-2xl rounded-tl-sm bg-surface animate-pulse" />
          <div className="h-2.5 w-12 rounded bg-surface/60 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* ---- Mobile actions menu ---- */

function ActionsMenu({
  selected,
  onStar,
  onArchive,
  onStatus,
}: {
  selected: ThreadRow;
  onStar: () => void;
  onArchive: () => void;
  onStatus: (status: "approved" | "rejected" | "resolved") => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-foreground/5 text-muted transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-xl shadow-lg py-1 min-w-[160px]">
            <button
              onClick={() => { onStar(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground hover:bg-foreground/5 transition-colors"
            >
              <Star className={cn("w-3.5 h-3.5", selected.isStarred && "text-amber-500 fill-amber-500")} />
              {selected.isStarred ? "Unstar" : "Star"}
            </button>
            {selected.threadType === "request" && selected.status !== "approved" && (
              <button
                onClick={() => { onStatus("approved"); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#4e6b51] hover:bg-foreground/5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve
              </button>
            )}
            {selected.threadType === "request" && selected.status !== "rejected" && (
              <button
                onClick={() => { onStatus("rejected"); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-destructive hover:bg-foreground/5 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Decline
              </button>
            )}
            <button
              onClick={() => { onArchive(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground hover:bg-foreground/5 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ThreadView({
  selected,
  msgs,
  loadingMsgs,
  draft,
  sending,
  messagesEndRef,
  onBack,
  onStar,
  onArchive,
  onStatus,
  onSend,
  onDraftChange,
  threadDisplayName,
}: ThreadViewProps) {
  // Group messages by date for date separators, and track sender changes
  const messagesWithDates = useMemo(() => {
    const result: ({ type: "date"; label: string; key: string } | { type: "msg"; msg: MessageRow; showSender: boolean })[] = [];
    let lastDateKey = "";
    let lastSenderId = "";
    for (const msg of msgs) {
      const dateKey = getDateKey(msg.createdAt);
      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        lastSenderId = ""; // Reset sender tracking on new date
        result.push({ type: "date", label: fmtDateSeparator(msg.createdAt), key: dateKey });
      }
      // Show sender name only when sender changes or in group threads
      const showSender = selected.isGroup && msg.senderId !== lastSenderId;
      lastSenderId = msg.senderId;
      result.push({ type: "msg", msg, showSender });
    }
    return result;
  }, [msgs, selected.isGroup]);

  // Check if last message is from studio and has been read (for read receipts)
  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
  const showReadReceipt =
    lastMsg && lastMsg.senderRole !== "client" && lastMsg.isRead;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Thread header */}
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center gap-3">
        <button
          className="lg:hidden p-1.5 rounded-lg hover:bg-foreground/5 text-muted"
          onClick={onBack}
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
          <p className="text-sm font-semibold text-foreground truncate">{threadDisplayName(selected)}</p>
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

        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-0.5">
          <button
            onClick={onStar}
            className="p-2 rounded-lg hover:bg-foreground/5 text-muted transition-colors"
            title={selected.isStarred ? "Unstar" : "Star"}
          >
            <Star
              className={cn("w-4 h-4", selected.isStarred && "text-amber-500 fill-amber-500")}
            />
          </button>
          {selected.threadType === "request" && selected.status !== "approved" && (
            <button
              onClick={() => onStatus("approved")}
              className="p-2 rounded-lg hover:bg-[#4e6b51]/10 text-[#4e6b51] transition-colors"
              title="Approve"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {selected.threadType === "request" && selected.status !== "rejected" && (
            <button
              onClick={() => onStatus("rejected")}
              className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
              title="Decline"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onArchive}
            className="p-2 rounded-lg hover:bg-foreground/5 text-muted transition-colors"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile actions menu */}
        <div className="sm:hidden">
          <ActionsMenu selected={selected} onStar={onStar} onArchive={onArchive} onStatus={onStatus} />
        </div>
      </div>

      {/* Reference photos */}
      {selected.threadType === "request" &&
        selected.referencePhotoUrls &&
        selected.referencePhotoUrls.length > 0 && (
          <div className="px-4 sm:px-5 py-3 border-b border-border bg-surface/50">
            <p className="text-[11px] font-medium text-muted mb-2">Client reference photos</p>
            <div className="flex gap-2 flex-wrap">
              {selected.referencePhotoUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0 hover:opacity-90 transition-opacity"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Reference ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
        {loadingMsgs && <MessageSkeleton />}
        {!loadingMsgs && msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-muted" />
            </div>
            <p className="text-sm font-medium text-foreground">Start the conversation</p>
            <p className="text-xs text-muted mt-1">
              Send a message below to begin chatting.
            </p>
          </div>
        )}
        {messagesWithDates.map((item) => {
          if (item.type === "date") {
            return (
              <div key={item.key} className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] font-medium text-muted/60 uppercase tracking-wide shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            );
          }
          const msg = item.msg;
          const isStudio = msg.senderRole !== "client";
          const isLastMsg = msg.id === lastMsg?.id;
          return (
            <div
              key={msg.id}
              className={cn("flex gap-2.5", isStudio ? "flex-row-reverse" : "flex-row")}
            >
              {/* Avatar — initials for everyone, consistent style */}
              <Avatar size="sm" className="shrink-0 mt-0.5 w-7 h-7">
                <AvatarFallback
                  className={cn(
                    "text-[10px] font-semibold w-7 h-7",
                    isStudio
                      ? "bg-accent/10 text-accent"
                      : "bg-surface text-muted",
                  )}
                >
                  {initials(msg.senderFirstName, msg.senderLastName)}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "max-w-[72%] flex flex-col gap-0.5",
                  isStudio ? "items-end" : "items-start",
                )}
              >
                {/* Sender name — only in group threads and when sender changes */}
                {item.showSender && (
                  <span className="text-[10px] font-medium text-muted/70 px-1">
                    {msg.senderFirstName} {msg.senderLastName}
                  </span>
                )}
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap",
                    isStudio
                      ? "bg-accent text-white rounded-tr-sm"
                      : "bg-surface text-foreground rounded-tl-sm border border-border",
                  )}
                >
                  {msg.body}
                </div>
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] text-muted/60">{fmtTime(msg.createdAt)}</span>
                  {isStudio && isLastMsg && showReadReceipt && (
                    <CheckCheck className="w-3 h-3 text-accent" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {/* Sending indicator */}
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
        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
      <div className="px-4 sm:px-5 py-3 border-t border-border">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-surface border border-border rounded-xl px-4 py-2.5 text-[13.5px] placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30 max-h-32 overflow-y-auto"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <button
            onClick={onSend}
            disabled={!draft.trim() || sending}
            className="p-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted/40 mt-1.5 px-1 hidden sm:block">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
