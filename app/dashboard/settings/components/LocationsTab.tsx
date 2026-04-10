"use client";

/**
 * LocationsTab — Admin management of studio locations.
 *
 * Provides a list of all locations (active and inactive) with inline editing,
 * a dialog for creating new locations, and toggle for active/inactive status.
 * Uses `useOptimistic` + `useTransition` for instant UI feedback on mutations.
 *
 * @module settings/components/LocationsTab
 * @see {@link ../../location-actions} — server actions for CRUD
 */

import { type FormEvent, useOptimistic, useRef, useState, useTransition } from "react";
import { MapPin, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LocationRow } from "../../location-actions";
import { createLocation, updateLocation } from "../../location-actions";
import { FieldRow, INPUT_CLASS, Toggle } from "./shared";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TIMEZONES = [
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "America/Anchorage", label: "Alaska (AKST)" },
  { value: "America/Los_Angeles", label: "Pacific (PST)" },
  { value: "America/Denver", label: "Mountain (MST)" },
  { value: "America/Chicago", label: "Central (CST)" },
  { value: "America/New_York", label: "Eastern (EST)" },
  { value: "America/Phoenix", label: "Arizona (MST, no DST)" },
  { value: "America/Puerto_Rico", label: "Atlantic (AST)" },
  { value: "Pacific/Guam", label: "Guam (ChST)" },
];

