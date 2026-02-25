"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Tag, PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AssistantServiceRow, AssistantServiceStats } from "./actions";

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`;
  const hrs = Math.floor(min / 60);
  const rem = min % 60;
  if (rem === 0) return `${hrs}hr${hrs > 1 ? "s" : ""}`;
  return `${hrs}hr ${rem}min`;
}

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  lash: { label: "Lash", className: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20" },
  jewelry: {
    label: "Jewelry",
    className: "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/20",
  },
  crochet: {
    label: "Crochet",
    className: "bg-[#7ba3a3]/12 text-[#5b8a8a] border-[#7ba3a3]/20",
  },
  consulting: {
    label: "Consulting",
    className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
  },
};

const FILTER_TABS = ["all", "lash", "jewelry", "crochet", "consulting"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

export function AssistantServicesPage({
  initialServices,
  stats,
}: {
  initialServices: AssistantServiceRow[];
  stats: AssistantServiceStats;
}) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered =
    filter === "all" ? initialServices : initialServices.filter((s) => s.category === filter);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">My Services</h1>
        <p className="text-sm text-muted mt-0.5">
          Services you&apos;re certified and active to perform
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Services", value: stats.totalServices },
          { label: "Certified", value: stats.certifiedCount },
          {
            label: "Avg Duration",
            value: stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : "—",
          },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize",
              filter === tab
                ? "bg-foreground/8 text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Services table */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">
            {filter === "all"
              ? "All Services"
              : `${CATEGORY_CONFIG[filter]?.label ?? filter} Services`}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <PackageOpen className="w-8 h-8 text-foreground/15 mb-2" />
              <p className="text-sm text-muted">No services found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-surface/30">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1">
                      Service
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1 hidden md:table-cell">
                      Category
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1">
                      Duration
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 pb-2.5 pt-1">
                      Price
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 pt-1">
                      Certified
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((svc) => {
                    const cat = CATEGORY_CONFIG[svc.category] ?? {
                      label: svc.category,
                      className: "bg-foreground/5 text-muted border-border/30",
                    };
                    return (
                      <tr
                        key={svc.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      >
                        <td className="px-5 py-3.5 align-middle">
                          <p className="text-sm font-medium text-foreground">{svc.name}</p>
                          {svc.description && (
                            <p className="text-[10px] text-muted mt-0.5 hidden sm:block">
                              {svc.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell align-middle">
                          <Badge className={cn("border text-[10px] px-1.5 py-0.5", cat.className)}>
                            {cat.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-center align-middle">
                          <span className="text-xs text-muted flex items-center justify-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {svc.durationMin != null ? formatDuration(svc.durationMin) : "TBD"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center align-middle">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm font-semibold text-foreground flex items-center gap-0.5">
                              <Tag className="w-3 h-3 text-muted" />
                              {svc.price === 0 ? "Free" : `$${svc.price}`}
                            </span>
                            {svc.deposit != null && (
                              <span className="text-[9px] text-muted">${svc.deposit} deposit</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center align-middle">
                          {svc.certified ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <CheckCircle2 className="w-4 h-4 text-[#4e6b51]" />
                              <span className="text-[9px] text-muted">
                                {svc.timesPerformed}x{svc.certDate && ` · ${svc.certDate}`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted text-center">
        Need to add a service or update certification? Message Trini.
      </p>
    </div>
  );
}
