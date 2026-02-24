/**
 * KPI stat cards — 6 key metrics across the top of the analytics dashboard.
 *
 * DB-wired via `getKpiStats()`: revenue MTD, booking count, new clients,
 * no-show rate, fill rate, avg ticket.
 *
 * @module analytics/components/KpiCards
 * @see {@link ../actions.ts} — `KpiStats` type
 */
"use client";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CalendarCheck,
  Users,
  AlertTriangle,
  BarChart2,
  Ticket,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KpiStats } from "../actions";

export function KpiCards({ stats }: { stats: KpiStats }) {
  const cards: Array<{
    label: string;
    value: string;
    icon: typeof DollarSign;
    color: string;
    bg: string;
    delta: number | null;
    invertColor?: boolean;
  }> = [
    {
      label: "Revenue MTD",
      value: `$${stats.revenueMtd.toLocaleString()}`,
      icon: DollarSign,
      color: "text-[#4e6b51]",
      bg: "bg-[#4e6b51]/10",
      delta: stats.revenueMtdDelta,
    },
    {
      label: "Bookings",
      value: `${stats.bookingCount}`,
      icon: CalendarCheck,
      color: "text-accent",
      bg: "bg-accent/10",
      delta: stats.bookingCountDelta,
    },
    {
      label: "New Clients",
      value: `${stats.newClients}`,
      icon: Users,
      color: "text-[#c4907a]",
      bg: "bg-[#c4907a]/10",
      delta: stats.newClientsDelta,
    },
    {
      label: "No-Show Rate",
      value: `${stats.noShowRate}%`,
      icon: AlertTriangle,
      color: "text-[#d4a574]",
      bg: "bg-[#d4a574]/10",
      delta: stats.noShowRateDelta,
      invertColor: true,
    },
    {
      label: "Fill Rate",
      value: `${stats.fillRate}%`,
      icon: BarChart2,
      color: "text-[#7ba3a3]",
      bg: "bg-[#7ba3a3]/10",
      delta: stats.fillRateDelta,
    },
    {
      label: "Avg Ticket",
      value: `$${stats.avgTicket}`,
      icon: Ticket,
      color: "text-blush",
      bg: "bg-blush/10",
      delta: stats.avgTicketDelta,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((s) => {
        const isPositive = s.delta !== null && s.delta >= 0;
        const deltaColor = s.invertColor
          ? isPositive
            ? "text-destructive"
            : "text-[#4e6b51]"
          : isPositive
            ? "text-[#4e6b51]"
            : "text-destructive";
        const DeltaIcon = isPositive ? TrendingUp : TrendingDown;

        return (
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
                  {s.delta !== null && (
                    <div className={cn("flex items-center gap-1 mt-1", deltaColor)}>
                      <DeltaIcon className="w-3 h-3" />
                      <span className="text-[10px] font-medium">
                        {Math.abs(s.delta)}% vs prior mo.
                      </span>
                    </div>
                  )}
                </div>
                <div className={cn("rounded-xl p-2 shrink-0", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
