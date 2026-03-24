"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download } from "lucide-react";
import type { BookingExportRow, Range } from "@/lib/types/analytics.types";
import { cn } from "@/lib/utils";
import { exportBookingsCsv } from "./actions";

const RANGES = ["7d", "30d", "90d", "12m"] as const;

const INSIGHTS_TABS = ["Overview", "Revenue", "Bookings", "Clients", "Team", "Marketing"] as const;
type InsightsTab = (typeof INSIGHTS_TABS)[number];

export function AnalyticsShell({
  kpis,
  overview,
  revenue,
  bookings,
  clients,
  team,
  marketing,
}: {
  kpis: ReactNode;
  overview: ReactNode;
  revenue: ReactNode;
  bookings: ReactNode;
  clients: ReactNode;
  team: ReactNode;
  marketing: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = (searchParams.get("range") as Range) ?? "30d";
  const [tab, setTab] = useState<InsightsTab>("Overview");
  const [isExporting, startExport] = useTransition();

  function setRange(r: Range) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", r);
    router.push(`${pathname}?${params.toString()}`);
  }

  function downloadCsv(rows: BookingExportRow[]) {
    const headers = [
      "Date",
      "Client",
      "Service",
      "Status",
      "Duration (min)",
      "Price",
      "Staff",
      "Notes",
    ];
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [r.date, r.client, r.service, r.status, r.durationMin, r.priceUsd, r.staff, r.notes]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Insights
          </h1>
          <p className="text-sm text-muted mt-0.5">Trends, insights, and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              startExport(async () => {
                const rows = await exportBookingsCsv();
                downloadCsv(rows);
              })
            }
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-border text-xs font-medium text-foreground hover:bg-foreground/8 hover:border-foreground/20 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? "Exporting\u2026" : "Export CSV"}
          </button>
          <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  range === r
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards — always visible */}
      {kpis}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {INSIGHTS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content — display:none keeps Suspense boundaries streaming
          independently without re-mounting when switching tabs */}
      <div style={{ display: tab === "Overview" ? "block" : "none" }}>{overview}</div>
      <div style={{ display: tab === "Revenue" ? "block" : "none" }}>{revenue}</div>
      <div style={{ display: tab === "Bookings" ? "block" : "none" }}>{bookings}</div>
      <div style={{ display: tab === "Clients" ? "block" : "none" }}>{clients}</div>
      <div style={{ display: tab === "Team" ? "block" : "none" }}>{team}</div>
      <div style={{ display: tab === "Marketing" ? "block" : "none" }}>{marketing}</div>
    </div>
  );
}
