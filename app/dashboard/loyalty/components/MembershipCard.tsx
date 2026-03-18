/**
 * MembershipCard.tsx — Lash Club membership card.
 *
 * Shows the client's active or paused membership plan, fill usage
 * progress bar, included perks, and renewal date.
 */

import { BadgeCheck, PauseCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LoyaltyPageData } from "../actions";

type Membership = NonNullable<LoyaltyPageData["membership"]>;

interface MembershipCardProps {
  membership: Membership;
}

export function MembershipCard({ membership }: MembershipCardProps) {
  return (
    <Card className="gap-0">
      <CardContent className="px-5 pb-5 pt-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold text-foreground">{membership.planName}</p>
          </div>
          {membership.status === "paused" ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-[#7a5c10] bg-[#7a5c10]/10 border border-[#7a5c10]/20 rounded px-1.5 py-0.5">
              <PauseCircle className="w-3 h-3" />
              Paused
            </span>
          ) : (
            <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/12 border border-[#4e6b51]/20 rounded px-1.5 py-0.5">
              Active
            </span>
          )}
        </div>

        {/* Fill usage */}
        <div className="rounded-xl bg-accent/8 border border-accent/15 px-4 py-3 text-center">
          <p className="text-3xl font-bold text-foreground">
            {membership.fillsRemainingThisCycle}
            <span className="text-base font-normal text-muted"> / {membership.fillsPerCycle}</span>
          </p>
          <p className="text-xs text-muted mt-0.5">
            fill{membership.fillsRemainingThisCycle !== 1 ? "s" : ""} remaining this cycle
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-foreground/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{
                width: `${Math.round((membership.fillsRemainingThisCycle / membership.fillsPerCycle) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Perks */}
        <div className="space-y-1">
          {membership.productDiscountPercent > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <BadgeCheck className="w-3.5 h-3.5 text-accent shrink-0" />
              {membership.productDiscountPercent}% off all products
            </div>
          )}
          {membership.perks.map((perk, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted">
              <BadgeCheck className="w-3.5 h-3.5 text-accent shrink-0" />
              {perk}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted border-t border-border/50 pt-2">
          Renews {membership.cycleEndsAt}
        </p>
      </CardContent>
    </Card>
  );
}
