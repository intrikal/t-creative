/**
 * Promotions tab — DB-wired promo codes and discount offers.
 *
 * Receives `PromotionRow[]` from `getPromotions()` via parent props.
 *
 * @module financial/components/PromotionsTab
 * @see {@link ../actions.ts} — `PromotionRow` type, `getPromotions()`
 */
"use client";

import { Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromotionRow } from "../actions";

/** Format the discount value for display based on type. */
function formatDiscount(type: string, value: number) {
  if (type === "percent") return `${value}%`;
  if (type === "fixed") return `$${Math.round(value / 100)}`;
  if (type === "bogo") return "2-for-1";
  return String(value);
}

export function PromotionsTab({
  promotions,
  onNewPromo,
}: {
  promotions: PromotionRow[];
  onNewPromo: () => void;
}) {
  const activePromos = promotions.filter((p) => p.isActive).length;
  const totalRedemptions = promotions.reduce((s, p) => s + p.redemptionCount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Promotions & Discount Codes</h2>
          <p className="text-xs text-muted mt-0.5">
            Create discount codes, seasonal offers, and referral bonuses.
          </p>
        </div>
        <button
          onClick={onNewPromo}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Tag className="w-3.5 h-3.5" />
          New Promo
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Promos", value: String(activePromos) },
          { label: "Total Redemptions", value: String(totalRedemptions) },
          { label: "Total Promos", value: String(promotions.length) },
        ].map((s) => (
          <div key={s.label} className="bg-background border border-border rounded-xl p-3">
            <p className="text-[10px] text-muted uppercase tracking-wide font-medium">{s.label}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {promotions.length === 0 ? (
        <p className="text-sm text-muted text-center py-12">No promotions created yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {promotions.map((p) => (
            <div
              key={p.id}
              className={cn(
                "bg-background border rounded-xl p-4 flex flex-col gap-3",
                p.isActive ? "border-border" : "border-border/40 opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold text-foreground">
                      {p.code}
                    </span>
                    <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                      {formatDiscount(p.discountType, p.discountValue)}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{p.description ?? "No description"}</p>
                </div>
                <button className="p-1.5 text-muted hover:text-destructive hover:bg-destructive/8 rounded-lg transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted flex-wrap">
                <span>
                  {p.redemptionCount}
                  {p.maxUses ? `/${p.maxUses}` : ""} uses
                </span>
                <span>Expires: {p.endsAt ?? "No expiry"}</span>
                <span className={cn("font-medium", p.isActive ? "text-[#4e6b51]" : "text-muted")}>
                  {p.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
