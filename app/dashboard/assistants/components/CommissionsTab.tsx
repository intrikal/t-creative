"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CommissionRow } from "../actions";

function fmt(cents: number) {
  return "$" + Math.round(cents / 100).toLocaleString();
}

export function CommissionsTab({ data }: { data: CommissionRow[] }) {
  const totalRevenue = data.reduce((s, r) => s + r.revenueInCents, 0);
  const totalEarned = data.reduce((s, r) => s + r.earnedInCents, 0);
  const totalPaidOut = data.reduce((s, r) => s + r.paidOutInCents, 0);
  const totalBalance = totalEarned - totalPaidOut;

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4 md:px-5">
        <CardTitle className="text-sm font-semibold">Commission Tracker</CardTitle>
        <p className="text-xs text-muted mt-0.5">All-time · current month balance is unpaid</p>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                  Assistant
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                  Rate
                </th>
                <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                  Sessions
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                  Revenue
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                  Earned
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                  Paid Out
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const balance = c.earnedInCents - c.paidOutInCents;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-4 md:px-5 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                            {c.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-foreground">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="text-xs font-semibold text-foreground">{c.rate}%</span>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="text-sm text-foreground tabular-nums">{c.sessions}</span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="text-sm text-foreground tabular-nums">
                        {fmt(c.revenueInCents)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {fmt(c.earnedInCents)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle hidden lg:table-cell">
                      <span className="text-sm text-muted tabular-nums">
                        {fmt(c.paidOutInCents)}
                      </span>
                    </td>
                    <td className="px-4 md:px-5 py-3 text-right align-middle">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          balance > 0 ? "text-[#7a5c10]" : "text-muted",
                        )}
                      >
                        {fmt(balance)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface/40">
                <td
                  className="px-4 md:px-5 py-2.5 text-xs font-semibold text-foreground"
                  colSpan={3}
                >
                  Total
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">
                  {fmt(totalRevenue)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">
                  {fmt(totalEarned)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums hidden lg:table-cell">
                  {fmt(totalPaidOut)}
                </td>
                <td className="px-4 md:px-5 py-2.5 text-right text-sm font-semibold text-[#7a5c10] tabular-nums">
                  {fmt(totalBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
