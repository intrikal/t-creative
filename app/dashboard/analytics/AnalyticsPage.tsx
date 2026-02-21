"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  CalendarCheck,
  DollarSign,
  AlertTriangle,
  BarChart2,
  Ticket,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

const RANGES = ["7d", "30d", "90d", "12m"] as const;
type Range = (typeof RANGES)[number];

const STAT_CARDS = [
  {
    label: "Revenue MTD",
    value: "$9,840",
    change: "+22%",
    up: true,
    icon: DollarSign,
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
  },
  {
    label: "Bookings",
    value: "91",
    change: "+9%",
    up: true,
    icon: CalendarCheck,
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    label: "New Clients",
    value: "34",
    change: "+18%",
    up: true,
    icon: Users,
    color: "text-[#c4907a]",
    bg: "bg-[#c4907a]/10",
  },
  {
    label: "No-Show Rate",
    value: "8%",
    change: "-2%",
    up: true,
    icon: AlertTriangle,
    color: "text-[#d4a574]",
    bg: "bg-[#d4a574]/10",
  },
  {
    label: "Fill Rate",
    value: "74%",
    change: "+5%",
    up: true,
    icon: BarChart2,
    color: "text-[#7ba3a3]",
    bg: "bg-[#7ba3a3]/10",
  },
  {
    label: "Avg Ticket",
    value: "$108",
    change: "+$12",
    up: true,
    icon: Ticket,
    color: "text-blush",
    bg: "bg-blush/10",
  },
];

const BOOKINGS_TREND = [
  { week: "Jan 5", lash: 12, jewelry: 4, crochet: 2, consulting: 1 },
  { week: "Jan 12", lash: 14, jewelry: 5, crochet: 3, consulting: 2 },
  { week: "Jan 19", lash: 11, jewelry: 6, crochet: 2, consulting: 1 },
  { week: "Jan 26", lash: 16, jewelry: 4, crochet: 4, consulting: 3 },
  { week: "Feb 2", lash: 13, jewelry: 7, crochet: 2, consulting: 2 },
  { week: "Feb 9", lash: 18, jewelry: 5, crochet: 3, consulting: 1 },
  { week: "Feb 16", lash: 15, jewelry: 8, crochet: 3, consulting: 2 },
  { week: "Feb 21", lash: 10, jewelry: 4, crochet: 2, consulting: 1 },
];

const REVENUE_TREND = [
  { week: "Jan 5", revenue: 1820 },
  { week: "Jan 12", revenue: 2340 },
  { week: "Jan 19", revenue: 1980 },
  { week: "Jan 26", revenue: 2760 },
  { week: "Feb 2", revenue: 2420 },
  { week: "Feb 9", revenue: 3180 },
  { week: "Feb 16", revenue: 2680 },
  { week: "Feb 21", revenue: 1640 },
];

const REVENUE_GOAL = 12000;
const REVENUE_ACTUAL = 9840;

const SERVICE_MIX = [
  { label: "Lash Services", pct: 54, color: "bg-[#c4907a]", count: 52 },
  { label: "Jewelry", pct: 21, color: "bg-[#d4a574]", count: 20 },
  { label: "Consulting", pct: 14, color: "bg-[#5b8a8a]", count: 13 },
  { label: "Crochet", pct: 8, color: "bg-[#7ba3a3]", count: 8 },
  { label: "Training", pct: 3, color: "bg-accent", count: 3 },
];

const CLIENT_SOURCES = [
  { label: "Instagram", pct: 42, count: 14, color: "bg-pink-400" },
  { label: "Word of Mouth", pct: 28, count: 10, color: "bg-[#4e6b51]" },
  { label: "Google", pct: 16, count: 5, color: "bg-blue-400" },
  { label: "Referral", pct: 10, count: 4, color: "bg-[#d4a574]" },
  { label: "Website", pct: 4, count: 1, color: "bg-foreground/30" },
];

const TOP_SERVICES = [
  { service: "Volume Lashes — Full Set", bookings: 28, revenue: 5040, trend: "up" },
  { service: "Classic Lash Fill", bookings: 24, revenue: 2280, trend: "up" },
  { service: "Permanent Jewelry Weld", bookings: 18, revenue: 1170, trend: "up" },
  { service: "Business Consulting", bookings: 12, revenue: 1800, trend: "neutral" },
  { service: "Mega Volume Set", bookings: 9, revenue: 1980, trend: "up" },
  { service: "Crochet Braid Install", bookings: 8, revenue: 960, trend: "down" },
];

