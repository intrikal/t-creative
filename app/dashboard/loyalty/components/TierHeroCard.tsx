/**
 * TierHeroCard.tsx — Tier status card with progress bar and upgrade callout.
 *
 * Displays the client's current points total, tier badge, progress toward
 * the next tier, and a motivational upgrade callout.
 */

import { Gift, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TIERS, type Tier } from "./helpers";

interface TierHeroCardProps {
  totalPoints: number;
  tier: Tier;
  isMaxTier: boolean;
  progress: number;
  pointsToNext: number;
}

export function TierHeroCard({
  totalPoints,
  tier,
  isMaxTier,
  progress,
  pointsToNext,
}: TierHeroCardProps) {
  return (
    <Card className="gap-0 overflow-hidden">
      <CardContent className="px-5 pb-5 pt-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <p className="text-3xl font-bold text-foreground">{totalPoints.toLocaleString()}</p>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tier.bg} ${tier.color} ${tier.border} border`}
              >
                {tier.name}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {isMaxTier
                ? "You've reached the highest tier!"
                : `${pointsToNext} points until ${tier.nextName}`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-medium">
            <span className={tier.color}>{tier.name}</span>
            {!isMaxTier && (
              <span className="text-muted">
                {tier.nextName} · {tier.nextAt} pts
              </span>
            )}
          </div>
          <div className="h-2.5 bg-foreground/8 rounded-full overflow-hidden">
            <div
              className={`h-full ${tier.accent} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Tier upgrade callout */}
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-accent/8 border border-accent/15">
          <TrendingUp className="w-4 h-4 text-accent shrink-0" />
          <p className="text-xs text-foreground">
            {isMaxTier
              ? "Enjoy VIP perks on every visit — priority booking, free add-ons, and exclusive offers."
              : `Reach ${tier.nextName} to unlock ${TIERS.find((t) => t.name === tier.nextName)?.reward ?? "more rewards"}. Keep it up!`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
