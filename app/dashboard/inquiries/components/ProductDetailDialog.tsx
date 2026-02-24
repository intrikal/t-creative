"use client";

import { useState } from "react";
import { Mail, Phone, Clock, CheckCheck, Tag, DollarSign } from "lucide-react";
import { Dialog, Field, Input } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProductInquiry } from "../InquiriesPage";
import { CATEGORY_COLOR, CATEGORY_LABEL, productStatusBadge } from "../InquiriesPage";

export function ProductDetailDialog({
  inquiry,
  onClose,
  onSendQuote,
  onUpdateStatus,
}: {
  inquiry: ProductInquiry | null;
  onClose: () => void;
  onSendQuote: (id: number, amountInCents: number) => void;
  onUpdateStatus: (id: number, status: ProductInquiry["status"]) => void;
}) {
  const [quoteInput, setQuoteInput] = useState(
    inquiry?.quotedInCents ? `$${(inquiry.quotedInCents / 100).toFixed(0)}` : "",
  );
  if (!inquiry) return null;
  const cat = inquiry.category ? CATEGORY_COLOR[inquiry.category] : null;
  const sb = productStatusBadge(inquiry.status);

  function handleSendQuote() {
    const cleaned = quoteInput.replace(/[$,\s]/g, "");
    const dollars = parseFloat(cleaned);
    if (isNaN(dollars) || dollars <= 0) return;
    onSendQuote(inquiry!.id, Math.round(dollars * 100));
    onClose();
  }

  return (
    <Dialog open={!!inquiry} onClose={onClose} title={inquiry.name} size="lg">
      <div className="space-y-4">
        {/* Contact */}
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
          {cat && inquiry.category && (
            <span
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1",
                cat.bg,
                cat.text,
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />
              {CATEGORY_LABEL[inquiry.category]}
            </span>
          )}
          {inquiry.quantity > 1 && (
            <span className="text-[11px] text-muted flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60">
              Qty: {inquiry.quantity}
            </span>
          )}
        </div>

        {/* Product */}
        <div className="bg-surface rounded-xl p-4 border border-border/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
            Product / Service Requested
          </p>
          <p className="text-sm font-medium text-foreground">{inquiry.product}</p>
          {inquiry.message && (
            <p className="text-sm text-muted mt-2 leading-relaxed">{inquiry.message}</p>
          )}
          {inquiry.customizations && (
            <p className="text-sm text-muted mt-2 leading-relaxed">
              <span className="font-medium text-foreground">Customizations:</span>{" "}
              {inquiry.customizations}
            </p>
          )}
        </div>

        {/* Quote input */}
        {(inquiry.status === "new" || inquiry.status === "contacted") && (
          <Field label="Quote Amount">
            <Input
              placeholder="e.g. $150"
              value={quoteInput}
              onChange={(e) => setQuoteInput(e.target.value)}
            />
          </Field>
        )}
        {inquiry.quotedInCents && inquiry.status !== "new" && inquiry.status !== "contacted" && (
          <div className="flex items-center justify-between py-2 px-4 bg-[#4e6b51]/8 rounded-xl border border-[#4e6b51]/15">
            <span className="text-xs text-muted">Quoted amount</span>
            <span className="text-sm font-semibold text-[#4e6b51]">
              ${(inquiry.quotedInCents / 100).toLocaleString()}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <a
            href={`mailto:${inquiry.email}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Reply via Email
          </a>
          {(inquiry.status === "new" || inquiry.status === "contacted") && (
            <>
              <button
                onClick={handleSendQuote}
                disabled={!quoteInput.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#4e6b51] text-white text-xs font-medium rounded-lg hover:bg-[#4e6b51]/90 transition-colors disabled:opacity-50"
              >
                <Tag className="w-3.5 h-3.5" /> Send Quote
              </button>
            </>
          )}
          {inquiry.status === "quote_sent" && (
            <>
              <button
                onClick={() => {
                  onUpdateStatus(inquiry.id, "in_progress");
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#4e6b51] text-white text-xs font-medium rounded-lg hover:bg-[#4e6b51]/90 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark In Progress
              </button>
            </>
          )}
          {inquiry.status === "in_progress" && (
            <button
              onClick={() => {
                onUpdateStatus(inquiry.id, "completed");
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#4e6b51] text-white text-xs font-medium rounded-lg hover:bg-[#4e6b51]/90 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark Completed
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
