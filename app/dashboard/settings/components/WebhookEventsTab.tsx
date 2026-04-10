/**
 * WebhookEventsTab — Admin view of Square webhook event processing status.
 *
 * Shows recent webhook events with their processing status, allows filtering
 * by status, viewing raw payload, and retrying failed events.
 */
"use client";

import { useCallback, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getWebhookEvents,
  getWebhookEventDetail,
  retryWebhookEvent,
  type WebhookEventRow,
  type WebhookEventDetail,
} from "../webhook-actions";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type StatusFilter = "all" | "failed" | "pending";

interface Props {
  initialEvents: WebhookEventRow[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusBadge(row: WebhookEventRow) {
  if (row.isProcessed) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">Processed</Badge>
    );
  }
  if (row.attempts > 1) {
    return <Badge className="bg-red-500/15 text-red-600 border-red-500/20">Failed</Badge>;
  }
  return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20">Pending</Badge>;
}

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateId(id: string | null) {
  if (!id) return "—";
  return id.length > 16 ? `${id.slice(0, 16)}…` : id;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function WebhookEventsTab({ initialEvents }: Props) {
  const [events, setEvents] = useState<WebhookEventRow[]>(initialEvents);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<WebhookEventDetail | null>(null);
  const [isPending, startTransition] = useTransition();
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(
    (status: StatusFilter) => {
      setFilter(status);
      setExpandedId(null);
      setDetail(null);
      setError(null);
      startTransition(async () => {
        const rows = await getWebhookEvents({ status });
        setEvents(rows);
      });
    },
    [startTransition],
  );

  const toggleExpand = useCallback(
    (id: number) => {
      if (expandedId === id) {
        setExpandedId(null);
        setDetail(null);
        return;
      }
      setExpandedId(id);
      setDetail(null);
      startTransition(async () => {
        const d = await getWebhookEventDetail(id);
        setDetail(d);
      });
    },
    [expandedId, startTransition],
  );

  const handleRetry = useCallback(
    (id: number) => {
      setRetryingId(id);
      setError(null);
      startTransition(async () => {
        const result = await retryWebhookEvent(id);
        setRetryingId(null);
        if (!result.success) {
          setError(result.error);
          return;
        }
        const rows = await getWebhookEvents({ status: filter });
        setEvents(rows);
        setExpandedId(null);
        setDetail(null);
      });
    },
    [filter, startTransition],
  );

  const FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "failed", label: "Failed" },
    { value: "pending", label: "Pending" },
  ];

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => loadEvents(value)}
            disabled={isPending}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === value
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <Card className="gap-0">
        <CardContent className="px-0 pb-0 pt-0">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Webhook className="w-8 h-8 text-muted/40 mb-3" />
              <p className="text-sm font-medium text-muted">No webhook events</p>
              <p className="text-xs text-muted/70 mt-1">
                {filter === "failed"
                  ? "No failed webhook events found"
                  : filter === "pending"
                    ? "No pending webhook events found"
                    : "Webhook events will appear here as they are received"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider w-8" />
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                      Event Type
                    </th>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                      External ID
                    </th>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                      Attempts
                    </th>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                      Created
                    </th>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                      Processed
                    </th>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {events.map((row) => (
                    <>
                      <tr
                        key={row.id}
                        onClick={() => toggleExpand(row.id)}
                        className="hover:bg-foreground/[0.02] transition-colors cursor-pointer"
                      >
                        <td className="px-3 sm:px-5 py-3 text-muted">
                          {expandedId === row.id ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-foreground font-mono text-xs">
                          {row.eventType}
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-muted font-mono text-xs">
                          {truncateId(row.externalEventId)}
                        </td>
                        <td className="px-3 sm:px-5 py-3">{statusBadge(row)}</td>
                        <td className="px-3 sm:px-5 py-3 text-muted">{row.attempts}</td>
                        <td className="px-3 sm:px-5 py-3 text-foreground whitespace-nowrap">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-muted whitespace-nowrap">
                          {formatDate(row.processedAt)}
                        </td>
                        <td className="px-3 sm:px-5 py-3">
                          {!row.isProcessed && row.attempts > 1 && (
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={retryingId === row.id || isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetry(row.id);
                              }}
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${retryingId === row.id ? "animate-spin" : ""}`}
                              />
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                      {expandedId === row.id && (
                        <tr key={`${row.id}-detail`}>
                          <td colSpan={8} className="bg-foreground/[0.02]">
                            <div className="px-5 py-4 space-y-2">
                              {row.errorMessage && (
                                <div className="text-xs text-red-600 bg-red-500/10 rounded px-3 py-2 font-mono">
                                  {row.errorMessage}
                                </div>
                              )}
                              <p className="text-xs font-medium text-muted uppercase tracking-wider">
                                Raw Payload
                              </p>
                              {detail ? (
                                <pre className="text-xs font-mono text-foreground bg-surface border border-border rounded-lg p-4 overflow-x-auto max-h-80">
                                  {JSON.stringify(detail.payload, null, 2)}
                                </pre>
                              ) : (
                                <p className="text-xs text-muted">Loading…</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
