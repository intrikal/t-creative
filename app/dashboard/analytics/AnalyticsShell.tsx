"use client";

import { type ReactNode, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download } from "lucide-react";
import type { BookingExportRow, Range } from "@/lib/types/analytics.types";
import { cn } from "@/lib/utils";
import { exportBookingsCsv } from "./actions";

const RANGES = ["7d", "30d", "90d", "12m"] as const;

export const INSIGHTS_TABS = [
  "Overview",
  "Revenue",
  "Bookings",
  "Clients",
  "Team",
  "Marketing",
] as const;
export type InsightsTab = (typeof INSIGHTS_TABS)[number];

export function AnalyticsShell({
  kpis,
  tabContent,
  activeTab,
}: {
  kpis: ReactNode;
  tabContent: ReactNode;
  activeTab: InsightsTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = (searchParams.get("range") as Range) ?? "30d";
  const [isExporting, startExport] = useTransition();

  function setRange(r: Range) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", r);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setTab(t: InsightsTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (t === "Overview") {
      params.delete("tab");
    } else {
      params.set("tab", t);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
              activeTab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content — only the active tab's sections are server-rendered */}
      {tabContent}
    </div>
  );
}
