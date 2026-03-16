"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  PauseCircle,
  Plus,
  RefreshCw,
  Scissors,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Dialog, DialogFooter, Field, Input, Select, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createMembership,
  createMembershipPlan,
  renewMembership,
  updateMembershipPlan,
  updateMembershipStatus,
  type MembershipPlan,
  type MembershipRow,
  type MembershipStatus,
} from "./actions";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<MembershipStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" },
  paused: { label: "Paused", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  expired: {
    label: "Expired",
    className: "bg-foreground/8 text-foreground border-foreground/15",
  },
};

const STATUS_FILTERS = ["All", "Active", "Paused", "Cancelled", "Expired"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/* ------------------------------------------------------------------ */
/*  Create membership dialog                                           */
/* ------------------------------------------------------------------ */

function CreateMembershipDialog({
  open,
  onClose,
  clients,
  plans,
}: {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  plans: MembershipPlan[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const activePlans = plans.filter((p) => p.isActive);
  const selectedPlan = activePlans.find((p) => String(p.id) === planId);
  const valid = clientId !== "" && planId !== "";

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    try {
      await createMembership({ clientId, planId: Number(planId), notes: notes || undefined });
      setClientId("");
      setPlanId("");
      setNotes("");
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Membership"
      description="Enroll a client in a Lash Club membership. Their cycle starts today."
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client" required>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plan" required>
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Select plan…</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatCents(p.priceInCents)}/mo
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {selectedPlan && (
          <div className="rounded-lg bg-foreground/4 px-3 py-2.5 text-xs text-muted space-y-1">
            <p>
              <span className="font-medium text-foreground">{selectedPlan.fillsPerCycle}</span> fill
              {selectedPlan.fillsPerCycle !== 1 ? "s" : ""} per 30-day cycle
            </p>
            {selectedPlan.productDiscountPercent > 0 && (
              <p>
                <span className="font-medium text-foreground">
                  {selectedPlan.productDiscountPercent}%
                </span>{" "}
                off all retail products
              </p>
            )}
          </div>
        )}
        <Field label="Notes" hint="Payment method, receipt, or any special terms">
          <Textarea
            rows={2}
            placeholder="Paid via Square on Mar 15…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "Enrolling…" : "Enroll Client"}
        disabled={!valid || saving}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Create / edit plan dialog                                          */
/* ------------------------------------------------------------------ */

type PlanForm = {
  name: string;
  slug: string;
  description: string;
  pricePerMonth: string;
  fillsPerCycle: string;
  productDiscountPercent: string;
  perks: string; // newline-separated
};

const EMPTY_PLAN_FORM: PlanForm = {
  name: "",
  slug: "",
  description: "",
  pricePerMonth: "",
  fillsPerCycle: "1",
  productDiscountPercent: "10",
  perks: "",
};

function PlanDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: MembershipPlan | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<PlanForm>(
    editing
      ? {
          name: editing.name,
          slug: editing.slug,
          description: editing.description ?? "",
          pricePerMonth: String(editing.priceInCents / 100),
          fillsPerCycle: String(editing.fillsPerCycle),
          productDiscountPercent: String(editing.productDiscountPercent),
          perks: editing.perks.join("\n"),
        }
      : EMPTY_PLAN_FORM,
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PlanForm>(key: K, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  // Auto-generate slug from name when creating
  function onNameChange(val: string) {
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: editing
        ? prev.slug
        : val
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
    }));
  }

  const priceInCents = Math.round((Number(form.pricePerMonth) || 0) * 100);
  const perks = form.perks
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const valid =
    form.name.trim() !== "" &&
    form.slug.trim() !== "" &&
    priceInCents > 0 &&
    Number(form.fillsPerCycle) >= 1;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceInCents,
        fillsPerCycle: Number(form.fillsPerCycle),
        productDiscountPercent: Number(form.productDiscountPercent) || 0,
        perks,
      };
      if (editing) {
        await updateMembershipPlan(editing.id, payload);
      } else {
        await createMembershipPlan({ ...payload, slug: form.slug.trim() });
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Edit: ${editing.name}` : "New Membership Plan"}
      description={
        editing
          ? "Update this plan's details. Existing subscribers keep current entitlements until next renewal."
          : "Define a new Lash Club tier. Clients will be enrolled by admin — there's no self-serve checkout yet."
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan name" required>
            <Input
              placeholder="Lash Club"
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </Field>
          <Field label="Slug" required hint="URL-safe identifier">
            <Input
              placeholder="lash-club"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              disabled={!!editing}
            />
          </Field>
        </div>
        <Field label="Description">
          <Input
            placeholder="One fill per month + 10% off products"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price / month ($)" required>
            <Input
              type="number"
              min={0}
              step={5}
              placeholder="89"
              value={form.pricePerMonth}
              onChange={(e) => set("pricePerMonth", e.target.value)}
            />
          </Field>
          <Field label="Fills per cycle" required>
            <Input
              type="number"
              min={1}
              value={form.fillsPerCycle}
              onChange={(e) => set("fillsPerCycle", e.target.value)}
            />
          </Field>
          <Field label="Product discount (%)" hint="0 = none">
            <Input
              type="number"
              min={0}
              max={100}
              step={5}
              value={form.productDiscountPercent}
              onChange={(e) => set("productDiscountPercent", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Perks" hint="One perk per line — shown on client's membership card">
          <Textarea
            rows={4}
            placeholder={"1 lash fill/month\n10% off all products\nPriority booking"}
            value={form.perks}
            onChange={(e) => set("perks", e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "Saving…" : editing ? "Save Changes" : "Create Plan"}
        disabled={!valid || saving}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Members tab                                                        */
/* ------------------------------------------------------------------ */

function MembersTab({
  memberships,
  plans,
  clients,
}: {
  memberships: MembershipRow[];
  plans: MembershipPlan[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
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
    await updateMembershipStatus(id, status);
    router.refresh();
  }

  async function handleRenew(id: string) {
    setMenuTarget(null);
    await renewMembership(id);
    router.refresh();
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

/* ------------------------------------------------------------------ */
/*  Plans tab                                                          */
/* ------------------------------------------------------------------ */

function PlansTab({ plans }: { plans: MembershipPlan[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);

  async function handleToggleActive(plan: MembershipPlan) {
    await updateMembershipPlan(plan.id, { isActive: !plan.isActive });
    router.refresh();
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

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function MembershipsPage({
  initialMemberships,
  plans,
  clients,
}: {
  initialMemberships: MembershipRow[];
  plans: MembershipPlan[];
  clients: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<"members" | "plans">("members");

  const TABS = [
    { id: "members" as const, label: "Members", icon: CreditCard },
    { id: "plans" as const, label: "Plans", icon: ShieldCheck },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Memberships</h1>
        <p className="text-sm text-muted mt-0.5">Lash Club recurring subscriptions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <MembersTab memberships={initialMemberships} plans={plans} clients={clients} />
      ) : (
        <PlansTab plans={plans} />
      )}
    </div>
  );
}
