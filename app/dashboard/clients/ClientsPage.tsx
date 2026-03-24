/**
 * ClientsPage — Dashboard view for managing the studio's client list.
 *
 * Renders the /dashboard/clients route with two tabs: a filterable client
 * directory (search, source, lifecycle stage, VIP toggle) and a loyalty
 * program tab. Supports CRUD operations on clients with optimistic UI
 * updates so the list feels instant even while server actions are in flight.
 *
 * This is a Client Component ("use client") because it relies on
 * interactive state: search/filter inputs, optimistic list mutations via
 * useOptimistic, and dialog open/close management — none of which can
 * execute in a Server Component.
 */
"use client";

import { useState, useOptimistic, useTransition, useCallback } from "react";
import dynamic from "next/dynamic";
import { Search, Star, Plus, Users, TrendingUp, DollarSign, ArrowUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ClientRow, LoyaltyRow, LifecycleStage } from "@/lib/types/client.types";
import { cn } from "@/lib/utils";
export type { LifecycleStage };
import {
  createClient,
  updateClient,
  deleteClient,
  getClients as fetchClients,
  getClientLoyalty,
} from "./actions";
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
  // Raw DB rows loaded so far — grows as the user clicks "Load more" for
  // cursor-based pagination. Kept as raw rows so mapClientRow can derive
  // display-friendly Client objects on every render.
  const [allRows, setAllRows] = useState(initialClients);
  // Whether the server reported more rows beyond the current page.
  const [hasMore, setHasMore] = useState(initialHasMore);
  // Loading spinner guard for the "Load more" button.
  const [loadingMore, setLoadingMore] = useState(false);
  // Transform raw DB rows into display-friendly Client objects on every render
  // so derived fields (initials, formatted dates, etc.) stay current after
  // optimistic updates mutate allRows.
  const mappedClients = allRows.map(mapClientRow);
  // Build Map<clientId, totalSpent> for O(1) lookups when computing loyalty
  // tier thresholds — avoids scanning the client array per loyalty row.
  const totalSpentMap = new Map(mappedClients.map((c) => [c.id, c.totalSpent]));
  // Loyalty data is loaded lazily when the Loyalty tab is first opened to
  // avoid a slow aggregation query blocking the initial page render.
  const [loyaltyRows, setLoyaltyRows] = useState(initialLoyalty);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyLoaded, setLoyaltyLoaded] = useState(initialLoyalty.length > 0);
  // Transform each loyalty DB row into a display-friendly LoyaltyEntry, using
  // totalSpentMap to inject the client's total spend for tier calculation.
  const mappedLoyalty = loyaltyRows.map((r) => mapLoyaltyRow(r, totalSpentMap));

  // useTransition wraps server-action calls so the UI stays responsive and
  // isPending can drive disabled states on buttons while mutations settle.
  const [isPending, startTransition] = useTransition();
  // Optimistic client list — lets the user see edits/deletes immediately
  // while the server action runs in the background via startTransition.
  const [clients, addOptimistic] = useOptimistic<
    Client[],
    { type: "update"; id: string; data: Partial<Client> } | { type: "delete"; id: string }
  >(mappedClients, (state, action) => {
    switch (action.type) {
      case "update":
        // .map() with spread operator to shallow-merge optimistic changes into
        // the matching client while preserving all other fields unchanged.
        // Spread is used here (vs Object.assign) for immutability — React needs
        // a new object reference to detect the state change.
        return state.map((c) => (c.id === action.id ? { ...c, ...action.data } : c));
      case "delete":
        // .filter() removes the deleted client from the optimistic list —
        // React will roll back if the server action fails.
        return state.filter((c) => c.id !== action.id);
    }
  });
  // --- Filter state ---
  // Each filter is a separate useState so toggling one does not reset the
  // others. They combine with AND logic in the `filtered` derivation below.
  const [search, setSearch] = useState(""); // Free-text name/email filter
  const [sourceFilter, setSourceFilter] = useState("All"); // Acquisition channel pill
  const [stageFilter, setStageFilter] = useState<LifecycleStage | "all">("all"); // Lifecycle stage pill
  const [vipOnly, setVipOnly] = useState(false); // VIP-only toggle
  const [sortBy, setSortBy] = useState<"recent" | "visits" | "spend" | "name">("recent"); // Sort order
  const [activeTab, setActiveTab] = useState<ClientsTab>("clients"); // Top-level tab: "clients" | "loyalty"

  // Lazy-load loyalty data the first time the Loyalty tab is opened.
  const handleTabChange = useCallback(
    async (tab: ClientsTab) => {
      setActiveTab(tab);
      if (tab === "loyalty" && !loyaltyLoaded) {
        setLoyaltyLoading(true);
        try {
          const rows = await getClientLoyalty();
          setLoyaltyRows(rows);
          setLoyaltyLoaded(true);
        } finally {
          setLoyaltyLoading(false);
        }
      }
    },
    [loyaltyLoaded],
  );

  // --- Dialog state ---
  // Each dialog is controlled by a separate piece of state because they are
  // independent: form dialog, delete confirmation, preferences sheet, and
  // waivers sheet can each open/close without affecting the others.
  const [formOpen, setFormOpen] = useState(false); // Add/Edit form dialog visibility
  const [editTarget, setEditTarget] = useState<Client | null>(null); // Client being edited, null = adding new
  const [formInitial, setFormInitial] = useState<ClientFormState>(BLANK_FORM); // Pre-filled form values for edit mode
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null); // Client pending delete confirmation
  const [prefsTarget, setPrefsTarget] = useState<Client | null>(null); // Client whose preferences sheet is open
  const [waiversTarget, setWaiversTarget] = useState<Client | null>(null); // Client whose waivers sheet is open

  // .filter() applies all active filters with AND logic — a client must match
  // every active filter to appear. This runs on every render but the client
  // list is small enough (< 1000) that memoization would add complexity
  // without meaningful performance gain.
  const filtered = clients
    .filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      const matchSource = sourceFilter === "All" || sourceBadge(c.source)?.label === sourceFilter;
      const matchVip = !vipOnly || c.vip;
      const matchStage = stageFilter === "all" || c.lifecycleStage === stageFilter;
      return matchSearch && matchSource && matchVip && matchStage;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "visits":
          return b.totalBookings - a.totalBookings;
        case "spend":
          return b.totalSpent - a.totalSpent;
        case "name":
          return a.name.localeCompare(b.name);
        case "recent":
        default:
          // "—" sorts last; otherwise compare as dates descending
          if (a.lastVisit === "—" && b.lastVisit === "—") return 0;
          if (a.lastVisit === "—") return 1;
          if (b.lastVisit === "—") return -1;
          return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
      }
    });

  // Stats reflect the current filtered view so Trini can see segment totals.
  const isFiltered = search !== "" || sourceFilter !== "All" || stageFilter !== "all" || vipOnly;
  const statSource = isFiltered ? filtered : clients;
  const vipCount = statSource.filter((c) => c.vip).length;
  const totalRevenue = statSource.reduce((s, c) => s + c.totalSpent, 0);
  const avgSpend = statSource.length ? Math.round(totalRevenue / statSource.length) : 0;

  // Reset form to blank and open the dialog in "add" mode.
  const openAdd = () => {
    setEditTarget(null);
    setFormInitial(BLANK_FORM);
    setFormOpen(true);
  };

  // Pre-fill the form with the selected client's data and open in "edit" mode.
  // Splits the full name back into first/last so the two-field form works.
  const openEdit = (c: Client) => {
    setEditTarget(c);
    // Destructuring with rest syntax to split "Jane Doe Smith" into
    // firstName="Jane" and rest=["Doe", "Smith"], then rejoin the rest as lastName.
    // This handles multi-word last names (e.g., "Van Der Berg").
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

  // Persist a new or edited client. Closes the dialog first, then applies an
  // optimistic update so the card reflects changes immediately. The actual
  // server action (createClient / updateClient) runs inside startTransition
  // so React can reconcile once the mutation settles.
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
      // .filter(Boolean) drops empty strings so a blank lastName doesn't produce a trailing space.
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
        // Ternary: if tags exist, split the comma-separated string into an array
        // of ServiceCategory values via .split() → .map(trim+lowercase) → .filter(Boolean)
        // to strip empty entries from trailing commas. Otherwise, default to empty array.
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

  // Optimistically remove the client from the list, then call the server
  // action. If the server call fails, React will roll back the optimistic state.
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      addOptimistic({ type: "delete", id: targetId });
      await deleteClient(targetId);
    });
  };

  // Cursor-based pagination: fetch the next page of clients starting at the
  // current offset, append to allRows, and update the hasMore flag.
  async function loadMore() {
    setLoadingMore(true);
    try {
      const { rows, hasMore: more } = await fetchClients({ offset: allRows.length });
      // Spread operator appends the new page of rows to the existing array,
      // creating a new array reference so React detects the state change.
      setAllRows((prev) => [...prev, ...rows]);
      setHasMore(more);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Clients</h1>
          <p className="text-sm text-muted mt-0.5">{clients.length} total clients</p>
        </div>
        {activeTab === "clients" && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
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
            onClick={() => handleTabChange(id)}
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

      {activeTab === "loyalty" &&
        (loyaltyLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted">
            Loading loyalty data…
          </div>
        ) : (
          <LoyaltyTab initialLoyalty={mappedLoyalty} initialRewards={initialRewards} />
        ))}

      {activeTab === "clients" && (
        <>
          {/* Stat cards — update with active filter context */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-foreground/6 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-muted" />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {isFiltered ? "Filtered" : "Total"}
                  </p>
                </div>
                <p className="text-2xl font-semibold text-foreground">
                  {isFiltered ? filtered.length : clients.length}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {isFiltered ? `of ${clients.length} clients` : "clients"}
                </p>
              </CardContent>
            </Card>
            <Card className="py-4 gap-0">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-[#d4a574]/10 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-[#d4a574]" />
                  </div>
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
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-foreground/6 flex items-center justify-center">
                    <DollarSign className="w-3.5 h-3.5 text-muted" />
                  </div>
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
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-foreground/6 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-muted" />
                  </div>
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
          <div className="space-y-2.5">
            {/* Search + sort row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
                />
              </div>
              <div className="relative shrink-0">
                <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="pl-8 pr-7 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground appearance-none cursor-pointer"
                >
                  <option value="recent">Most recent</option>
                  <option value="spend">Highest spend</option>
                  <option value="visits">Most visits</option>
                  <option value="name">Name A–Z</option>
                </select>
              </div>
              <span className="text-xs text-muted shrink-0">
                {filtered.length} of {clients.length}
              </span>
            </div>
            {/* Filter pills row */}
            <div className="flex gap-1 flex-wrap items-center">
              {SOURCE_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    sourceFilter === s
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground hover:bg-foreground/5",
                  )}
                >
                  {s}
                </button>
              ))}
              <div className="w-px h-4 bg-border mx-1 shrink-0" />
              {(["all", "prospect", "active", "at_risk", "lapsed", "churned"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStageFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    stageFilter === s
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground hover:bg-foreground/5",
                  )}
                >
                  {s === "all"
                    ? "All stages"
                    : s === "at_risk"
                      ? "At risk"
                      : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <div className="w-px h-4 bg-border mx-1 shrink-0" />
              <button
                onClick={() => setVipOnly(!vipOnly)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  vipOnly
                    ? "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/25"
                    : "text-muted border-transparent hover:text-foreground hover:bg-foreground/5",
                )}
              >
                <Star className={cn("w-3 h-3", vipOnly && "fill-[#d4a574] text-[#d4a574]")} />
                VIP only
              </button>
            </div>
          </div>

          {/* Client grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-muted" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {search || sourceFilter !== "All" || stageFilter !== "all" || vipOnly
                  ? "No clients match your filters"
                  : "No clients yet"}
              </p>
              <p className="text-xs text-muted">
                {search || sourceFilter !== "All" || stageFilter !== "all" || vipOnly
                  ? "Try adjusting your search or filters"
                  : "Add your first client to get started"}
              </p>
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
