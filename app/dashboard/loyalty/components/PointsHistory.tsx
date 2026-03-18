/**
 * PointsHistory.tsx — Transaction history section.
 *
 * Displays a chronological list of points-earning and points-spending
 * transactions, or an empty-state message for new clients.
 */

import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LoyaltyPageData } from "../actions";

type Transaction = LoyaltyPageData["transactions"][number];

interface PointsHistoryProps {
  transactions: Transaction[];
}

export function PointsHistory({ transactions }: PointsHistoryProps) {
  if (transactions.length > 0) {
    return (
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-2">
          <p className="text-sm font-semibold text-foreground mb-3">Points History</p>
          <div className="space-y-0">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{tx.description}</p>
                  <p className="text-[11px] text-muted mt-0.5">{tx.createdAt}</p>
                </div>
                <span
                  className={`text-sm font-semibold shrink-0 ml-3 ${
                    tx.points > 0 ? "text-accent" : "text-destructive"
                  }`}
                >
                  {tx.points > 0 ? "+" : ""}
                  {tx.points}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6 text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Your journey starts here</p>
          <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
            Book your first service to start earning points. Every dollar spent gets you closer to
            amazing rewards.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
