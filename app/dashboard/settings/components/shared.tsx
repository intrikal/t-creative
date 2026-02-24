/**
 * Shared UI primitives for Settings tab components.
 *
 * Provides reusable building blocks to keep individual tab files lean:
 * - `Toggle` — animated on/off switch (44×24 px, green when on)
 * - `FieldRow` — responsive label + input wrapper (stacks on mobile)
 * - `ToggleRow` — label + hint text + Toggle, used for boolean settings
 * - `StatefulSaveButton` — "Save" → "Saving…" → "Saved ✓" feedback button
 * - `INPUT_CLASS` / `NUM_INPUT_CLASS` — consistent input styling constants
 *
 * @module settings/components/shared
 */
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        "relative w-10 h-[22px] rounded-full overflow-hidden transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        on ? "bg-accent" : "bg-foreground/20",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
          on ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <label className="text-xs font-medium text-muted sm:w-44 shrink-0">{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function ToggleRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export function StatefulSaveButton({
  label = "Save Changes",
  saving,
  saved,
  onSave,
}: {
  label?: string;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
    >
      <Check className="w-3.5 h-3.5" />
      {saved ? "Saved!" : saving ? "Saving…" : label}
    </button>
  );
}

export const INPUT_CLASS =
  "w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition";

export const NUM_INPUT_CLASS =
  "w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition max-w-[120px]";