const BUSY_HOURS = [
  { hour: "9am", load: 20 },
  { hour: "10am", load: 75 },
  { hour: "11am", load: 90 },
  { hour: "12pm", load: 60 },
  { hour: "1pm", load: 85 },
  { hour: "2pm", load: 95 },
  { hour: "3pm", load: 80 },
  { hour: "4pm", load: 70 },
  { hour: "5pm", load: 45 },
  { hour: "6pm", load: 25 },
];

const BUSY_DAYS = [
  { day: "Mon", load: 55 },
  { day: "Tue", load: 80 },
  { day: "Wed", load: 70 },
  { day: "Thu", load: 90 },
  { day: "Fri", load: 95 },
  { day: "Sat", load: 100 },
  { day: "Sun", load: 30 },
];

const STAFF_PERFORMANCE = [
  {
    name: "Trini",
    role: "Owner",
    bookings: 38,
    revenue: 4960,
    utilization: 82,
    avgTicket: 131,
    avatar: "T",
  },
  {
    name: "Aaliyah",
    role: "Lash Tech",
    bookings: 29,
    revenue: 2610,
    utilization: 68,
    avgTicket: 90,
    avatar: "A",
  },
  {
    name: "Jade",
    role: "Jewelry Artist",
    bookings: 18,
    revenue: 1170,
    utilization: 55,
    avgTicket: 65,
    avatar: "J",
  },
  {
    name: "Maya",
    role: "Stylist",
    bookings: 6,
    revenue: 720,
    utilization: 30,
    avgTicket: 120,
    avatar: "M",
  },
];

const ATTENDANCE_STATS = {
  completed: 77,
  noShow: 8,
  cancelled: 6,
  total: 91,
  revenueLost: 1240,
};

const RETENTION_TREND = [
  { week: "Jan 5", newClients: 6, returning: 11 },
  { week: "Jan 12", newClients: 7, returning: 17 },
  { week: "Jan 19", newClients: 5, returning: 14 },
  { week: "Jan 26", newClients: 9, returning: 18 },
  { week: "Feb 2", newClients: 4, returning: 20 },
  { week: "Feb 9", newClients: 8, returning: 19 },
  { week: "Feb 16", newClients: 5, returning: 23 },
  { week: "Feb 21", newClients: 6, returning: 11 },
];

const AT_RISK_CLIENTS = [
  {
    name: "Brittany W.",
    lastVisit: "Dec 28",
    daysSince: 55,
    service: "Volume Lashes",
    urgency: "high",
  },
  {
    name: "Keisha R.",
    lastVisit: "Jan 3",
    daysSince: 49,
    service: "Classic Fill",
    urgency: "high",
  },
  { name: "Tamara J.", lastVisit: "Jan 8", daysSince: 44, service: "Jewelry", urgency: "medium" },
  { name: "Nia F.", lastVisit: "Jan 11", daysSince: 41, service: "Crochet", urgency: "medium" },
  {
    name: "Destiny L.",
    lastVisit: "Jan 14",
    daysSince: 38,
    service: "Volume Lashes",
    urgency: "low",
  },
];

