/**
 * SequencesPage — Admin UI for email sequence management.
 *
 * Shows a list of sequences with stats, a create dialog with
 * step builder, and expandable detail with enrolled clients.
 */
"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Mail,
  Play,
  Pause,
  Trash2,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  Send,
  UserCheck,
  MailCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SequenceRow, SequenceDetail, SequenceTrigger } from "./actions";
import {
  createSequence,
  updateSequence,
  deleteSequence,
  getSequences,
  getSequenceDetail,
} from "./actions";

const TRIGGER_LABELS: Record<string, string> = {
  first_booking_completed: "First Booking Completed",
  no_visit_30_days: "No Visit (30 days)",
  no_visit_60_days: "No Visit (60 days)",
  membership_cancelled: "Membership Cancelled",
  new_client_signup: "New Client Signup",
};

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  first_booking_completed: "Triggers when a client completes their very first appointment",
  no_visit_30_days: "Triggers when a client hasn't booked in 30 days",
  no_visit_60_days: "Triggers when a client hasn't booked in 60 days",
  membership_cancelled: "Triggers when a client cancels their membership",
  new_client_signup: "Triggers when a new client creates an account",
};

const TRIGGERS: SequenceTrigger[] = [
  "first_booking_completed",
  "no_visit_30_days",
  "no_visit_60_days",
  "membership_cancelled",
  "new_client_signup",
];

type StepDraft = {
  stepOrder: number;
  delayDays: number;
  subject: string;
  body: string;
};

/* ------------------------------------------------------------------ */
/*  Expanded detail panel                                               */
/* ------------------------------------------------------------------ */

