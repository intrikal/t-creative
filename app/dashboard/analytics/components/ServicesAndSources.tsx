/**
 * Top services table + client sources breakdown.
 *
 * DB-wired: Top services from `getTopServices()`, client sources from `getClientSources()`.
 *
 * @module analytics/components/ServicesAndSources
 * @see {@link ../actions.ts} — `TopService`, `ClientSourceItem` types
 */
"use client";

import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TopService, ClientSourceItem } from "../actions";

const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  word_of_mouth: "Word of Mouth",
  google_search: "Google",
  referral: "Referral",
  website_direct: "Website",
  event: "Event / Pop-Up",
};

const SOURCE_COLORS: Record<string, string> = {
  instagram: "bg-pink-400",
  tiktok: "bg-foreground/70",
  pinterest: "bg-red-400",
  word_of_mouth: "bg-[#4e6b51]",
  google_search: "bg-blue-400",
  referral: "bg-[#d4a574]",
  website_direct: "bg-foreground/30",
  event: "bg-[#7ba3a3]",
};

export function ServicesAndSources({
  topServices,
  clientSources,
}: {
  topServices: TopService[];
  clientSources: ClientSourceItem[];
}) {
  return (
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
              {topServices.map((s, i) => (
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
                      {s.revenue > 0 && <TrendingUp className="w-3 h-3 text-[#4e6b51] shrink-0" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Client sources (DB-wired) */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Client Sources</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4 space-y-3.5">
          {clientSources.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              No source data yet. Assign sources to clients.
            </p>
          ) : (
            clientSources.map((s) => (
              <div key={s.source}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-foreground">
                    {SOURCE_LABELS[s.source] ?? s.source}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">{s.count} clients</span>
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {s.pct}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      SOURCE_COLORS[s.source] ?? "bg-foreground/30",
                    )}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
