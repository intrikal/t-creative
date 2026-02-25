"use client";

import { useState, useTransition } from "react";
import { CheckCircle, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AftercareSection, PolicyEntry } from "./actions";
import {
  updateAftercareSection,
  deleteAftercareSection,
  createAftercareSection,
  updatePolicy as updatePolicyAction,
  deletePolicy as deletePolicyAction,
  createPolicy as createPolicyAction,
} from "./actions";
import { AftercareCard } from "./components/AftercareCard";
import { NewPolicyDialog } from "./components/NewPolicyDialog";
import { NewSectionDialog } from "./components/NewSectionDialog";
import { PolicyCard } from "./components/PolicyCard";

export function AftercarePage({
  initialSections,
  initialPolicies,
}: {
  initialSections: AftercareSection[];
  initialPolicies: PolicyEntry[];
}) {
  const [tab, setTab] = useState<"aftercare" | "policies">("aftercare");
  const [sections, setSections] = useState<AftercareSection[]>(initialSections);
  const [policyList, setPolicyList] = useState<PolicyEntry[]>(initialPolicies);
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newPolicyOpen, setNewPolicyOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleUpdateSection(updated: AftercareSection) {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    startTransition(async () => {
      await updateAftercareSection(updated.id, {
        title: updated.title,
        category: updated.category ?? undefined,
        dos: updated.dos,
        donts: updated.donts,
      });
    });
  }

  function handleDeleteSection(id: number) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    startTransition(async () => {
      await deleteAftercareSection(id);
    });
  }

  function handleCreateSection(title: string) {
    startTransition(async () => {
      await createAftercareSection({ title, dos: [], donts: [] });
      setSections((prev) => [
        ...prev,
        { id: Date.now(), title, category: null, dos: [], donts: [] },
      ]);
    });
  }

  function handleUpdatePolicy(updated: PolicyEntry) {
    setPolicyList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    startTransition(async () => {
      await updatePolicyAction(updated.id, { title: updated.title, content: updated.content });
    });
  }

  function handleDeletePolicy(id: number) {
    setPolicyList((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      await deletePolicyAction(id);
    });
  }

  function handleCreatePolicy(title: string, content: string) {
    startTransition(async () => {
      await createPolicyAction({ title, content });
      setPolicyList((prev) => [...prev, { id: Date.now(), title, content }]);
    });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Aftercare & Policies
          </h1>
          <p className="text-sm text-muted mt-0.5">Client care instructions and studio policies</p>
        </div>
        <button
          onClick={() => (tab === "aftercare" ? setNewSectionOpen(true) : setNewPolicyOpen(true))}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {tab === "aftercare" ? "New Section" : "New Policy"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setTab("aftercare")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            tab === "aftercare"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground",
          )}
        >
          <CheckCircle className="w-3.5 h-3.5" /> Aftercare
        </button>
        <button
          onClick={() => setTab("policies")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            tab === "policies"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground",
          )}
        >
          <FileText className="w-3.5 h-3.5" /> Policies
        </button>
      </div>

      {tab === "aftercare" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Hover any item to edit or remove it. Use the <strong>+ Add</strong> button at the bottom
            of each list to add new instructions.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {sections.map((s) => (
              <AftercareCard
                key={s.id}
                section={s}
                onUpdate={handleUpdateSection}
                onDelete={() => handleDeleteSection(s.id)}
              />
            ))}
            {sections.length === 0 && (
              <div className="col-span-full text-center py-12 border border-dashed border-border rounded-xl">
                <p className="text-sm text-muted">No aftercare sections yet.</p>
                <button
                  onClick={() => setNewSectionOpen(true)}
                  className="mt-2 text-sm text-accent hover:underline"
                >
                  + Add your first section
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "policies" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Click <strong>Edit</strong> on any policy to update it inline.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {policyList.map((p) => (
              <PolicyCard
                key={p.id}
                policy={p}
                onUpdate={handleUpdatePolicy}
                onDelete={() => handleDeletePolicy(p.id)}
              />
            ))}
            {policyList.length === 0 && (
              <div className="col-span-full text-center py-12 border border-dashed border-border rounded-xl">
                <p className="text-sm text-muted">No policies yet.</p>
                <button
                  onClick={() => setNewPolicyOpen(true)}
                  className="mt-2 text-sm text-accent hover:underline"
                >
                  + Add your first policy
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <NewSectionDialog
        key={`section-${newSectionOpen}`}
        open={newSectionOpen}
        onClose={() => setNewSectionOpen(false)}
        onAdd={handleCreateSection}
      />
      <NewPolicyDialog
        key={`policy-${newPolicyOpen}`}
        open={newPolicyOpen}
        onClose={() => setNewPolicyOpen(false)}
        onAdd={handleCreatePolicy}
      />
    </div>
  );
}
