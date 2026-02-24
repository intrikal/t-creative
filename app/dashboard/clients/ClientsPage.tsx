"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Star, Plus, Users, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientRow, LoyaltyRow } from "./actions";
import { createClient, updateClient, deleteClient } from "./actions";
import { ClientCard } from "./components/ClientCard";
import { ClientFormDialog, BLANK_FORM, type ClientFormState } from "./components/ClientFormDialog";
import { DeleteDialog } from "./components/DeleteDialog";
import { LoyaltyTab } from "./components/LoyaltyTab";

/* ------------------------------------------------------------------ */
/*  Types & helpers (exported for child components)                     */
/* ------------------------------------------------------------------ */

export type ClientSource =
  | "instagram"
  | "tiktok"
  | "pinterest"
  | "word_of_mouth"
  | "google_search"
  | "referral"
  | "website_direct";

export type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

export interface Client {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  source: ClientSource;
  joinedDate: string;
  vip: boolean;
  services: ServiceCategory[];
  totalBookings: number;
  totalSpent: number;
  lastVisit: string;
  notes?: string;
  referredBy?: string;
  tags?: string;
}

export interface LoyaltyEntry {
  id: string;
  name: string;
  points: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  totalSpent: number;
  lastActivity: string;
  pointsToNext: number;
}

