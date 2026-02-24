"use client";

import { useState } from "react";
import { Mail, Phone, Clock, CheckCheck, Archive } from "lucide-react";
import { Dialog, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GeneralInquiry } from "../InquiriesPage";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  SOURCE_ICON,
  SOURCE_LABEL,
  statusBadge,
} from "../InquiriesPage";

export function GeneralDetailDialog({
  inquiry,
  onClose,
  onMarkRead,
  onArchive,
  onReply,
}: {
  inquiry: GeneralInquiry | null;
  onClose: () => void;
  onMarkRead: (id: number) => void;
  onArchive: (id: number) => void;
  onReply: (id: number, text: string) => void;
}) {
  const [replyText, setReplyText] = useState("");
  if (!inquiry) return null;
  const cat = inquiry.interest ? CATEGORY_COLOR[inquiry.interest] : null;
  const sb = statusBadge(inquiry.status);

  return (
    <Dialog open={!!inquiry} onClose={onClose} title={inquiry.name} size="lg">
      <div className="space-y-4">
        {/* Contact info row */}
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          <a
            href={`mailto:${inquiry.email}`}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            {inquiry.email}
          </a>
          {inquiry.phone && (
            <a
              href={`tel:${inquiry.phone}`}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {inquiry.phone}
            </a>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {inquiry.receivedAt}
          </span>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", sb.cls)}>
            {sb.label}
          </span>
          {cat && inquiry.interest && (
            <span
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1",
                cat.bg,
                cat.text,
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />
              {CATEGORY_LABEL[inquiry.interest]}
            </span>
          )}
          {inquiry.source && (
            <span className="text-[11px] text-muted flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60">
              {SOURCE_ICON[inquiry.source]}
              {SOURCE_LABEL[inquiry.source]}
            </span>
          )}
        </div>

        {/* Full message */}
        <div className="bg-surface rounded-xl p-4 border border-border/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Message</p>
          <p className="text-sm text-foreground leading-relaxed">{inquiry.message}</p>
        </div>

        {/* Staff reply if already replied */}
        {inquiry.staffReply && (
          <div className="bg-[#4e6b51]/5 rounded-xl p-4 border border-[#4e6b51]/15">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4e6b51] mb-2">
              Your Reply
            </p>
            <p className="text-sm text-foreground leading-relaxed">{inquiry.staffReply}</p>
          </div>
        )}

        {/* Quick reply */}
        {inquiry.status !== "archived" && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              Quick Reply
            </p>
            <Textarea
              rows={3}
              placeholder="Type a reply…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <a
            href={`mailto:${inquiry.email}${replyText ? `?body=${encodeURIComponent(replyText)}` : ""}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Reply via Email
          </a>
          {inquiry.phone && (
            <a
              href={`tel:${inquiry.phone}`}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-xs font-medium text-foreground rounded-lg hover:bg-foreground/5 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          )}
          {replyText.trim() && (
            <button
              onClick={() => {
                onReply(inquiry.id, replyText.trim());
                setReplyText("");
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#4e6b51] text-white text-xs font-medium rounded-lg hover:bg-[#4e6b51]/90 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Save Reply
            </button>
          )}
          {inquiry.status !== "read" && inquiry.status !== "replied" && (
            <button
              onClick={() => {
                onMarkRead(inquiry.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-xs font-medium text-foreground rounded-lg hover:bg-foreground/5 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark as Read
            </button>
          )}
          {inquiry.status !== "archived" && (
            <button
              onClick={() => {
                onArchive(inquiry.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-xs font-medium text-muted rounded-lg hover:bg-foreground/5 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