function SequenceDetailPanel({ detail }: { detail: SequenceDetail }) {
  const completedCount = detail.enrollments.filter((e) => e.status === "completed").length;
  const cancelledCount = detail.enrollments.filter((e) => e.status === "cancelled").length;
  const activeCount = detail.enrollments.filter((e) => e.status === "active").length;

  return (
    <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
      {/* Steps timeline */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
          Steps ({detail.steps.length})
        </p>
        <div className="space-y-0">
          {detail.steps.map((step, idx) => {
            const daysSoFar = detail.steps.slice(0, idx + 1).reduce((s, st) => s + st.delayDays, 0);
            return (
              <div key={step.id} className="flex gap-3">
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-accent/12 flex items-center justify-center shrink-0">
                    <Mail className="w-3 h-3 text-accent" />
                  </div>
                  {idx < detail.steps.length - 1 && (
                    <div className="w-px flex-1 bg-border/60 my-1" />
                  )}
                </div>
                {/* Step content */}
                <div className="pb-4 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Step {step.stepOrder}
                    </span>
                    <span className="text-[10px] text-muted">
                      Day {daysSoFar}
                      {step.delayDays > 0 && idx > 0 && ` (+${step.delayDays}d)`}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 mt-0.5 truncate">{step.subject}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enrolled clients */}
      {detail.enrollments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Enrollments ({detail.enrollments.length})
            </p>
            <div className="flex items-center gap-3">
              {activeCount > 0 && (
                <span className="text-[10px] text-[#4e6b51]">{activeCount} active</span>
              )}
              {completedCount > 0 && (
                <span className="text-[10px] text-muted">{completedCount} completed</span>
              )}
              {cancelledCount > 0 && (
                <span className="text-[10px] text-muted">{cancelledCount} cancelled</span>
              )}
            </div>
          </div>
          <div className="space-y-0">
            {detail.enrollments.slice(0, 8).map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2.5 py-2 border-b border-border/40 last:border-0"
              >
                <Avatar size="sm" className="shrink-0">
                  <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                    {e.profileName
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{e.profileName}</p>
                  <p className="text-[10px] text-muted">
                    Step {e.currentStep} of {detail.steps.length} ·{" "}
                    {new Date(e.enrolledAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "border text-[9px] px-1.5 py-0",
                    e.status === "active" && "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
                    e.status === "completed" && "bg-foreground/8 text-muted border-foreground/12",
                    e.status === "cancelled" &&
                      "bg-destructive/8 text-destructive border-destructive/15",
                  )}
                >
                  {e.status}
                </Badge>
              </div>
            ))}
            {detail.enrollments.length > 8 && (
              <p className="text-[10px] text-muted pt-2">+{detail.enrollments.length - 8} more</p>
            )}
          </div>
        </div>
      )}

      {detail.enrollments.length === 0 && (
        <p className="text-xs text-muted/60 py-2">
          No clients enrolled yet. Clients are auto-enrolled when the trigger event fires.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function SequencesPage({ initialData }: { initialData: SequenceRow[] }) {
  const [sequences, setSequences] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<SequenceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<SequenceTrigger>("first_booking_completed");
  const [steps, setSteps] = useState<StepDraft[]>([
    { stepOrder: 1, delayDays: 0, subject: "", body: "" },
  ]);

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { stepOrder: prev.length + 1, delayDays: 3, subject: "", body: "" },
    ]);
  }

  function removeStep(idx: number) {
    setSteps((prev) =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepOrder: i + 1 })),
    );
  }

  function updateStep(idx: number, field: keyof StepDraft, value: string | number) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function refresh() {
    startTransition(async () => {
      const updated = await getSequences();
      setSequences(updated);
    });
  }

  function handleCreate() {
    if (!name.trim() || steps.some((s) => !s.subject.trim() || !s.body.trim())) return;
    startTransition(async () => {
      const result = await createSequence({ name, triggerEvent: trigger, steps });
      if (result.success) {
        setShowCreate(false);
        setName("");
        setSteps([{ stepOrder: 1, delayDays: 0, subject: "", body: "" }]);
        refresh();
      }
    });
  }

  function handleToggle(id: number, currentActive: boolean) {
    startTransition(async () => {
      await updateSequence(id, { isActive: !currentActive });
      refresh();
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteSequence(id);
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      refresh();
    });
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setExpandedDetail(null);
    setLoadingDetail(true);
    try {
      const detail = await getSequenceDetail(id);
      setExpandedDetail(detail);
    } finally {
      setLoadingDetail(false);
    }
  }

  // Stats
  const totalActive = sequences.filter((s) => s.isActive).length;
  const totalEnrollments = sequences.reduce((s, seq) => s + seq.activeEnrollments, 0);
  const totalSteps = sequences.reduce((s, seq) => s + seq.stepCount, 0);

  // Calculate total days for timeline preview
  const totalDays = steps.reduce((sum, s) => sum + s.delayDays, 0);

  const STAT_CARDS = [
    {
      label: "Sequences",
      value: String(sequences.length),
      sub: `${totalActive} active`,
      icon: Mail,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
    },
    {
      label: "Active Enrollments",
      value: String(totalEnrollments),
      sub: "clients in sequences",
      icon: UserCheck,
      iconColor: "text-[#4e6b51]",
      iconBg: "bg-[#4e6b51]/10",
    },
    {
      label: "Total Steps",
      value: String(totalSteps),
      sub: "across all sequences",
      icon: MailCheck,
      iconColor: "text-[#5b8a8a]",
      iconBg: "bg-[#5b8a8a]/10",
    },
    {
      label: "Triggers",
      value: String(new Set(sequences.map((s) => s.triggerEvent)).size),
      sub: `of ${TRIGGERS.length} available`,
      icon: Zap,
      iconColor: "text-[#7a5c10]",
      iconBg: "bg-[#7a5c10]/10",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Email Sequences
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Automated drip campaigns triggered by client lifecycle events
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Sequence
        </button>
      </div>

      {/* Stat cards */}
      {sequences.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STAT_CARDS.map((s) => (
            <Card key={s.label} className="gap-0 py-0">
              <CardContent className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted truncate">
                      {s.label}
                    </p>
                    <p className="text-lg font-semibold text-foreground tracking-tight">
                      {s.value}
                    </p>
                    <p className="text-xs text-muted truncate">{s.sub}</p>
                  </div>
                  <div className={cn("rounded-xl p-2 shrink-0", s.iconBg)}>
                    <s.icon className={cn("w-4 h-4", s.iconColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Create Sequence</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Sequence Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Welcome Series"
                  className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Trigger Event</label>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as SequenceTrigger)}
                  className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                >
                  {TRIGGERS.map((t) => (
                    <option key={t} value={t}>
                      {TRIGGER_LABELS[t]}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted mt-1">{TRIGGER_DESCRIPTIONS[trigger]}</p>
              </div>
            </div>

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted">Steps ({steps.length})</label>
                <span className="text-[10px] text-muted">
                  Total timeline: {totalDays} day{totalDays !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="bg-surface border border-border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Step {step.stepOrder}
                      </span>
                      {steps.length > 1 && (
                        <button
                          onClick={() => removeStep(idx)}
                          className="p-1 text-muted hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted block mb-0.5">
                          Delay (days{idx === 0 ? " after enrollment" : " after previous"})
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={step.delayDays}
                          onChange={(e) => updateStep(idx, "delayDays", Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm bg-white border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted block mb-0.5">Subject</label>
                        <input
                          value={step.subject}
                          onChange={(e) => updateStep(idx, "subject", e.target.value)}
                          placeholder="Email subject..."
                          className="w-full px-2 py-1.5 text-sm bg-white border border-border rounded-md placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted block mb-0.5">
                        Body (HTML supported, use {"{{firstName}}"} and {"{{businessName}}"})
                      </label>
                      <textarea
                        value={step.body}
                        onChange={(e) => updateStep(idx, "body", e.target.value)}
                        rows={3}
                        placeholder="Email body..."
                        className="w-full px-2 py-1.5 text-sm bg-white border border-border rounded-md resize-none placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addStep} className="mt-2 text-xs text-accent hover:underline">
                + Add step
              </button>
            </div>

            {/* Timeline preview */}
            {steps.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted block mb-2">
                  Timeline Preview
                </label>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {steps.map((step, idx) => {
                    const daysSoFar = steps
                      .slice(0, idx + 1)
                      .reduce((s, st) => s + st.delayDays, 0);
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        {idx > 0 && (
                          <div className="flex items-center gap-0.5">
                            <div className="w-6 h-px bg-border" />
                            <span className="text-[9px] text-muted whitespace-nowrap">
                              +{step.delayDays}d
                            </span>
                            <div className="w-6 h-px bg-border" />
                          </div>
                        )}
                        <div className="shrink-0 w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
                          <Mail className="w-3.5 h-3.5 text-accent" />
                        </div>
                        <span className="text-[9px] text-muted whitespace-nowrap">
                          Day {daysSoFar}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={
                  !name.trim() ||
                  steps.some((s) => !s.subject.trim() || !s.body.trim()) ||
                  isPending
                }
                className="px-4 py-2 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Creating..." : "Create Sequence"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sequences list */}
      {sequences.length === 0 && !showCreate ? (
        <Card className="gap-0">
          <CardContent className="px-5 py-16 text-center">
            <Mail className="w-8 h-8 text-foreground/15 mx-auto mb-3" />
            <p className="text-sm text-muted/60 font-medium">No sequences yet</p>
            <p className="text-xs text-muted/40 mt-0.5 max-w-sm mx-auto">
              Create your first automated email sequence to nurture clients after bookings,
              re-engage lapsed visitors, or welcome new signups.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Sequence
            </button>

            {/* Suggested sequences */}
            <div className="mt-8 pt-6 border-t border-border/50 max-w-lg mx-auto">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-3">
                Popular sequences to get started
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {[
                  {
                    name: "Welcome Series",
                    trigger: "New Client Signup",
                    desc: "3-email intro to your services",
                  },
                  {
                    name: "Post-Visit Follow-Up",
                    trigger: "First Booking Completed",
                    desc: "Thank you + aftercare tips",
                  },
                  {
                    name: "Win-Back Campaign",
                    trigger: "No Visit (30 days)",
                    desc: "Re-engage lapsed clients",
                  },
                  {
                    name: "Cancellation Recovery",
                    trigger: "Membership Cancelled",
                    desc: "Offer to reconnect",
                  },
                ].map((s) => (
                  <div
                    key={s.name}
                    className="flex items-start gap-2.5 p-3 rounded-lg border border-border/50 bg-surface/50"
                  >
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Send className="w-3 h-3 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{s.name}</p>
                      <p className="text-[10px] text-muted mt-0.5">{s.trigger}</p>
                      <p className="text-[10px] text-muted/60">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : sequences.length > 0 ? (
        <div className="space-y-3">
          {sequences.map((seq) => {
            const isExpanded = expandedId === seq.id;
            return (
              <Card
                key={seq.id}
                className={cn(
                  "gap-0 hover:shadow-md hover:border-border transition-all",
                  isPending && "opacity-60 pointer-events-none",
                )}
              >
                <CardContent className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <button
                      onClick={() => toggleExpand(seq.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                          seq.isActive ? "bg-[#4e6b51]/12" : "bg-foreground/8",
                        )}
                      >
                        <Mail
                          className={cn("w-4 h-4", seq.isActive ? "text-[#4e6b51]" : "text-muted")}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {seq.name}
                          </p>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-muted shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            className={cn(
                              "text-[9px] px-1.5 py-0 border",
                              seq.isActive
                                ? "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20"
                                : "bg-foreground/8 text-muted border-border",
                            )}
                          >
                            {seq.isActive ? "Active" : "Paused"}
                          </Badge>
                          <span className="text-[10px] text-muted">
                            {TRIGGER_LABELS[seq.triggerEvent] ?? seq.triggerEvent}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center gap-1 text-xs text-muted justify-end">
                          <Clock className="w-3 h-3" />
                          {seq.stepCount} step{seq.stepCount !== 1 ? "s" : ""}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted mt-0.5 justify-end">
                          <Users className="w-3 h-3" />
                          {seq.activeEnrollments} enrolled
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggle(seq.id, seq.isActive)}
                          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
                          title={seq.isActive ? "Pause" : "Activate"}
                        >
                          {seq.isActive ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(seq.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/8 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <>
                      {loadingDetail ? (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <div className="flex items-center gap-2 py-4">
                            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                            <span className="text-xs text-muted">Loading details...</span>
                          </div>
                        </div>
                      ) : expandedDetail ? (
                        <SequenceDetailPanel detail={expandedDetail} />
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* How it works — always visible at the bottom */}
      <Card className="gap-0">
        <CardContent className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-3">
            How sequences work
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Zap,
                title: "Trigger fires",
                desc: "A client lifecycle event (e.g. first booking, 30 days inactive) enrolls the client automatically.",
              },
              {
                icon: Clock,
                title: "Steps send on schedule",
                desc: "Each step sends after its configured delay. Emails are processed daily and respect opt-out preferences.",
              },
              {
                icon: MailCheck,
                title: "Sequence completes",
                desc: "After the final step, the enrollment is marked complete. Clients are never enrolled twice in the same active sequence.",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="w-3.5 h-3.5 text-muted" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{item.title}</p>
                  <p className="text-[10px] text-muted leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
