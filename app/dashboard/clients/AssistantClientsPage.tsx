"use client";

import { useState } from "react";
import { Search, Star, CalendarDays, Clock, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AssistantClientRow, AssistantClientStats } from "./actions";

function categoryDot(cat: string) {
  return (
    {
      lash: "bg-[#c4907a]",
      jewelry: "bg-[#d4a574]",
      crochet: "bg-[#7ba3a3]",
      consulting: "bg-[#5b8a8a]",
    }[cat] ?? "bg-foreground/30"
  );
}

export function AssistantClientsPage({
  initialClients,
  stats,
}: {
  initialClients: AssistantClientRow[];
  stats: AssistantClientStats;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "vip" | "upcoming">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = initialClients.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ? true : filter === "vip" ? c.vip : !!c.nextAppointment;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">My Clients</h1>
        <p className="text-sm text-muted mt-0.5">
          {stats.totalClients} client{stats.totalClients !== 1 ? "s" : ""} you&apos;ve worked with
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Clients", value: stats.totalClients },
          { label: "VIP Clients", value: stats.vipClients },
          { label: "Total Revenue", value: `$${stats.totalRevenue.toLocaleString()}` },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "vip", "upcoming"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize",
                filter === f
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Client list */}
      <Card className="gap-0">
        <CardContent className="px-0 py-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-8 h-8 text-foreground/15 mb-2" />
              <p className="text-sm text-muted">No clients found.</p>
            </div>
          ) : (
            filtered.map((c) => {
              const isExpanded = expandedId === c.id;
              return (
                <div key={c.id} className="border-b border-border/40 last:border-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface/60 transition-colors text-left"
                  >
                    <Avatar>
                      <AvatarFallback className="bg-surface text-muted text-xs font-semibold">
                        {c.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">{c.name}</span>
                        {c.vip && <Star className="w-3 h-3 text-[#d4a574] fill-[#d4a574]" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {c.lastServiceDate && (
                          <span className="text-xs text-muted flex items-center gap-0.5">
                            <CalendarDays className="w-2.5 h-2.5" /> {c.lastServiceDate}
                          </span>
                        )}
                        {c.lastService && (
                          <span className="text-xs text-muted">{c.lastService}</span>
                        )}
                        {c.categories.map((cat) => (
                          <span
                            key={cat}
                            className={cn("w-1.5 h-1.5 rounded-full shrink-0", categoryDot(cat))}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-semibold text-foreground">${c.totalSpent}</span>
                      <span className="text-[10px] text-muted">{c.totalVisits} visits</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-surface/30 border-t border-border/30 space-y-2 pt-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {c.phone && (
                          <div>
                            <p className="text-muted">Phone</p>
                            <p className="text-foreground font-medium mt-0.5">{c.phone}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted">Email</p>
                          <p className="text-foreground font-medium mt-0.5 truncate">{c.email}</p>
                        </div>
                      </div>
                      {c.nextAppointment && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="w-3 h-3 text-accent" />
                          <span className="text-accent font-medium">Next: {c.nextAppointment}</span>
                        </div>
                      )}
                      {c.notes && (
                        <p className="text-xs text-muted bg-background rounded-lg px-3 py-2 border border-border/50 italic">
                          &ldquo;{c.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
