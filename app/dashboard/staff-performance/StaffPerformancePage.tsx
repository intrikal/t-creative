/**
 * StaffPerformancePage — Admin dashboard for staff KPIs.
 *
 * Displays per-staff cards for 7 KPIs, a comparison bar chart, and a
 * sortable comparison table. Date range picker (7d/30d/90d/12m) persisted
 * in the URL via ?range= search param.
 *
 * @module staff-performance/StaffPerformancePage
 * @see {@link ./actions.ts} — `StaffKpi` type and data query
 */
"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  CalendarCheck,
  DollarSign,
  Clock,
  RotateCcw,
  AlertTriangle,
  Star,
  Wallet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Range, StaffKpi } from "@/lib/types/analytics.types";
import { cn } from "@/lib/utils";

const RANGES = ["7d", "30d", "90d", "12m"] as const;

const AVATAR_PALETTE: Record<string, string> = {
  T: "bg-[#c4907a]",
  A: "bg-[#7ba3a3]",
  J: "bg-[#d4a574]",
  M: "bg-[#5b8a8a]",
};

type SortKey =
  | "name"
  | "bookingsMonth"
  | "revenue"
  | "durationDelta"
  | "retentionRate"
  | "noShowRate"
  | "avgRating"
  | "commissionThisMonth";

