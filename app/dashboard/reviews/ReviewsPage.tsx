/**
 * Client component — Reviews dashboard with moderation actions.
 *
 * Receives real reviews + stats from `page.tsx`. All mutations (approve,
 * reject, feature, reply) call server actions and trigger revalidation.
 *
 * @module reviews/ReviewsPage
 * @see {@link ./actions.ts} — server actions
 * @see {@link ./page.tsx} — Server Component providing data
 */
"use client";

import { useState, useTransition } from "react";
import {
  Star,
  CheckCircle,
  Pin,
  MessageSquare,
  Search,
  Send,
  Link2,
  EyeOff,
  PinOff,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReviewRow, ReviewStats, ReviewStatus, ReviewSource } from "./actions";
import { approveReview, rejectReview, featureReview, unfeatureReview, saveReply } from "./actions";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "w-3.5 h-3.5",
            i < rating ? "text-[#d4a574] fill-[#d4a574]" : "text-border",
          )}
        />
      ))}
    </div>
  );
}

function sourceConfig(source: ReviewSource | null) {
  switch (source) {
    case "google":
      return { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-100" };
    case "website":
      return { label: "Website", className: "bg-foreground/8 text-muted border-foreground/12" };
    case "instagram":
      return { label: "Instagram", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "yelp":
      return { label: "Yelp", className: "bg-red-50 text-red-700 border-red-100" };
    default:
      return null;
  }
}

function statusConfig(status: ReviewStatus) {
  switch (status) {
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "approved":
      return { label: "Approved", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "featured":
      return { label: "Featured", className: "bg-accent/12 text-accent border-accent/20" };
    case "hidden":
      return { label: "Hidden", className: "bg-foreground/8 text-muted border-foreground/12" };
  }
}

/* ------------------------------------------------------------------ */
/*  Review card                                                         */
/* ------------------------------------------------------------------ */

function ReviewCard({ review }: { review: ReviewRow }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState(review.reply ?? "");
  const [isPending, startTransition] = useTransition();
  const src = sourceConfig(review.source);
  const sts = statusConfig(review.status);

  function handleApprove() {
    startTransition(() => approveReview(review.id));
  }
  function handleReject() {
    startTransition(() => rejectReview(review.id));
  }
  function handleFeature() {
    startTransition(() => featureReview(review.id));
  }
  function handleUnfeature() {
    startTransition(() => unfeatureReview(review.id));
  }
  function handleSaveReply() {
    startTransition(async () => {
      await saveReply(review.id, draft);
      setReplyOpen(false);
    });
  }

  return (
    <Card className={cn("gap-0", isPending && "opacity-60 pointer-events-none")}>
      <CardContent className="px-5 pt-5 pb-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          <Avatar size="sm" className="shrink-0 mt-0.5">
            <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
              {review.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{review.client}</span>
              {review.status === "featured" && <Pin className="w-3 h-3 text-accent" />}
              {src && (
                <Badge className={cn("border text-[10px] px-1.5 py-0.5", src.className)}>
                  {src.label}
                </Badge>
              )}
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                {sts.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <StarRow rating={review.rating} />
              <span className="text-[10px] text-muted">
                {review.serviceName} · {review.date}
              </span>
            </div>
          </div>
        </div>

        {/* Review text */}
        {review.text && (
          <p className="text-sm text-foreground/90 leading-relaxed mt-3">{review.text}</p>
        )}

        {/* Existing reply */}
        {review.reply && !replyOpen && (
          <div className="mt-3 pl-3 border-l-2 border-accent/30">
            <p className="text-[10px] font-semibold text-accent mb-1">Your reply</p>
            <p className="text-xs text-muted leading-relaxed">{review.reply}</p>
          </div>
        )}

        {/* Reply composer */}
        {replyOpen && (
          <div className="mt-3 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Write a reply…"
              className="w-full resize-none bg-surface border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setReplyOpen(false)}
                className="px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReply}
                className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90"
              >
                Save Reply
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 flex-wrap">
          {review.status === "pending" && (
            <button
              onClick={handleApprove}
              className="flex items-center gap-1.5 text-xs font-medium text-[#4e6b51] hover:opacity-80 transition-opacity"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
          )}
          {review.status === "approved" && (
            <button
              onClick={handleFeature}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80 transition-opacity"
            >
              <Pin className="w-3.5 h-3.5" /> Feature
            </button>
          )}
          {review.status === "featured" && (
            <button
              onClick={handleUnfeature}
              className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              <PinOff className="w-3.5 h-3.5" /> Unfeature
            </button>
          )}
          {!replyOpen && (
            <button
              onClick={() => setReplyOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" /> {review.reply ? "Edit reply" : "Reply"}
            </button>
          )}
          {review.status !== "hidden" && (
            <button
              onClick={handleReject}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors ml-auto"
            >
              <EyeOff className="w-3.5 h-3.5" /> Hide
            </button>
          )}
          {review.status === "hidden" && (
            <button
              onClick={handleApprove}
              className="flex items-center gap-1.5 text-xs font-medium text-[#4e6b51] hover:opacity-80 transition-opacity ml-auto"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Restore
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

const REVIEWS_PAGE_TABS = [
  { id: "reviews", label: "Reviews" },
  { id: "request", label: "Request Reviews" },
] as const;
type ReviewsPageTab = (typeof REVIEWS_PAGE_TABS)[number]["id"];

export function ReviewsPage({
  initialReviews,
  stats,
}: {
  initialReviews: ReviewRow[];
  stats: ReviewStats;
}) {
  const [filter, setFilter] = useState<"all" | ReviewStatus>("all");
  const [search, setSearch] = useState("");
  const [pageTab, setPageTab] = useState<ReviewsPageTab>("reviews");

  const filtered = initialReviews.filter((r) => {
    const matchStatus = filter === "all" || r.status === filter;
    const matchSearch =
      !search ||
      r.client.toLowerCase().includes(search.toLowerCase()) ||
      r.text.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Reviews</h1>
          <p className="text-sm text-muted mt-0.5">
            Approve, feature, and respond to client reviews
          </p>
        </div>
        {stats.pendingCount > 0 && (
          <span className="px-2.5 py-1 bg-[#7a5c10]/10 text-[#7a5c10] text-xs font-medium rounded-full border border-[#7a5c10]/20 shrink-0">
            {stats.pendingCount} pending
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border -mt-2">
        {REVIEWS_PAGE_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setPageTab(id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              pageTab === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {pageTab === "request" && (
        <div className="space-y-5">
          {/* Quick send */}
          <div className="bg-background border border-border rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Send Manual Request
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Client Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Mitchell"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Send Via</label>
                <select className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground">
                  <option>SMS (via Square)</option>
                  <option>Email</option>
                  <option>Both</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors">
                <Send className="w-3.5 h-3.5" />
                Send Request
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors">
                <Link2 className="w-3.5 h-3.5" />
                Copy Google Review Link
              </button>
            </div>
          </div>

          {/* Automated stats placeholder */}
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Automated Review Requests
              </p>
              <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 px-2 py-0.5 rounded-full">
                Active via Square
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Requests are automatically sent 24 hours after each completed appointment via Square
              SMS reminders.
            </p>
          </div>
        </div>
      )}

      {pageTab === "reviews" && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Rating overview */}
            <Card className="gap-0">
              <CardContent className="px-5 py-5">
                <div className="flex items-center gap-5">
                  <div className="text-center shrink-0">
                    <p className="text-4xl font-bold text-foreground">{stats.avgRating}</p>
                    <StarRow rating={Math.round(stats.avgRating)} />
                    <p className="text-[10px] text-muted mt-1">{stats.totalReviews} reviews</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {stats.ratingDist.map((r) => (
                      <div key={r.stars} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted w-3 shrink-0">{r.stars}</span>
                        <Star className="w-2.5 h-2.5 text-[#d4a574] fill-[#d4a574] shrink-0" />
                        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#d4a574] rounded-full"
                            style={{ width: `${r.pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted w-5 text-right shrink-0">
                          {r.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick stats */}
            <Card className="gap-0">
              <CardContent className="px-5 py-5 grid grid-cols-2 gap-4 h-full">
                {[
                  { label: "Featured", value: stats.featuredCount, color: "text-accent" },
                  { label: "With Reply", value: stats.withReplyCount, color: "text-[#4e6b51]" },
                  { label: "Pending", value: stats.pendingCount, color: "text-[#7a5c10]" },
                  { label: "5-Star", value: stats.fiveStarCount, color: "text-[#d4a574]" },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center justify-center">
                    <p className={cn("text-2xl font-semibold", s.color)}>{s.value}</p>
                    <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Filters + search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex gap-1 flex-wrap">
              {(["all", "pending", "approved", "featured", "hidden"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                    filter === f
                      ? "bg-foreground text-background"
                      : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative sm:ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search reviews…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted w-full sm:w-48"
              />
            </div>
          </div>

          {/* Review cards — 2-col on xl */}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-10">No reviews found.</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {filtered.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
