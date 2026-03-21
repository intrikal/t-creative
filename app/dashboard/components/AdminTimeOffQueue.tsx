"use client";

import { useState } from "react";
import { Check, X, Clock, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PendingTimeOffRequest } from "../time-off-actions";
import { approveTimeOffRequest, denyTimeOffRequest } from "../time-off-actions";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RequestCard({ request }: { request: PendingTimeOffRequest }) {
  const [processing, setProcessing] = useState<"approve" | "deny" | null>(null);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [deniedReason, setDeniedReason] = useState("");
  const [done, setDone] = useState<"approved" | "denied" | null>(null);

  const staffName = [request.staffFirstName, request.staffLastName].filter(Boolean).join(" ");
  const initials = [request.staffFirstName[0], request.staffLastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();

  const dateLabel =
    request.startDate === request.endDate
      ? formatDate(request.startDate)
      : `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`;

  async function handleApprove() {
    setProcessing("approve");
    try {
      await approveTimeOffRequest(request.id);
      setDone("approved");
    } finally {
      setProcessing(null);
    }
  }

  async function handleDeny() {
    setProcessing("deny");
    try {
      await denyTimeOffRequest(request.id, deniedReason || undefined);
      setDone("denied");
    } finally {
      setProcessing(null);
      setShowDenyForm(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 py-3 px-3 rounded-xl bg-surface/40 border border-border/30">
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
            done === "approved" ? "bg-[#4e6b51]/15" : "bg-red-400/15",
          )}
        >
          {done === "approved" ? (
            <Check className="w-3 h-3 text-[#4e6b51]" />
          ) : (
            <X className="w-3 h-3 text-red-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{staffName}</p>
          <p className="text-xs text-muted">{dateLabel}</p>
        </div>
        <span
          className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
            done === "approved"
              ? "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20"
              : "bg-red-400/10 text-red-400 border-red-400/20",
          )}
        >
          {done === "approved" ? "Approved" : "Denied"}
        </span>
      </div>
    );
  }

  return (
    <div className="py-3 px-3 rounded-xl bg-surface/60 border border-border/40 space-y-2.5">
      {/* Staff info + dates */}
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent shrink-0 mt-0.5">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{staffName}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <CalendarDays className="w-3 h-3 text-muted shrink-0" />
            <span className="text-xs text-muted">{dateLabel}</span>
            {request.isPartial && request.partialStartTime && request.partialEndTime && (
              <>
                <span className="text-muted/40 text-xs">·</span>
                <Clock className="w-3 h-3 text-muted shrink-0" />
                <span className="text-xs text-muted">
                  {request.partialStartTime} – {request.partialEndTime}
                </span>
              </>
            )}
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                request.isPartial
                  ? "bg-purple-50 text-purple-600"
                  : request.type === "vacation"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-amber-50 text-amber-600",
              )}
            >
              {request.isPartial ? "Partial" : request.type === "vacation" ? "Vacation" : "Day Off"}
            </span>
          </div>
          {request.reason && (
            <p className="text-xs text-muted/70 mt-1 italic">&ldquo;{request.reason}&rdquo;</p>
          )}
        </div>
        <span className="text-[10px] text-muted/50 shrink-0">{request.submittedOn}</span>
      </div>

      {/* Deny reason form */}
      {showDenyForm && (
        <div className="pl-10">
          <input
            type="text"
            value={deniedReason}
            onChange={(e) => setDeniedReason(e.target.value)}
            placeholder="Reason for denial (optional)"
            className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pl-10">
        <button
          onClick={handleApprove}
          disabled={!!processing}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#4e6b51]/10 text-[#4e6b51] rounded-lg hover:bg-[#4e6b51]/20 transition-colors disabled:opacity-60"
        >
          <Check className="w-3 h-3" />
          {processing === "approve" ? "Approving…" : "Approve"}
        </button>

        {showDenyForm ? (
          <>
            <button
              onClick={handleDeny}
              disabled={!!processing}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-400/10 text-red-500 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-60"
            >
              <X className="w-3 h-3" />
              {processing === "deny" ? "Denying…" : "Confirm Deny"}
            </button>
            <button
              onClick={() => {
                setShowDenyForm(false);
                setDeniedReason("");
              }}
              className="px-3 py-1.5 text-xs font-medium text-muted rounded-lg hover:bg-foreground/5 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowDenyForm(true)}
            disabled={!!processing}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted rounded-lg hover:bg-foreground/5 hover:text-foreground transition-colors disabled:opacity-60"
          >
            <X className="w-3 h-3" />
            Deny
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminTimeOffQueue({ requests }: { requests: PendingTimeOffRequest[] }) {
  if (requests.length === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-sm font-semibold">Time-Off Requests</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3">
          <p className="text-sm text-muted/60 italic text-center py-4">
            No pending time-off requests.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Time-Off Requests</CardTitle>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#7a5c10]/10 text-[#7a5c10] border border-[#7a5c10]/20">
            {requests.length} pending
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3 space-y-2">
        {requests.map((r) => (
          <RequestCard key={r.id} request={r} />
        ))}
      </CardContent>
    </Card>
  );
}
