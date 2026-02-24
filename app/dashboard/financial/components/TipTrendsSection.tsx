/**
 * Tip percentage trends — weekly trend + per-category breakdown.
 *
 * @module financial/components/TipTrendsSection
 * @see {@link ../actions.ts} — `TipStats` type, `getTipTrends()`
 */
"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TipStats } from "../actions";

const CATEGORY_COLORS: Record<string, string> = {
  "Lash Services": "bg-[#c4907a]",
  Jewelry: "bg-[#d4a574]",
  Consulting: "bg-[#5b8a8a]",
  Crochet: "bg-[#7ba3a3]",
};

export function TipTrendsSection({ data }: { data: TipStats }) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const maxPct = Math.max(...data.weeklyTrend.map((w) => w.avgTipPct), 1);
  const maxCatPct = Math.max(...data.byCategory.map((c) => c.avgTipPct), 1);

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Heart className="w-4 h-4 text-muted" /> Tip Trends
          </CardTitle>
          <span className="text-xs text-muted">{data.overallAvgPct}% avg overall</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4 space-y-5">
        {/* Weekly bar chart */}
        {data.weeklyTrend.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-3">
              Weekly Average Tip %
            </p>
            <div className="h-28 flex items-end gap-2">
              {data.weeklyTrend.map((w, i) => (
                <div
                  key={w.week}
                  className="relative flex-1 flex flex-col items-center justify-end h-full"
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {hoveredBar === i && (
                    <div className="absolute bottom-full mb-1.5 z-10 pointer-events-none">
                      <div className="bg-foreground text-background text-[10px] font-semibold rounded-md px-2 py-1 whitespace-nowrap shadow-sm">
                        {w.avgTipPct}%
                      </div>
                      <div className="w-1.5 h-1.5 bg-foreground rotate-45 mx-auto -mt-1" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "w-full rounded-t transition-all cursor-default",
                      "bg-[#d4a574]",
                      hoveredBar === i && "brightness-90",
                    )}
                    style={{ height: `${(w.avgTipPct / maxPct) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-1.5">
              {data.weeklyTrend.map((w) => (
                <div key={w.week} className="flex-1 text-center">
                  <span className="text-[10px] text-muted">{w.week}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-category breakdown */}
        {data.byCategory.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-3">
              By Service Category
            </p>
            <div className="space-y-2.5">
              {data.byCategory.map((c) => (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{c.category}</span>
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {c.avgTipPct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${CATEGORY_COLORS[c.category] ?? "bg-[#8fa89c]"}`}
                      style={{ width: `${(c.avgTipPct / maxCatPct) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
