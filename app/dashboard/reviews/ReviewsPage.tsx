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
  ArrowUpDown,
  MessageCircle,
  Clock,
  Sparkles,
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
    <Card
      className={cn(
        "gap-0 hover:shadow-md hover:border-border transition-all",
        isPending && "opacity-60 pointer-events-none",
      )}
    >
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
              placeholder="Write a reply..."
              className="w-full resize-none bg-surface border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setReplyOpen(false)}
                className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReply}
                className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
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

type SortOption = "newest" | "oldest" | "highest" | "lowest";

export function ReviewsPage({
  initialReviews,
  stats,
}: {
  initialReviews: ReviewRow[];
  stats: ReviewStats;
}) {
  const [filter, setFilter] = useState<"all" | ReviewStatus>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [pageTab, setPageTab] = useState<ReviewsPageTab>("reviews");

  const responseRate =
    stats.totalReviews > 0 ? Math.round((stats.withReplyCount / stats.totalReviews) * 100) : 0;

  const filtered = initialReviews
    .filter((r) => {
      const matchStatus = filter === "all" || r.status === filter;
      const matchSearch =
        !search ||
        r.client.toLowerCase().includes(search.toLowerCase()) ||
        r.text.toLowerCase().includes(search.toLowerCase()) ||
        r.serviceName.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "highest":
          return b.rating - a.rating;
        case "lowest":
          return a.rating - b.rating;
        case "newest":
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

  const STAT_CARDS = [
    {
      label: "Avg Rating",
      value: String(stats.avgRating),
      sub: `${stats.totalReviews} total reviews`,
      icon: Star,
      iconColor: "text-[#d4a574]",
      iconBg: "bg-[#d4a574]/10",
    },
    {
      label: "Featured",
      value: String(stats.featuredCount),
      sub: "shown on website",
      icon: Sparkles,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
    },
    {
      label: "Response Rate",
      value: `${responseRate}%`,
      sub: `${stats.withReplyCount} of ${stats.totalReviews} replied`,
      icon: MessageCircle,
      iconColor: "text-[#4e6b51]",
      iconBg: "bg-[#4e6b51]/10",
    },
    {
      label: "Pending",
      value: String(stats.pendingCount),
      sub: "awaiting moderation",
      icon: Clock,
      iconColor: "text-[#7a5c10]",
      iconBg: "bg-[#7a5c10]/10",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Reviews
          </h1>
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
      <div className="flex gap-1 border-b border-border">
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
        <div className="space-y-4">
          {/* Quick send */}
          <Card className="gap-0">
            <CardContent className="px-5 py-5 space-y-4">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Send Manual Request
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">Client Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Mitchell"
                    className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Send Via</label>
                  <select className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground">
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
            </CardContent>
          </Card>

          {/* Automated stats */}
          <Card className="gap-0">
            <CardContent className="px-5 py-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                  Automated Review Requests
                </p>
                <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 px-2 py-0.5 rounded-full border border-[#4e6b51]/20">
                  Active via Square
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Requests are automatically sent 24 hours after each completed appointment via Square
                SMS reminders.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {pageTab === "reviews" && (
        <>
          {/* Stat cards row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STAT_CARDS.map((s) => (
              <Card key={s.label} className="gap-0 py-0">
                <CardContent className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted truncate">
                        {s.label}
                      </p>
                      <p className="text-lg font-semibold text-foreground tracking-tight">
                        {s.value}
                      </p>
                      <p className="text-xs text-muted truncate">{s.sub}</p>
                    </div>
                    <div className={cn("rounded-xl p-2 shrink-0", s.iconBg)}>
                      <s.icon className={cn("w-4 h-4", s.iconColor)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Rating distribution */}
          <Card className="gap-0">
            <CardContent className="px-5 py-4">
              <div className="flex items-center gap-6">
                <div className="text-center shrink-0">
                  <p className="text-4xl font-bold text-foreground tracking-tight">
                    {stats.avgRating}
                  </p>
                  <StarRow rating={Math.round(stats.avgRating)} />
                  <p className="text-[10px] text-muted mt-1">{stats.totalReviews} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {stats.ratingDist.map((r) => (
                    <div key={r.stars} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted w-3 shrink-0">{r.stars}</span>
                      <Star className="w-2.5 h-2.5 text-[#d4a574] fill-[#d4a574] shrink-0" />
                      <div className="flex-1 h-1.5 bg-border/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#d4a574] rounded-full transition-all"
                          style={{ width: `${r.pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted w-8 text-right shrink-0">
                        {r.pct}%
                      </span>
                    </div>
                  ))}
                </div>
                {/* 5-star highlight */}
                <div className="hidden sm:flex flex-col items-center shrink-0 pl-6 border-l border-border/50">
                  <p className="text-2xl font-semibold text-[#d4a574]">{stats.fiveStarCount}</p>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className="w-2.5 h-2.5 text-[#d4a574] fill-[#d4a574]" />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">5-star reviews</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filter bar */}
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
                  {f === "pending" && stats.pendingCount > 0 && (
                    <span className="ml-1 text-[10px] opacity-70">{stats.pendingCount}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <div className="relative shrink-0">
                <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="pl-7 pr-3 py-1.5 text-xs bg-white border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 appearance-none cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="highest">Highest rated</option>
                  <option value="lowest">Lowest rated</option>
                </select>
              </div>
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search reviews..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
                />
              </div>
            </div>
          </div>

          {/* Review cards */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="w-7 h-7 text-foreground/15 mx-auto mb-2" />
              <p className="text-sm text-muted/60 font-medium">No reviews found</p>
              <p className="text-xs text-muted/40 mt-0.5">
                {search || filter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Reviews will appear here as clients submit them"}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted">
                {filtered.length} review{filtered.length !== 1 ? "s" : ""}
                {filter !== "all" ? ` (${filter})` : ""}
              </p>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {filtered.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
