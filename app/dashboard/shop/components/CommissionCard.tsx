"use client";

/** Expandable commission card showing status, quote, details, and file attachments. */

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Package,
  ImageIcon,
  FileBox,
  Paperclip,
} from "lucide-react";
import {
  acceptQuote,
  declineQuote,
  type ClientCommission,
  type CommissionCategory,
} from "@/app/dashboard/commissions/actions";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, CAT_CONFIG } from "./commissions-helpers";

export function CommissionCard({ commission }: { commission: ClientCommission }) {
  /** expanded: whether the detail section (description, metadata, files) is open */
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  /** actionDone: tracks the client's quote response so the UI reflects
   *  the new status optimistically before the server confirms */
  const [actionDone, setActionDone] = useState<"accepted" | "declined" | null>(null);

  const s = STATUS_CONFIG[commission.status] ?? STATUS_CONFIG.inquiry;
  const StatusIcon = s.icon;

  const catCfg = CAT_CONFIG[commission.category as CommissionCategory] ?? {
    label: commission.category ?? "Commission",
    icon: Package,
    color: "text-muted",
  };
  const CatIcon = catCfg.icon;

  const meta = commission.metadata as Record<string, unknown> | null;
  // Separate display fields from file URL arrays — SKIP_KEYS holds
  // metadata keys that are rendered as file galleries, not key-value pairs.
  // Object.entries + filter: extract only string-valued metadata fields
  // for the detail grid, skipping file arrays and empty values.
  const SKIP_KEYS = new Set(["referenceUrls", "designUrls"]);
  const metaEntries = meta
    ? Object.entries(meta).filter(([k, v]) => !SKIP_KEYS.has(k) && v && typeof v === "string")
    : [];
  const referenceUrls = (meta?.referenceUrls as string[] | undefined) ?? [];
  const designUrls = (meta?.designUrls as string[] | undefined) ?? [];
  const hasFiles = referenceUrls.length > 0 || designUrls.length > 0;

  function handleAccept() {
    startTransition(async () => {
      await acceptQuote(commission.id);
      setActionDone("accepted");
    });
  }

  function handleDecline() {
    startTransition(async () => {
      await declineQuote(commission.id);
      setActionDone("declined");
    });
  }

  // ternary: derive the displayed status — if the client just accepted
  // or declined, show that immediately without waiting for revalidation
  const effectiveStatus =
    actionDone === "accepted"
      ? "accepted"
      : actionDone === "declined"
        ? "cancelled"
        : commission.status;

  const effectiveCfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.inquiry;
  const EffectiveStatusIcon = effectiveCfg.icon;

  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5">
            <CatIcon className={cn("w-4 h-4", catCfg.color)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {commission.title}
                </p>
                <p className="text-[11px] text-muted/60 mt-0.5">
                  {catCfg.label} · {commission.orderNumber}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-medium border px-1.5 py-0.5 rounded-full shrink-0",
                  effectiveCfg.color,
                  effectiveCfg.bg,
                  effectiveCfg.border,
                )}
              >
                <EffectiveStatusIcon className="w-2.5 h-2.5" />
                {effectiveCfg.label}
              </span>
            </div>

            {/* Quote section */}
            {(effectiveStatus === "quoted" || effectiveStatus === "accepted") &&
              commission.quotedInCents != null && (
                <div className="mt-3 p-3 rounded-xl bg-surface border border-border">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-muted font-medium uppercase tracking-wide">
                        Quoted Price
                      </p>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        ${(commission.quotedInCents / 100).toFixed(0)}
                      </p>
                    </div>
                    {commission.estimatedCompletionAt && (
                      <div className="text-right">
                        <p className="text-[11px] text-muted font-medium uppercase tracking-wide">
                          Est. Completion
                        </p>
                        <p className="text-xs text-foreground mt-0.5">
                          {commission.estimatedCompletionAt}
                        </p>
                      </div>
                    )}
                  </div>

                  {effectiveStatus === "quoted" && !actionDone && (
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={handleAccept}
                        disabled={isPending}
                        className="flex-1 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {isPending ? "…" : "Accept"}
                      </button>
                      <button
                        onClick={handleDecline}
                        disabled={isPending}
                        className="flex-1 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              )}

            {/* Expandable details */}
            {(commission.description || metaEntries.length > 0 || hasFiles) && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 mt-2.5 text-[11px] text-muted hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> Show details
                    {hasFiles && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-muted/60">
                        <Paperclip className="w-2.5 h-2.5" />
                        {referenceUrls.length + designUrls.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            )}

            {expanded && (
              <div className="mt-2.5 space-y-3 text-xs text-muted border-t border-border/50 pt-2.5">
                {commission.description && <p>{commission.description}</p>}

                {metaEntries.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {metaEntries.map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium text-muted/70 capitalize">
                          {k.replace(/([A-Z])/g, " $1").toLowerCase()}:{" "}
                        </span>
                        {String(v)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reference images */}
                {referenceUrls.length > 0 && (
                  <div>
                    <p className="font-medium text-muted/70 mb-1.5 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Reference images
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {referenceUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-16 h-16 rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
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

                {/* Design files */}
                {designUrls.length > 0 && (
                  <div>
                    <p className="font-medium text-muted/70 mb-1.5 flex items-center gap-1">
                      <FileBox className="w-3 h-3" /> Design files
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {designUrls.map((url, i) => {
                        const filename = decodeURIComponent(
                          url.split("/").pop() ?? `file-${i + 1}`,
                        );
                        const ext = filename.split(".").pop()?.toUpperCase() ?? "FILE";
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-foreground/5 transition-colors"
                          >
                            <FileBox className="w-3.5 h-3.5 text-[#5a5aaa] shrink-0" />
                            <span className="text-foreground truncate flex-1">{filename}</span>
                            <span className="text-[10px] text-muted/60 shrink-0">{ext}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted/50 mt-2">{commission.createdAt}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
