/**
 * Promotion ROI — table showing revenue generated vs discount given
 * for each promotion code, with ROI indicator.
 *
 * DB-wired: data from `getPromotionRoi()`.
 *
 * @module analytics/components/PromotionRoiSection
 * @see {@link ../actions.ts} — `PromotionRoiItem` type
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PromotionRoiItem } from "../actions";

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percent: "%",
  fixed: "$",
  bogo: "BOGO",
};

function roiColor(roi: number) {
  if (roi >= 200) return "text-[#4e6b51]";
  if (roi >= 0) return "text-[#d4a574]";
  return "text-destructive";
}

function roiBgColor(roi: number) {
  if (roi >= 200) return "bg-[#4e6b51]/10 text-[#4e6b51]";
  if (roi >= 0) return "bg-[#d4a574]/10 text-[#d4a574]";
  return "bg-destructive/10 text-destructive";
}

export function PromotionRoiSection({ data }: { data: PromotionRoiItem[] }) {
  if (data.length === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Promotion ROI</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <p className="text-sm text-muted text-center py-8">
            No promotions have been redeemed yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalDiscount = data.reduce((s, d) => s + d.totalDiscount, 0);
  const totalNet = data.reduce((s, d) => s + d.netRevenue, 0);
  const overallRoi =
    totalDiscount > 0 ? Math.round(((totalNet - totalDiscount) / totalDiscount) * 100) : 0;

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">Promotion ROI</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              All time — revenue generated vs discounts given
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-muted uppercase tracking-wide">Total Discounted</p>
              <p className="text-sm font-medium text-foreground tabular-nums">
                ${totalDiscount.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted uppercase tracking-wide">Net Revenue</p>
              <p className="text-sm font-medium text-foreground tabular-nums">
                ${totalNet.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted uppercase tracking-wide">Overall ROI</p>
              <p className={cn("text-sm font-semibold tabular-nums", roiColor(overallRoi))}>
                {overallRoi > 0 ? "+" : ""}
                {overallRoi}%
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                Promo Code
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden sm:table-cell">
                Bookings
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                Gross Rev
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                Discount
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                Net Rev
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                ROI
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr
                key={p.code}
                className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
              >
                <td className="px-5 py-3 align-middle">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground font-mono">
                        {p.code}
                      </span>
                      <span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded">
                        {DISCOUNT_TYPE_LABELS[p.discountType] ?? p.discountType}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-[11px] text-muted mt-0.5 truncate max-w-48">
                        {p.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-right align-middle hidden sm:table-cell">
                  <span className="text-xs text-muted tabular-nums">{p.bookings}</span>
                </td>
                <td className="px-3 py-3 text-right align-middle hidden md:table-cell">
                  <span className="text-xs text-muted tabular-nums">
                    ${p.grossRevenue.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-3 text-right align-middle">
                  <span className="text-sm text-destructive/80 tabular-nums">
                    -${p.totalDiscount.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-3 text-right align-middle">
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    ${p.netRevenue.toLocaleString()}
                  </span>
                </td>
                <td className="px-5 py-3 text-right align-middle">
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums whitespace-nowrap",
                      roiBgColor(p.roi),
                    )}
                  >
                    {p.roi > 0 ? "+" : ""}
                    {p.roi}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
