"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Clock, Star, Calendar, DollarSign, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AssistantRow, AvailabilityRow } from "./actions";
import { createAssistant, toggleAssistantStatus } from "./actions";
import { AddAssistantDialog, type AssistantFormData } from "./components/AddAssistantDialog";
import { AssistantCard } from "./components/AssistantCard";
import { AvailabilityTab } from "./components/AvailabilityTab";
import { CommissionsTab } from "./components/CommissionsTab";
import { PayrollTab } from "./components/PayrollTab";

/* ------------------------------------------------------------------ */
/*  Types & helpers (exported for child components)                     */
/* ------------------------------------------------------------------ */

export type AssistantStatus = "active" | "on_leave" | "inactive";
export type Skill = "lash" | "jewelry" | "crochet" | "consulting" | "training" | "events" | "admin";
export type ShiftDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const ALL_DAYS: ShiftDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface Session {
  id: number;
  clientName: string;
  service: string;
  date: string;
  revenue: number;
  rating: number | null;
}

export interface Assistant {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: AssistantStatus;
  phone: string;
  email: string;
  skills: Skill[];
  shifts: ShiftDay[];
  hours: string;
  hireDate: string;
  totalSessions: number;
  totalRevenue: number;
  avgRating: number;
  thisMonthSessions: number;
  certifications: string[];
  recentSessions: Session[];
}

export function statusConfig(status: AssistantStatus) {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "on_leave":
      return { label: "On Leave", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "inactive":
      return { label: "Inactive", className: "bg-foreground/8 text-muted border-foreground/12" };
  }
}

export function skillTag(skill: Skill) {
  const map: Record<Skill, { label: string; className: string }> = {
    lash: { label: "Lash", className: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20" },
    jewelry: { label: "Jewelry", className: "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/20" },
    crochet: { label: "Crochet", className: "bg-[#7ba3a3]/12 text-[#4a7a7a] border-[#7ba3a3]/20" },
    consulting: {
      label: "Consulting",
      className: "bg-[#5b8a8a]/12 text-[#3a6a6a] border-[#5b8a8a]/20",
    },
    training: { label: "Training", className: "bg-accent/12 text-accent border-accent/20" },
    events: { label: "Events", className: "bg-purple-50 text-purple-700 border-purple-100" },
    admin: { label: "Admin", className: "bg-foreground/8 text-muted border-foreground/12" },
  };
  return map[skill];
}

export function ratingStars(rating: number) {
  return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
}

/* ------------------------------------------------------------------ */
/*  Data mappers                                                       */
/* ------------------------------------------------------------------ */

function deriveStatus(row: AssistantRow): AssistantStatus {
  if (!row.isActive) return "inactive";
  if (!row.isAvailable) return "on_leave";
  return "active";
}

function mapAssistantRow(r: AssistantRow): Assistant {
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
  const specialties = r.specialties
    ? (r.specialties
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) as Skill[])
    : [];

  return {
    id: r.id,
    name,
    initials: name
      .trim()
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    role: r.title ?? "Staff",
    status: deriveStatus(r),
    phone: r.phone ?? "",
    email: r.email,
    skills: specialties,
    shifts: [],
    hours: "—",
    hireDate: r.startDate
      ? new Date(r.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "—",
    totalSessions: r.totalSessions,
    totalRevenue: Math.round(r.totalRevenue / 100),
    avgRating: r.averageRating ? parseFloat(r.averageRating) : 0,
    thisMonthSessions: r.thisMonthSessions,
    certifications: [],
    recentSessions: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                                */
/* ------------------------------------------------------------------ */

const PAGE_TABS = ["Roster", "Availability", "Commissions", "Payroll"] as const;
type PageTab = (typeof PAGE_TABS)[number];

/* ------------------------------------------------------------------ */
/*  AssistantsPage                                                      */
/* ------------------------------------------------------------------ */

export function AssistantsPage({
  initialAssistants,
  initialAvailability,
}: {
  initialAssistants: AssistantRow[];
  initialAvailability: AvailabilityRow[];
}) {
  const router = useRouter();

  const mapped = initialAssistants.map(mapAssistantRow);

  const [assistants, setAssistants] = useState<Assistant[]>(mapped);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pageTab, setPageTab] = useState<PageTab>("Roster");

  // Computed stats
  const activeCount = assistants.filter((a) => a.status === "active").length;
  const onLeaveCount = assistants.filter((a) => a.status === "on_leave").length;
  const ratedAssistants = assistants.filter((a) => a.avgRating > 0);
  const avgRating =
    ratedAssistants.length > 0
      ? (ratedAssistants.reduce((s, a) => s + a.avgRating, 0) / ratedAssistants.length).toFixed(1)
      : "—";
  const totalSessions = assistants.reduce((s, a) => s + a.thisMonthSessions, 0);
  const totalRevenue = assistants.reduce((s, a) => s + a.totalRevenue, 0);

  const TEAM_STATS = [
    {
      label: "Total Assistants",
      value: String(assistants.length),
      sub: `${activeCount} active${onLeaveCount > 0 ? ` · ${onLeaveCount} on leave` : ""}`,
      icon: UserCheck,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Sessions This Month",
      value: String(totalSessions),
      sub: "current period",
      icon: Calendar,
      color: "text-[#4e6b51]",
      bg: "bg-[#4e6b51]/10",
    },
    {
      label: "Avg. Rating",
      value: avgRating,
      sub: "across all assistants",
      icon: Star,
      color: "text-[#d4a574]",
      bg: "bg-[#d4a574]/10",
    },
    {
      label: "Team Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      sub: "all time combined",
      icon: DollarSign,
      color: "text-blush",
      bg: "bg-blush/10",
    },
  ];

  const handleAddAssistant = async (data: AssistantFormData) => {
    await createAssistant({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || undefined,
      title: data.role,
      specialties: data.specialties || undefined,
    });
    router.refresh();
  };

  const handleToggleStatus = async (id: string, status: AssistantStatus) => {
    await toggleAssistantStatus(id, status);
    setAssistants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Assistants</h1>
          <p className="text-sm text-muted mt-0.5">Your team overview and performance</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Assistant
        </button>
      </div>

      {/* Team stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TEAM_STATS.map((stat) => (
          <Card key={stat.label} className="gap-0 py-4">
            <CardContent className="px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-semibold text-foreground mt-1">{stat.value}</p>
                  <p className="text-[10px] text-muted mt-1">{stat.sub}</p>
                </div>
                <div className={cn("rounded-xl p-2 shrink-0", stat.bg)}>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {PAGE_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setPageTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              pageTab === t
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Roster */}
      {pageTab === "Roster" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {assistants.map((a) => (
            <AssistantCard key={a.id} assistant={a} onToggleStatus={handleToggleStatus} />
          ))}
        </div>
      )}

      {/* Availability */}
      {pageTab === "Availability" && (
        <AvailabilityTab assistants={assistants} availability={initialAvailability} />
      )}

      {/* Commissions */}
      {pageTab === "Commissions" && <CommissionsTab />}

      {/* Payroll */}
      {pageTab === "Payroll" && <PayrollTab />}

      <AddAssistantDialog
        key={`assistant-${dialogOpen}`}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleAddAssistant}
      />
    </div>
  );
}
