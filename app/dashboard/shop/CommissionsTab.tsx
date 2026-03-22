"use client";

/** CommissionsTab — client-facing commission requests panel for the Shop dashboard. */

import { useState } from "react";
import { Plus, Package } from "lucide-react";
import type { ClientCommission } from "@/lib/types/commission.types";
import { CommissionRequestDialog } from "./components/CommissionRequestDialog";
import { CommissionCard } from "./components/CommissionCard";

export function CommissionsTab({ commissions }: { commissions: ClientCommission[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted">
          Submit a custom crochet or 3D printing request. We&apos;ll review and send you a quote.
        </p>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New Request
        </button>
      </div>

      {/* Commission list */}
      {commissions.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl">
          <Package className="w-8 h-8 text-muted/40 mx-auto mb-2" />
          <p className="text-sm text-muted">No commission requests yet</p>
          <p className="text-xs text-muted/60 mt-1">Click &quot;New Request&quot; to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {commissions.map((c) => (
            <CommissionCard key={c.id} commission={c} />
          ))}
        </div>
      )}

      {dialogOpen && <CommissionRequestDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
