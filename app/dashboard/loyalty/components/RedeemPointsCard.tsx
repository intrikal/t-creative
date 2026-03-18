/**
 * RedeemPointsCard.tsx — Redeem points section with reward list.
 *
 * Shows available rewards the client can redeem with their points,
 * plus success/error feedback messages after redemption attempts.
 */

import { Check, Gift, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ClientReward } from "../actions";
import { CATEGORY_ICON } from "./helpers";

interface RedeemPointsCardProps {
  rewards: ClientReward[];
  totalPoints: number;
  redeemedLabel: string | null;
  redeemError: string | null;
  isRedeeming: boolean;
  onRedeem: (reward: ClientReward) => void;
}

export function RedeemPointsCard({
  rewards,
  totalPoints,
  redeemedLabel,
  redeemError,
  isRedeeming,
  onRedeem,
}: RedeemPointsCardProps) {
  return (
    <Card className="gap-0">
      <CardContent className="px-5 pb-5 pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-accent" />
          <p className="text-sm font-semibold text-foreground">Redeem Points</p>
        </div>

        {redeemedLabel && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
            <Check className="w-3.5 h-3.5 text-accent shrink-0" />
            <p className="text-xs text-foreground">
              <span className="font-medium">{redeemedLabel}</span> redeemed! We&apos;ll apply it at
              your next appointment.
            </p>
          </div>
        )}

        {redeemError && (
          <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
            {redeemError}
          </p>
        )}

        {rewards.length > 0 ? (
          <div className="space-y-1">
            {rewards.map((reward) => {
              const affordable = totalPoints >= reward.pointsCost;
              const CatIcon = CATEGORY_ICON[reward.category] ?? Gift;
              return (
                <div
                  key={reward.id}
                  className={`flex items-center gap-2.5 py-2 px-2 rounded-lg transition-colors ${
                    affordable ? "hover:bg-surface/60" : "opacity-40"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      affordable ? "bg-accent/10" : "bg-foreground/5"
                    }`}
                  >
                    <CatIcon
                      className={`w-3.5 h-3.5 ${affordable ? "text-accent" : "text-muted"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{reward.label}</p>
                    <p className="text-[10px] text-muted">
                      {reward.category.replace("_", " ")}
                      {reward.discountInCents != null &&
                        ` — $${(reward.discountInCents / 100).toFixed(0)} off`}
                    </p>
                  </div>
                  {affordable ? (
                    <button
                      onClick={() => onRedeem(reward)}
                      disabled={isRedeeming}
                      className="text-[11px] font-semibold text-accent border border-accent/30 rounded-md px-2 py-0.5 hover:bg-accent/10 transition-colors disabled:opacity-40 shrink-0"
                    >
                      {reward.pointsCost.toLocaleString()} pts
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-muted shrink-0">
                      {reward.pointsCost.toLocaleString()} pts
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-3 text-center">
            <Tag className="w-7 h-7 text-muted/30 mx-auto mb-2" />
            <p className="text-xs text-muted">No rewards available yet. Check back soon!</p>
          </div>
        )}

        <p className="text-[11px] text-muted pt-1">
          Points never expire. We&apos;ll apply your reward at your next appointment.
        </p>
      </CardContent>
    </Card>
  );
}
