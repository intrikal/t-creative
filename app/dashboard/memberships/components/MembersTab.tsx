"use client";

/** MembersTab — member list with status filters, stats cards, and action menus. */

import { useState, useTransition } from "react";
import { PauseCircle, Plus, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  renewMembership,
  updateMembershipStatus,
  type MembershipPlan,
  type MembershipRow,
  type MembershipStatus,
} from "../actions";
import {
  formatCents,
  formatDate,
  STATUS_CONFIG,
  STATUS_FILTERS,
  type StatusFilter,
} from "./membership-helpers";
import { CreateMembershipDialog } from "./CreateMembershipDialog";

export function MembersTab({
  memberships,
  plans,
  clients,
}: {
  memberships: MembershipRow[];
  plans: MembershipPlan[];
  clients: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<string | null>(null);

  const filtered = memberships.filter(
    (m) => statusFilter === "All" || STATUS_CONFIG[m.status].label === statusFilter,
  );

  const activeCount = memberships.filter((m) => m.status === "active").length;
  const mrr = memberships
    .filter((m) => m.status === "active")
    .reduce((acc, m) => acc + m.priceInCents, 0);

  async function handleStatusChange(id: string, status: MembershipStatus) {
    setMenuTarget(null);
    startTransition(async () => {
      await updateMembershipStatus(id, status);
    });
  }

  async function handleRenew(id: string) {
    setMenuTarget(null);
    startTransition(async () => {
      await renewMembership(id);
    });
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active members", value: String(activeCount) },
          { label: "Monthly revenue", value: formatCents(mrr) },
          { label: "Total enrolled", value: String(memberships.length) },
          {
            label: "Fills this cycle",
            value: String(
              memberships
                .filter((m) => m.status === "active")
                .reduce((a, m) => a + m.fillsRemainingThisCycle, 0),
            ),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card px-4 py-3 space-y-0.5"
          >
            <p className="text-[11px] text-muted uppercase tracking-wide">{stat.label}</p>
            <p className="text-lg font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + create */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                statusFilter === f
                  ? "bg-accent text-white"
                  : "bg-foreground/5 text-muted hover:bg-foreground/8 hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Enroll Client
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted">
            {statusFilter === "All"
              ? "No memberships yet. Enroll a client to get started."
              : `No ${statusFilter.toLowerCase()} memberships.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const cfg = STATUS_CONFIG[m.status];
            const isMenuOpen = menuTarget === m.id;
            const fillPct = Math.round(
              ((m.fillsPerCycle - m.fillsRemainingThisCycle) / m.fillsPerCycle) * 100,
            );

            return (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-card px-4 py-3.5 flex items-center gap-4"
              >
                {/* Fill indicator */}
                <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-foreground/4">
                  <span className="text-[10px] font-bold text-foreground leading-none text-center">
                    {m.fillsRemainingThisCycle}
                    <br />
                    <span className="text-muted font-normal">left</span>
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{m.clientName}</p>
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
                        cfg.className,
                      )}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {m.planName} · {formatCents(m.priceInCents)}/mo
                    {m.productDiscountPercent > 0 && ` · ${m.productDiscountPercent}% off products`}
                  </p>
                  <div className="mt-2 h-1 rounded-full bg-foreground/8 overflow-hidden w-40">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </div>

                {/* Cycle info */}
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-[11px] text-muted">Renews</p>
                  <p className="text-xs font-medium text-foreground">{formatDate(m.cycleEndsAt)}</p>
                </div>

                {/* Actions menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setMenuTarget(isMenuOpen ? null : m.id)}
                    className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted transition-colors text-xs font-medium"
                  >
                    •••
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-xl shadow-lg py-1 z-20">
                      {m.status === "active" && (
                        <>
                          <button
                            onClick={() => handleRenew(m.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Renew cycle (collected payment)
                          </button>
                          <button
                            onClick={() => handleStatusChange(m.id, "paused")}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                            Pause membership
                          </button>
                        </>
                      )}
                      {m.status === "paused" && (
                        <button
                          onClick={() => handleStatusChange(m.id, "active")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Resume membership
                        </button>
                      )}
                      {m.status !== "cancelled" && m.status !== "expired" && (
                        <button
                          onClick={() => handleStatusChange(m.id, "cancelled")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/8 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel membership
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateMembershipDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clients={clients}
        plans={plans}
      />
    </div>
  );
}
