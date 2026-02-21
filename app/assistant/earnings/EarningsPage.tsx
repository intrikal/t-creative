"use client";

import { useState } from "react";
import { TrendingUp, DollarSign, CalendarDays, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Period = "week" | "month" | "all";

interface EarningEntry {
  id: number;
  date: string;
  service: string;
  client: string;
  clientInitials: string;
  gross: number;
  commission: number; // percentage
  net: number;
  status: "paid" | "pending";
}

const EARNINGS: EarningEntry[] = [
  {
    id: 1,
    date: "Today",
    service: "Classic Lash Fill",
    client: "Maya R.",
    clientInitials: "MR",
    gross: 75,
    commission: 60,
    net: 45,
    status: "pending",
  },
  {
    id: 2,
    date: "Today",
    service: "Volume Lashes Full Set",
    client: "Priya K.",
    clientInitials: "PK",
    gross: 140,
    commission: 60,
    net: 84,
    status: "pending",
  },
  {
    id: 3,
    date: "Today",
    service: "Classic Lash Fill",
    client: "Chloe T.",
    clientInitials: "CT",
    gross: 75,
    commission: 60,
    net: 45,
    status: "pending",
  },
  {
    id: 4,
    date: "Today",
    service: "Lash Removal + Rebook",
    client: "Amy L.",
    clientInitials: "AL",
    gross: 35,
    commission: 60,
    net: 21,
    status: "pending",
  },
  {
    id: 5,
    date: "Feb 22",
    service: "Classic Lash Fill",
    client: "Dana W.",
    clientInitials: "DW",
    gross: 75,
    commission: 60,
    net: 45,
    status: "pending",
  },
  {
    id: 6,
    date: "Feb 22",
    service: "Volume Lashes Full Set",
    client: "Nia B.",
    clientInitials: "NB",
    gross: 140,
    commission: 60,
    net: 84,
    status: "pending",
  },
  {
    id: 7,
    date: "Feb 15",
    service: "Volume Lashes Full Set",
    client: "Lena P.",
    clientInitials: "LP",
    gross: 140,
    commission: 60,
    net: 84,
    status: "paid",
  },
  {
    id: 8,
    date: "Feb 14",
    service: "Classic Lash Fill",
    client: "Tasha N.",
    clientInitials: "TN",
    gross: 75,
    commission: 60,
    net: 45,
    status: "paid",
  },
  {
    id: 9,
    date: "Feb 12",
    service: "Hybrid Lashes Full Set",
    client: "Kira M.",
    clientInitials: "KM",
    gross: 130,
    commission: 60,
    net: 78,
    status: "paid",
  },
  {
    id: 10,
    date: "Feb 10",
    service: "Classic Lash Fill",
    client: "Jordan L.",
    clientInitials: "JL",
    gross: 75,
    commission: 60,
    net: 45,
    status: "paid",
  },
  {
    id: 11,
    date: "Feb 8",
    service: "Lash Tint + Lift",
    client: "Aisha R.",
    clientInitials: "AR",
    gross: 65,
    commission: 60,
    net: 39,
    status: "paid",
  },
  {
    id: 12,
    date: "Feb 5",
    service: "Classic Lash Fill",
    client: "Sade O.",
    clientInitials: "SO",
    gross: 75,
    commission: 60,
    net: 45,
    status: "paid",
  },
  {
    id: 13,
    date: "Feb 3",
    service: "Volume Lashes Full Set",
    client: "Camille F.",
    clientInitials: "CF",
    gross: 140,
    commission: 60,
    net: 84,
    status: "paid",
  },
  {
    id: 14,
    date: "Feb 1",
    service: "Classic Lash Fill",
    client: "Dana W.",
    clientInitials: "DW",
    gross: 75,
    commission: 60,
    net: 45,
    status: "paid",
  },
  {
    id: 15,
    date: "Jan 28",
    service: "Volume Lashes Full Set",
    client: "Nia B.",
    clientInitials: "NB",
    gross: 140,
    commission: 60,
    net: 84,
    status: "paid",
  },
  {
    id: 16,
    date: "Jan 24",
    service: "Volume Lashes Full Set",
    client: "Amy L.",
    clientInitials: "AL",
    gross: 140,
    commission: 60,
    net: 84,
    status: "paid",
  },
];

const WEEKLY_BARS = [
  { label: "Feb 10", amount: 159 },
  { label: "Feb 11", amount: 0 },
  { label: "Feb 12", amount: 78 },
  { label: "Feb 13", amount: 0 },
  { label: "Feb 14", amount: 45 },
  { label: "Feb 15", amount: 84 },
  { label: "Feb 16", amount: 0 },
];

export function AssistantEarningsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  const pendingEarnings = EARNINGS.filter((e) => e.status === "pending");

  const thisWeekEntries = EARNINGS.filter((e) => ["Today", "Feb 22"].includes(e.date));
  const thisWeekGross = thisWeekEntries.reduce((s, e) => s + e.gross, 0);
  const thisWeekNet = thisWeekEntries.reduce((s, e) => s + e.net, 0);

  const monthNet = EARNINGS.reduce((s, e) => s + e.net, 0);
  const pendingTotal = pendingEarnings.reduce((s, e) => s + e.net, 0);

  const displayEntries =
    period === "week"
      ? thisWeekEntries
      : period === "month"
        ? EARNINGS.filter((e) => !["Jan 28", "Jan 24"].includes(e.date))
        : EARNINGS;

  const maxBar = Math.max(...WEEKLY_BARS.map((b) => b.amount));

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Earnings</h1>
        <p className="text-sm text-muted mt-0.5">
          Your commission breakdown — 60% of service price
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "This Week (Net)",
            value: `$${thisWeekNet}`,
            icon: TrendingUp,
            iconColor: "text-[#4e6b51]",
            iconBg: "bg-[#4e6b51]/10",
          },
          {
            label: "This Week (Gross)",
            value: `$${thisWeekGross}`,
            icon: DollarSign,
            iconColor: "text-blush",
            iconBg: "bg-blush/10",
          },
          {
            label: "Pending Payout",
            value: `$${pendingTotal}`,
            icon: Clock,
            iconColor: "text-[#7a5c10]",
            iconBg: "bg-[#7a5c10]/10",
          },
          {
            label: "Month to Date",
            value: `$${monthNet}`,
            icon: CalendarDays,
            iconColor: "text-accent",
            iconBg: "bg-accent/10",
          },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {s.label}
                  </p>
                  <p className="text-2xl font-semibold text-foreground tracking-tight mt-1">
                    {s.value}
                  </p>
                </div>
                <div className={cn("rounded-xl p-2 shrink-0", s.iconBg)}>
                  <s.icon className={cn("w-4 h-4", s.iconColor)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly chart */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Weekly Earnings (Net)</CardTitle>
              <p className="text-xs text-muted mt-0.5">
                Feb 10 – 16 · Total:{" "}
                <span className="font-medium text-foreground">
                  ${WEEKLY_BARS.reduce((s, b) => s + b.amount, 0)}
                </span>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="flex items-end gap-2 h-28">
            {WEEKLY_BARS.map((bar) => {
              const isHovered = hoveredBar === bar.label;
              return (
                <div
                  key={bar.label}
                  className="flex-1 flex flex-col items-center gap-1 relative group"
                  onMouseEnter={() => bar.amount > 0 && setHoveredBar(bar.label)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                      <div className="bg-foreground text-background text-[11px] font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-md">
                        {bar.label} · ${bar.amount}
                      </div>
                      <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                    </div>
                  )}
                  <span className="text-[10px] text-muted tabular-nums">
                    {bar.amount > 0 ? `$${bar.amount}` : ""}
                  </span>
                  <div className="w-full flex items-end" style={{ height: "80px" }}>
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-all",
                        isHovered ? "bg-[#a0705a]" : "bg-[#c4907a]",
                      )}
                      style={{
                        height: `${maxBar > 0 ? (bar.amount / maxBar) * 80 : 0}px`,
                        minHeight: bar.amount > 0 ? "4px" : "0",
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-muted">{bar.label.split(" ")[1]}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Earnings log */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Earnings Log</CardTitle>
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
        <CardContent className="px-0 pb-0 pt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface/30">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1">
                  Service / Client
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1 hidden sm:table-cell">
                  Date
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1 hidden md:table-cell">
                  Gross
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1">
                  Your Cut
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                >
                  <td className="px-5 py-3 align-middle">
                    <p className="text-sm font-medium text-foreground">{e.service}</p>
                    <p className="text-[10px] text-muted">{e.client}</p>
                  </td>
                  <td className="px-4 py-3 align-middle hidden sm:table-cell">
                    <span className="text-xs text-muted">{e.date}</span>
                  </td>
                  <td className="px-4 py-3 text-right align-middle hidden md:table-cell">
                    <span className="text-xs text-muted">${e.gross}</span>
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <span className="text-sm font-semibold text-foreground">${e.net}</span>
                    <span className="text-[10px] text-muted ml-1">({e.commission}%)</span>
                  </td>
                  <td className="px-5 py-3 text-center align-middle">
                    <Badge
                      className={cn(
                        "border text-[10px] px-1.5 py-0.5",
                        e.status === "paid"
                          ? "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20"
                          : "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20",
                      )}
                    >
                      {e.status === "paid" ? "Paid" : "Pending"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
