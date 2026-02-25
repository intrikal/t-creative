"use client";

import { useState } from "react";
import { Star, Reply, X, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Review {
  id: number;
  client: string;
  clientInitials: string;
  rating: number;
  service: string;
  date: string;
  comment: string;
  replied: boolean;
  replyText?: string;
}

const INITIAL_REVIEWS: Review[] = [
  {
    id: 1,
    client: "Maya R.",
    clientInitials: "MR",
    rating: 5,
    service: "Classic Lash Fill",
    date: "Feb 18",
    comment:
      "Jasmine is absolutely amazing! My lashes have never looked better. She's so precise and really listens to what I want.",
    replied: false,
  },
  {
    id: 2,
    client: "Lena P.",
    clientInitials: "LP",
    rating: 5,
    service: "Volume Lashes Full Set",
    date: "Feb 15",
    comment:
      "Best lash tech I've had. Always consistent, my retention is incredible. Definitely coming back every 3 weeks!",
    replied: true,
    replyText:
      "Thank you so much Lena! You're always such a joy to have in the chair. See you in 3 weeks! 💕",
  },
  {
    id: 3,
    client: "Kira M.",
    clientInitials: "KM",
    rating: 5,
    service: "Hybrid Lashes Full Set",
    date: "Feb 12",
    comment:
      "I was nervous to try hybrid but Jasmine walked me through it and the result was SO pretty. Highly recommend!",
    replied: false,
  },
  {
    id: 4,
    client: "Aisha R.",
    clientInitials: "AR",
    rating: 5,
    service: "Lash Tint + Lift",
    date: "Feb 5",
    comment:
      "Clean, efficient, and my natural lashes look incredible. Jasmine is super professional.",
    replied: true,
    replyText:
      "Aisha, I'm so glad you loved your lift! Your natural lashes are gorgeous — the tint really made them pop. 🌟",
  },
  {
    id: 5,
    client: "Tasha N.",
    clientInitials: "TN",
    rating: 4,
    service: "Classic Lash Fill",
    date: "Feb 14",
    comment:
      "Great experience overall! Only thing was the appointment ran a little long but my lashes look beautiful.",
    replied: false,
  },
  {
    id: 6,
    client: "Jordan L.",
    clientInitials: "JL",
    rating: 5,
    service: "Classic Lash Fill",
    date: "Jan 30",
    comment: "5 stars every time. Jasmine is my go-to. Always on time, always perfect.",
    replied: true,
    replyText: "Jordan you are TOO sweet! Always love having you 💗 See you next fill!",
  },
  {
    id: 7,
    client: "Dana W.",
    clientInitials: "DW",
    rating: 5,
    service: "Classic Lash Fill",
    date: "Feb 1",
    comment:
      "My lashes are everything. Jasmine takes her time and makes sure everything is perfect before I leave. 10/10!",
    replied: false,
  },
  {
    id: 8,
    client: "Amy L.",
    clientInitials: "AL",
    rating: 5,
    service: "Volume Lashes Full Set",
    date: "Jan 24",
    comment:
      "I drive 40 mins just to see Jasmine and it's always worth it. She's the best in San Jose imo.",
    replied: true,
    replyText:
      "Amy! 40 mins each way means the world to me. You deserve the best and I've got you every time! 🙏",
  },
  {
    id: 9,
    client: "Nia B.",
    clientInitials: "NB",
    rating: 5,
    service: "Volume Lashes Full Set",
    date: "Jan 28",
    comment:
      "Absolutely love my lashes every single time. You can tell Jasmine genuinely cares about her craft.",
    replied: false,
  },
  {
    id: 10,
    client: "Camille F.",
    clientInitials: "CF",
    rating: 4,
    service: "Volume Lashes Full Set",
    date: "Feb 3",
    comment:
      "Really happy with the result! Would love if there were more booking windows on weekdays.",
    replied: true,
    replyText:
      "Thanks Camille! Totally hear you on weekday availability — I'm working on adding more slots soon! 🗓️",
  },
  {
    id: 11,
    client: "Sade O.",
    clientInitials: "SO",
    rating: 5,
    service: "Classic Lash Fill",
    date: "Feb 5",
    comment:
      "Jasmine's eye for detail is unreal. My fills always look like a fresh set. So talented!",
    replied: false,
  },
  {
    id: 12,
    client: "Chloe T.",
    clientInitials: "CT",
    rating: 5,
    service: "Classic Lash Fill",
    date: "Feb 8",
    comment:
      "My lashes have never felt so natural and looked so full at the same time. Jasmine nailed exactly what I described.",
    replied: false,
  },
];

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

export function AssistantReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  const fiveStars = reviews.filter((r) => r.rating === 5).length;
  const fourStars = reviews.filter((r) => r.rating === 4).length;

  const ratingDist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => r.rating === n).length,
  }));

  function openReply(id: number) {
    const r = reviews.find((r) => r.id === id);
    setReplyDraft(r?.replyText ?? "");
    setReplyingTo(id);
  }

  function submitReply(id: number) {
    if (!replyDraft.trim()) return;
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, replied: true, replyText: replyDraft.trim() } : r)),
    );
    setReplyingTo(null);
    setReplyDraft("");
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
            <p className="text-5xl font-bold text-foreground tracking-tight">{avg}</p>
            <div className="flex justify-center mt-2">
              <StarRow rating={Math.round(parseFloat(avg))} />
            </div>
            <p className="text-xs text-muted mt-1.5">{reviews.length} reviews</p>
          </CardContent>
        </Card>

        {/* Distribution */}
        <Card className="gap-0 py-5 sm:col-span-2">
          <CardContent className="px-5 space-y-1.5">
            {ratingDist.map(({ n, count }) => (
              <div key={n} className="flex items-center gap-2">
                <span className="text-xs text-muted w-3 text-right">{n}</span>
                <Star className="w-3 h-3 fill-[#d4a574] text-[#d4a574] shrink-0" />
                <div className="flex-1 h-1.5 rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-[#d4a574] transition-all"
                    style={{ width: `${reviews.length > 0 ? (count / reviews.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-muted w-5 text-right tabular-nums">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "5-Star Reviews", value: fiveStars },
          { label: "4-Star Reviews", value: fourStars },
          { label: "This Month", value: reviews.filter((r) => r.date.startsWith("Feb")).length },
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
          <CardTitle className="text-sm font-semibold">All Reviews</CardTitle>
        </CardHeader>
        {reviews.map((r) => (
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
                          disabled={!replyDraft.trim()}
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
        ))}
      </div>
    </div>
  );
}
