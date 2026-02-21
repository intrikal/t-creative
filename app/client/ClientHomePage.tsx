"use client";

import type React from "react";
import Link from "next/link";
import {
  CalendarCheck,
  MessageSquare,
  HeartHandshake,
  ChevronRight,
  Clock,
  Sparkles,
  Star,
  Gift,
  CalendarPlus,
  ShoppingBag,
  GraduationCap,
  AlertCircle,
  Receipt,
  Images,
  TrendingUp,
  DollarSign,
  CalendarDays,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                   */
/* ------------------------------------------------------------------ */

interface UpcomingAppointment {
  id: number;
  date: string;
  time: string;
  service: string;
  assistant: string;
  durationMin: number;
  status: "confirmed" | "pending";
}

interface PastAppointment {
  id: number;
  date: string;
  service: string;
  assistant: string;
  price: number;
}

const UPCOMING: UpcomingAppointment[] = [
  {
    id: 1,
    date: "Sat, Feb 28",
    time: "10:00 AM",
    service: "Classic Lash Fill",
    assistant: "Jasmine",
    durationMin: 90,
    status: "confirmed",
  },
];

const PAST_APPOINTMENTS: PastAppointment[] = [
  { id: 1, date: "Feb 1", service: "Classic Lash Fill", assistant: "Jasmine", price: 75 },
  { id: 2, date: "Jan 18", service: "Volume Lashes — Full Set", assistant: "Jasmine", price: 140 },
  { id: 3, date: "Jan 4", service: "Classic Lash Fill", assistant: "Jasmine", price: 75 },
  { id: 4, date: "Dec 21", service: "Classic Lash Fill", assistant: "Jasmine", price: 75 },
];

const LOYALTY_POINTS = 240;
const LOYALTY_NEXT_REWARD = 300;

const FILL_DUE_DATE = "Feb 22";
const FILL_DAYS_AWAY = 1;

const QUICK_ACTIONS = [
  { label: "Book a Service", icon: CalendarPlus, href: "/client/book" },
  { label: "My Bookings", icon: CalendarCheck, href: "/client/bookings" },
  { label: "Shop", icon: ShoppingBag, href: "/client/shop" },
  { label: "Gallery", icon: Images, href: "/client/gallery" },
  { label: "Training", icon: GraduationCap, href: "/client/training" },
  { label: "Aftercare", icon: HeartHandshake, href: "/client/aftercare" },
  { label: "Messages", icon: MessageSquare, href: "/client/messages" },
  { label: "Invoices", icon: Receipt, href: "/client/invoices" },
];

const MOCK_STATS: {
  label: string;
  value: string;
  sub: string;
  trend?: "up" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}[] = [
  {
    label: "Total Visits",
    value: "18",
    sub: "all time",
    trend: "neutral",
    icon: CalendarDays,
    iconColor: "text-[#c4907a]",
    iconBg: "bg-[#c4907a]/10",
  },
  {
    label: "Lifetime Spend",
    value: "$1,240",
    sub: "+$215 this month",
    trend: "up",
    icon: DollarSign,
    iconColor: "text-[#4e6b51]",
    iconBg: "bg-[#4e6b51]/10",
  },
  {
    label: "Loyalty Points",
    value: "240",
    sub: "60 pts to next reward",
    trend: "neutral",
    icon: Gift,
    iconColor: "text-[#d4a574]",
    iconBg: "bg-[#d4a574]/10",
  },
  {
    label: "Member Since",
    value: "Jan '24",
    sub: "2 years",
    trend: "neutral",
    icon: Star,
    iconColor: "text-accent",
    iconBg: "bg-accent/10",
  },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  iconColor,
  iconBg,
}: (typeof MOCK_STATS)[number]) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
            <div className="flex items-center gap-1 text-xs text-muted">
              {trend === "up" && <TrendingUp className="w-3 h-3 text-[#4e6b51]" />}
              <span>{sub}</span>
            </div>
          </div>
          <div className={cn("rounded-xl p-2 shrink-0", iconBg)}>
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientHomePage() {
  const nextReward = LOYALTY_NEXT_REWARD - LOYALTY_POINTS;
  const loyaltyPct = Math.round((LOYALTY_POINTS / LOYALTY_NEXT_REWARD) * 100);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Welcome back, Maya ✦
        </h1>
        <p className="text-sm text-muted mt-0.5">Glad to have you at T Creative Studio</p>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-sm font-medium text-foreground hover:bg-foreground/5 hover:border-foreground/20 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-muted" />
            {label}
          </Link>
        ))}
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {MOCK_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* ── Fill reminder banner ────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#c4907a]/30 bg-[#c4907a]/[0.06]">
        <AlertCircle className="w-4 h-4 text-[#c4907a] shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">
            Your lash fill is due {FILL_DAYS_AWAY <= 1 ? "tomorrow" : `in ${FILL_DAYS_AWAY} days`} —{" "}
            {FILL_DUE_DATE}
          </span>
          <span className="text-xs text-muted ml-2 hidden sm:inline">
            Based on your last visit on Feb 1. Fills are recommended every 2–3 weeks.
          </span>
        </div>
        <Link
          href="/client/book"
          className="text-xs font-semibold text-[#96604a] hover:text-[#c4907a] transition-colors shrink-0 flex items-center gap-0.5 border border-[#c4907a]/30 rounded-lg px-3 py-1.5"
        >
          Book fill <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* ── Two-column body ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Left column — main content */}
        <div className="xl:col-span-3 space-y-4">
          {/* Upcoming appointment */}
          <Card className="gap-0">
            <CardHeader className="pb-0 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Upcoming Appointment</CardTitle>
                <Link
                  href="/client/bookings"
                  className="text-xs text-accent hover:underline flex items-center gap-0.5"
                >
                  All bookings <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-3">
              {UPCOMING.length === 0 ? (
                <div className="py-8 text-center">
                  <Sparkles className="w-6 h-6 text-muted/40 mx-auto mb-2" />
                  <p className="text-sm text-muted">No upcoming appointments</p>
                  <Link
                    href="/client/book"
                    className="text-xs text-accent hover:underline mt-1 inline-block"
                  >
                    Book a service
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {UPCOMING.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-stretch gap-4 p-4 rounded-xl bg-accent/5 border border-accent/15"
                    >
                      {/* Date block */}
                      <div className="shrink-0 flex flex-col items-center justify-center text-center w-14 border-r border-accent/15 pr-4">
                        <p className="text-[10px] font-semibold text-accent uppercase tracking-wide">
                          {appt.date.split(",")[0]}
                        </p>
                        <p className="text-3xl font-bold text-foreground leading-none mt-0.5">
                          {appt.date.split(" ").pop()}
                        </p>
                        <p className="text-[10px] text-muted mt-0.5">
                          {appt.date.split(", ")[1]?.split(" ").slice(0, 1).join("")}
                        </p>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{appt.service}</p>
                            <p className="text-xs text-muted mt-0.5">with {appt.assistant}</p>
                          </div>
                          <Badge
                            className={cn(
                              "border text-[10px] px-1.5 py-0.5 shrink-0",
                              appt.status === "confirmed"
                                ? "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20"
                                : "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20",
                            )}
                          >
                            {appt.status === "confirmed" ? "Confirmed" : "Pending"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                          <span className="flex items-center gap-1 text-[11px] text-muted">
                            <Clock className="w-3 h-3" />
                            {appt.time}
                          </span>
                          <span className="text-[11px] text-muted">{appt.durationMin} min</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button className="text-[11px] font-medium text-muted border border-border rounded-lg px-3 py-1.5 hover:border-foreground/20 hover:text-foreground transition-colors">
                            Reschedule
                          </button>
                          <button className="text-[11px] font-medium text-muted border border-border rounded-lg px-3 py-1.5 hover:border-destructive/30 hover:text-destructive transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent visit history */}
          <Card className="gap-0">
            <CardHeader className="pb-0 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#c4907a]" />
                  <CardTitle className="text-sm font-semibold">Visit History</CardTitle>
                </div>
                <Link
                  href="/client/bookings"
                  className="text-xs text-accent hover:underline flex items-center gap-0.5"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-2 pt-2">
              {PAST_APPOINTMENTS.map((appt, i) => (
                <div
                  key={appt.id}
                  className={cn(
                    "flex items-center gap-3 py-3",
                    i < PAST_APPOINTMENTS.length - 1 && "border-b border-border/40",
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-foreground/6 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-muted/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{appt.service}</p>
                    <p className="text-xs text-muted mt-0.5">
                      with {appt.assistant} · {appt.date}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground shrink-0">
                    ${appt.price}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="xl:col-span-2 space-y-4">
          {/* Loyalty card */}
          <Card className="gap-0">
            <CardHeader className="pb-0 pt-5">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#d4a574]" />
                <CardTitle className="text-sm font-semibold">Loyalty Points</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-foreground tracking-tight">
                    {LOYALTY_POINTS}
                  </p>
                  <p className="text-xs text-muted mt-1">{nextReward} pts until your next reward</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
                    Bronze
                  </p>
                  <p className="text-xs text-muted mt-0.5">→ Silver at 300</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="w-full h-2.5 rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#d4a574] to-[#c4907a] transition-all"
                    style={{ width: `${loyaltyPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted/60">
                  <span>0</span>
                  <span>{LOYALTY_NEXT_REWARD} pts = $10 off</span>
                </div>
              </div>
              <p className="text-[11px] text-muted bg-surface rounded-lg px-3 py-2 border border-border leading-relaxed">
                Earn 1 point per $1 spent. Redeem at checkout for discounts.
              </p>
              <Link
                href="/client/shop"
                className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
              >
                Shop now <ChevronRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Studio note */}
          <Card className="gap-0 border-accent/20 bg-accent/[0.02]">
            <CardContent className="px-5 py-4 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent font-bold text-[10px] tracking-tight">TC</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">From T Creative Studio</p>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Thank you for being a loyal client! Don&apos;t forget to follow your aftercare
                  instructions after each visit to keep your lashes looking their best.
                </p>
                <Link
                  href="/client/aftercare"
                  className="text-xs text-accent hover:underline mt-1.5 inline-flex items-center gap-0.5"
                >
                  View aftercare guide <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
