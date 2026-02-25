"use client";

import { useState, useMemo } from "react";
import { Clock, DollarSign, ChevronRight, Search } from "lucide-react";
import { BookingRequestDialog } from "@/components/booking/BookingRequestDialog";
import { formatPrice } from "@/components/booking/helpers";
import type { Service, ServiceAddOn } from "@/components/booking/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Category config                                                     */
/* ------------------------------------------------------------------ */

type Category = "lash" | "jewelry" | "crochet" | "consulting" | "3d_printing" | "aesthetics";

const CAT_CONFIG: Record<
  Category,
  { label: string; dot: string; bg: string; text: string; border: string; activeBg: string }
> = {
  lash: {
    label: "Lash",
    dot: "bg-[#c4907a]",
    bg: "bg-[#c4907a]/12",
    text: "text-[#96604a]",
    border: "border-[#c4907a]/20",
    activeBg: "bg-[#c4907a]/15 text-[#96604a] border-[#c4907a]/30",
  },
  jewelry: {
    label: "Jewelry",
    dot: "bg-[#d4a574]",
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/20",
    activeBg: "bg-[#d4a574]/15 text-[#a07040] border-[#d4a574]/30",
  },
  crochet: {
    label: "Crochet",
    dot: "bg-[#7ba3a3]",
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4a7a7a]",
    border: "border-[#7ba3a3]/20",
    activeBg: "bg-[#7ba3a3]/15 text-[#4a7a7a] border-[#7ba3a3]/30",
  },
  consulting: {
    label: "Consulting",
    dot: "bg-[#5b8a8a]",
    bg: "bg-[#5b8a8a]/12",
    text: "text-[#3a6060]",
    border: "border-[#5b8a8a]/20",
    activeBg: "bg-[#5b8a8a]/15 text-[#3a6060] border-[#5b8a8a]/30",
  },
  "3d_printing": {
    label: "3D Printing",
    dot: "bg-[#6b5b95]",
    bg: "bg-[#6b5b95]/12",
    text: "text-[#4a3d6e]",
    border: "border-[#6b5b95]/20",
    activeBg: "bg-[#6b5b95]/15 text-[#4a3d6e] border-[#6b5b95]/30",
  },
  aesthetics: {
    label: "Aesthetics",
    dot: "bg-[#d4768a]",
    bg: "bg-[#d4768a]/12",
    text: "text-[#a0506a]",
    border: "border-[#d4768a]/20",
    activeBg: "bg-[#d4768a]/15 text-[#a0506a] border-[#d4768a]/30",
  },
};

function formatDuration(min: number | null) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${min}m`;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientBookPage({
  services,
  addOnsByService,
}: {
  services: Service[];
  addOnsByService: Record<number, ServiceAddOn[]>;
}) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | Category>("all");
  const [bookingTarget, setBookingTarget] = useState<Service | null>(null);

  // Get unique categories from actual services with counts
  const categories = useMemo(() => {
    const cats = [...new Set(services.map((s) => s.category))];
    return cats.filter((c): c is Category => c in CAT_CONFIG);
  }, [services]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of services) {
      counts[s.category] = (counts[s.category] ?? 0) + 1;
    }
    return counts;
  }, [services]);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchCat = activeTab === "all" || s.category === activeTab;
      return matchSearch && matchCat;
    });
  }, [services, search, activeTab]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Book a Service</h1>
        <p className="text-sm text-muted mt-0.5">Browse services and request an appointment</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-all shrink-0",
            activeTab === "all"
              ? "bg-foreground/8 text-foreground border-foreground/15"
              : "bg-transparent text-muted border-transparent hover:bg-foreground/5 hover:text-foreground",
          )}
        >
          All
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full",
              activeTab === "all" ? "bg-foreground/10" : "bg-foreground/5",
            )}
          >
            {services.length}
          </span>
        </button>
        {categories.map((cat) => {
          const cfg = CAT_CONFIG[cat];
          const count = categoryCounts[cat] ?? 0;
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-all shrink-0",
                isActive
                  ? cfg.activeBg
                  : "bg-transparent text-muted border-transparent hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
              {cfg.label}
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-white/40" : "bg-foreground/5",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
        <input
          type="text"
          placeholder="Search services…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
        />
      </div>

      {/* Service cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((svc) => {
            const cfg = CAT_CONFIG[svc.category as Category];
            if (!cfg) return null;
            const addOns = addOnsByService[svc.id] ?? [];
            return (
              <Card key={svc.id} className="gap-0 flex flex-col h-full">
                <CardContent className="px-5 pt-5 pb-4 flex flex-col h-full">
                  <div className="flex items-start gap-2 mb-2">
                    <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", cfg.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        {svc.name}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "border text-[10px] px-1.5 py-0.5 shrink-0",
                        cfg.bg,
                        cfg.text,
                        cfg.border,
                      )}
                    >
                      {cfg.label}
                    </Badge>
                  </div>
                  {svc.description && (
                    <p className="text-xs text-muted leading-relaxed flex-1">{svc.description}</p>
                  )}

                  {/* Add-ons */}
                  {addOns.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/60 mb-1">
                        Add-ons
                      </p>
                      {addOns.map((addon) => (
                        <div
                          key={addon.id}
                          className="flex items-center justify-between text-[11px] text-muted py-0.5"
                        >
                          <span>
                            {addon.name}
                            {addon.additionalMinutes > 0 && (
                              <span className="ml-1 text-muted/60">
                                +{addon.additionalMinutes}min
                              </span>
                            )}
                          </span>
                          <span className="font-medium text-foreground/70">
                            +{formatPrice(addon.priceInCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                      <DollarSign className="w-3 h-3 text-[#4e6b51]" />
                      {formatPrice(svc.priceInCents)}
                    </span>
                    {formatDuration(svc.durationMinutes) && (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Clock className="w-3 h-3" />
                        {formatDuration(svc.durationMinutes)}
                      </span>
                    )}
                    {svc.depositInCents && (
                      <span className="text-[10px] text-[#7a5c10] ml-auto">
                        {formatPrice(svc.depositInCents)} deposit
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setBookingTarget(svc)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors bg-accent text-white hover:bg-accent/90"
                  >
                    Book this service <ChevronRight className="w-3 h-3" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted">No services match your search.</p>
        </div>
      )}

      {bookingTarget && (
        <BookingRequestDialog service={bookingTarget} open onClose={() => setBookingTarget(null)} />
      )}
    </div>
  );
}
