"use client";

/**
 * ServicesPage.tsx — Root client component for the Services dashboard section.
 *
 * ## Responsibility
 * This file is intentionally thin. It owns:
 * 1. Top-level tab navigation (Menu / Bundles / Forms & Waivers).
 * 2. The `services` state array that drives the Menu tab and the service-name
 *    picker inside `BundlesTab`.
 * 3. CRUD handlers for services (create, update, delete, toggle active).
 * 4. The "Import Catalog" seed banner (shown only when no services exist yet).
 * 5. Stat cards and filter controls for the Menu tab.
 *
 * Everything else is delegated to co-located components:
 *   - `ServiceCard`       — individual service card
 *   - `ServiceFormDialog` — add/edit modal
 *   - `AddOnsDialog`      — add-on management modal
 *   - `BundlesTab`        — full bundles panel (self-contained CRUD)
 *   - `FormsTab`          — full forms/waivers panel (self-contained CRUD)
 *
 * ## Data flow
 * Initial data is fetched server-side by `app/dashboard/services/page.tsx` and
 * passed as props. After mount, the page maintains its own optimistic state and
 * calls server actions directly on mutations. `router.refresh()` is used only
 * after the seed catalog import, which replaces the entire services list.
 *
 * ## Filter logic
 * Filtering is client-side only (no DB round-trip) since the full service list
 * is small enough to hold in memory (typically < 50 items for a single studio).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Tag, Package, FileText, ToggleLeft, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ServiceRow } from "./actions";
import {
  createService,
  updateService,
  deleteService,
  toggleServiceActive,
  seedServiceCatalog,
} from "./actions";
import type { BundleRow } from "./bundle-actions";
import { AddOnsDialog } from "./components/AddOnsDialog";
import { BundlesTab } from "./components/BundlesTab";
import { FormsTab } from "./components/FormsTab";
import { ServiceCard } from "./components/ServiceCard";
import { ServiceFormDialog } from "./components/ServiceFormDialog";
import type { FormRow } from "./form-actions";
import { CAT_CONFIG, dbToService, serviceToInput, serviceToFormData } from "./types";
import type { Category, Service, ServiceFormData } from "./types";

/* ------------------------------------------------------------------ */
/*  Tab configuration                                                  */
/* ------------------------------------------------------------------ */

const SERVICES_TABS = [
  { id: "menu", label: "Menu", icon: Tag },
  { id: "bundles", label: "Bundles", icon: Package },
  { id: "forms", label: "Forms & Waivers", icon: FileText },
] as const;
type ServicesTab = (typeof SERVICES_TABS)[number]["id"];

const CATEGORY_FILTERS = ["All", "Lash", "Jewelry", "Crochet", "Consulting", "Training"] as const;

/* ------------------------------------------------------------------ */
/*  ServicesPage                                                       */
/* ------------------------------------------------------------------ */

/**
 * ServicesPage — three-tab dashboard for service menu, bundles, and forms.
 *
 * @param initialServices - Services fetched server-side; hydrates the Menu tab.
 * @param initialBundles  - Bundles fetched server-side; passed through to BundlesTab.
 * @param initialForms    - Forms fetched server-side; passed through to FormsTab.
 */
