/**
 * @file VenuesDialog.tsx
 * @description Modal dialog listing all saved venues with inline edit, activate/deactivate,
 *   and add-new-venue actions.
 */

"use client";

import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { VenueRow } from "../actions";
import { VENUE_TYPE_LABELS, centsToDisplay, emptyVenueForm, venueToForm } from "./helpers";
import type { VenueForm } from "./types";
import { VenueFormDialog } from "./VenueFormDialog";

export function VenuesDialog({
  open,
  onClose,
  venues,
  onAdd,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  venues: VenueRow[];
  onAdd: (form: VenueForm) => void;
  onUpdate: (id: number, form: VenueForm, isActive: boolean) => void;
}) {
  /** Whether the "Add Venue" form dialog is open. */
  const [addOpen, setAddOpen] = useState(false);
  /** The venue being edited (null = no edit in progress). */
  const [editingVenue, setEditingVenue] = useState<VenueRow | null>(null);

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Saved Venues" size="lg">
        <div className="space-y-2">
          {venues.length === 0 && (
            <p className="text-sm text-muted text-center py-6">
              No saved venues yet. Add your first venue below.
            </p>
          )}

          {venues.map((v) => (
            <div
              key={v.id}
              className={cn(
                "flex items-start gap-3 px-3 py-2.5 rounded-lg border",
                v.isActive ? "border-border/60" : "border-border/30 opacity-60",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{v.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/8 text-muted border border-foreground/10">
                    {VENUE_TYPE_LABELS[v.venueType]}
                  </span>
                  {!v.isActive && <span className="text-[10px] text-muted italic">Inactive</span>}
                </div>
                {v.address && <p className="text-xs text-muted mt-0.5 truncate">{v.address}</p>}
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {v.defaultTravelFeeInCents != null && v.defaultTravelFeeInCents > 0 && (
                    <span className="text-xs text-muted">
                      Travel: {centsToDisplay(v.defaultTravelFeeInCents)}
                    </span>
                  )}
                  {v.parkingInfo && (
                    <span className="text-xs text-muted">Parking: {v.parkingInfo}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditingVenue(v)}
                  className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted hover:text-foreground transition-colors"
                  aria-label="Edit venue"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onUpdate(v.id, venueToForm(v), !v.isActive)}
                  className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted hover:text-foreground transition-colors text-[11px] font-medium"
                  title={v.isActive ? "Deactivate venue" : "Reactivate venue"}
                >
                  {v.isActive ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-accent hover:bg-accent/5 rounded-lg transition-colors border border-dashed border-accent/30 mt-2"
          >
            <Plus className="w-3.5 h-3.5" /> Add venue
          </button>
        </div>
      </Dialog>

      <VenueFormDialog
        key={`add-${addOpen}`}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        initial={emptyVenueForm()}
        onSave={onAdd}
      />

      {editingVenue && (
        <VenueFormDialog
          key={`edit-${editingVenue.id}`}
          open={!!editingVenue}
          onClose={() => setEditingVenue(null)}
          initial={venueToForm(editingVenue)}
          onSave={(form) => {
            onUpdate(editingVenue.id, form, editingVenue.isActive);
            setEditingVenue(null);
          }}
        />
      )}
    </>
  );
}