const REBOOK_RATES = [
  { service: "Classic Lash Fill", rate: 84, color: "bg-[#c4907a]" },
  { service: "Volume Lashes", rate: 76, color: "bg-[#c4907a]" },
  { service: "Business Consulting", rate: 68, color: "bg-[#5b8a8a]" },
  { service: "Permanent Jewelry", rate: 55, color: "bg-[#d4a574]" },
  { service: "Crochet Install", rate: 42, color: "bg-[#7ba3a3]" },
  { service: "Mega Volume Set", rate: 38, color: "bg-[#c4907a]" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function heatColor(load: number) {
  if (load >= 85) return "bg-[#c4907a]";
  if (load >= 60) return "bg-[#d4a574]";
  if (load >= 35) return "bg-[#e8c4b8]";
  return "bg-foreground/8";
}

function urgencyColor(urgency: string) {
  if (urgency === "high") return "text-destructive bg-destructive/10";
  if (urgency === "medium") return "text-[#d4a574] bg-[#d4a574]/10";
  return "text-muted bg-foreground/5";
}

function avatarBg(letter: string) {
  const palette: Record<string, string> = {
    T: "bg-[#c4907a]",
    A: "bg-[#7ba3a3]",
    J: "bg-[#d4a574]",
    M: "bg-[#5b8a8a]",
  };
  return palette[letter] ?? "bg-accent";
}

/* ------------------------------------------------------------------ */
/*  Revenue Goal Arc (SVG donut arc)                                   */
/* ------------------------------------------------------------------ */

function GoalArc({ actual, goal }: { actual: number; goal: number }) {
  const pct = Math.min(actual / goal, 1);
  const r = 44;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const strokeDash = circumference * pct;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-border"
        />
        {/* Progress */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#4e6b51"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
          strokeDashoffset={circumference * 0.25}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 16, fontWeight: 600 }}
        >
          {Math.round(pct * 100)}%
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted" style={{ fontSize: 9 }}>
          of goal
        </text>
      </svg>
      <div className="text-center">
        <p className="text-base font-semibold text-foreground">${actual.toLocaleString()}</p>
        <p className="text-[11px] text-muted">of ${goal.toLocaleString()} goal</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");

  const maxBookingBar = Math.max(
    ...BOOKINGS_TREND.map((w) => w.lash + w.jewelry + w.crochet + w.consulting),
  );
  const maxRevenueBar = Math.max(...REVENUE_TREND.map((w) => w.revenue));
  const maxRetentionBar = Math.max(...RETENTION_TREND.map((w) => w.newClients + w.returning));
  const BAR_AREA_H = 180;
  const REV_BAR_H = 160;
  const RET_BAR_H = 140;
  const PEAK_BAR_H = 110;

  const totalAttendance =
    ATTENDANCE_STATS.completed + ATTENDANCE_STATS.noShow + ATTENDANCE_STATS.cancelled;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Analytics</h1>
          <p className="text-sm text-muted mt-0.5">Trends, insights, and performance</p>
        </div>
        <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                range === r ? "bg-foreground text-background" : "text-muted hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards — 6 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-muted uppercase tracking-wide leading-tight">
                    {s.label}
                  </p>
                  <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">
                    {s.value}
                  </p>
                  <p
                    className={cn(
                      "text-[10px] mt-1 flex items-center gap-0.5",
                      s.up ? "text-[#4e6b51]" : "text-destructive",
                    )}
                  >
                    {s.up ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {s.change}
                  </p>
                </div>
                <div className={cn("rounded-xl p-2 shrink-0", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue trend + Monthly goal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue bar chart */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Revenue by Week</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            <div className="relative h-52">
              {/* Gridlines */}
              {[1000, 2000, 3000].map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${18 + (line / maxRevenueBar) * REV_BAR_H}px` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-7 text-right shrink-0">
                    ${line / 1000}k
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
              {/* Bars */}
              <div className="absolute inset-0 flex items-end gap-1.5 pl-9">
                {REVENUE_TREND.map((w) => {
                  const barPx = Math.round((w.revenue / maxRevenueBar) * REV_BAR_H);
                  return (
                    <div
                      key={w.week}
                      className="group relative flex-1 flex flex-col items-center gap-1.5"
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                        <div className="bg-foreground text-background rounded-xl px-3 py-2 shadow-xl text-[11px] whitespace-nowrap">
                          <p className="font-semibold">{w.week}</p>
                          <p className="text-background/70 mt-0.5">${w.revenue.toLocaleString()}</p>
                        </div>
                        <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                      </div>
                      <div
                        className="w-full rounded-t-sm bg-[#4e6b51] hover:brightness-110 transition-all cursor-default"
                        style={{ height: `${barPx}px` }}
                      />
                      <span className="text-[9px] text-muted whitespace-nowrap">
                        {w.week.replace("Jan ", "J").replace("Feb ", "F")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly goal */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Monthly Goal</CardTitle>
            <p className="text-xs text-muted mt-0.5">February progress</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 flex items-center justify-center">
            <GoalArc actual={REVENUE_ACTUAL} goal={REVENUE_GOAL} />
          </CardContent>
        </Card>
      </div>

      {/* Bookings trend + service mix */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Stacked bar chart */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold">Bookings by Week</CardTitle>
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: "Lash", color: "bg-[#c4907a]" },
                  { label: "Jewelry", color: "bg-[#d4a574]" },
                  { label: "Crochet", color: "bg-[#7ba3a3]" },
                  { label: "Consulting", color: "bg-[#5b8a8a]" },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className={cn("w-2 h-2 rounded-sm", l.color)} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            <div className="relative h-56">
              {[20, 15, 10, 5].map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${18 + (line / maxBookingBar) * BAR_AREA_H}px` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-4 text-right shrink-0">
                    {line}
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
              <div className="absolute inset-0 flex items-end gap-1.5 pl-6">
                {BOOKINGS_TREND.map((w) => {
                  const total = w.lash + w.jewelry + w.crochet + w.consulting;
                  const barPx = Math.round((total / maxBookingBar) * BAR_AREA_H);
                  return (
                    <div
                      key={w.week}
                      className="group relative flex-1 flex flex-col items-center gap-1.5"
                    >
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                        <div className="bg-foreground text-background rounded-xl px-3 py-2.5 shadow-xl text-[11px] whitespace-nowrap min-w-[120px]">
                          <p className="font-semibold mb-1.5 pb-1.5 border-b border-background/20">
                            {w.week} · {total} bookings
                          </p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-[#c4907a] inline-block" />
                                Lash
                              </span>
                              <span className="font-medium">{w.lash}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-[#d4a574] inline-block" />
                                Jewelry
                              </span>
                              <span className="font-medium">{w.jewelry}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-[#7ba3a3] inline-block" />
                                Crochet
                              </span>
                              <span className="font-medium">{w.crochet}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-[#5b8a8a] inline-block" />
                                Consulting
                              </span>
                              <span className="font-medium">{w.consulting}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                      </div>
                      <div
                        className="w-full flex flex-col rounded-t-sm overflow-hidden cursor-default hover:brightness-110 transition-all"
                        style={{ height: `${barPx}px` }}
                      >
                        <div className="bg-[#c4907a] min-h-0" style={{ flex: w.lash }} />
                        <div className="bg-[#d4a574] min-h-0" style={{ flex: w.jewelry }} />
                        <div className="bg-[#7ba3a3] min-h-0" style={{ flex: w.crochet }} />
                        <div className="bg-[#5b8a8a] min-h-0" style={{ flex: w.consulting }} />
                      </div>
                      <span className="text-[9px] text-muted whitespace-nowrap">{w.week}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service mix */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Service Mix</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 space-y-3.5">
            {SERVICE_MIX.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-foreground">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">{s.count} appts</span>
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {s.pct}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", s.color)}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Staff Performance */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Staff Performance</CardTitle>
          <p className="text-xs text-muted mt-0.5">
            Bookings, revenue, and utilization this period
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {STAFF_PERFORMANCE.map((s) => (
              <div
                key={s.name}
                className="bg-surface rounded-xl border border-border p-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0",
                      avatarBg(s.avatar),
                    )}
                  >
                    {s.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    <p className="text-[11px] text-muted truncate">{s.role}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-base font-semibold text-foreground tabular-nums">
                      {s.bookings}
                    </p>
                    <p className="text-[9px] text-muted uppercase tracking-wide">Bookings</p>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground tabular-nums">
                      ${(s.revenue / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[9px] text-muted uppercase tracking-wide">Revenue</p>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground tabular-nums">
                      ${s.avgTicket}
                    </p>
                    <p className="text-[9px] text-muted uppercase tracking-wide">Avg Ticket</p>
                  </div>
                </div>
                {/* Utilization bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-muted">Utilization</span>
                    <span className="text-[10px] font-medium text-foreground tabular-nums">
                      {s.utilization}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        s.utilization >= 70
                          ? "bg-[#4e6b51]"
                          : s.utilization >= 45
                            ? "bg-[#d4a574]"
                            : "bg-destructive/60",
                      )}
                      style={{ width: `${s.utilization}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Attendance & Cancellations + Rebooking Rates */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Attendance breakdown */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Attendance & Cancellations</CardTitle>
            <p className="text-xs text-muted mt-0.5">{totalAttendance} appointments this period</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 space-y-4">
            {/* Stacked horizontal breakdown bar */}
            <div className="h-4 rounded-full overflow-hidden flex gap-px">
              <div
                className="bg-[#4e6b51]"
                style={{ width: `${(ATTENDANCE_STATS.completed / totalAttendance) * 100}%` }}
              />
              <div
                className="bg-[#d4a574]"
                style={{ width: `${(ATTENDANCE_STATS.cancelled / totalAttendance) * 100}%` }}
              />
              <div
                className="bg-destructive/70"
                style={{ width: `${(ATTENDANCE_STATS.noShow / totalAttendance) * 100}%` }}
              />
            </div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center py-3 bg-[#4e6b51]/8 rounded-xl border border-[#4e6b51]/20">
                <p className="text-xl font-semibold text-[#4e6b51] tabular-nums">
                  {ATTENDANCE_STATS.completed}
                </p>
                <p className="text-[10px] text-muted mt-0.5">Completed</p>
                <p className="text-[10px] text-[#4e6b51] mt-0.5">
                  {Math.round((ATTENDANCE_STATS.completed / totalAttendance) * 100)}%
                </p>
              </div>
              <div className="text-center py-3 bg-[#d4a574]/8 rounded-xl border border-[#d4a574]/20">
                <p className="text-xl font-semibold text-[#d4a574] tabular-nums">
                  {ATTENDANCE_STATS.cancelled}
                </p>
                <p className="text-[10px] text-muted mt-0.5">Cancelled</p>
                <p className="text-[10px] text-[#d4a574] mt-0.5">
                  {Math.round((ATTENDANCE_STATS.cancelled / totalAttendance) * 100)}%
                </p>
              </div>
              <div className="text-center py-3 bg-destructive/8 rounded-xl border border-destructive/20">
                <p className="text-xl font-semibold text-destructive tabular-nums">
                  {ATTENDANCE_STATS.noShow}
                </p>
                <p className="text-[10px] text-muted mt-0.5">No-Shows</p>
                <p className="text-[10px] text-destructive mt-0.5">
                  {Math.round((ATTENDANCE_STATS.noShow / totalAttendance) * 100)}%
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted">Est. revenue lost to no-shows</span>
              <span className="text-sm font-semibold text-destructive">
                -${ATTENDANCE_STATS.revenueLost.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Rebooking rate by service */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Rebooking Rate by Service</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              % of clients who rebooked after their appointment
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 space-y-3.5">
            {REBOOK_RATES.map((s) => (
              <div key={s.service}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-foreground truncate mr-2">{s.service}</span>
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums shrink-0",
                      s.rate >= 70
                        ? "text-[#4e6b51]"
                        : s.rate >= 50
                          ? "text-[#d4a574]"
                          : "text-muted",
                    )}
                  >
                    {s.rate}%
                  </span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", s.color)}
                    style={{ width: `${s.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Client Retention + At-Risk */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* New vs returning stacked bar */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">Client Retention</CardTitle>
                <p className="text-xs text-muted mt-0.5">New vs. returning clients by week</p>
              </div>
              <div className="flex gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="w-2 h-2 rounded-sm bg-[#4e6b51] inline-block" />
                  Returning
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="w-2 h-2 rounded-sm bg-[#c4907a] inline-block" />
                  New
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            <div className="relative h-48">
              {[10, 20].map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${18 + (line / maxRetentionBar) * RET_BAR_H}px` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-4 text-right shrink-0">
                    {line}
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
              <div className="absolute inset-0 flex items-end gap-1.5 pl-6">
                {RETENTION_TREND.map((w) => {
                  const total = w.newClients + w.returning;
                  const barPx = Math.round((total / maxRetentionBar) * RET_BAR_H);
                  return (
                    <div
                      key={w.week}
                      className="group relative flex-1 flex flex-col items-center gap-1.5"
                    >
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                        <div className="bg-foreground text-background rounded-xl px-3 py-2 shadow-xl text-[11px] whitespace-nowrap">
                          <p className="font-semibold mb-1 pb-1 border-b border-background/20">
                            {w.week} · {total} clients
                          </p>
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-[#4e6b51] inline-block" />
                                Returning
                              </span>
                              <span className="font-medium">{w.returning}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-[#c4907a] inline-block" />
                                New
                              </span>
                              <span className="font-medium">{w.newClients}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                      </div>
                      <div
                        className="w-full flex flex-col rounded-t-sm overflow-hidden cursor-default hover:brightness-110 transition-all"
                        style={{ height: `${barPx}px` }}
                      >
                        <div className="bg-[#4e6b51] min-h-0" style={{ flex: w.returning }} />
                        <div className="bg-[#c4907a] min-h-0" style={{ flex: w.newClients }} />
                      </div>
                      <span className="text-[9px] text-muted whitespace-nowrap">
                        {w.week.replace("Jan ", "J").replace("Feb ", "F")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* At-risk clients */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">At-Risk Clients</CardTitle>
            <p className="text-xs text-muted mt-0.5">Haven&apos;t visited in 38+ days</p>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-2">
            {AT_RISK_CLIENTS.map((c, i) => (
              <div
                key={c.name}
                className={cn(
                  "flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface/60 transition-colors",
                  i !== 0 && "border-t border-border/40",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[11px] text-muted truncate">
                    {c.service} · {c.lastVisit}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0",
                    urgencyColor(c.urgency),
                  )}
                >
                  {c.daysSince}d ago
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top services + Client sources */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top services table */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Top Services</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 w-6">
                    #
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                    Service
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 whitespace-nowrap hidden sm:table-cell">
                    Bookings
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {TOP_SERVICES.map((s, i) => (
                  <tr
                    key={s.service}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-5 py-3 text-[11px] text-muted/50 align-middle">{i + 1}</td>
                    <td className="px-3 py-3 align-middle">
                      <p className="text-sm text-foreground">{s.service}</p>
                    </td>
                    <td className="px-3 py-3 text-right hidden sm:table-cell align-middle">
                      <span className="text-xs text-muted tabular-nums">{s.bookings}</span>
                    </td>
                    <td className="px-5 py-3 text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm font-medium text-foreground tabular-nums">
                          ${s.revenue.toLocaleString()}
                        </span>
                        {s.trend === "up" && (
                          <TrendingUp className="w-3 h-3 text-[#4e6b51] shrink-0" />
                        )}
                        {s.trend === "down" && (
                          <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Client sources */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Client Sources</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 space-y-3.5">
            {CLIENT_SOURCES.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-foreground">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">{s.count} clients</span>
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {s.pct}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", s.color)}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Peak Times */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Peak Times</CardTitle>
          <p className="text-xs text-muted mt-0.5">When your studio is busiest</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* By hour */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-3">
                By Hour
              </p>
              <div className="flex items-end gap-1 h-36">
                {BUSY_HOURS.map((h) => {
                  const busyness =
                    h.load >= 85
                      ? "Peak"
                      : h.load >= 60
                        ? "Busy"
                        : h.load >= 35
                          ? "Moderate"
                          : "Low";
                  return (
                    <div
                      key={h.hour}
                      className="group relative flex-1 flex flex-col items-center gap-1.5"
                    >
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                        <div className="bg-foreground text-background rounded-xl px-2.5 py-2 shadow-xl text-[11px] whitespace-nowrap">
                          <p className="font-semibold">{h.hour}</p>
                          <p className="text-background/70 mt-0.5">
                            {busyness} · {h.load}%
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                      </div>
                      <div
                        className={cn(
                          "w-full rounded-t-sm transition-all cursor-default hover:brightness-110",
                          heatColor(h.load),
                        )}
                        style={{ height: `${Math.round((h.load / 100) * PEAK_BAR_H)}px` }}
                      />
                      <span className="text-[9px] text-muted leading-none">{h.hour}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* By day */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-3">
                By Day
              </p>
              <div className="flex items-end gap-1.5 h-36">
                {BUSY_DAYS.map((d) => {
                  const busyness =
                    d.load >= 85
                      ? "Peak"
                      : d.load >= 60
                        ? "Busy"
                        : d.load >= 35
                          ? "Moderate"
                          : "Low";
                  return (
                    <div
                      key={d.day}
                      className="group relative flex-1 flex flex-col items-center gap-1.5"
                    >
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                        <div className="bg-foreground text-background rounded-xl px-2.5 py-2 shadow-xl text-[11px] whitespace-nowrap">
                          <p className="font-semibold">{d.day}</p>
                          <p className="text-background/70 mt-0.5">
                            {busyness} · {d.load}%
                          </p>
                        </div>
                        <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                      </div>
                      <div
                        className={cn(
                          "w-full rounded-t-sm transition-all cursor-default hover:brightness-110",
                          heatColor(d.load),
                        )}
                        style={{ height: `${Math.round((d.load / 100) * PEAK_BAR_H)}px` }}
                      />
                      <span className="text-[9px] text-muted leading-none">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border/50">
            {[
              { label: "Low", color: "bg-foreground/8" },
              { label: "Moderate", color: "bg-[#e8c4b8]" },
              { label: "Busy", color: "bg-[#d4a574]" },
              { label: "Peak", color: "bg-[#c4907a]" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className={cn("w-3 h-3 rounded-sm", l.color)} />
                {l.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
