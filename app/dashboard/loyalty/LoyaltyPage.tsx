"use client";

/**
 * LoyaltyPage.tsx — Client loyalty & referrals page.
 *
 * A warm, inviting page with a wide-screen two-column layout matching
 * the dashboard home page pattern. Shows tier status, perks, referral code,
 * how to earn, redemption info, and points history.
 */

import { useState } from "react";
import {
  Award,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Gift,
  Heart,
  Scissors,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Ticket,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LoyaltyPageData } from "./actions";

/* ------------------------------------------------------------------ */
/*  Tier config                                                        */
/* ------------------------------------------------------------------ */

const TIERS = [
  {
    name: "Bronze",
    min: 0,
    nextName: "Silver",
    nextAt: 300,
    reward: "birthday discounts & early booking",
    color: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-amber-200",
    accent: "bg-amber-500",
    greeting: "You're off to a great start!",
  },
  {
    name: "Silver",
    min: 300,
    nextName: "Gold",
    nextAt: 700,
    reward: "10% off & free add-ons",
    color: "text-slate-500",
    bg: "bg-slate-100",
    border: "border-slate-200",
    accent: "bg-slate-400",
    greeting: "You're building something special!",
  },
  {
    name: "Gold",
    min: 700,
    nextName: "Platinum",
    nextAt: 1500,
    reward: "15% off & priority booking",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    accent: "bg-yellow-500",
    greeting: "You're one of our favorites!",
  },
  {
    name: "Platinum",
    min: 1500,
    nextName: "Platinum",
    nextAt: 1500,
    reward: "VIP perks",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    accent: "bg-violet-500",
    greeting: "You're a VIP — we appreciate you so much!",
  },
] as const;

