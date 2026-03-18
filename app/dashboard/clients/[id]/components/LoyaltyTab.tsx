/**
 * @module LoyaltyTab
 * Loyalty points balance card with tier display and
 * transaction history list.
 */

import { Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, getTier } from "./helpers";
import type { ClientDetailData } from "./types";

interface LoyaltyTabProps {
  data: ClientDetailData;
}

export function LoyaltyTab({ data }: LoyaltyTabProps) {
  const tier = getTier(data.loyaltyBalance);

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <Card className="py-0">
        <CardContent className="p-5 flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", tier.bg)}>
            <Gift className={cn("w-5 h-5", tier.color)} />
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{data.loyaltyBalance} points</p>
            <p className={cn("text-sm font-medium", tier.color)}>{tier.label} Tier</p>
          </div>
        </CardContent>
      </Card>

      {/* Transaction history */}
      {data.loyaltyTransactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted">No loyalty activity</p>
        </div>
      ) : (
        <div className="space-y-1">
          {data.loyaltyTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-foreground/3 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">
                  {tx.description || tx.type.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted">{formatDate(tx.createdAt)}</p>
              </div>
              <span
                className={cn(
                  "text-sm font-semibold shrink-0",
                  tx.points > 0 ? "text-green-600" : "text-red-500",
                )}
              >
                {tx.points > 0 ? "+" : ""}
                {tx.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
