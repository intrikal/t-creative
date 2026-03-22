/**
 * Membership value tracking — member vs non-member spend, average
 * membership lifetime, monthly churn rate, and per-plan breakdown.
 *
 * DB-wired: data from `getMembershipValue()`.
 *
 * @module analytics/components/MembershipValueSection
 * @see {@link ../actions.ts} — `MembershipValueStats` type
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MembershipValueStats } from "@/lib/types/analytics.types";

function churnColor(rate: number) {
  if (rate <= 5) return "text-[#4e6b51]";
  if (rate <= 15) return "text-[#d4a574]";
  return "text-destructive";
}

export function MembershipValueSection({ data }: { data: MembershipValueStats }) {
  const hasMembers = data.activeCount > 0 || data.cancelledCount > 0;

  if (!hasMembers) {
    return (
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Membership Value</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <p className="text-sm text-muted text-center py-8">No memberships created yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Key metrics */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Membership Value</CardTitle>
          <p className="text-xs text-muted mt-0.5">Members vs non-members (last 12 months)</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4 space-y-5">
          {/* Spend comparison */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
              Avg Annual Spend
            </p>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground">Members</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    ${data.memberAvgSpend.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#4e6b51]"
                    style={{
                      width: `${Math.min((data.memberAvgSpend / Math.max(data.memberAvgSpend, data.nonMemberAvgSpend, 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground">Non-members</span>
                  <span className="text-sm font-medium text-muted tabular-nums">
                    ${data.nonMemberAvgSpend.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/20"
                    style={{
                      width: `${Math.min((data.nonMemberAvgSpend / Math.max(data.memberAvgSpend, data.nonMemberAvgSpend, 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            {data.spendLift !== 0 && (
              <p className="text-[11px] text-muted mt-2">
                Members spend{" "}
                <span
                  className={cn(
                    "font-semibold",
                    data.spendLift > 0 ? "text-[#4e6b51]" : "text-destructive",
                  )}
                >
                  {data.spendLift > 0 ? "+" : ""}
                  {data.spendLift}%
                </span>{" "}
                more
              </p>
            )}
          </div>

          {/* Lifetime & Churn */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                Avg Lifetime
              </p>
              {data.avgLifetimeDays != null ? (
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {data.avgLifetimeDays < 60
                    ? `${data.avgLifetimeDays}d`
                    : `${Math.round(data.avgLifetimeDays / 30)}mo`}
                </p>
              ) : (
                <p className="text-sm text-muted">No cancellations yet</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                Monthly Churn
              </p>
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  churnColor(data.monthlyChurnRate),
                )}
              >
                {data.monthlyChurnRate}%
              </p>
            </div>
          </div>

          {/* Counts */}
          <div className="flex items-center gap-3 pt-3 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4e6b51]" />
              <span className="text-xs text-muted">{data.activeCount} active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-foreground/20" />
              <span className="text-xs text-muted">{data.cancelledCount} cancelled</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-plan breakdown */}
      <Card className="xl:col-span-2 gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">By Plan</CardTitle>
          <p className="text-xs text-muted mt-0.5">Performance metrics per membership tier</p>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-3">
          {data.byPlan.length === 0 ? (
            <p className="text-sm text-muted text-center py-8 px-5">No plan data available.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                    Plan
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden sm:table-cell">
                    Active
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                    Avg Spend
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                    Avg Lifetime
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                    Churn
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.byPlan.map((p) => (
                  <tr
                    key={p.plan}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-5 py-3 align-middle">
                      <p className="text-sm text-foreground">{p.plan}</p>
                      <p className="text-[10px] text-muted">{p.cancelled} cancelled</p>
                    </td>
                    <td className="px-3 py-3 text-right align-middle hidden sm:table-cell">
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        {p.active}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        ${p.avgSpend.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle hidden md:table-cell">
                      <span className="text-xs text-muted tabular-nums">
                        {p.avgLifetimeDays != null
                          ? p.avgLifetimeDays < 60
                            ? `${p.avgLifetimeDays}d`
                            : `${Math.round(p.avgLifetimeDays / 30)}mo`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right align-middle">
                      <span
                        className={cn("text-sm font-medium tabular-nums", churnColor(p.churnRate))}
                      >
                        {p.churnRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