export function ServicesPage({
  initialServices,
  initialBundles,
  initialForms,
}: {
  initialServices: ServiceRow[];
  initialBundles: BundleRow[];
  initialForms: FormRow[];
}) {
  const router = useRouter();

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<ServicesTab>("menu");

  /* ── Service list state (Menu tab) ── */
  const [services, setServices] = useState<Service[]>(() => initialServices.map(dbToService));

  /* ── Filter state ── */
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  /* ── Dialog state ── */
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [addOnsTarget, setAddOnsTarget] = useState<Service | null>(null);

  /* ── Seed state ── */
  const [seeding, setSeeding] = useState(false);

  /* ── Seed handler ── */
  async function handleSeedCatalog() {
    setSeeding(true);
    try {
      await seedServiceCatalog();
      // Refresh forces the server component to re-fetch and pass updated initialServices.
      router.refresh();
    } finally {
      setSeeding(false);
    }
  }

  /* ── Derived: filtered service list ── */
  const filtered = services.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || CAT_CONFIG[s.category].label === categoryFilter;
    const matchStatus =
      statusFilter === "all" || (statusFilter === "active" ? s.active : !s.active);
    return matchSearch && matchCat && matchStatus;
  });

  /* ── CRUD handlers ── */

  async function handleSave(data: ServiceFormData) {
    const input = serviceToInput(data);
    if (editTarget) {
      const row = await updateService(editTarget.id, input);
      setServices((prev) => prev.map((s) => (s.id === editTarget.id ? dbToService(row) : s)));
    } else {
      const row = await createService(input);
      setServices((prev) => [...prev, dbToService(row)]);
    }
    setEditTarget(null);
  }

  async function handleDelete(id: number) {
    await deleteService(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleToggleActive(id: number) {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    await toggleServiceActive(id, !svc.active);
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }

  /* ── Derived stat values ── */
  const activeCount = services.filter((s) => s.active).length;
  const paidServices = services.filter((s) => s.price > 0);
  const avgPrice =
    paidServices.length > 0
      ? Math.round(paidServices.reduce((a, b) => a + b.price, 0) / paidServices.length)
      : 0;
  const topService =
    services.length > 0 ? [...services].sort((a, b) => b.bookings - a.bookings)[0] : null;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Services</h1>
          <p className="text-sm text-muted mt-0.5">
            Your full service menu — pricing, duration, and staff assignments
          </p>
        </div>
        {activeTab === "menu" && (
          <button
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border -mt-2">
        {SERVICES_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Bundles tab ── */}
      {activeTab === "bundles" && (
        <BundlesTab initialBundles={initialBundles} serviceNames={services.map((s) => s.name)} />
      )}

      {/* ── Forms tab ── */}
      {activeTab === "forms" && <FormsTab initialForms={initialForms} />}

      {/* ── Menu tab ── */}
      {activeTab === "menu" && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Total Services
                </p>
                <p className="text-2xl font-semibold text-foreground mt-1">{services.length}</p>
                <p className="text-xs text-muted mt-1">across 5 categories</p>
              </CardContent>
            </Card>
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="text-[10px] font-medium text-muted uppercase tracking-wide">Active</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{activeCount}</p>
                <p className="text-xs text-muted mt-1">{services.length - activeCount} inactive</p>
              </CardContent>
            </Card>
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Avg Price
                </p>
                <p className="text-2xl font-semibold text-foreground mt-1">${avgPrice}</p>
                <p className="text-xs text-muted mt-1">fixed-price services</p>
              </CardContent>
            </Card>
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Most Booked
                </p>
                {topService ? (
                  <>
                    <p className="text-base font-semibold text-foreground mt-1 truncate">
                      {topService.name}
                    </p>
                    {topService.bookings > 0 && (
                      <p className="text-xs text-[#4e6b51] mt-1">{topService.bookings} bookings</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted mt-1">No services yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Seed catalog banner — only shown when no services exist yet */}
          {services.length === 0 && (
            <div className="flex items-center gap-4 p-4 rounded-xl border border-accent/30 bg-accent/5">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Set up your service menu</p>
                <p className="text-xs text-muted mt-0.5">
                  Import your full catalog — lash, jewelry, crochet, and consulting — in one click.
                </p>
              </div>
              <button
                onClick={handleSeedCatalog}
                disabled={seeding}
                className="shrink-0 px-4 py-2 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {seeding ? "Importing…" : "Import Catalog"}
              </button>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search services…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {CATEGORY_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setCategoryFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    categoryFilter === f
                      ? "bg-foreground text-background"
                      : "bg-surface border border-border text-muted hover:text-foreground hover:bg-foreground/5",
                  )}
                >
                  {f}
                </button>
              ))}
              <div className="w-px h-5 bg-border mx-1" />
              {(["all", "active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                    statusFilter === s
                      ? "bg-foreground text-background"
                      : "bg-surface border border-border text-muted hover:text-foreground hover:bg-foreground/5",
                  )}
                >
                  {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <button
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All");
                  setStatusFilter("all");
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                <ToggleLeft className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* Service grid — grouped by category when "All" is selected */}
          {categoryFilter === "All" ? (
            <div className="space-y-8">
              {(Object.keys(CAT_CONFIG) as Category[]).map((cat) => {
                const catServices = filtered.filter((s) => s.category === cat);
                if (catServices.length === 0) return null;
                const cfg = CAT_CONFIG[cat];
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                      <h2 className="text-sm font-semibold text-foreground">{cfg.label}</h2>
                      <span className="text-xs text-muted">({catServices.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {catServices.map((s) => (
                        <ServiceCard
                          key={s.id}
                          service={s}
                          onEdit={() => {
                            setEditTarget(s);
                            setFormOpen(true);
                          }}
                          onDelete={() => handleDelete(s.id)}
                          onToggleActive={() => handleToggleActive(s.id)}
                          onAddOns={() => setAddOnsTarget(s)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted text-sm">No services found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onEdit={() => {
                    setEditTarget(s);
                    setFormOpen(true);
                  }}
                  onDelete={() => handleDelete(s.id)}
                  onToggleActive={() => handleToggleActive(s.id)}
                  onAddOns={() => setAddOnsTarget(s)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Dialogs — rendered at page level to avoid stacking context issues */}
      <ServiceFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        initial={editTarget ? serviceToFormData(editTarget) : null}
        onSave={handleSave}
      />
      {addOnsTarget && (
        <AddOnsDialog service={addOnsTarget} onClose={() => setAddOnsTarget(null)} />
      )}
    </div>
  );
}
