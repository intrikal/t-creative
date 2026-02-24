/**
 * Product vs service revenue split.
 *
 * @module financial/components/ProductSalesSection
 * @see {@link ../actions.ts} — `ProductSalesStats` type, `getProductSales()`
 */
"use client";

import { Package, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductSalesStats } from "../actions";

export function ProductSalesSection({
  productSales,
  totalRevenue,
}: {
  productSales: ProductSalesStats;
  totalRevenue: number;
}) {
  const serviceRevenue = Math.max(0, totalRevenue - productSales.productRevenue);
  const total = productSales.productRevenue + serviceRevenue;
  const productPct = total > 0 ? Math.round((productSales.productRevenue / total) * 100) : 0;
  const servicePct = 100 - productPct;

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Package className="w-4 h-4 text-muted" /> Revenue Breakdown
        </CardTitle>
        <p className="text-xs text-muted mt-0.5">Products vs services</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4 space-y-4">
        {/* Stacked bar */}
        <div className="h-3 bg-border rounded-full overflow-hidden flex">
          {servicePct > 0 && (
            <div
              className="h-full bg-[#c4907a] transition-all"
              style={{ width: `${servicePct}%` }}
            />
          )}
          {productPct > 0 && (
            <div
              className="h-full bg-[#5b8a8a] transition-all"
              style={{ width: `${productPct}%` }}
            />
          )}
        </div>

        {/* Legend + stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#c4907a] mt-1 shrink-0" />
            <div>
              <p className="text-xs text-muted">Services</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">
                ${serviceRevenue.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted">{servicePct}% of revenue</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#5b8a8a] mt-1 shrink-0" />
            <div>
              <p className="text-xs text-muted">Products</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">
                ${productSales.productRevenue.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted">
                {productSales.productOrderCount} orders &middot; ${productSales.avgOrderValue} avg
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
