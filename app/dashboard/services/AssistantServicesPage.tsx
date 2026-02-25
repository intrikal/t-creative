"use client";

import { CheckCircle2, Clock, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ServiceCategory = "lash" | "lash-addon" | "training";

interface Service {
  id: number;
  name: string;
  category: ServiceCategory;
  description: string;
  durationMin: number;
  price: number;
  priceMax?: number;
  certified: boolean;
  certDate?: string;
}

const SERVICES: Service[] = [
  {
    id: 1,
    name: "Classic Lashes — Full Set",
    category: "lash",
    description: "Individual synthetic lashes applied to each natural lash. Natural, defined look.",
    durationMin: 90,
    price: 120,
    certified: true,
    certDate: "Aug 2024",
  },
  {
    id: 2,
    name: "Classic Lash Fill",
    category: "lash",
    description: "Fill for classic set. Recommended every 2–3 weeks.",
    durationMin: 75,
    price: 75,
    certified: true,
    certDate: "Aug 2024",
  },
  {
    id: 3,
    name: "Hybrid Lashes — Full Set",
    category: "lash",
    description: "Mix of classic and volume fans for a textured, full look.",
    durationMin: 90,
    price: 130,
    certified: true,
    certDate: "Oct 2024",
  },
  {
    id: 4,
    name: "Hybrid Lash Fill",
    category: "lash",
    description: "Fill for hybrid set. Recommended every 2–3 weeks.",
    durationMin: 75,
    price: 80,
    certified: true,
    certDate: "Oct 2024",
  },
  {
    id: 5,
    name: "Volume Lashes — Full Set",
    category: "lash",
    description: "Mega volume fans for a dramatic, fluffy look. 2D–10D available.",
    durationMin: 120,
    price: 140,
    certified: true,
    certDate: "Dec 2024",
  },
  {
    id: 6,
    name: "Volume Lash Fill",
    category: "lash",
    description: "Fill for volume set. Recommended every 2–3 weeks.",
    durationMin: 90,
    price: 90,
    certified: true,
    certDate: "Dec 2024",
  },
  {
    id: 7,
    name: "Lash Removal",
    category: "lash-addon",
    description: "Safe removal of lash extensions using professional solvent.",
    durationMin: 30,
    price: 25,
    certified: true,
    certDate: "Aug 2024",
  },
  {
    id: 8,
    name: "Lash Removal + Rebook",
    category: "lash-addon",
    description: "Removal with same-day rebook discount.",
    durationMin: 45,
    price: 35,
    certified: true,
    certDate: "Aug 2024",
  },
  {
    id: 9,
    name: "Lash Tint + Lift",
    category: "lash-addon",
    description: "Keratin lash lift and tint for natural lashes. Lasts 6–8 weeks.",
    durationMin: 60,
    price: 65,
    certified: true,
    certDate: "Jan 2025",
  },
  {
    id: 10,
    name: "Aftercare Consultation",
    category: "lash-addon",
    description:
      "15-min add-on for new clients — covers aftercare routine, products, and maintenance tips.",
    durationMin: 15,
    price: 0,
    certified: true,
    certDate: "Aug 2024",
  },
];

const CATEGORY_CONFIG: Record<ServiceCategory, { label: string; className: string }> = {
  lash: { label: "Lash", className: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20" },
  "lash-addon": {
    label: "Add-on",
    className: "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/20",
  },
  training: { label: "Training", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" },
};

export function AssistantServicesPage() {
  const certifiedCount = SERVICES.filter((s) => s.certified).length;

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
          { label: "Services", value: SERVICES.length },
          { label: "Certified", value: certifiedCount },
          {
            label: "Avg Duration",
            value: `${Math.round(SERVICES.reduce((s, x) => s + x.durationMin, 0) / SERVICES.length)}m`,
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

      {/* Services table */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Certified Services</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-3">
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
                {SERVICES.map((svc) => {
                  const cat = CATEGORY_CONFIG[svc.category];
                  return (
                    <tr
                      key={svc.id}
                      className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                    >
                      <td className="px-5 py-3.5 align-middle">
                        <p className="text-sm font-medium text-foreground">{svc.name}</p>
                        <p className="text-[10px] text-muted mt-0.5 hidden sm:block">
                          {svc.description}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell align-middle">
                        <Badge className={cn("border text-[10px] px-1.5 py-0.5", cat.className)}>
                          {cat.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-center align-middle">
                        <span className="text-xs text-muted flex items-center justify-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {svc.durationMin}m
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center align-middle">
                        <span className="text-sm font-semibold text-foreground flex items-center justify-center gap-0.5">
                          <Tag className="w-3 h-3 text-muted" />
                          {svc.price === 0 ? "Free" : `$${svc.price}`}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center align-middle">
                        {svc.certified ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <CheckCircle2 className="w-4 h-4 text-[#4e6b51]" />
                            {svc.certDate && (
                              <span className="text-[9px] text-muted">{svc.certDate}</span>
                            )}
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
        </CardContent>
      </Card>

      <p className="text-xs text-muted text-center">
        Need to add a service or update certification? Message Trini.
      </p>
    </div>
  );
}
