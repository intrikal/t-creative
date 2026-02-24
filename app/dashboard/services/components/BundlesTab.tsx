"use client";

/**
 * BundlesTab.tsx — Service bundles management panel for the Services dashboard.
 *
 * Contains two components:
 * - `BundleFormDialog` — modal for creating or editing a bundle.
 * - `BundlesTab`       — the full tab panel with the bundle grid.
 *
 * ## Data flow
 * `BundlesTab` receives initial DB rows (`BundleRow[]`) from the server and
 * converts them to UI-friendly `Bundle[]` objects on first render. All mutations
 * call server actions (`createBundle`, `updateBundle`, etc.) then immediately
 * patch local state for optimistic UI — no page reload or `router.refresh()` needed.
 *
 * ## Bundle dialog: service picker
 * The service name picker in `BundleFormDialog` is a free-form multi-select rendered
 * as toggled chips. The `serviceNames` prop is sourced from the parent's live
 * `services` state (not a separate fetch) so it always reflects recently-added services.
 */

import { useState } from "react";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Dialog, Field, Input, Textarea, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BundleRow, BundleInput } from "../bundle-actions";
import { createBundle, updateBundle, deleteBundle, toggleBundleActive } from "../bundle-actions";
import { dbToBundle, BLANK_BUNDLE } from "../types";
import type { Bundle, BundleForm } from "../types";
import { Toggle } from "./Toggle";

/* ------------------------------------------------------------------ */
/*  BundleFormDialog                                                   */
/* ------------------------------------------------------------------ */

/**
 * BundleFormDialog — modal for creating or editing a service bundle.
 *
 * @param open         - Controls dialog visibility.
 * @param onClose      - Called on cancel or close.
 * @param initial      - Pre-populated values for edit mode; `null` for create mode.
 * @param serviceNames - Available service names for the included-services picker.
 *                       Should be the parent's live services list, not a static snapshot.
 * @param onSave       - Called with the validated form state. Parent persists the change.
 */
