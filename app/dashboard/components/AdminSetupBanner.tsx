"use client";

import { useState } from "react";
import { X, Check, Link as LinkIcon, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardPageProps } from "../admin-dashboard-types";

export function SetupBanner({
  setup, bookingSlug, onDismiss,
}: {
  setup: NonNullable<DashboardPageProps["setup"]>;
  bookingSlug: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const items = [
    { done: !!setup.studioName, label: "Studio profile", desc: setup.studioName ?? "Name and bio" },
    { done: !!setup.locationArea, label: "Location", desc: setup.locationArea ?? "Where you work" },
    { done: setup.socialCount > 0, label: "Social links", desc: setup.socialCount > 0 ? `${setup.socialCount} connected` : "Instagram, TikTok..." },
    { done: setup.hasPolicies, label: "Booking policies", desc: setup.hasPolicies ? "Fees set" : "Cancellation & no-show" },
    { done: setup.hasDeposits, label: "Deposits", desc: setup.hasDeposits ? "Amounts set" : "Protect your time" },
  ];
  const completedCount = items.filter((i) => i.done).length;
  const bookingUrl = `tcreative.studio/book/${bookingSlug}`;

  function handleCopy() {
    navigator.clipboard.writeText(`https://${bookingUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="gap-0 py-0 border-accent/20 bg-accent/[0.03]">
      <CardContent className="px-5 py-4 space-y-4">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider">
            Setup — {completedCount}/5
          </p>
          <div className="flex-1 h-1 rounded-full bg-foreground/6 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 5) * 100}%` }}
            />
          </div>
          {completedCount === 5 && (
            <span className="text-[10px] font-semibold text-[#4e6b51]">Complete</span>
          )}
          <button
            onClick={onDismiss}
            className="p-1 rounded-md hover:bg-foreground/8 text-muted hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Checklist */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {items.map(({ done, label, desc }) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors",
                done ? "bg-surface border-foreground/8" : "bg-foreground/[0.02] border-foreground/5",
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                  done ? "bg-[#4e6b51]/15 text-[#4e6b51]" : "bg-foreground/6 text-foreground/20",
                )}
              >
                {done ? <Check className="w-3 h-3" /> : "○"}
              </div>
              <div className="min-w-0">
                <p className={cn("text-xs font-semibold leading-tight", done ? "text-foreground" : "text-foreground/50")}>
                  {label}
                </p>
                <p className="text-[10px] text-muted/50 truncate">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Booking link */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface border border-foreground/8">
          <div className="w-7 h-7 rounded-lg bg-accent/12 flex items-center justify-center shrink-0">
            <LinkIcon className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider">Your booking link</p>
            <p className="text-sm font-mono text-foreground/80 truncate">
              tcreative.studio/book/<span className="text-accent font-semibold">{bookingSlug}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-accent border border-accent/20 hover:bg-accent/8 transition-colors shrink-0"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
