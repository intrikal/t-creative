"use client";

import { Plus, Minus, Pencil, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProductRow } from "../actions";
import { CATEGORY_CONFIG, statusConfig, priceDisplay, LOW_STOCK_THRESHOLD } from "./helpers";

export function InventoryTab({
  products,
  pendingIds,
  onAdjustStock,
  onEdit,
}: {
  products: ProductRow[];
  pendingIds: Set<string>;
  onAdjustStock: (id: number, delta: number) => void;
  onEdit: (p: ProductRow) => void;
}) {
  const trackedProducts = products.filter((p) => p.stock !== undefined);

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Stock Inventory</CardTitle>
          <span className="text-xs text-muted">{trackedProducts.length} tracked items</span>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface/30">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1">
                  Product
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1 hidden md:table-cell">
                  Category
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1 hidden lg:table-cell">
                  Pricing
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1">
                  Stock
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1">
                  Status
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1 hidden lg:table-cell">
                  Sold
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1">
                  Adjust
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1 hidden md:table-cell">
                  Edit
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const cat = CATEGORY_CONFIG[p.category];
                const sts = statusConfig(p.status);
                const isLow =
                  p.stock !== undefined && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD;
                const isOut = p.stock === 0;
                const pending = pendingIds.has(`p-${p.id}`);
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors",
                      pending && "opacity-60",
                    )}
                  >
                    <td className="px-5 py-3.5 align-middle">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        {isLow && (
                          <p className="text-[10px] text-[#7a5c10] flex items-center gap-0.5 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> Low stock
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell align-middle">
                      <Badge className={cn("border text-[10px] px-1.5 py-0.5", cat.className)}>
                        {cat.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell align-middle">
                      <span className="text-xs text-muted">{priceDisplay(p)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      {p.stock !== undefined ? (
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            isOut
                              ? "text-destructive"
                              : isLow
                                ? "text-[#7a5c10]"
                                : "text-foreground",
                          )}
                        >
                          {p.stock}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                        {sts.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden lg:table-cell align-middle">
                      <span className="text-xs text-muted tabular-nums">{p.sales}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center align-middle">
                      {p.stock !== undefined ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onAdjustStock(p.id, -1)}
                            disabled={p.stock === 0}
                            className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:bg-foreground/5 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs tabular-nums w-6 text-center text-foreground font-medium">
                            {p.stock}
                          </span>
                          <button
                            onClick={() => onAdjustStock(p.id, 1)}
                            className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onEdit(p)}
                          className="text-[11px] text-accent hover:underline"
                        >
                          Enable
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center hidden md:table-cell align-middle">
                      <button
                        onClick={() => onEdit(p)}
                        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
