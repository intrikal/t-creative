"use client";

/**
 * ServiceCard.tsx — Grid card for a single service in the Services → Menu tab.
 *
 * ## Design
 * Each card has a 1px top colour strip (the category's dot colour) to provide
 * a visual grouping cue without relying solely on text labels. Inactive services
 * dim to 60% opacity and soften their border so they recede from active ones.
 *
 * ## Hover actions
 * Edit, Add-ons (Layers icon), and Delete buttons are revealed on hover via
 * CSS opacity, keeping the card visually clean at rest. The delete action shows
 * an in-place confirmation overlay rather than a separate dialog, which avoids
 * nesting dialogs inside cards and feels more contextual.
 *
 * ## Delete confirmation overlay
 * When the user clicks Delete, the card's content is covered by a confirmation
 * panel with Keep / Delete buttons. This approach:
 * - Avoids a separate Dialog (no z-index layering)
 * - Makes the destructive action feel deliberate and reversible
 * - Keeps the confirmation tightly coupled to the specific service card
 */

import { useState } from "react";
import { Pencil, Trash2, Clock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAT_CONFIG, formatPrice, formatDuration } from "../types";
import type { Service } from "../types";
import { Toggle } from "./Toggle";

/**
 * ServiceCard — displays a single service with hover actions and an active toggle.
 *
 * @param service        - The service to display.
 * @param onEdit         - Opens the ServiceFormDialog pre-populated with this service.
 * @param onDelete       - Permanently removes the service (after in-card confirmation).
 * @param onToggleActive - Flips the active/inactive state of the service.
 * @param onAddOns       - Opens the AddOnsDialog for managing this service's add-ons.
 */
export function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggleActive,
  onAddOns,
}: {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onAddOns: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cat = CAT_CONFIG[service.category];

  return (
    <div
      className={cn(
        "group relative bg-background border rounded-2xl flex flex-col transition-all shadow-sm hover:shadow-md overflow-hidden",
        service.active ? "border-border" : "border-border/50 opacity-60",
      )}
    >
      {/* Category colour strip — 4px top accent, uses the category's dot colour */}
      <div className={cn("h-1 w-full shrink-0", cat.dot)} />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Top row: name + hover actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn("text-[10px] font-semibold uppercase tracking-wider mb-0.5", cat.text)}
            >
              {cat.label}
            </p>
            <h3
              className={cn(
                "text-sm font-semibold text-foreground leading-snug",
                !service.active && "text-muted",
              )}
            >
              {service.name}
            </h3>
          </div>

          {/* Hover actions — suppressed when the delete confirmation overlay is visible */}
          {!confirmDelete && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onAddOns}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
                title="Manage add-ons"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/8 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        {service.description && (
          <p className="text-xs text-muted leading-relaxed line-clamp-2">{service.description}</p>
        )}

        {/* Price + duration + deposit chip */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-xl font-semibold text-foreground tracking-tight">
            {formatPrice(service)}
          </span>
          {service.durationMin > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Clock className="w-3 h-3" />
              {formatDuration(service.durationMin)}
            </span>
          )}
          {service.depositOverride !== undefined && service.depositOverride > 0 && (
            <span className="text-[10px] text-[#d4a574] bg-[#d4a574]/10 px-1.5 py-0.5 rounded-full border border-[#d4a574]/20">
              ${service.depositOverride} deposit
            </span>
          )}
        </div>

        {/* Footer: active label + toggle */}
        <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-border/40">
          <span
            className={cn("text-xs font-medium", service.active ? "text-[#4e6b51]" : "text-muted")}
          >
            {service.active ? "Active" : "Inactive"}
          </span>
          <Toggle on={service.active} onChange={onToggleActive} />
        </div>
      </div>

      {/* Delete confirmation overlay — floats above card content */}
      {confirmDelete && (
        <div className="absolute inset-0 bg-background/97 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-3 p-5 z-10">
          <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Delete service?</p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              &ldquo;{service.name}&rdquo; will be permanently removed.
            </p>
          </div>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-foreground/5 transition-colors"
            >
              Keep
            </button>
            <button
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
