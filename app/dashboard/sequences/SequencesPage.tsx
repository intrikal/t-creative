/**
 * SequencesPage — Admin UI for email sequence management.
 *
 * Shows a list of sequences with stats, a create dialog with
 * step builder, and toggle active/inactive controls.
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SequenceRow, SequenceTrigger } from "./actions";
import { createSequence, updateSequence, deleteSequence, getSequences } from "./actions";

const TRIGGER_LABELS: Record<string, string> = {
  first_booking_completed: "First Booking Completed",
  no_visit_30_days: "No Visit (30 days)",
  no_visit_60_days: "No Visit (60 days)",
  membership_cancelled: "Membership Cancelled",
  new_client_signup: "New Client Signup",
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

export function SequencesPage({ initialData }: { initialData: SequenceRow[] }) {
  const [sequences, setSequences] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
      refresh();
    });
  }

  // Calculate total days for timeline preview
  const totalDays = steps.reduce((sum, s) => sum + s.delayDays, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Email Sequences</h1>
          <p className="text-sm text-muted mt-0.5">
            Automated drip campaigns triggered by client lifecycle events
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Sequence
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Create Sequence</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Sequence Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Welcome Series"
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Trigger Event</label>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as SequenceTrigger)}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground"
                >
                  {TRIGGERS.map((t) => (
                    <option key={t} value={t}>
                      {TRIGGER_LABELS[t]}
                    </option>
                  ))}
                </select>
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
                          className="text-muted hover:text-destructive text-xs"
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
                          className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted block mb-0.5">Subject</label>
                        <input
                          value={step.subject}
                          onChange={(e) => updateStep(idx, "subject", e.target.value)}
                          placeholder="Email subject..."
                          className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md"
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
                        className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md resize-none"
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
                <div className="flex items-center gap-1 overflow-x-auto">
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
                className="px-3 py-1.5 text-xs text-muted hover:text-foreground"
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
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Sequence"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sequences list */}
      {sequences.length === 0 ? (
        <Card className="gap-0">
          <CardContent className="px-5 py-12 text-center">
            <Mail className="w-8 h-8 text-foreground/15 mx-auto mb-2" />
            <p className="text-sm text-muted">No sequences yet</p>
            <p className="text-xs text-muted mt-1">
              Create your first sequence to start automating client outreach
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <Card key={seq.id} className="gap-0">
              <CardContent className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
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
                      <p className="text-sm font-semibold text-foreground truncate">{seq.name}</p>
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
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <Clock className="w-3 h-3" />
                        {seq.stepCount} step{seq.stepCount !== 1 ? "s" : ""}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                        <Users className="w-3 h-3" />
                        {seq.activeEnrollments} active
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(seq.id, seq.isActive)}
                        className="p-1.5 text-muted hover:text-foreground transition-colors"
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
                        className="p-1.5 text-muted hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