function BundleFormDialog({
  open,
  onClose,
  initial,
  serviceNames,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: BundleForm | null;
  serviceNames: string[];
  onSave: (f: BundleForm) => void;
}) {
  const [form, setForm] = useState<BundleForm>(initial ?? BLANK_BUNDLE);

  // Keep component out of the DOM when closed so state resets on re-open.
  if (!open) return null;

  function toggleService(name: string) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(name)
        ? prev.services.filter((s) => s !== name)
        : [...prev.services, name],
    }));
  }

  // Bundle is valid when it has a name, at least 2 services, and a non-zero bundle price.
  const canSave = form.name.trim() && form.services.length >= 2 && form.bundlePrice > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? "Edit Bundle" : "New Bundle"}
      description="Group services into a discounted package."
      size="lg"
    >
      <div className="space-y-4">
        <Field label="Bundle Name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. New Client Lash Package"
            autoFocus
          />
        </Field>
        <Field label="Description">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Brief description for clients…"
          />
        </Field>

        <Field label="Included Services" required hint="Select at least 2 services">
          <div className="flex flex-wrap gap-1.5 mt-1 max-h-36 overflow-y-auto">
            {serviceNames.length === 0 ? (
              <p className="text-xs text-muted">No services in your menu yet.</p>
            ) : (
              serviceNames.map((name) => {
                const selected = form.services.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleService(name)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                      selected
                        ? "bg-foreground text-background border-foreground"
                        : "bg-surface border-border text-muted hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {name}
                  </button>
                );
              })
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Original Price ($)" hint="Sum of individual services">
            <Input
              type="number"
              min={0}
              value={form.originalPrice}
              onChange={(e) => setForm((p) => ({ ...p, originalPrice: Number(e.target.value) }))}
            />
          </Field>
          <Field label="Bundle Price ($)" required>
            <Input
              type="number"
              min={0}
              value={form.bundlePrice}
              onChange={(e) => setForm((p) => ({ ...p, bundlePrice: Number(e.target.value) }))}
            />
          </Field>
        </div>

        {/* Live savings preview — only shown when the bundle is actually discounted */}
        {form.originalPrice > 0 &&
          form.bundlePrice > 0 &&
          form.bundlePrice < form.originalPrice && (
            <p className="text-xs text-[#4e6b51]">
              Clients save ${form.originalPrice - form.bundlePrice} (
              {Math.round(((form.originalPrice - form.bundlePrice) / form.originalPrice) * 100)}%
              off)
            </p>
          )}

        <div className="flex items-center justify-between py-1 border-t border-border/50">
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-xs text-muted mt-0.5">
              Inactive bundles won&apos;t appear on your booking page
            </p>
          </div>
          <Toggle on={form.active} onChange={(v) => setForm((p) => ({ ...p, active: v }))} />
        </div>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={() => {
          if (canSave) {
            onSave(form);
            onClose();
          }
        }}
        confirmLabel={initial ? "Save Changes" : "Create Bundle"}
        disabled={!canSave}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  BundlesTab                                                         */
/* ------------------------------------------------------------------ */

/**
 * BundlesTab — displays the full bundles management panel.
 *
 * Renders a grid of bundle cards and manages all CRUD state locally after
 * initial hydration from `initialBundles`. All mutations are optimistic:
 * the local state is updated immediately after the server action resolves.
 *
 * @param initialBundles - Server-fetched bundle rows to hydrate the initial list.
 * @param serviceNames   - Names of active services, used to populate the service picker.
 */
export function BundlesTab({
  initialBundles,
  serviceNames,
}: {
  initialBundles: BundleRow[];
  serviceNames: string[];
}) {
  const [bundles, setBundles] = useState<Bundle[]>(() => initialBundles.map(dbToBundle));
  const [bundleFormOpen, setBundleFormOpen] = useState(false);
  const [editBundle, setEditBundle] = useState<Bundle | null>(null);

  async function handleToggleActive(id: number) {
    const b = bundles.find((x) => x.id === id);
    if (!b) return;
    await toggleBundleActive(id, !b.active);
    setBundles((prev) => prev.map((x) => (x.id === id ? { ...x, active: !x.active } : x)));
  }

  async function handleSave(form: BundleForm) {
    const input: BundleInput = {
      name: form.name,
      description: form.description,
      serviceNames: form.services,
      originalPriceInCents: Math.round(form.originalPrice * 100),
      bundlePriceInCents: Math.round(form.bundlePrice * 100),
      isActive: form.active,
    };
    if (editBundle) {
      const row = await updateBundle(editBundle.id, input);
      setBundles((prev) => prev.map((b) => (b.id === editBundle.id ? dbToBundle(row) : b)));
    } else {
      const row = await createBundle(input);
      setBundles((prev) => [...prev, dbToBundle(row)]);
    }
    setEditBundle(null);
  }

  async function handleDelete(id: number) {
    await deleteBundle(id);
    setBundles((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Service Bundles</h2>
          <p className="text-xs text-muted mt-0.5">
            Combine services into discounted packages to increase bookings.
          </p>
        </div>
        <button
          onClick={() => {
            setEditBundle(null);
            setBundleFormOpen(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Bundle
        </button>
      </div>

      {/* Empty state */}
      {bundles.length === 0 && (
        <p className="text-sm text-muted text-center py-10">
          No bundles yet. Create one to offer discounted service packages.
        </p>
      )}

      {/* Bundle cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {bundles.map((b) => {
          const savings = b.originalPrice - b.bundlePrice;
          const pct = b.originalPrice > 0 ? Math.round((savings / b.originalPrice) * 100) : 0;
          return (
            <div
              key={b.id}
              className={cn(
                "group relative bg-background border rounded-2xl p-4 flex flex-col gap-3 transition-all hover:shadow-sm",
                b.active ? "border-border" : "border-border/40 opacity-60",
              )}
            >
              {/* Name row + hover actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
                    {b.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => {
                      setEditBundle(b);
                      setBundleFormOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
                    title="Edit bundle"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/8 transition-colors"
                    title="Delete bundle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed line-clamp-2">{b.description}</p>

              {/* Included services chips */}
              <div className="flex flex-wrap gap-1">
                {b.services.map((svc, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-surface border border-border text-muted px-2 py-0.5 rounded-full"
                  >
                    {svc}
                  </span>
                ))}
              </div>

              {/* Pricing row */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">${b.bundlePrice}</span>
                {b.originalPrice > 0 && (
                  <span className="text-xs text-muted line-through">${b.originalPrice}</span>
                )}
                {pct > 0 && (
                  <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 px-1.5 py-0.5 rounded-full">
                    Save {pct}%
                  </span>
                )}
              </div>

              {/* Footer: service count + active toggle */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                <span className="text-[10px] text-muted">
                  {b.services.length} service{b.services.length !== 1 ? "s" : ""}
                </span>
                <Toggle on={b.active} onChange={() => handleToggleActive(b.id)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Form dialog — rendered outside the grid to avoid stacking context issues */}
      <BundleFormDialog
        open={bundleFormOpen}
        onClose={() => {
          setBundleFormOpen(false);
          setEditBundle(null);
        }}
        serviceNames={serviceNames}
        initial={
          editBundle
            ? {
                name: editBundle.name,
                description: editBundle.description,
                services: editBundle.services,
                originalPrice: editBundle.originalPrice,
                bundlePrice: editBundle.bundlePrice,
                active: editBundle.active,
              }
            : null
        }
        onSave={handleSave}
      />
    </div>
  );
}
