/**
 * ThreadView.tsx
 * Thread detail view: header with actions, reference photos, message bubbles,
 * and compose input area.
 */

import { RefObject } from "react";
import {
  Send,
  Paperclip,
  ArrowLeft,
  Star,
  Archive,
  CheckCircle2,
  XCircle,
  Users,
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
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Thread header */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
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
      </div>

      {/* Reference photos */}
      {selected.threadType === "request" &&
        selected.referencePhotoUrls &&
        selected.referencePhotoUrls.length > 0 && (
          <div className="px-5 py-3 border-b border-border bg-surface/50">
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
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loadingMsgs && <p className="text-sm text-muted text-center py-6">Loading messages...</p>}
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
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30 max-h-32 overflow-y-auto"
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
      </div>
    </div>
  );
}
