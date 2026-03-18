"use client";

/** PlansTab — membership plan cards with create/edit/toggle controls. */

import { useState, useTransition } from "react";
import { BadgeCheck, CalendarDays, Plus, Scissors, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateMembershipPlan, type MembershipPlan } from "../actions";
import { formatCents } from "./membership-helpers";
import { PlanDialog } from "./PlanDialog";

export function PlansTab({ plans }: { plans: MembershipPlan[] }) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);

  async function handleToggleActive(plan: MembershipPlan) {
    startTransition(async () => {
      await updateMembershipPlan(plan.id, { isActive: !plan.isActive });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {plans.filter((p) => p.isActive).length} active plan
          {plans.filter((p) => p.isActive).length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted">
            No plans yet. Create a plan to start enrolling clients.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "rounded-xl border bg-card p-5 space-y-3",
                plan.isActive ? "border-border" : "border-border/50 opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={cn("w-4 h-4", plan.isActive ? "text-accent" : "text-muted")}
                    />
                    <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                    {!plan.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/8 text-muted border border-foreground/15">
                        Inactive
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-muted mt-0.5">{plan.description}</p>
                  )}
                </div>
                <p className="text-base font-bold text-foreground shrink-0">
                  {formatCents(plan.priceInCents)}
                  <span className="text-xs font-normal text-muted">/mo</span>
                </p>
              </div>

              {/* Highlights */}
              <div className="flex gap-3 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Scissors className="w-3 h-3" />
                  {plan.fillsPerCycle} fill{plan.fillsPerCycle !== 1 ? "s" : ""}/cycle
                </span>
                {plan.productDiscountPercent > 0 && (
                  <span className="flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" />
                    {plan.productDiscountPercent}% off products
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {plan.cycleIntervalDays}d cycle
                </span>
              </div>

              {/* Perks */}
              {plan.perks.length > 0 && (
                <ul className="space-y-0.5">
                  {plan.perks.map((perk, i) => (
                    <li key={i} className="text-xs text-muted flex items-start gap-1.5">
                      <span className="text-accent mt-0.5">·</span>
                      {perk}
                    </li>
                  ))}
                </ul>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditingPlan(plan)}
                  className="flex-1 text-xs font-medium text-muted hover:text-foreground bg-foreground/5 hover:bg-foreground/8 rounded-lg py-1.5 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleActive(plan)}
                  className="flex-1 text-xs font-medium text-muted hover:text-foreground bg-foreground/5 hover:bg-foreground/8 rounded-lg py-1.5 transition-colors"
                >
                  {plan.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanDialog open={createOpen} onClose={() => setCreateOpen(false)} editing={null} />
      {editingPlan && (
        <PlanDialog
          open={!!editingPlan}
          onClose={() => setEditingPlan(null)}
          editing={editingPlan}
        />
      )}
    </div>
  );
}
