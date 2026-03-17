"use client";

import { type ReactNode, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingExportRow } from "./actions";
import { exportBookingsCsv } from "./actions";

const RANGES = ["7d", "30d", "90d", "12m"] as const;
type Range = (typeof RANGES)[number];

export function AnalyticsShell({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<Range>("30d");
  const [isExporting, startExport] = useTransition();

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
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Analytics</h1>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-foreground hover:border-foreground/20 transition-colors disabled:opacity-50"
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

      {children}
    </div>
  );
}
