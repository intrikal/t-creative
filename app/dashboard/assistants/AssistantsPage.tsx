"use client";

import { useState, useOptimistic, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { UserCheck, Star, Calendar, DollarSign, Plus, Search, ArrowUpDown } from "lucide-react";
import { getShifts } from "@/app/dashboard/staff/actions";
import { ShiftsContent } from "@/app/dashboard/team/ShiftsContent";
import {
  getPrograms,
  getStudents,
  getTrainingStats,
  getClients as getTrainingClients,
} from "@/app/dashboard/training/actions";
import { cn } from "@/lib/utils";
import type { AssistantRow } from "./actions";
import {
  getAssistants,
  getAssistantAvailability,
  getCommissionsData,
  getPayrollData,
  createAssistant,
  toggleAssistantStatus,
  updateCommissionSettings,
  type CommissionType,
} from "./actions";
import { AddAssistantDialog, type AssistantFormData } from "./components/AddAssistantDialog";
import { AssistantCard } from "./components/AssistantCard";
import { AvailabilityTab } from "./components/AvailabilityTab";
import { CommissionsTab } from "./components/CommissionsTab";
import { PayrollTab } from "./components/PayrollTab";

const TrainingPage = dynamic(
  () => import("@/app/dashboard/training/TrainingPage").then((m) => m.TrainingPage),
  { ssr: false },
);

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
  commissionType: CommissionType;
  commissionRate: number | null;
  commissionFlatFee: number | null;
  tipSplitPercent: number;
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
    commissionType: r.commissionType,
    commissionRate: r.commissionRatePercent,
    commissionFlatFee: r.commissionFlatFeeInCents,
    tipSplitPercent: r.tipSplitPercent,
    certifications: [],
    recentSessions: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function TabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-surface" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                                */
/* ------------------------------------------------------------------ */

const PAGE_TABS = [
  "Roster",
  "Availability",
  "Commissions",
  "Payroll",
  "Shifts",
  "Training",
] as const;
type PageTab = (typeof PAGE_TABS)[number];

type StatusFilter = "all" | "active" | "on_leave" | "inactive";
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "inactive", label: "Inactive" },
];

type RosterSort = "name" | "sessions" | "revenue" | "rating";
type CommissionSort = "name" | "sessions" | "revenue" | "earned" | "balance";
type PayrollSort = "name" | "sessions" | "revenue" | "owed";

/** Tabs where the shared filter bar is shown */
const FILTERABLE_TABS: Set<PageTab> = new Set([
  "Roster",
  "Availability",
  "Commissions",
  "Payroll",
  "Shifts",
]);

/* ------------------------------------------------------------------ */
/*  AssistantsPage                                                      */
/* ------------------------------------------------------------------ */

