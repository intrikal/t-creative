"use client";

/**
 * StepAllergies.tsx — Allergy and sensitivity disclosure step.
 *
 * What: Asks the client about four common allergies relevant to lash and
 *       jewelry services (adhesive/glue, latex, nickel/metals, fragrances)
 *       plus a "None of the above" option and an optional free-text notes field.
 *
 * Why: A safety requirement before any lash extension or permanent jewelry
 *      service. Collecting this at onboarding means the studio can flag
 *      sensitivities before every future appointment without re-asking.
 *
 * Conditional step: This component always exists in the codebase but
 *       OnboardingFlow.tsx filters it out of the active steps array when
 *       the client's selected interests don't include "lash" or "jewelry".
 *       If a client later adds those interests, the step is reinstated.
 *
 * Mutual exclusion:
 *       "None of the above" and specific allergies are mutually exclusive.
 *       Selecting "None" clears all specific allergies; selecting any specific
 *       allergy clears "None". This is computed in `toggle()` before calling
 *       `setSelected` + `form.setFieldValue` to avoid React's in-render state
 *       update warning (form.setFieldValue is always called after setSelected,
 *       never inside the state updater).
 *
 * Keyboard shortcuts:
 * - A–D toggle the four specific allergies
 * - E toggles "None of the above"
 * - Enter advances (skipped when the notes textarea is focused)
 *
 * Related files:
 * - components/onboarding/panels/PanelAllergies.tsx — paired right panel (live echo)
 * - components/onboarding/OnboardingFlow.tsx         — conditionally includes this step
 * - lib/onboarding-schema.ts                         — allergies object schema
 * - app/onboarding/actions.ts                        — persists allergies to JSONB
 */
// useState: holds component-local state. useEffect: runs side effects (like event listeners).
// useCallback: wraps a function so it's only recreated when its dependencies change.
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { OnboardingForm } from "../OnboardingFlow";

// `as const` after each field value tells TypeScript to treat it as the literal string
// "adhesive" (not just any string). This enables stricter type checking downstream.
const ALLERGY_OPTIONS = [
  { field: "adhesive" as const, label: "Adhesive / Lash Glue", letter: "A" },
  { field: "latex" as const, label: "Latex", letter: "B" },
  { field: "nickel" as const, label: "Nickel / Metals", letter: "C" },
  { field: "fragrances" as const, label: "Fragrances", letter: "D" },
  { field: "none" as const, label: "None of the above", letter: "E" },
];

