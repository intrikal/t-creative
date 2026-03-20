import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAdminWeeklyRevenue } from "../admin-home-queries";
import { RevenueChart } from "../RevenueChart";

export async function AdminRevenueChartSection() {
  const { weeklyRevenue, weeklyRevenueTotal, weeklyRevenueVsPriorPct } =
    await getAdminWeeklyRevenue();

  const weeklyTotalDisplay = `$${weeklyRevenueTotal.toLocaleString()}`;
  const weeklyVsPriorDisplay =
    weeklyRevenueVsPriorPct !== null
      ? weeklyRevenueVsPriorPct > 0
        ? `↑ ${weeklyRevenueVsPriorPct}% vs prior week`
        : weeklyRevenueVsPriorPct < 0
          ? `↓ ${Math.abs(weeklyRevenueVsPriorPct)}% vs prior week`
          : "flat vs prior week"
      : null;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">Revenue — Last 7 Days</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              Total: <span className="font-medium text-foreground">{weeklyTotalDisplay}</span>
              {weeklyVsPriorDisplay && (
                <span
                  className={cn(
                    "ml-2",
                    weeklyRevenueVsPriorPct !== null && weeklyRevenueVsPriorPct >= 0
                      ? "text-[#4e6b51]"
                      : "text-destructive",
                  )}
                >
                  {weeklyVsPriorDisplay}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#c4907a] inline-block" /> Today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#e8c4b8] inline-block" /> Prior days
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-3">
        <RevenueChart data={weeklyRevenue} />
      </CardContent>
    </Card>
  );
}
