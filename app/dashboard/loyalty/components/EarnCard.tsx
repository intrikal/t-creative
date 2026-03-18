/**
 * EarnCard.tsx — "Ways to Earn" grid.
 *
 * Displays a responsive grid of opportunities for clients to earn
 * loyalty points (booking, reviews, referrals, etc.).
 */

import { Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EARN_WAYS } from "./helpers";

export function EarnCard() {
  return (
    <Card className="gap-0">
      <CardContent className="px-5 pb-5 pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-accent" />
          <p className="text-sm font-semibold text-foreground">Ways to Earn</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EARN_WAYS.map((way) => (
            <div
              key={way.label}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface/60 hover:bg-surface transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <way.icon className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{way.label}</p>
                <p className="text-[11px] text-muted">{way.hint}</p>
              </div>
              <span className="text-xs font-semibold text-accent shrink-0">{way.points}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