const EMPTY_FORM: LocationFormData = {
  name: "",
  address: "",
  city: "",
  timezone: "America/Los_Angeles",
  phone: "",
  email: "",
  squareLocationId: "",
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LocationFormData {
  name: string;
  address: string;
  city: string;
  timezone: string;
  phone: string;
  email: string;
  squareLocationId: string;
}

type OptimisticAction =
  | { type: "add"; location: LocationRow }
  | { type: "update"; id: number; location: LocationRow }
  | { type: "toggle_active"; id: number };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LocationsTab({ initial }: { initial: LocationRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [locations, addOptimistic] = useOptimistic<LocationRow[], OptimisticAction>(
    initial,
    (state, action) => {
      switch (action.type) {
        case "add":
          return [...state, action.location];
        case "update":
          return state.map((l) => (l.id === action.id ? action.location : l));
        case "toggle_active":
          return state.map((l) => (l.id === action.id ? { ...l, isActive: !l.isActive } : l));
      }
    },
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const dialogNameRef = useRef<HTMLInputElement>(null);

  /* ── Create handler ── */
  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = formDataToInput(fd);
    if (!input.name.trim()) return;

    setDialogOpen(false);
    startTransition(async () => {
      const row = await createLocation(input);
      addOptimistic({ type: "add", location: row });
    });
  }

  /* ── Update handler ── */
  function handleUpdate(id: number, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = formDataToInput(fd);

    setExpandedId(null);
    startTransition(async () => {
      const row = await updateLocation(id, input);
      addOptimistic({ type: "update", id, location: row });
    });
  }

  /* ── Toggle active handler ── */
  function handleToggleActive(id: number, current: boolean) {
    startTransition(async () => {
      addOptimistic({ type: "toggle_active", id });
      await updateLocation(id, { isActive: !current });
    });
  }

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {locations.filter((l) => l.isActive).length} active of {locations.length} total
        </p>
        <button
          type="button"
          onClick={() => {
            setDialogOpen(true);
            requestAnimationFrame(() => dialogNameRef.current?.focus());
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Location
        </button>
      </div>

      {/* Add Location Dialog */}
      {dialogOpen && (
        <Card className="gap-0 border-accent/30">
          <CardContent className="px-5 pb-5 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">New Location</h3>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="text-muted hover:text-foreground transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <LocationForm
              defaults={EMPTY_FORM}
              nameRef={dialogNameRef}
              onSubmit={handleCreate}
              onCancel={() => setDialogOpen(false)}
              submitLabel="Create"
              isPending={isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Location cards */}
      {locations.length === 0 && !dialogOpen && (
        <Card className="gap-0">
          <CardContent className="px-5 py-10 text-center">
            <MapPin className="w-8 h-8 mx-auto text-muted/40 mb-2" />
            <p className="text-sm text-muted">No locations yet. Add your first studio location.</p>
          </CardContent>
        </Card>
      )}

      {locations.map((loc) => (
        <Card key={loc.id} className="gap-0">
          <CardContent className="px-5 py-4">
            {/* Summary row */}
            <div className="flex items-start justify-between gap-4">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === loc.id ? null : loc.id)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{loc.name}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-medium rounded-full shrink-0",
                      loc.isActive ? "bg-accent/10 text-accent" : "bg-foreground/8 text-muted",
                    )}
                  >
                    {loc.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                {(loc.address || loc.city) && (
                  <p className="text-xs text-muted mt-0.5 ml-6 truncate">
                    {[loc.address, loc.city].filter(Boolean).join(", ")}
                  </p>
                )}
              </button>
              <Toggle
                on={loc.isActive}
                onChange={() => handleToggleActive(loc.id, loc.isActive)}
                aria-label={`Toggle ${loc.name} active status`}
              />
            </div>

            {/* Expanded inline edit */}
            {expandedId === loc.id && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <LocationForm
                  defaults={locationToForm(loc)}
                  onSubmit={(e) => handleUpdate(loc.id, e)}
                  onCancel={() => setExpandedId(null)}
                  submitLabel="Save"
                  isPending={isPending}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LocationForm — reused for create and edit                          */
/* ------------------------------------------------------------------ */

function LocationForm({
  defaults,
  nameRef,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: {
  defaults: LocationFormData;
  nameRef?: React.RefObject<HTMLInputElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FieldRow label="Name *">
        <input
          ref={nameRef}
          name="name"
          type="text"
          required
          defaultValue={defaults.name}
          className={INPUT_CLASS}
          placeholder="e.g. Downtown Studio"
        />
      </FieldRow>
      <FieldRow label="Address">
        <input
          name="address"
          type="text"
          defaultValue={defaults.address}
          className={INPUT_CLASS}
          placeholder="Street address"
        />
      </FieldRow>
      <FieldRow label="City">
        <input
          name="city"
          type="text"
          defaultValue={defaults.city}
          className={INPUT_CLASS}
          placeholder="City"
        />
      </FieldRow>
      <FieldRow label="Timezone">
        <select name="timezone" defaultValue={defaults.timezone} className={INPUT_CLASS}>
          {TIMEZONES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Phone">
        <input
          name="phone"
          type="text"
          defaultValue={defaults.phone}
          className={INPUT_CLASS}
          placeholder="(555) 123-4567"
        />
      </FieldRow>
      <FieldRow label="Email">
        <input
          name="email"
          type="text"
          defaultValue={defaults.email}
          className={INPUT_CLASS}
          placeholder="location@example.com"
        />
      </FieldRow>
      <FieldRow label="Square Location ID">
        <input
          name="squareLocationId"
          type="text"
          defaultValue={defaults.squareLocationId}
          className={INPUT_CLASS}
          placeholder="Optional — for Square sync"
        />
      </FieldRow>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-1.5 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving\u2026" : submitLabel}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formDataToInput(fd: FormData) {
  return {
    name: (fd.get("name") as string) ?? "",
    address: (fd.get("address") as string) || undefined,
    city: (fd.get("city") as string) || undefined,
    timezone: (fd.get("timezone") as string) ?? "America/Los_Angeles",
    phone: (fd.get("phone") as string) || undefined,
    email: (fd.get("email") as string) || undefined,
    squareLocationId: (fd.get("squareLocationId") as string) || undefined,
  };
}

function locationToForm(loc: LocationRow): LocationFormData {
  return {
    name: loc.name,
    address: loc.address ?? "",
    city: loc.city ?? "",
    timezone: loc.timezone,
    phone: loc.phone ?? "",
    email: loc.email ?? "",
    squareLocationId: loc.squareLocationId ?? "",
  };
}