export function StaffPerformancePage({ data }: { data: StaffKpi[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = (searchParams.get("range") as Range) ?? "30d";

  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  function setRange(r: Range) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", r);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sortedData = [...data].sort((a, b) => {
    let aVal = a[sortKey] ?? 0;
    let bVal = b[sortKey] ?? 0;
    if (typeof aVal === "string") aVal = aVal.toLowerCase() as unknown as number;
    if (typeof bVal === "string") bVal = bVal.toLowerCase() as unknown as number;
    return sortAsc ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
  });

  const selectedStaff = selectedStaffId ? data.find((s) => s.staffId === selectedStaffId) : null;

  // Chart data for comparison bar chart
  const chartData = data.map((s) => ({
    name: s.name.split(" ")[0],
    Revenue: s.revenue,
    Bookings: s.bookingsMonth,
    Commission: s.commissionThisMonth,
  }));

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Staff Performance
          </h1>
          <p className="text-sm text-muted mt-0.5">
            KPIs, retention, and commission across your team
          </p>
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

      {data.length === 0 ? (
        <Card className="gap-0">
          <CardContent className="px-5 py-12 text-center">
            <p className="text-sm text-muted">No staff data for this period.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards per staff */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((s) => (
              <Card
                key={s.staffId}
                className={cn(
                  "gap-0 cursor-pointer transition-all hover:border-accent/30",
                  selectedStaffId === s.staffId && "border-accent/50 ring-1 ring-accent/20",
                )}
                onClick={() => setSelectedStaffId(selectedStaffId === s.staffId ? null : s.staffId)}
              >
                <CardContent className="px-5 pb-5 pt-5 space-y-4">
                  {/* Staff header */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0",
                        AVATAR_PALETTE[s.avatar] ?? "bg-accent",
                      )}
                    >
                      {s.avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                      <p className="text-[11px] text-muted truncate">
                        {s.role} ·{" "}
                        {s.commissionType === "flat_fee"
                          ? `$${Math.round(s.flatFeeInCents / 100)}/session`
                          : `${s.commissionRate}% commission`}
                      </p>
                    </div>
                  </div>

                  {/* KPI grid — 4 columns */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <KpiCell
                      icon={CalendarCheck}
                      label="Bookings"
                      value={String(s.bookingsMonth)}
                      sub={`${s.bookingsWeek} this wk`}
                    />
                    <KpiCell
                      icon={DollarSign}
                      label="Revenue"
                      value={`$${s.revenue >= 1000 ? `${(s.revenue / 1000).toFixed(1)}k` : s.revenue}`}
                    />
                    <KpiCell
                      icon={Star}
                      label="Rating"
                      value={s.avgRating != null ? String(s.avgRating) : "—"}
                      sub={s.reviewCount > 0 ? `${s.reviewCount} reviews` : undefined}
                      color={
                        s.avgRating != null && s.avgRating >= 4.5 ? "text-[#4e6b51]" : undefined
                      }
                    />
                    <KpiCell
                      icon={Wallet}
                      label="Commission"
                      value={`$${s.commissionThisMonth.toLocaleString()}`}
                    />
                  </div>

                  {/* Second row — 3 columns */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <KpiCell
                      icon={Clock}
                      label="Duration"
                      value={
                        s.durationDelta != null
                          ? `${s.durationDelta > 0 ? "+" : ""}${s.durationDelta}m`
                          : "—"
                      }
                      color={
                        s.durationDelta != null
                          ? s.durationDelta > 5
                            ? "text-destructive/80"
                            : s.durationDelta <= 0
                              ? "text-[#4e6b51]"
                              : "text-[#d4a574]"
                          : undefined
                      }
                      sub={
                        s.avgScheduledMinutes != null
                          ? `${s.avgScheduledMinutes}m sched`
                          : undefined
                      }
                    />
                    <KpiCell
                      icon={RotateCcw}
                      label="Retention"
                      value={s.retentionRate != null ? `${s.retentionRate}%` : "—"}
                      color={
                        s.retentionRate != null
                          ? s.retentionRate >= 70
                            ? "text-[#4e6b51]"
                            : s.retentionRate >= 50
                              ? "text-[#d4a574]"
                              : "text-destructive/80"
                          : undefined
                      }
                      sub="60-day rebook"
                    />
                    <KpiCell
                      icon={AlertTriangle}
                      label="No-Show"
                      value={`${s.noShowRate}%`}
                      color={
                        s.noShowRate <= 5
                          ? "text-[#4e6b51]"
                          : s.noShowRate <= 15
                            ? "text-[#d4a574]"
                            : "text-destructive/80"
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Selected staff detail */}
          {selectedStaff && (
            <Card className="gap-0">
              <CardHeader className="pt-5 pb-0 px-5">
                <CardTitle className="text-sm font-semibold">
                  {selectedStaff.name} — Detail
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DetailStat label="Bookings (week)" value={String(selectedStaff.bookingsWeek)} />
                  <DetailStat
                    label="Bookings (month)"
                    value={String(selectedStaff.bookingsMonth)}
                  />
                  <DetailStat
                    label="Bookings (all time)"
                    value={String(selectedStaff.bookingsAllTime)}
                  />
                  <DetailStat
                    label="Revenue"
                    value={`$${selectedStaff.revenue.toLocaleString()}`}
                  />
                  <DetailStat
                    label="Avg Scheduled"
                    value={
                      selectedStaff.avgScheduledMinutes != null
                        ? `${selectedStaff.avgScheduledMinutes} min`
                        : "—"
                    }
                  />
                  <DetailStat
                    label="Avg Actual"
                    value={
                      selectedStaff.avgActualMinutes != null
                        ? `${selectedStaff.avgActualMinutes} min`
                        : "—"
                    }
                  />
                  <DetailStat
                    label="Retention (60-day)"
                    value={
                      selectedStaff.retentionRate != null ? `${selectedStaff.retentionRate}%` : "—"
                    }
                  />
                  <DetailStat
                    label="Commission (period)"
                    value={`$${selectedStaff.commissionThisPeriod.toLocaleString()}`}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comparison chart */}
          <Card className="gap-0">
            <CardHeader className="pt-5 pb-0 px-5">
              <CardTitle className="text-sm font-semibold">Staff Comparison</CardTitle>
              <p className="text-xs text-muted mt-0.5">
                Revenue, bookings, and commission this month
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4">
              <div className="w-full select-none">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border-tertiary)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
                      }
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-foreground text-background text-xs rounded-lg px-3 py-2 shadow-md">
                            <p className="font-medium mb-1">{label}</p>
                            {payload.map((p) => (
                              <p key={p.name}>
                                {p.name}:{" "}
                                {p.name === "Bookings"
                                  ? p.value
                                  : `$${Number(p.value).toLocaleString()}`}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                    <Bar dataKey="Revenue" fill="#c4907a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Commission" fill="#7ba3a3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Comparison table */}
          <Card className="gap-0">
            <CardHeader className="pt-5 pb-0 px-5">
              <CardTitle className="text-sm font-semibold">Performance Table</CardTitle>
              <p className="text-xs text-muted mt-0.5">Click column headers to sort</p>
            </CardHeader>
            <CardContent className="px-0 pb-0 pt-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <SortHeader
                        label="Staff"
                        sortKey="name"
                        current={sortKey}
                        asc={sortAsc}
                        onClick={handleSort}
                        align="left"
                        className="px-4 md:px-5"
                      />
                      <SortHeader
                        label="Bookings"
                        sortKey="bookingsMonth"
                        current={sortKey}
                        asc={sortAsc}
                        onClick={handleSort}
                      />
                      <SortHeader
                        label="Revenue"
                        sortKey="revenue"
                        current={sortKey}
                        asc={sortAsc}
                        onClick={handleSort}
                      />
                      <SortHeader
                        label="Dur. Delta"
                        sortKey="durationDelta"
                        current={sortKey}
                        asc={sortAsc}
                        onClick={handleSort}
                        className="hidden md:table-cell"
                      />
                      <SortHeader
                        label="Retention"
                        sortKey="retentionRate"
                        current={sortKey}
                        asc={sortAsc}
                        onClick={handleSort}
                        className="hidden md:table-cell"
                      />
                      <SortHeader
                        label="No-Show"
                        sortKey="noShowRate"
                        current={sortKey}
                        asc={sortAsc}
                        onClick={handleSort}
                      />
                      <SortHeader
                        label="Rating"
                        sortKey="avgRating"
                        current={sortKey}
                        asc={sortAsc}
                        onClick={handleSort}
                        className="hidden lg:table-cell"
                      />
                      <SortHeader
                        label="Commission"
                        sortKey="commissionThisMonth"
                        current={sortKey}
                        asc={sortAsc}
                        onClick={handleSort}
                        className="px-4 md:px-5"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((s) => (
                      <tr
                        key={s.staffId}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      >
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0",
                                AVATAR_PALETTE[s.avatar] ?? "bg-accent",
                              )}
                            >
                              {s.avatar}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {s.name}
                              </p>
                              <p className="text-[10px] text-muted">{s.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <span className="text-sm text-foreground tabular-nums">
                            {s.bookingsMonth}
                          </span>
                          <p className="text-[9px] text-muted">{s.bookingsAllTime} total</p>
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            ${s.revenue.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center align-middle hidden md:table-cell">
                          <span
                            className={cn(
                              "text-sm tabular-nums",
                              s.durationDelta != null
                                ? s.durationDelta > 5
                                  ? "text-destructive/80"
                                  : s.durationDelta <= 0
                                    ? "text-[#4e6b51]"
                                    : "text-[#d4a574]"
                                : "text-muted",
                            )}
                          >
                            {s.durationDelta != null
                              ? `${s.durationDelta > 0 ? "+" : ""}${s.durationDelta}m`
                              : "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center align-middle hidden md:table-cell">
                          <span
                            className={cn(
                              "text-sm tabular-nums",
                              s.retentionRate != null
                                ? s.retentionRate >= 70
                                  ? "text-[#4e6b51]"
                                  : s.retentionRate >= 50
                                    ? "text-[#d4a574]"
                                    : "text-destructive/80"
                                : "text-muted",
                            )}
                          >
                            {s.retentionRate != null ? `${s.retentionRate}%` : "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <span
                            className={cn(
                              "text-sm tabular-nums",
                              s.noShowRate <= 5
                                ? "text-[#4e6b51]"
                                : s.noShowRate <= 15
                                  ? "text-[#d4a574]"
                                  : "text-destructive/80",
                            )}
                          >
                            {s.noShowRate}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center align-middle hidden lg:table-cell">
                          <span className="text-sm text-foreground tabular-nums">
                            {s.avgRating != null ? s.avgRating : "—"}
                          </span>
                          {s.reviewCount > 0 && (
                            <p className="text-[9px] text-muted">{s.reviewCount} reviews</p>
                          )}
                        </td>
                        <td className="px-4 md:px-5 py-3 text-right align-middle">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            ${s.commissionThisMonth.toLocaleString()}
                          </span>
                          <p className="text-[9px] text-muted">
                            ${s.commissionThisPeriod.toLocaleString()} period
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function KpiCell({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div>
      <Icon className="w-3 h-3 text-muted mx-auto mb-1" />
      <p className={cn("text-base font-semibold tabular-nums", color ?? "text-foreground")}>
        {value}
      </p>
      <p className="text-[9px] text-muted uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[9px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg border border-border p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-lg font-semibold text-foreground mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function SortHeader({
  label,
  sortKey: key,
  current,
  asc,
  onClick,
  align = "center",
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const isActive = current === key;
  const alignClass =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";

  return (
    <th
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 cursor-pointer select-none hover:text-foreground transition-colors",
        alignClass,
        className,
      )}
      onClick={() => onClick(key)}
    >
      {label}
      {isActive && <span className="ml-0.5 text-foreground">{asc ? "↑" : "↓"}</span>}
    </th>
  );
}
