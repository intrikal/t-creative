"use client";

import { useState, useTransition } from "react";
import { Plus, RefreshCw, PauseCircle, XCircle, CheckCircle } from "lucide-react";
import { Dialog, DialogFooter, Field, Input, Select, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createSubscription,
  updateSubscriptionStatus,
  type SubscriptionRow,
  type SubscriptionStatus,
  type CreateSubscriptionInput,
} from "./actions";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function intervalLabel(days: number): string {
  if (days === 7) return "Every week";
  if (days === 14) return "Every 2 weeks";
  if (days === 21) return "Every 3 weeks";
  if (days === 30) return "Every month";
  if (days === 42) return "Every 6 weeks";
  if (days === 56) return "Every 8 weeks";
  return `Every ${days} days`;
}

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" },
  paused: { label: "Paused", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" },
  completed: {
    label: "Completed",
    className: "bg-foreground/8 text-foreground border-foreground/15",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const STATUS_FILTERS = ["All", "Active", "Paused", "Completed", "Cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const INTERVAL_OPTIONS = [
  { value: 7, label: "Every week" },
  { value: 14, label: "Every 2 weeks" },
  { value: 21, label: "Every 3 weeks" },
  { value: 30, label: "Every month" },
  { value: 42, label: "Every 6 weeks" },
  { value: 56, label: "Every 8 weeks" },
];

/* ------------------------------------------------------------------ */
/*  Create dialog                                                      */
/* ------------------------------------------------------------------ */

type CreateForm = {
  clientId: string;
  serviceId: string;
  name: string;
  totalSessions: string;
  intervalDays: string;
  pricePerSession: string;
  notes: string;
};

const EMPTY_FORM: CreateForm = {
  clientId: "",
  serviceId: "",
  name: "",
  totalSessions: "6",
  intervalDays: "21",
  pricePerSession: "",
  notes: "",
};

function CreateSubscriptionDialog({
  open,
  onClose,
  clients,
  serviceOptions,
}: {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  serviceOptions: { id: number; name: string; priceInCents: number }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CreateForm>(key: K, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  // Auto-fill price from service selection
  function onServiceChange(serviceId: string) {
    const svc = serviceOptions.find((s) => String(s.id) === serviceId);
    setForm((prev) => ({
      ...prev,
      serviceId,
      pricePerSession: svc ? String(svc.priceInCents / 100) : prev.pricePerSession,
    }));
  }

  const totalSessions = Number(form.totalSessions) || 0;
  const pricePerSession = Math.round((Number(form.pricePerSession) || 0) * 100);
  const totalPaid = totalSessions * pricePerSession;

  const valid =
    form.clientId !== "" &&
    form.serviceId !== "" &&
    form.name.trim() !== "" &&
    totalSessions > 0 &&
    Number(form.intervalDays) > 0 &&
    pricePerSession > 0;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    startTransition(async () => {
      await createSubscription({
        clientId: form.clientId,
        serviceId: Number(form.serviceId),
        name: form.name.trim(),
        totalSessions,
        intervalDays: Number(form.intervalDays),
        pricePerSessionInCents: pricePerSession,
        totalPaidInCents: totalPaid,
        notes: form.notes.trim() || undefined,
      } satisfies CreateSubscriptionInput);
      setSaving(false);
      setForm(EMPTY_FORM);
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Subscription Package"
      description="Create a pre-paid session package for a client."
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client" required>
            <Select value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Service" required>
            <Select value={form.serviceId} onChange={(e) => onServiceChange(e.target.value)}>
              <option value="">Select service…</option>
              {serviceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Package name" required hint='e.g. "6-fill package", "Monthly lash plan"'>
          <Input
            placeholder="6-fill package"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sessions" required>
            <Input
              type="number"
              min={1}
              value={form.totalSessions}
              onChange={(e) => set("totalSessions", e.target.value)}
            />
          </Field>
          <Field label="Interval" required>
            <Select value={form.intervalDays} onChange={(e) => set("intervalDays", e.target.value)}>
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Price / session ($)" required>
            <Input
              type="number"
              min={0}
              step={5}
              placeholder="0"
              value={form.pricePerSession}
              onChange={(e) => set("pricePerSession", e.target.value)}
            />
          </Field>
        </div>
        {totalPaid > 0 && (
          <p className="text-xs text-muted bg-foreground/4 rounded-lg px-3 py-2">
            Total package value:{" "}
            <span className="font-semibold text-foreground">{formatCents(totalPaid)}</span> (
            {totalSessions} × {formatCents(pricePerSession)})
          </p>
        )}
        <Field label="Notes" hint="Payment method, receipt number, any special terms">
          <Textarea
            rows={2}
            placeholder="Prepaid via Venmo on Mar 15…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "Creating…" : "Create Package"}
        disabled={!valid || saving}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export function SubscriptionsPage({
  initialSubscriptions,
  clients,
  serviceOptions,
  embedded,
}: {
  initialSubscriptions: SubscriptionRow[];
  clients: { id: string; name: string }[];
  serviceOptions: { id: number; name: string; priceInCents: number }[];
  embedded?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<SubscriptionRow | null>(null);

  const filtered = initialSubscriptions.filter(
    (s) => statusFilter === "All" || STATUS_CONFIG[s.status].label === statusFilter,
  );

  // Summary stats
  const activeCount = initialSubscriptions.filter((s) => s.status === "active").length;
  const totalSessionsSold = initialSubscriptions.reduce((acc, s) => acc + s.totalSessions, 0);
  const totalSessionsUsed = initialSubscriptions.reduce((acc, s) => acc + s.sessionsUsed, 0);
  const totalRevenue = initialSubscriptions.reduce((acc, s) => acc + s.totalPaidInCents, 0);

  async function handleStatusChange(sub: SubscriptionRow, status: SubscriptionStatus) {
    setActionTarget(null);
    startTransition(async () => {
      await updateSubscriptionStatus(sub.id, status);
    });
  }

  return (
    <div className={embedded ? "space-y-6" : "p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6"}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        {!embedded && (
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted mt-0.5">Pre-paid session packages</p>
        </div>
        )}
        <button
          onClick={() => setCreateOpen(true)}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shrink-0${embedded ? " ml-auto" : ""}`}
        >
          <Plus className="w-4 h-4" />
          New Package
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active packages", value: String(activeCount) },
          { label: "Sessions sold", value: String(totalSessionsSold) },
          { label: "Sessions completed", value: String(totalSessionsUsed) },
          { label: "Total revenue", value: formatCents(totalRevenue) },
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

      {/* Filter tabs */}
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

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted">
            {statusFilter === "All"
              ? "No subscription packages yet."
              : `No ${statusFilter.toLowerCase()} packages.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub) => {
            const cfg = STATUS_CONFIG[sub.status];
            const pct = Math.round((sub.sessionsUsed / sub.totalSessions) * 100);
            const isMenuOpen = actionTarget?.id === sub.id;

            return (
              <div
                key={sub.id}
                className="rounded-xl border border-border bg-card px-4 py-3.5 flex items-center gap-4"
              >
                {/* Progress ring / bar */}
                <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-foreground/4 relative">
                  <span className="text-[10px] font-bold text-foreground leading-none">
                    {sub.sessionsUsed}/{sub.totalSessions}
                  </span>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{sub.name}</p>
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
                    {sub.clientName} · {sub.serviceName} · {intervalLabel(sub.intervalDays)}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1 rounded-full bg-foreground/8 overflow-hidden w-40">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Price */}
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-sm font-semibold text-foreground">
                    {formatCents(sub.totalPaidInCents)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatCents(sub.pricePerSessionInCents)}/session
                  </p>
                </div>

                {/* Sessions remaining */}
                <div className="shrink-0 text-center hidden md:block w-20">
                  <p className="text-sm font-semibold text-foreground">{sub.sessionsRemaining}</p>
                  <p className="text-[11px] text-muted">remaining</p>
                </div>

                {/* Actions menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setActionTarget(isMenuOpen ? null : sub)}
                    className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted transition-colors text-xs font-medium"
                  >
                    •••
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-background border border-border rounded-xl shadow-lg py-1 z-20">
                      {sub.status === "active" && (
                        <button
                          onClick={() => handleStatusChange(sub, "paused")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                        >
                          <PauseCircle className="w-3.5 h-3.5" />
                          Pause package
                        </button>
                      )}
                      {sub.status === "paused" && (
                        <button
                          onClick={() => handleStatusChange(sub, "active")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Resume package
                        </button>
                      )}
                      {(sub.status === "active" || sub.status === "paused") && (
                        <button
                          onClick={() => handleStatusChange(sub, "completed")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Mark completed
                        </button>
                      )}
                      {sub.status !== "cancelled" && (
                        <button
                          onClick={() => handleStatusChange(sub, "cancelled")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/8 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel package
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

      <CreateSubscriptionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clients={clients}
        serviceOptions={serviceOptions}
      />
    </div>
  );
}
