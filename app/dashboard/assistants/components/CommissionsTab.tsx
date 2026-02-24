"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COMMISSION_DATA = [
  {
    id: 1,
    name: "Jasmine Carter",
    initials: "JC",
    rate: 30,
    sessions: 28,
    revenue: 4900,
    earned: 1470,
    paidOut: 1200,
  },
  {
    id: 2,
    name: "Brianna Moss",
    initials: "BM",
    rate: 28,
    sessions: 21,
    revenue: 2100,
    earned: 588,
    paidOut: 500,
  },
  {
    id: 3,
    name: "Simone Owens",
    initials: "SO",
    rate: 25,
    sessions: 14,
    revenue: 1850,
    earned: 462,
    paidOut: 400,
  },
  {
    id: 4,
    name: "Kezia Thompson",
    initials: "KT",
    rate: 25,
    sessions: 0,
    revenue: 0,
    earned: 0,
    paidOut: 0,
  },
];

export function CommissionsTab() {
  const totalBalance = COMMISSION_DATA.reduce((s, c) => s + (c.earned - c.paidOut), 0);

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4 md:px-5">
        <CardTitle className="text-sm font-semibold">Commission Tracker</CardTitle>
        <p className="text-xs text-muted mt-0.5">Current pay period</p>
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
              {COMMISSION_DATA.map((c) => {
                const balance = c.earned - c.paidOut;
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
                        ${c.revenue.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        ${c.earned.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle hidden lg:table-cell">
                      <span className="text-sm text-muted tabular-nums">
                        ${c.paidOut.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 md:px-5 py-3 text-right align-middle">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          balance > 0 ? "text-[#7a5c10]" : "text-muted",
                        )}
                      >
                        ${balance.toLocaleString()}
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
                  ${COMMISSION_DATA.reduce((s, c) => s + c.revenue, 0).toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">
                  ${COMMISSION_DATA.reduce((s, c) => s + c.earned, 0).toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums hidden lg:table-cell">
                  ${COMMISSION_DATA.reduce((s, c) => s + c.paidOut, 0).toLocaleString()}
                </td>
                <td className="px-4 md:px-5 py-2.5 text-right text-sm font-semibold text-[#7a5c10] tabular-nums">
                  ${totalBalance.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
