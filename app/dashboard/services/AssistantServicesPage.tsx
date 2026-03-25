"use client";

import { useState } from "react";
import { CheckCircle2, Clock, PackageOpen, DollarSign, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AssistantServiceRow, AssistantServiceStats } from "@/lib/types/services.types";
import { cn } from "@/lib/utils";

function formatDuration(min: number): string {
  if (min < 60) return `${min}min`;
  const hrs = Math.floor(min / 60);
  const rem = min % 60;
  if (rem === 0) return `${hrs}hr${hrs > 1 ? "s" : ""}`;
  return `${hrs}hr ${rem}min`;
}

const CATEGORY_LABELS: Record<string, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
  "3d_printing": "3D Printing",
  aesthetics: "Aesthetics",
};

const CATEGORY_ACCENT: Record<string, string> = {
  lash: "#c4907a",
  jewelry: "#d4a574",
  crochet: "#7ba3a3",
  consulting: "#4e6b51",
  "3d_printing": "#7a5c10",
  aesthetics: "#96604a",
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ");
}

function categoryAccent(cat: string): string {
  return CATEGORY_ACCENT[cat] ?? "#999";
}

/* ------------------------------------------------------------------ */
/*  Service card                                                       */
/* ------------------------------------------------------------------ */

function ServiceCard({ svc }: { svc: AssistantServiceRow }) {
  return (
    <Card className="gap-0 overflow-hidden hover:shadow-sm transition-shadow">
      <div className="h-1" style={{ background: categoryAccent(svc.category) }} />
      <CardContent className="px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">{svc.name}</p>
            {svc.description && (
              <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">
                {svc.description}
              </p>
            )}
          </div>
          {svc.certified && <CheckCircle2 className="w-4 h-4 text-[#4e6b51] shrink-0 mt-0.5" />}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
            <DollarSign className="w-3.5 h-3.5 text-muted" />
            {svc.price === 0 ? "Free" : `${svc.price}`}
          </span>
          {svc.deposit != null && svc.deposit > 0 && (
            <span className="text-[10px] text-muted px-1.5 py-0.5 rounded-full bg-surface border border-border">
              ${svc.deposit} deposit
            </span>
          )}
          {svc.durationMin != null && (
            <span className="flex items-center gap-1 text-xs text-muted ml-auto">
              <Clock className="w-3 h-3" />
              {formatDuration(svc.durationMin)}
            </span>
          )}
        </div>

        {svc.certified && (
          <div className="flex items-center gap-2 text-[10px] text-muted pt-1 border-t border-border/40">
            <span className="font-medium text-[#4e6b51]">Certified</span>
            <span>{svc.timesPerformed}x performed</span>
            {svc.certDate && <span>· since {svc.certDate}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AssistantServicesPage({
  initialServices,
  stats,
}: {
  initialServices: AssistantServiceRow[];
  stats: AssistantServiceStats;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  // Derive unique categories from data
  const categories = [...new Set(initialServices.map((s) => s.category))];

  const filtered = initialServices.filter((svc) => {
    const matchSearch =
      svc.name.toLowerCase().includes(search.toLowerCase()) ||
      (svc.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || svc.category === filter;
    return matchSearch && matchFilter;
  });

  // Group filtered services by category for section display
  const grouped = filtered.reduce<Record<string, AssistantServiceRow[]>>((acc, svc) => {
    (acc[svc.category] ??= []).push(svc);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          My Services
        </h1>
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

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
              filter === "all"
                ? "bg-foreground/8 text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                filter === cat
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Service cards grouped by category */}
      {Object.keys(grouped).length === 0 ? (
        <Card className="gap-0">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <PackageOpen className="w-8 h-8 text-foreground/15 mb-2" />
              <p className="text-sm text-muted font-medium">
                {search ? "No services match your search." : "No services assigned yet"}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-xs text-accent hover:underline mt-1"
                >
                  Clear search
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, services]) => (
            <div key={cat}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-1 h-5 rounded-full shrink-0"
                  style={{ background: categoryAccent(cat) }}
                />
                <span className="text-sm font-semibold text-foreground">{categoryLabel(cat)}</span>
                <span className="text-xs text-muted">{services.length}</span>
              </div>
              {/* Card grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {services.map((svc) => (
                  <ServiceCard key={svc.id} svc={svc} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted text-center">
        Need to add a service or update certification? Reach out to your studio owner.
      </p>
    </div>
  );
}
