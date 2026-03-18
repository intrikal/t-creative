"use client";

import { useState, useOptimistic, useTransition } from "react";
import dynamic from "next/dynamic";
import { Search, Star, Plus, Users, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientRow, LoyaltyRow, LifecycleStage } from "./actions";
export type { LifecycleStage };
import { createClient, updateClient, deleteClient, getClients as fetchClients } from "./actions";
import { ClientCard } from "./components/ClientCard";
import { BLANK_FORM, type ClientFormState } from "./components/ClientFormDialog";

const ClientFormDialog = dynamic(
  () => import("./components/ClientFormDialog").then((m) => m.ClientFormDialog),
  { ssr: false },
);
const ClientPreferencesDialog = dynamic(
  () => import("./components/ClientPreferencesDialog").then((m) => m.ClientPreferencesDialog),
  { ssr: false },
);
const ClientWaiversDialog = dynamic(
  () => import("./components/ClientWaiversDialog").then((m) => m.ClientWaiversDialog),
  { ssr: false },
);
const DeleteDialog = dynamic(
  () => import("./components/DeleteDialog").then((m) => m.DeleteDialog),
  { ssr: false },
);
import {
  type ClientSource,
  type ServiceCategory,
  type Client,
  type LoyaltyEntry,
  type ClientsTab,
  sourceBadge,
  SVC_LABEL,
  SVC_COLOR,
  initials,
  avatarColor,
  TIER_CONFIG,
  getTier,
  SOURCE_FILTERS,
  CLIENTS_TABS,
  mapClientRow,
  mapLoyaltyRow,
} from "./components/helpers";
import { LoyaltyTab } from "./components/LoyaltyTab";
import type { LoyaltyRewardRow } from "./loyalty-rewards-actions";

// Re-export types and helpers so existing imports from this module continue to work
export {
  type ClientSource,
  type ServiceCategory,
  type Client,
  type LoyaltyEntry,
  sourceBadge,
  SVC_LABEL,
  SVC_COLOR,
  initials,
  avatarColor,
  TIER_CONFIG,
  getTier,
};

/* ------------------------------------------------------------------ */
/*  ClientsPage                                                         */
/* ------------------------------------------------------------------ */

export function ClientsPage({
  initialClients,
  initialHasMore = false,
  initialLoyalty,
  initialRewards = [],
}: {
  initialClients: ClientRow[];
  initialHasMore?: boolean;
  initialLoyalty: LoyaltyRow[];
  initialRewards?: LoyaltyRewardRow[];
}) {
  const [allRows, setAllRows] = useState(initialClients);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const mappedClients = allRows.map(mapClientRow);
  const totalSpentMap = new Map(mappedClients.map((c) => [c.id, c.totalSpent]));
  const mappedLoyalty = initialLoyalty.map((r) => mapLoyaltyRow(r, totalSpentMap));

  const [isPending, startTransition] = useTransition();
  const [clients, addOptimistic] = useOptimistic<
    Client[],
    { type: "update"; id: string; data: Partial<Client> } | { type: "delete"; id: string }
  >(mappedClients, (state, action) => {
    switch (action.type) {
      case "update":
        return state.map((c) => (c.id === action.id ? { ...c, ...action.data } : c));
      case "delete":
        return state.filter((c) => c.id !== action.id);
    }
  });
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState<LifecycleStage | "all">("all");
  const [vipOnly, setVipOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientsTab>("clients");

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [formInitial, setFormInitial] = useState<ClientFormState>(BLANK_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [prefsTarget, setPrefsTarget] = useState<Client | null>(null);
  const [waiversTarget, setWaiversTarget] = useState<Client | null>(null);

  const filtered = clients.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === "All" || sourceBadge(c.source)?.label === sourceFilter;
    const matchVip = !vipOnly || c.vip;
    const matchStage = stageFilter === "all" || c.lifecycleStage === stageFilter;
    return matchSearch && matchSource && matchVip && matchStage;
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
      lifecycleStage: c.lifecycleStage,
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
      lifecycleStage: f.lifecycleStage ?? null,
      internalNotes: f.notes.trim() || undefined,
      tags: f.tags.trim() || undefined,
    };

    if (editTarget) {
      const name = [input.firstName, input.lastName].filter(Boolean).join(" ");
      const optimisticData: Partial<Client> = {
        name,
        initials: initials(name),
        email: input.email,
        phone: input.phone ?? "",
        source: input.source ?? "website_direct",
        vip: input.isVip,
        lifecycleStage: input.lifecycleStage,
        notes: input.internalNotes,
        tags: input.tags,
        services: input.tags
          ? (input.tags
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean) as ServiceCategory[])
          : [],
      };
      const targetId = editTarget.id;
      setFormOpen(false);
      startTransition(async () => {
        addOptimistic({ type: "update", id: targetId, data: optimisticData });
        await updateClient(targetId, input);
      });
    } else {
      setFormOpen(false);
      startTransition(async () => {
        await createClient(input);
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      addOptimistic({ type: "delete", id: targetId });
      await deleteClient(targetId);
    });
  };

  async function loadMore() {
    setLoadingMore(true);
    try {
      const { rows, hasMore: more } = await fetchClients({ offset: allRows.length });
      setAllRows((prev) => [...prev, ...rows]);
      setHasMore(more);
    } finally {
      setLoadingMore(false);
    }
  }

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

      {activeTab === "loyalty" && (
        <LoyaltyTab initialLoyalty={mappedLoyalty} initialRewards={initialRewards} />
      )}

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
              <div className="w-px h-4 bg-border mx-1" />
              {(["all", "prospect", "active", "at_risk", "lapsed", "churned"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStageFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    stageFilter === s
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {s === "all"
                    ? "All stages"
                    : s === "at_risk"
                      ? "At risk"
                      : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <div className="w-px h-4 bg-border mx-1" />
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
                  onPreferences={(c) => setPrefsTarget(c)}
                  onWaivers={(c) => setWaiversTarget(c)}
                />
              ))}
            </div>
          )}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
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

      {/* Client preferences dialog */}
      {prefsTarget && (
        <ClientPreferencesDialog
          open
          onClose={() => setPrefsTarget(null)}
          clientId={prefsTarget.id}
          clientName={prefsTarget.name}
        />
      )}

      {/* Client waivers dialog */}
      {waiversTarget && (
        <ClientWaiversDialog
          open
          onClose={() => setWaiversTarget(null)}
          clientId={waiversTarget.id}
          clientName={waiversTarget.name}
        />
      )}
    </div>
  );
}