export function sourceBadge(source: ClientSource) {
  switch (source) {
    case "instagram":
      return { label: "Instagram", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "tiktok":
      return { label: "TikTok", className: "bg-slate-50 text-slate-700 border-slate-100" };
    case "pinterest":
      return { label: "Pinterest", className: "bg-red-50 text-red-700 border-red-100" };
    case "word_of_mouth":
      return { label: "Word of Mouth", className: "bg-teal-50 text-teal-700 border-teal-100" };
    case "google_search":
      return { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-100" };
    case "referral":
      return { label: "Referral", className: "bg-amber-50 text-amber-700 border-amber-100" };
    case "website_direct":
      return { label: "Website", className: "bg-stone-50 text-stone-600 border-stone-100" };
  }
}

export const SVC_LABEL: Record<ServiceCategory, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
};

export const SVC_COLOR: Record<ServiceCategory, string> = {
  lash: "bg-[#c4907a]/10 text-[#96604a] border-[#c4907a]/20",
  jewelry: "bg-[#d4a574]/10 text-[#a07040] border-[#d4a574]/20",
  crochet: "bg-[#7ba3a3]/10 text-[#3a6a6a] border-[#7ba3a3]/20",
  consulting: "bg-[#5b8a8a]/10 text-[#3a6a6a] border-[#5b8a8a]/20",
};

export function initials(name: string) {
  return name
    .trim()
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-[#c4907a]/20 text-[#96604a]",
  "bg-[#d4a574]/20 text-[#a07040]",
  "bg-[#7ba3a3]/20 text-[#3a6a6a]",
  "bg-purple-100 text-purple-700",
  "bg-blue-50 text-blue-700",
  "bg-amber-50 text-amber-700",
];

export function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export const TIER_CONFIG = {
  bronze: {
    label: "Bronze",
    color: "text-[#a07040]",
    bg: "bg-[#a07040]/10",
    border: "border-[#a07040]/20",
    minPoints: 0,
    nextPoints: 300,
  },
  silver: {
    label: "Silver",
    color: "text-muted",
    bg: "bg-foreground/8",
    border: "border-foreground/15",
    minPoints: 300,
    nextPoints: 700,
  },
  gold: {
    label: "Gold",
    color: "text-[#d4a574]",
    bg: "bg-[#d4a574]/10",
    border: "border-[#d4a574]/20",
    minPoints: 700,
    nextPoints: 1500,
  },
  platinum: {
    label: "Platinum",
    color: "text-[#5b8a8a]",
    bg: "bg-[#5b8a8a]/10",
    border: "border-[#5b8a8a]/20",
    minPoints: 1500,
    nextPoints: null,
  },
};

export function getTier(points: number): "bronze" | "silver" | "gold" | "platinum" {
  if (points >= 1500) return "platinum";
  if (points >= 700) return "gold";
  if (points >= 300) return "silver";
  return "bronze";
}

/* ------------------------------------------------------------------ */
/*  Source filter labels                                                */
/* ------------------------------------------------------------------ */

const SOURCE_FILTERS = [
  "All",
  "Instagram",
  "TikTok",
  "Pinterest",
  "Referral",
  "Word of Mouth",
  "Google",
  "Website",
] as const;

/* ------------------------------------------------------------------ */
/*  Data mappers                                                       */
/* ------------------------------------------------------------------ */

function mapClientRow(r: ClientRow): Client {
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
  const tagsList = r.tags
    ? (r.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean) as ServiceCategory[])
    : [];

  return {
    id: r.id,
    name,
    initials: initials(name),
    email: r.email,
    phone: r.phone ?? "",
    source: r.source ?? "website_direct",
    joinedDate: new Date(r.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    vip: r.isVip,
    services: tagsList,
    totalBookings: r.totalBookings,
    totalSpent: Math.round(r.totalSpent / 100),
    lastVisit: r.lastVisit
      ? new Date(r.lastVisit).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—",
    notes: r.internalNotes ?? undefined,
    referredBy: r.referredByName ?? undefined,
    tags: r.tags ?? undefined,
  };
}

function mapLoyaltyRow(r: LoyaltyRow, totalSpentMap: Map<string, number>): LoyaltyEntry {
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
  const tier = getTier(r.points);
  const nextPoints = TIER_CONFIG[tier].nextPoints;
  return {
    id: r.id,
    name,
    points: r.points,
    tier,
    totalSpent: totalSpentMap.get(r.id) ?? 0,
    lastActivity: r.lastActivity
      ? new Date(r.lastActivity).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—",
    pointsToNext: nextPoints ? Math.max(0, nextPoints - r.points) : 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                                */
/* ------------------------------------------------------------------ */

const CLIENTS_TABS = [
  { id: "clients", label: "Clients" },
  { id: "loyalty", label: "Loyalty" },
] as const;
type ClientsTab = (typeof CLIENTS_TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  ClientsPage                                                         */
/* ------------------------------------------------------------------ */

export function ClientsPage({
  initialClients,
  initialLoyalty,
}: {
  initialClients: ClientRow[];
  initialLoyalty: LoyaltyRow[];
}) {
  const router = useRouter();

  const mappedClients = initialClients.map(mapClientRow);
  const totalSpentMap = new Map(mappedClients.map((c) => [c.id, c.totalSpent]));
  const mappedLoyalty = initialLoyalty.map((r) => mapLoyaltyRow(r, totalSpentMap));

  const [clients, setClients] = useState<Client[]>(mappedClients);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [vipOnly, setVipOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientsTab>("clients");

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [formInitial, setFormInitial] = useState<ClientFormState>(BLANK_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const filtered = clients.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === "All" || sourceBadge(c.source)?.label === sourceFilter;
    const matchVip = !vipOnly || c.vip;
    return matchSearch && matchSource && matchVip;
  });

  const vipCount = clients.filter((c) => c.vip).length;
  const totalRevenue = clients.reduce((s, c) => s + c.totalSpent, 0);
  const avgSpend = clients.length ? Math.round(totalRevenue / clients.length) : 0;

  const openAdd = () => {
    setEditTarget(null);
    setFormInitial(BLANK_FORM);
    setFormOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditTarget(c);
    const [firstName, ...rest] = c.name.split(" ");
    setFormInitial({
      firstName: firstName ?? "",
      lastName: rest.join(" "),
      email: c.email,
      phone: c.phone,
      source: c.source,
      referredBy: c.referredBy ?? "",
      tags: c.tags ?? c.services.join(", "),
      notes: c.notes ?? "",
      vip: c.vip,
    });
    setFormOpen(true);
  };

  const handleSave = async (f: ClientFormState) => {
    const input = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim() || undefined,
      source: f.source as ClientSource,
      isVip: f.vip,
      internalNotes: f.notes.trim() || undefined,
      tags: f.tags.trim() || undefined,
    };

    if (editTarget) {
      await updateClient(editTarget.id, input);
      const name = [input.firstName, input.lastName].filter(Boolean).join(" ");
      setClients((prev) =>
        prev.map((c) =>
          c.id === editTarget.id
            ? {
                ...c,
                name,
                initials: initials(name),
                email: input.email,
                phone: input.phone ?? "",
                source: input.source ?? "website_direct",
                vip: input.isVip,
                notes: input.internalNotes,
                tags: input.tags,
                services: input.tags
                  ? (input.tags
                      .split(",")
                      .map((t) => t.trim().toLowerCase())
                      .filter(Boolean) as ServiceCategory[])
                  : [],
              }
            : c,
        ),
      );
    } else {
      await createClient(input);
      router.refresh();
    }
    setFormOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteClient(deleteTarget.id);
    setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Clients</h1>
          <p className="text-sm text-muted mt-0.5">{clients.length} total clients</p>
        </div>
        {activeTab === "clients" && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border -mt-2">
        {CLIENTS_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "loyalty" && <LoyaltyTab initialLoyalty={mappedLoyalty} />}

      {activeTab === "clients" && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-muted" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Total
                  </p>
                </div>
                <p className="text-2xl font-semibold text-foreground">{clients.length}</p>
              </CardContent>
            </Card>
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Star className="w-3.5 h-3.5 text-[#d4a574]" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    VIP
                  </p>
                </div>
                <p className="text-2xl font-semibold text-foreground">{vipCount}</p>
                <p className="text-xs text-muted mt-0.5">top clients</p>
              </CardContent>
            </Card>
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-muted" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Revenue
                  </p>
                </div>
                <p className="text-2xl font-semibold text-foreground">
                  ${totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-muted mt-0.5">all time</p>
              </CardContent>
            </Card>
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-muted" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Avg Spend
                  </p>
                </div>
                <p className="text-2xl font-semibold text-foreground">${avgSpend}</p>
                <p className="text-xs text-muted mt-0.5">per client</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
              />
            </div>
            <div className="flex gap-1 flex-wrap items-center">
              {SOURCE_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    sourceFilter === s
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => setVipOnly(!vipOnly)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  vipOnly
                    ? "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/25"
                    : "text-muted border-transparent hover:text-foreground",
                )}
              >
                <Star className={cn("w-3 h-3", vipOnly && "fill-[#d4a574] text-[#d4a574]")} />
                VIP only
              </button>
              <span className="text-xs text-muted ml-auto sm:ml-2">
                {filtered.length} of {clients.length}
              </span>
            </div>
          </div>

          {/* Client grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted">No clients match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onEdit={openEdit}
                  onDelete={(c) => setDeleteTarget(c)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Form dialog */}
      {formOpen && (
        <ClientFormDialog
          key={editTarget?.id ?? "new"}
          open
          title={editTarget ? "Edit Client" : "Add Client"}
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* Delete dialog */}
      <DeleteDialog
        target={deleteTarget}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
