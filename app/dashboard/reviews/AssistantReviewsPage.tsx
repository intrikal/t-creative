"use client";

import { useState, useTransition } from "react";
import { Star, Reply, X, Send, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AssistantReviewsData, AssistantReviewRow } from "./actions";
import { assistantSaveReply } from "./actions";

type Period = "week" | "month" | "all";

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  google: {
    label: "Google",
    className: "bg-[#4285f4]/10 text-[#4285f4] border-[#4285f4]/20",
  },
  website: {
    label: "Website",
    className: "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20",
  },
  instagram: {
    label: "Instagram",
    className: "bg-[#c13584]/10 text-[#c13584] border-[#c13584]/20",
  },
  yelp: {
    label: "Yelp",
    className: "bg-[#d32323]/10 text-[#d32323] border-[#d32323]/20",
  },
};

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "w-3 h-3",
            i < rating ? "fill-[#d4a574] text-[#d4a574]" : "text-border fill-border",
          )}
        />
      ))}
    </div>
  );
}

export function AssistantReviewsPage({ data }: { data: AssistantReviewsData }) {
  const [reviews, setReviews] = useState<AssistantReviewRow[]>(data.reviews);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [isPending, startTransition] = useTransition();

  const { stats } = data;

  // Filter reviews by period
  const now = new Date();
  const displayReviews =
    period === "week"
      ? (() => {
          const weekStart = new Date(now);
          const day = weekStart.getDay();
          const diff = day === 0 ? 6 : day - 1;
          weekStart.setDate(weekStart.getDate() - diff);
          weekStart.setHours(0, 0, 0, 0);
          return reviews.filter((r) => new Date(r.dateKey) >= weekStart);
        })()
      : period === "month"
        ? (() => {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return reviews.filter((r) => new Date(r.dateKey) >= monthStart);
          })()
        : reviews;

  function openReply(id: number) {
    const r = reviews.find((r) => r.id === id);
    setReplyDraft(r?.replyText ?? "");
    setReplyingTo(id);
  }

  function submitReply(id: number) {
    if (!replyDraft.trim()) return;

    // Optimistic update
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, replied: true, replyText: replyDraft.trim() } : r)),
    );
    setReplyingTo(null);

    const draft = replyDraft.trim();
    setReplyDraft("");

    startTransition(async () => {
      await assistantSaveReply(id, draft);
    });
  }

  function cancelReply() {
    setReplyingTo(null);
    setReplyDraft("");
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">My Reviews</h1>
        <p className="text-sm text-muted mt-0.5">Client feedback on your work</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Avg rating */}
        <Card className="gap-0 py-5 sm:col-span-1">
          <CardContent className="px-5 text-center">
            <p className="text-5xl font-bold text-foreground tracking-tight">
              {stats.avgRating.toFixed(1)}
            </p>
            <div className="flex justify-center mt-2">
              <StarRow rating={Math.round(stats.avgRating)} />
            </div>
            <p className="text-xs text-muted mt-1.5">{stats.totalReviews} reviews</p>
          </CardContent>
        </Card>

        {/* Distribution */}
        <Card className="gap-0 py-5 sm:col-span-2">
          <CardContent className="px-5 space-y-1.5">
            {stats.ratingDist.map(({ stars, count }) => (
              <div key={stars} className="flex items-center gap-2">
                <span className="text-xs text-muted w-3 text-right">{stars}</span>
                <Star className="w-3 h-3 fill-[#d4a574] text-[#d4a574] shrink-0" />
                <div className="flex-1 h-1.5 rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-[#d4a574] transition-all"
                    style={{
                      width: `${stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted w-5 text-right tabular-nums">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "5-Star Reviews", value: stats.fiveStarCount },
          { label: "4-Star Reviews", value: stats.fourStarCount },
          { label: "This Month", value: stats.thisMonthCount },
          { label: "Response Rate", value: `${stats.responseRate}%` },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review list */}
      <div className="space-y-3">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">All Reviews</CardTitle>
            <div className="flex gap-1">
              {(["week", "month", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                    period === p
                      ? "bg-foreground/8 text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {p === "all" ? "All time" : `This ${p}`}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        {displayReviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="w-10 h-10 text-foreground/15 mb-3" />
            <p className="text-sm text-muted">No reviews for this period.</p>
            {period !== "all" && (
              <p className="text-xs text-muted/60 mt-1">Try selecting a longer time range.</p>
            )}
          </div>
        ) : (
          displayReviews.map((r) => (
            <Card key={r.id} className="gap-0">
              <CardContent className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                      {r.clientInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{r.client}</span>
                        <StarRow rating={r.rating} />
                        {r.source && SOURCE_CONFIG[r.source] && (
                          <Badge
                            className={cn(
                              "border text-[9px] px-1.5 py-0",
                              SOURCE_CONFIG[r.source].className,
                            )}
                          >
                            {SOURCE_CONFIG[r.source].label}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted">{r.date}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{r.service}</p>
                    <p className="text-sm text-foreground mt-2 leading-relaxed">
                      &ldquo;{r.comment}&rdquo;
                    </p>

                    {/* Existing reply */}
                    {r.replied && r.replyText && replyingTo !== r.id && (
                      <div className="mt-3 pl-3 border-l-2 border-accent/30">
                        <p className="text-[10px] text-accent font-semibold mb-1 flex items-center gap-1">
                          <Reply className="w-3 h-3" /> Your reply
                        </p>
                        <p className="text-xs text-foreground leading-relaxed">{r.replyText}</p>
                      </div>
                    )}

                    {/* Reply composer */}
                    {replyingTo === r.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          autoFocus
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          rows={3}
                          placeholder="Write your reply…"
                          className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none transition"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={cancelReply}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                          <button
                            onClick={() => submitReply(r.id)}
                            disabled={!replyDraft.trim() || isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40"
                          >
                            <Send className="w-3 h-3" /> Send reply
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => openReply(r.id)}
                        className="mt-2 flex items-center gap-1 text-[11px] text-muted hover:text-accent transition-colors"
                      >
                        <Reply className="w-3 h-3" />
                        {r.replied ? "Edit reply" : "Reply"}
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
