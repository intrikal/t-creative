"use client";

import { useState } from "react";
import {
  Star,
  CheckCircle,
  Pin,
  MessageSquare,
  Search,
  Send,
  Link2,
  RefreshCw,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MOCK_REVIEWS,
  RATING_DIST,
  type Review,
  type ReviewStatus,
  type ReviewSource,
  type ServiceCategory,
} from "@/lib/data/reviews";
import { cn } from "@/lib/utils";

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

function sourceConfig(source: ReviewSource) {
  switch (source) {
    case "google":
      return { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-100" };
    case "website":
      return { label: "Website", className: "bg-foreground/8 text-muted border-foreground/12" };
    case "instagram":
      return { label: "Instagram", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "yelp":
      return { label: "Yelp", className: "bg-red-50 text-red-700 border-red-100" };
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

const serviceLabel: Record<ServiceCategory, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
  training: "Training",
};

/* ------------------------------------------------------------------ */
/*  Review card                                                         */
/* ------------------------------------------------------------------ */

function ReviewCard({ review }: { review: Review }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState(review.reply ?? "");
  const src = sourceConfig(review.source);
  const sts = statusConfig(review.status);

  return (
    <Card className="gap-0">
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
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", src.className)}>
                {src.label}
              </Badge>
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                {sts.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <StarRow rating={review.rating} />
              <span className="text-[10px] text-muted">
                {serviceLabel[review.service]} · {review.date}
              </span>
            </div>
          </div>
        </div>

        {/* Review text */}
        <p className="text-sm text-foreground/90 leading-relaxed mt-3">{review.text}</p>

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
              <button className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90">
                Save Reply
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 flex-wrap">
          {review.status === "pending" && (
            <button className="flex items-center gap-1.5 text-xs font-medium text-[#4e6b51] hover:opacity-80 transition-opacity">
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
          )}
          {review.status === "approved" && (
            <button className="flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80 transition-opacity">
              <Pin className="w-3.5 h-3.5" /> Feature
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
          <button className="text-xs text-muted hover:text-foreground transition-colors ml-auto">
            Hide
          </button>
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

export function ReviewsPage() {
  const [filter, setFilter] = useState<"all" | ReviewStatus>("all");
  const [search, setSearch] = useState("");
  const [pageTab, setPageTab] = useState<ReviewsPageTab>("reviews");

  const avgRating = (MOCK_REVIEWS.reduce((s, r) => s + r.rating, 0) / MOCK_REVIEWS.length).toFixed(
    1,
  );

  const filtered = MOCK_REVIEWS.filter((r) => {
    const matchStatus = filter === "all" || r.status === filter;
    const matchSearch =
      !search ||
      r.client.toLowerCase().includes(search.toLowerCase()) ||
      r.text.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const pending = MOCK_REVIEWS.filter((r) => r.status === "pending").length;

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
        {pending > 0 && (
          <span className="px-2.5 py-1 bg-[#7a5c10]/10 text-[#7a5c10] text-xs font-medium rounded-full border border-[#7a5c10]/20 shrink-0">
            {pending} pending
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

          {/* Automated stats */}
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
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[
                { label: "Open Rate", value: "84%" },
                { label: "Click Rate", value: "31%" },
                { label: "Conversion", value: "18%" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="text-center bg-surface border border-border rounded-xl p-3"
                >
                  <p className="text-lg font-semibold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recently sent */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Recently Sent</p>
            </div>
            <div className="divide-y divide-border/40">
              {[
                {
                  client: "Amara Johnson",
                  service: "Classic Full Set",
                  sent: "Feb 19, 2:00 PM",
                  via: "SMS",
                  status: "reviewed",
                },
                {
                  client: "Destiny Cruz",
                  service: "Volume Lashes",
                  sent: "Feb 18, 4:00 PM",
                  via: "SMS",
                  status: "clicked",
                },
                {
                  client: "Keisha Williams",
                  service: "Crochet Install",
                  sent: "Feb 17, 3:30 PM",
                  via: "Email",
                  status: "sent",
                },
                {
                  client: "Maya Robinson",
                  service: "Classic Fill",
                  sent: "Feb 17, 12:00 PM",
                  via: "SMS",
                  status: "reviewed",
                },
                {
                  client: "Jordan Lee",
                  service: "Classic Fill",
                  sent: "Feb 16, 5:00 PM",
                  via: "Both",
                  status: "sent",
                },
              ].map((r) => (
                <div key={r.client + r.sent} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.client}</p>
                    <p className="text-[10px] text-muted">
                      {r.service} · {r.sent}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted">{r.via}</span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        r.status === "reviewed"
                          ? "text-[#4e6b51] bg-[#4e6b51]/10"
                          : r.status === "clicked"
                            ? "text-[#d4a574] bg-[#d4a574]/10"
                            : "text-muted bg-foreground/8",
                      )}
                    >
                      {r.status === "reviewed"
                        ? "Reviewed"
                        : r.status === "clicked"
                          ? "Clicked"
                          : "Sent"}
                    </span>
                    {r.status === "sent" && (
                      <button className="text-[10px] text-accent hover:underline flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5" />
                        Resend
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
                    <p className="text-4xl font-bold text-foreground">{avgRating}</p>
                    <StarRow rating={Math.round(Number(avgRating))} />
                    <p className="text-[10px] text-muted mt-1">{MOCK_REVIEWS.length} reviews</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {RATING_DIST.map((r) => (
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
                  {
                    label: "Featured",
                    value: MOCK_REVIEWS.filter((r) => r.status === "featured").length,
                    color: "text-accent",
                  },
                  {
                    label: "With Reply",
                    value: MOCK_REVIEWS.filter((r) => r.reply).length,
                    color: "text-[#4e6b51]",
                  },
                  {
                    label: "Google",
                    value: MOCK_REVIEWS.filter((r) => r.source === "google").length,
                    color: "text-blue-600",
                  },
                  {
                    label: "5-Star",
                    value: MOCK_REVIEWS.filter((r) => r.rating === 5).length,
                    color: "text-[#d4a574]",
                  },
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
      )}{" "}
      {/* end pageTab === "reviews" */}
    </div>
  );
}
