/**
 * PerksCard.tsx — "Your Perks" section with next-tier preview.
 *
 * Lists the perks for the client's current tier, and when the client
 * is not yet at Platinum, previews unlockable perks at the next tier.
 */

import { Crown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TIER_PERKS } from "./helpers";

interface PerksCardProps {
  tierName: string;
  nextTierName: string;
  isMaxTier: boolean;
  pointsToNext: number;
  currentPerks: { perk: string; Icon: LucideIcon }[];
}

export function PerksCard({
  tierName,
  nextTierName,
  isMaxTier,
  pointsToNext,
  currentPerks,
}: PerksCardProps) {
  return (
    <Card className="gap-0">
      <CardContent className="px-5 pb-5 pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-accent" />
          <p className="text-sm font-semibold text-foreground">Your {tierName} Perks</p>
        </div>
        <div className="space-y-1">
          {currentPerks.map((p) => (
            <div
              key={p.perk}
              className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-surface/60 transition-colors"
            >
              <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                <p.Icon className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-sm text-foreground">{p.perk}</p>
            </div>
          ))}
        </div>

        {/* Show next tier preview */}
        {!isMaxTier && (
          <div className="border-t border-border/50 pt-3 mt-2">
            <p className="text-[11px] text-muted mb-2">
              Unlock with {nextTierName} ({pointsToNext} pts to go):
            </p>
            <div className="space-y-1">
              {(TIER_PERKS[nextTierName] ?? [])
                .filter((p) => !p.perk.startsWith("All "))
                .map((p) => (
                  <div key={p.perk} className="flex items-center gap-2.5 py-1.5 px-2 opacity-50">
                    <div className="w-7 h-7 rounded-md bg-foreground/5 flex items-center justify-center shrink-0">
                      <p.Icon className="w-3.5 h-3.5 text-muted" />
                    </div>
                    <p className="text-sm text-muted">{p.perk}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