function getTier(points: number) {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

/* ------------------------------------------------------------------ */
/*  Tier perks                                                         */
/* ------------------------------------------------------------------ */

const TIER_PERKS: Record<string, { perk: string; Icon: LucideIcon }[]> = {
  Bronze: [
    { perk: "5% off on your birthday", Icon: Gift },
    { perk: "Early booking access", Icon: CalendarDays },
  ],
  Silver: [
    { perk: "10% off 1 service per month", Icon: Tag },
    { perk: "Free lash bath add-on", Icon: Sparkles },
    { perk: "All Bronze perks", Icon: ChevronRight },
  ],
  Gold: [
    { perk: "15% off all services", Icon: Tag },
    { perk: "Free add-on every visit", Icon: Gift },
    { perk: "Priority booking", Icon: Zap },
    { perk: "All Silver perks", Icon: ChevronRight },
  ],
  Platinum: [
    { perk: "20% off all services", Icon: Crown },
    { perk: "1 complimentary service/mo", Icon: Scissors },
    { perk: "VIP event invites", Icon: Ticket },
    { perk: "All Gold perks", Icon: ChevronRight },
  ],
};

/* ------------------------------------------------------------------ */
/*  Redemption catalog (hardcoded for now)                             */
/* ------------------------------------------------------------------ */

const REDEEM_OPTIONS: { label: string; points: number; Icon: LucideIcon; category: string }[] = [
  { label: "Lash Bath Add-on", points: 300, Icon: Sparkles, category: "Add-on" },
  { label: "$5 Off Any Service", points: 500, Icon: Tag, category: "Discount" },
  { label: "Aftercare Kit", points: 800, Icon: ShoppingBag, category: "Shop" },
  { label: "$10 Off Any Service", points: 1000, Icon: Tag, category: "Discount" },
  { label: "Free Fill Touch-up", points: 1500, Icon: Scissors, category: "Service" },
  { label: "$25 Off Any Service", points: 2500, Icon: Gift, category: "Discount" },
];

/* ------------------------------------------------------------------ */
/*  Earn opportunities                                                 */
/* ------------------------------------------------------------------ */

const EARN_WAYS = [
  {
    icon: CalendarCheck,
    label: "Book a service",
    points: "1pt / $1",
    hint: "Points on every visit",
  },
  { icon: Star, label: "Leave a review", points: "+25 pts", hint: "After each appointment" },
  { icon: Users, label: "Refer a friend", points: "+100 pts", hint: "They get 50 pts too" },
  { icon: Heart, label: "Add your birthday", points: "+50 pts", hint: "Plus a birthday surprise" },
  { icon: ShoppingBag, label: "Shop products", points: "1pt / $1", hint: "Aftercare & merch" },
  { icon: Sparkles, label: "Try a new service", points: "+25 pts", hint: "Explore something new" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LoyaltyPage({ data }: { data: LoyaltyPageData }) {
  const [copied, setCopied] = useState(false);
  const tier = getTier(data.totalPoints);
  const isMaxTier = tier.name === "Platinum";
  const progress = isMaxTier
    ? 100
    : Math.min(100, Math.round((data.totalPoints / tier.nextAt) * 100));
  const pointsToNext = isMaxTier ? 0 : tier.nextAt - data.totalPoints;

  function copyCode() {
    if (!data.referralCode) return;
    navigator.clipboard.writeText(data.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const currentPerks = TIER_PERKS[tier.name] ?? [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Personalized Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          {data.firstName ? `Hey ${data.firstName}` : "Loyalty & Rewards"}
        </h1>
        <p className="text-sm text-muted mt-0.5">{tier.greeting}</p>
      </div>

      {/* Tier Hero Card — full width */}
      <Card className="gap-0 overflow-hidden">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Gift className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <p className="text-3xl font-bold text-foreground">
                  {data.totalPoints.toLocaleString()}
                </p>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tier.bg} ${tier.color} ${tier.border} border`}
                >
                  {tier.name}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {isMaxTier
                  ? "You've reached the highest tier!"
                  : `${pointsToNext} points until ${tier.nextName}`}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-medium">
              <span className={tier.color}>{tier.name}</span>
              {!isMaxTier && (
                <span className="text-muted">
                  {tier.nextName} · {tier.nextAt} pts
                </span>
              )}
            </div>
            <div className="h-2.5 bg-foreground/8 rounded-full overflow-hidden">
              <div
                className={`h-full ${tier.accent} rounded-full transition-all duration-700 ease-out`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Tier upgrade callout */}
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-accent/8 border border-accent/15">
            <TrendingUp className="w-4 h-4 text-accent shrink-0" />
            <p className="text-xs text-foreground">
              {isMaxTier
                ? "Enjoy VIP perks on every visit — priority booking, free add-ons, and exclusive offers."
                : `Reach ${tier.nextName} to unlock ${TIERS.find((t) => t.name === tier.nextName)?.reward ?? "more rewards"}. Keep it up!`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout on xl screens */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Left column: 3/5 */}
        <div className="xl:col-span-3 space-y-4">
          {/* Your Perks */}
          <Card className="gap-0">
            <CardContent className="px-5 pb-5 pt-5 space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">Your {tier.name} Perks</p>
              </div>
              <div className="space-y-1">
                {currentPerks.map((p) => (
                  <div
                    key={p.perk}
                    className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-surface/60 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                      <p.Icon className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <p className="text-sm text-foreground">{p.perk}</p>
                  </div>
                ))}
              </div>

              {/* Show next tier preview */}
              {!isMaxTier && (
                <div className="border-t border-border/50 pt-3 mt-2">
                  <p className="text-[11px] text-muted mb-2">
                    Unlock with {tier.nextName} ({pointsToNext} pts to go):
                  </p>
                  <div className="space-y-1">
                    {(TIER_PERKS[tier.nextName] ?? [])
                      .filter((p) => !p.perk.startsWith("All "))
                      .map((p) => (
                        <div
                          key={p.perk}
                          className="flex items-center gap-2.5 py-1.5 px-2 opacity-50"
                        >
                          <div className="w-7 h-7 rounded-md bg-foreground/5 flex items-center justify-center shrink-0">
                            <p.Icon className="w-3.5 h-3.5 text-muted" />
                          </div>
                          <p className="text-sm text-muted">{p.perk}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* How to Earn */}
          <Card className="gap-0">
            <CardContent className="px-5 pb-5 pt-5 space-y-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">Ways to Earn</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EARN_WAYS.map((way) => (
                  <div
                    key={way.label}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface/60 hover:bg-surface transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <way.icon className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{way.label}</p>
                      <p className="text-[11px] text-muted">{way.hint}</p>
                    </div>
                    <span className="text-xs font-semibold text-accent shrink-0">{way.points}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: 2/5 */}
        <div className="xl:col-span-2 space-y-4">
          {/* Redeem Points */}
          <Card className="gap-0">
            <CardContent className="px-5 pb-5 pt-5 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">Redeem Points</p>
              </div>

              <div className="space-y-1">
                {REDEEM_OPTIONS.map((item) => {
                  const affordable = data.totalPoints >= item.points;
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2.5 py-2 px-2 rounded-lg transition-colors ${
                        affordable ? "hover:bg-surface/60" : "opacity-40"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          affordable ? "bg-accent/10" : "bg-foreground/5"
                        }`}
                      >
                        <item.Icon
                          className={`w-3.5 h-3.5 ${affordable ? "text-accent" : "text-muted"}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{item.label}</p>
                        <p className="text-[10px] text-muted">{item.category}</p>
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          affordable ? "text-accent" : "text-muted"
                        }`}
                      >
                        {item.points.toLocaleString()} pts
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted pt-1">
                Redeem at checkout — points never expire.
              </p>
            </CardContent>
          </Card>

          {/* Share the Love */}
          <Card className="gap-0">
            <CardContent className="px-5 pb-5 pt-5 space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">Share the Love</p>
              </div>

              {data.referralCode ? (
                <>
                  <p className="text-xs text-muted">
                    Give your code to a friend — you both earn bonus points when they book.
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-lg font-mono text-sm text-foreground tracking-wide text-center">
                      {data.referralCode}
                    </div>
                    <button
                      onClick={copyCode}
                      className="px-3 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  {data.referralCount > 0 && (
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-accent/8 border border-accent/15">
                      <Users className="w-4 h-4 text-accent shrink-0" />
                      <p className="text-xs text-foreground">
                        You&apos;ve brought{" "}
                        <span className="font-semibold">{data.referralCount}</span>{" "}
                        {data.referralCount === 1 ? "friend" : "friends"} to T Creative
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-3 text-center">
                  <Users className="w-7 h-7 text-muted/30 mx-auto mb-2" />
                  <p className="text-xs text-muted">
                    Your referral code will be ready after your first booking.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction History — full width */}
      {data.transactions.length > 0 ? (
        <Card className="gap-0">
          <CardContent className="px-5 pb-5 pt-5 space-y-2">
            <p className="text-sm font-semibold text-foreground mb-3">Points History</p>
            <div className="space-y-0">
              {data.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{tx.description}</p>
                    <p className="text-[11px] text-muted mt-0.5">{tx.createdAt}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold shrink-0 ml-3 ${
                      tx.points > 0 ? "text-accent" : "text-destructive"
                    }`}
                  >
                    {tx.points > 0 ? "+" : ""}
                    {tx.points}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0">
          <CardContent className="px-5 py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Your journey starts here</p>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                Book your first service to start earning points. Every dollar spent gets you closer
                to amazing rewards.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <p className="text-[11px] text-muted text-center pb-2">
        Points never expire. Redeem at checkout for discounts on services, add-ons, and shop orders.
      </p>
    </div>
  );
}