interface StepProps {
  form: OnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepAllergies({ form, onNext, stepNum }: StepProps) {
  // useState returns a pair: [currentValue, setterFunction].
  // Record<string, boolean> is a TypeScript utility type meaning "an object where
  // every key is a string and every value is a boolean" — like { adhesive: true, latex: false }.
  // The () => { ... } is a lazy initializer: the function only runs on the first render,
  // avoiding expensive computation on every re-render.
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const vals: Record<string, boolean> = {};
    for (const o of ALLERGY_OPTIONS) {
      // `as "allergies.adhesive"` is a type assertion — it tells TypeScript to treat this
      // dynamic string as the specific literal type that form.getFieldValue expects.
      // TanStack Form uses strict typing for nested field paths, so we need this workaround.
      vals[o.field] = form.getFieldValue(`allergies.${o.field}` as "allergies.adhesive") ?? false;
    }
    return vals;
  });

  // Object.values(selected) converts { adhesive: true, latex: false } into [true, false].
  // .some(Boolean) returns true if at least one value in the array is true.
  const hasSelection = Object.values(selected).some(Boolean);

  // useCallback wraps this function so React reuses the same function reference between
  // renders. It only creates a new function when [form] (the dependency array) changes.
  // This prevents unnecessary re-renders in child components that receive this function.
  const toggle = useCallback(
    (field: string) => {
      // Compute next state from current `selected` (not an updater fn) so we can
      // call form.setFieldValue AFTER setSelected — never inside the updater.
      // Calling form.setFieldValue inside a setState updater triggers a state update
      // on another component (LocalSubscribe) during render, which React disallows.
      const next: Record<string, boolean> =
        field === "none"
          ? Object.fromEntries(
              ALLERGY_OPTIONS.map((o) => [o.field, o.field === "none" ? !selected.none : false]),
            )
          : { ...selected, [field]: !selected[field], none: false };

      setSelected(next);
      for (const o of ALLERGY_OPTIONS) {
        form.setFieldValue(`allergies.${o.field}` as "allergies.adhesive", next[o.field]);
      }
    },
    [form, selected],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Guard: if the user is typing in the notes text field, don't treat
      // letter keys as toggle shortcuts (e.g., typing "a" shouldn't toggle adhesive).
      // (e.target as HTMLElement) is a type cast — e.target is a generic EventTarget,
      // but we know it's an HTML element, so we cast it to access .tagName.
      // The ?. is optional chaining: if the cast result is null, it returns undefined instead of crashing.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Enter" && hasSelection) onNext();
        return;
      }
      if (e.key === "Enter" && hasSelection) onNext();
      const letter = e.key.toUpperCase();
      // .find() returns the first array element matching the condition, or undefined if none match.
      const option = ALLERGY_OPTIONS.find((o) => o.letter === letter);
      if (option) toggle(option.field);
    },
    // Dependency array: useCallback recreates handleKeyDown only when these values change.
    [hasSelection, onNext, toggle],
  );

  // useEffect runs the function after the component renders. Here it adds a keyboard listener.
  // The dependency array [handleKeyDown] means it re-runs whenever handleKeyDown changes.
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    // The returned function is a cleanup: React calls it before re-running the effect
    // (or when the component unmounts) to remove the old listener and avoid duplicates.
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-accent font-medium">{stepNum}</span>
          <span className="text-accent">&rarr;</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-medium text-foreground leading-snug">
          Any sensitivities we should know about?
        </h1>
        <p className="text-muted text-sm mt-2">
          This helps us keep your experience safe and comfortable.
        </p>
      </motion.div>

      <div className="space-y-2.5">
        {/* .map() transforms each element in the array into a piece of UI (a button here). */}
        {ALLERGY_OPTIONS.map((option, i) => {
          const isSelected = selected[option.field];
          return (
            <motion.button
              key={option.field}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => toggle(option.field)}
              className={`
                group flex items-center gap-3 w-full px-4 py-3 rounded-md text-left
                transition-all duration-150 border
                ${
                  isSelected
                    ? "border-accent bg-accent/5 shadow-sm"
                    : "border-foreground/10 hover:border-foreground/20 hover:bg-surface/60"
                }
              `}
            >
              <span
                className={`
                  inline-flex items-center justify-center w-7 h-7 rounded text-xs font-medium
                  border transition-colors duration-150 shrink-0
                  ${
                    isSelected
                      ? "border-accent bg-accent text-white"
                      : "border-foreground/15 text-foreground/70 group-hover:border-foreground/25"
                  }
                `}
              >
                {option.letter}
              </span>
              <span className="text-sm text-foreground">{option.label}</span>
              {isSelected && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="shrink-0 ml-auto text-accent"
                >
                  <path
                    d="M4 8.5L6.5 11L12 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Notes field — form.Field is a render prop pattern: instead of rendering its own UI,
          it calls the function you pass as children, providing `field` (with state + handlers).
          {(field) => ...} is that function — it receives the field object and returns JSX. */}
      <form.Field name="allergies.notes">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-1"
          >
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Additional notes <span className="normal-case text-muted/60">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Had a reaction to adhesive in 2022, sensitive to certain metals…"
              value={field.state.value ?? ""}
              onChange={(e) => {
                field.handleChange(e.target.value);
                // Auto-grow: reset height then set to scrollHeight so it expands as the user types
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onBlur={field.handleBlur}
              className="w-full sm:max-w-[360px] px-0 py-2 text-sm bg-transparent border-b border-foreground/10
                placeholder:text-muted/30 text-foreground resize-none overflow-hidden
                focus:outline-none focus:border-accent
                transition-colors duration-200 leading-relaxed"
            />
          </motion.div>
        )}
      </form.Field>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-3 pt-2"
      >
        <button
          type="button"
          onClick={onNext}
          disabled={!hasSelection}
          className={`
            inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md
            transition-all duration-200
            ${
              hasSelection
                ? "bg-accent text-white hover:brightness-110 cursor-pointer"
                : "bg-foreground/10 text-muted/50 cursor-not-allowed"
            }
          `}
        >
          OK
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 8.5L6.5 11L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {hasSelection && (
          <span className="text-xs text-muted/50">
            press <strong className="text-muted/70">Enter &crarr;</strong>
          </span>
        )}
      </motion.div>
    </div>
  );
}
