/**
 * Deposit collection tracking — expected vs collected deposits.
 *
 * @module financial/components/DepositTrackingSection
 * @see {@link ../actions.ts} — `DepositStats` type, `getDepositStats()`
 */
"use client";

import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DepositStats } from "../actions";

export function DepositTrackingSection({ data }: { data: DepositStats }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted" /> Deposit Collection
        </CardTitle>
        <p className="text-xs text-muted mt-0.5">Last 90 days — bookings requiring a deposit</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        {data.bookingsNeedingDeposit === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No deposit-requiring bookings found.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-2xl font-semibold text-foreground tabular-nums">
                  {data.collectionRate}%
                </span>
                <span className="text-xs text-muted">
                  ${data.totalCollected.toLocaleString()} / ${data.totalExpected.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#4e6b51] transition-all"
                  style={{ width: `${data.collectionRate}%` }}
                />
              </div>
            </div>

            {/* Counts */}
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-muted">Bookings needing deposit: </span>
                <span className="font-medium text-foreground tabular-nums">
                  {data.bookingsNeedingDeposit}
                </span>
              </div>
              <div>
                <span className="text-muted">Deposits collected: </span>
                <span className="font-medium text-foreground tabular-nums">
                  {data.bookingsWithDeposit}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
