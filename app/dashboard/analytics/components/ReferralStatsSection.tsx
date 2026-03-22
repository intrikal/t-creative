"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReferralStats } from "../referral-actions";

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function ReferralStatsSection({ data }: { data: ReferralStats }) {
  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Referrals" value={data.totalReferrals} />
        <KpiCard label="Completed" value={data.completedReferrals} />
        <KpiCard label="Pending" value={data.pendingReferrals} />
        <KpiCard label="Rewards Paid" value={fmtUsd(data.totalRewardsPaid)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top referrers */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Top Referrers</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3">
            {data.topReferrers.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">No completed referrals yet.</p>
            ) : (
              <div className="space-y-2">
                {data.topReferrers.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent">
                        {i + 1}
                      </span>
                      <span className="text-foreground">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted">
                        {r.referralCount} referral{r.referralCount !== 1 ? "s" : ""}
                      </span>
                      <span className="font-medium text-foreground">{fmtUsd(r.totalReward)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent referrals */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Recent Referrals</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3">
            {data.recentReferrals.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">No referrals yet.</p>
            ) : (
              <div className="space-y-2">
                {data.recentReferrals.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-foreground">{r.referrerName}</span>
                      <span className="text-muted mx-1">→</span>
                      <span className="text-foreground">{r.referredName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          r.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : r.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.rewardAmountInCents > 0 && (
                        <span className="text-xs font-medium text-foreground">
                          {fmtUsd(r.rewardAmountInCents)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="gap-0">
      <CardContent className="px-4 py-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="text-lg font-bold text-foreground mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
