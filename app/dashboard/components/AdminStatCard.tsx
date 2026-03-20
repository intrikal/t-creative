import type React from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Trend } from "../admin-dashboard-types";

export function StatCard({
  label, value, sub, trend, icon: Icon, iconColor, iconBg, href, compact,
}: {
  label: string;
  value: string;
  sub: string;
  trend: Trend;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  href?: string;
  compact?: boolean;
}) {
  const content = (
    <Card className={cn("gap-0", compact ? "py-3" : "py-4", href && "hover:border-foreground/20 transition-colors")}>
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className={cn("font-semibold text-foreground tracking-tight", compact ? "text-lg" : "text-2xl")}>{value}</p>
            <div className="flex items-center gap-1 text-xs text-muted">
              {trend === "up" && <TrendingUp className="w-3 h-3 text-[#4e6b51]" />}
              {trend === "down" && <TrendingDown className="w-3 h-3 text-destructive" />}
              <span>{sub}</span>
            </div>
          </div>
          <div className={cn("rounded-xl p-2 shrink-0", iconBg)}>
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