export function AssistantsPage({
  pageTitle = "Assistants",
  pageSubtitle = "Your team overview and performance",
  initialAssistants,
  initialAvailability,
}: {
  pageTitle?: string;
  pageSubtitle?: string;
  initialAssistants?: AssistantRow[];
  initialAvailability?: import("./actions").AvailabilityRow[];
}) {
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pageTab, setPageTab] = useState<PageTab>("Roster");

  /* ---- Filter & sort state ---- */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rosterSort, setRosterSort] = useState<RosterSort>("name");
  const [commissionSort, setCommissionSort] = useState<CommissionSort>("earned");
  const [payrollSort, setPayrollSort] = useState<PayrollSort>("owed");

  /* ---- Data queries ---- */

  const assistantsQuery = useQuery({
    queryKey: ["assistants"],
    queryFn: getAssistants,
    initialData: initialAssistants,
  });

  const availabilityQuery = useQuery({
    queryKey: ["assistant-availability"],
    queryFn: getAssistantAvailability,
    initialData: initialAvailability,
    enabled: pageTab === "Availability" || pageTab === "Roster",
  });

  const commissionsQuery = useQuery({
    queryKey: ["commissions"],
    queryFn: getCommissionsData,
    enabled: pageTab === "Commissions",
  });

  const payrollQuery = useQuery({
    queryKey: ["payroll"],
    queryFn: getPayrollData,
    enabled: pageTab === "Payroll",
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: getShifts,
    enabled: pageTab === "Shifts",
  });

  const trainingQuery = useQuery({
    queryKey: ["training"],
    queryFn: async () => {
      const [programs, students, stats, clients] = await Promise.all([
        getPrograms(),
        getStudents(),
        getTrainingStats(),
        getTrainingClients(),
      ]);
      return { programs, students, stats, clients };
    },
    enabled: pageTab === "Training",
  });

  /* ---- Derived state ---- */

  const mapped = (assistantsQuery.data ?? []).map(mapAssistantRow);

  const [assistants, setOptimisticAssistants] = useOptimistic<
    Assistant[],
    | { type: "status"; id: string; status: AssistantStatus }
    | {
        type: "commission";
        id: string;
        settings: {
          commissionType: CommissionType;
          commissionRate?: number;
          commissionFlatFee?: number;
          tipSplitPercent?: number;
        };
      }
  >(mapped, (state, action) => {
    if (action.type === "status") {
      return state.map((a) => (a.id === action.id ? { ...a, status: action.status } : a));
    }
    if (action.type === "commission") {
      return state.map((a) =>
        a.id === action.id
          ? {
              ...a,
              commissionType: action.settings.commissionType,
              commissionRate: action.settings.commissionRate ?? a.commissionRate,
              commissionFlatFee: action.settings.commissionFlatFee ?? a.commissionFlatFee,
              tipSplitPercent: action.settings.tipSplitPercent ?? a.tipSplitPercent,
            }
          : a,
      );
    }
    return state;
  });

  /* ---- Filtering & sorting (memoized) ---- */

  const searchLower = search.toLowerCase();

  const filteredAssistants = useMemo(
    () =>
      assistants.filter(
        (a) =>
          (!search || a.name.toLowerCase().includes(searchLower)) &&
          (statusFilter === "all" || a.status === statusFilter),
      ),
    [assistants, searchLower, search, statusFilter],
  );

  const sortedRoster = useMemo(
    () =>
      [...filteredAssistants].sort((a, b) => {
        switch (rosterSort) {
          case "sessions":
            return b.thisMonthSessions - a.thisMonthSessions;
          case "revenue":
            return b.totalRevenue - a.totalRevenue;
          case "rating":
            return b.avgRating - a.avgRating;
          case "name":
          default:
            return a.name.localeCompare(b.name);
        }
      }),
    [filteredAssistants, rosterSort],
  );

  const sortedCommissions = useMemo(() => {
    const data = (commissionsQuery.data ?? []).filter(
      (c) => !search || c.name.toLowerCase().includes(searchLower),
    );
    return data.sort((a, b) => {
      switch (commissionSort) {
        case "sessions":
          return b.sessions - a.sessions;
        case "revenue":
          return b.revenueInCents - a.revenueInCents;
        case "earned":
          return b.earnedInCents + b.tipEarnedInCents - (a.earnedInCents + a.tipEarnedInCents);
        case "balance":
          return (
            b.earnedInCents +
            b.tipEarnedInCents -
            b.paidOutInCents -
            (a.earnedInCents + a.tipEarnedInCents - a.paidOutInCents)
          );
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [commissionsQuery.data, searchLower, search, commissionSort]);

  const sortedPayroll = useMemo(() => {
    const data = (payrollQuery.data?.rows ?? []).filter(
      (r) => !search || r.name.toLowerCase().includes(searchLower),
    );
    return data.sort((a, b) => {
      switch (payrollSort) {
        case "sessions":
          return b.sessions - a.sessions;
        case "revenue":
          return b.revenueInCents - a.revenueInCents;
        case "owed":
          return b.owedInCents - a.owedInCents;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [payrollQuery.data?.rows, searchLower, search, payrollSort]);

  const filteredShifts = useMemo(() => {
    const staffIds = new Set(filteredAssistants.map((a) => a.id));
    return (shiftsQuery.data ?? []).filter(
      (s) => !search || s.staffName.toLowerCase().includes(searchLower) || staffIds.has(s.staffId),
    );
  }, [shiftsQuery.data, filteredAssistants, searchLower, search]);

  const isFiltering = search !== "" || statusFilter !== "all";

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
    startTransition(async () => {
      await createAssistant({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || undefined,
        title: data.role,
        specialties: data.specialties || undefined,
        commissionType: data.commissionType,
        commissionRate: data.commissionRate,
        commissionFlatFee: data.commissionFlatFee,
        tipSplitPercent: data.tipSplitPercent,
      });
      assistantsQuery.refetch();
    });
  };

  const handleToggleStatus = async (id: string, status: AssistantStatus) => {
    startTransition(async () => {
      setOptimisticAssistants({ type: "status", id, status });
      await toggleAssistantStatus(id, status);
      assistantsQuery.refetch();
    });
  };

  const handleUpdateCommissionSettings = async (
    id: string,
    settings: {
      commissionType: CommissionType;
      commissionRate?: number;
      commissionFlatFee?: number;
      tipSplitPercent?: number;
    },
  ) => {
    startTransition(async () => {
      setOptimisticAssistants({ type: "commission", id, settings });
      await updateCommissionSettings(id, {
        commissionType: settings.commissionType,
        commissionRate: settings.commissionRate,
        commissionFlatFee: settings.commissionFlatFee,
        tipSplitPercent: settings.tipSplitPercent,
      });
      assistantsQuery.refetch();
      commissionsQuery.refetch();
    });
  };

  /* ---- Initial load skeleton ---- */

  const isInitialLoad = assistantsQuery.isLoading;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-sm text-muted mt-0.5">{pageSubtitle}</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Assistant
        </button>
      </div>

      {/* Team stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {isInitialLoad
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl px-4 py-3 animate-pulse"
              >
                <div className="space-y-2">
                  <div className="h-2.5 w-20 bg-surface rounded" />
                  <div className="h-5 w-12 bg-surface rounded" />
                  <div className="h-2.5 w-16 bg-surface rounded" />
                </div>
              </div>
            ))
          : TEAM_STATS.map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wide leading-none">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold text-foreground leading-tight">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted">{stat.sub}</p>
                  </div>
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                      stat.bg,
                    )}
                  >
                    <stat.icon className={cn("w-4 h-4", stat.color)} />
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {PAGE_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setPageTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              pageTab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filter bar — shown for filterable tabs */}
      {FILTERABLE_TABS.has(pageTab) && !isInitialLoad && assistants.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
              />
            </div>
            {/* Per-tab sort selector */}
            {pageTab === "Roster" && (
              <div className="relative shrink-0">
                <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <select
                  value={rosterSort}
                  onChange={(e) => setRosterSort(e.target.value as RosterSort)}
                  className="pl-8 pr-7 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground appearance-none cursor-pointer"
                >
                  <option value="name">Name A–Z</option>
                  <option value="sessions">Most sessions</option>
                  <option value="revenue">Highest revenue</option>
                  <option value="rating">Highest rating</option>
                </select>
              </div>
            )}
            {pageTab === "Commissions" && (
              <div className="relative shrink-0">
                <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <select
                  value={commissionSort}
                  onChange={(e) => setCommissionSort(e.target.value as CommissionSort)}
                  className="pl-8 pr-7 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground appearance-none cursor-pointer"
                >
                  <option value="earned">Highest earned</option>
                  <option value="balance">Highest balance</option>
                  <option value="sessions">Most sessions</option>
                  <option value="revenue">Highest revenue</option>
                  <option value="name">Name A–Z</option>
                </select>
              </div>
            )}
            {pageTab === "Payroll" && (
              <div className="relative shrink-0">
                <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <select
                  value={payrollSort}
                  onChange={(e) => setPayrollSort(e.target.value as PayrollSort)}
                  className="pl-8 pr-7 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground appearance-none cursor-pointer"
                >
                  <option value="owed">Most owed</option>
                  <option value="sessions">Most sessions</option>
                  <option value="revenue">Highest revenue</option>
                  <option value="name">Name A–Z</option>
                </select>
              </div>
            )}
            {isFiltering && (
              <span className="text-xs text-muted shrink-0">
                {filteredAssistants.length} of {assistants.length}
              </span>
            )}
          </div>
          {/* Status filter pills */}
          <div className="flex gap-1 flex-wrap items-center">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  statusFilter === s.value
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground hover:bg-foreground/5",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Roster */}
      {pageTab === "Roster" &&
        (isInitialLoad ? (
          <TabSkeleton />
        ) : assistants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mb-4">
              <UserCheck className="w-5 h-5 text-muted" />
            </div>
            <p className="text-sm font-semibold text-foreground">No team members yet</p>
            <p className="text-xs text-muted mt-1 max-w-xs">
              Add your first assistant to start tracking performance, commissions, and availability.
            </p>
            <button
              onClick={() => setDialogOpen(true)}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Assistant
            </button>
          </div>
        ) : sortedRoster.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-foreground mb-1">
              No team members match your filters
            </p>
            <p className="text-xs text-muted">Try adjusting your search or status filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {sortedRoster.map((a) => (
              <AssistantCard
                key={a.id}
                assistant={a}
                onToggleStatus={handleToggleStatus}
                onUpdateCommissionSettings={handleUpdateCommissionSettings}
              />
            ))}
          </div>
        ))}

      {/* Availability */}
      {pageTab === "Availability" &&
        (availabilityQuery.isLoading || isInitialLoad ? (
          <TabSkeleton />
        ) : (
          <AvailabilityTab
            assistants={filteredAssistants}
            availability={availabilityQuery.data ?? []}
          />
        ))}

      {/* Commissions */}
      {pageTab === "Commissions" &&
        (commissionsQuery.isLoading ? (
          <TabSkeleton />
        ) : (
          <CommissionsTab data={sortedCommissions} />
        ))}

      {/* Payroll */}
      {pageTab === "Payroll" &&
        (payrollQuery.isLoading ? (
          <TabSkeleton />
        ) : (
          <PayrollTab
            rows={sortedPayroll}
            summary={payrollQuery.data?.summary ?? { periodLabel: "", totalOwedInCents: 0 }}
          />
        ))}

      {/* Shifts */}
      {pageTab === "Shifts" &&
        (shiftsQuery.isLoading ? (
          <div className="border border-border rounded-xl overflow-hidden animate-pulse">
            <div className="px-5 pt-4 pb-3 border-b border-border/60 flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 bg-surface rounded" />
                <div className="h-2.5 w-20 bg-surface rounded" />
              </div>
              <div className="flex gap-1">
                <div className="w-7 h-7 bg-surface rounded-lg" />
                <div className="w-7 h-7 bg-surface rounded-lg" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: 640 }}>
                <thead>
                  <tr className="border-b border-border/60">
                    {["w-24", "w-16", "w-16", "w-16", "w-16", "w-16", "w-16", "w-16"].map(
                      (w, i) => (
                        <th key={i} className="px-3 pb-2.5 pt-2">
                          <div className={cn("h-2.5 bg-surface rounded mx-auto", w)} />
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-surface shrink-0" />
                          <div className="h-3 w-16 bg-surface rounded" />
                        </div>
                      </td>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-1.5 py-3">
                          {j === 1 || j === 3 ? (
                            <div className="h-12 bg-surface rounded-lg" />
                          ) : (
                            <div className="h-1 w-4 bg-surface/60 rounded mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <ShiftsContent
            shifts={filteredShifts}
            assistantNames={filteredAssistants.map((a) => ({
              id: a.id,
              name: a.name,
              initials: a.initials,
            }))}
          />
        ))}

      {/* Training */}
      {pageTab === "Training" &&
        (trainingQuery.isLoading ? (
          <TabSkeleton />
        ) : trainingQuery.data?.stats ? (
          <TrainingPage
            initialPrograms={trainingQuery.data.programs}
            initialStudents={trainingQuery.data.students}
            stats={trainingQuery.data.stats}
            clients={trainingQuery.data.clients}
            embedded
          />
        ) : null)}

      <AddAssistantDialog
        key={`assistant-${dialogOpen}`}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleAddAssistant}
      />
    </div>
  );
}
