/**
 * PendingRedemptions.tsx — Pending rewards list.
 *
 * Displays rewards that the client has redeemed but not yet used,
 * with the option to cancel each pending redemption.
 */

import { Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LoyaltyPageData } from "../actions";
import { CATEGORY_ICON } from "./helpers";

type PendingRedemption = LoyaltyPageData["pendingRedemptions"][number];

interface PendingRedemptionsProps {
  pendingRedemptions: PendingRedemption[];
  onCancelRedemption: (redemptionId: string) => void;
  isRedeeming: boolean;
}

export function PendingRedemptions({
  pendingRedemptions,
  onCancelRedemption,
  isRedeeming,
}: PendingRedemptionsProps) {
  if (pendingRedemptions.length === 0) return null;

  return (
    <Card className="gap-0">
      <CardContent className="px-5 pb-5 pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-accent" />
          <p className="text-sm font-semibold text-foreground">Pending Rewards</p>
        </div>
        <div className="space-y-1.5">
          {pendingRedemptions.map((r) => {
            const CatIcon = CATEGORY_ICON[r.rewardCategory] ?? Gift;
            return (
              <div
                key={r.id}
                className="flex items-center gap-2.5 py-2 px-2 rounded-lg bg-accent/5 border border-accent/10"
              >
                <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                  <CatIcon className="w-3.5 h-3.5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.rewardLabel}</p>
                  <p className="text-[10px] text-muted">
                    Redeemed {r.createdAt}
                    {r.discountInCents != null && ` — $${(r.discountInCents / 100).toFixed(0)} off`}
                  </p>
                </div>
                <button
                  onClick={() => onCancelRedemption(r.id)}
                  disabled={isRedeeming}
                  className="text-[10px] font-medium text-destructive border border-destructive/20 rounded-md px-2 py-0.5 hover:bg-destructive/8 transition-colors disabled:opacity-40 shrink-0"
                >
                  Cancel
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted">
          These rewards will be applied at your next appointment.
        </p>
      </CardContent>
    </Card>
  );
}
