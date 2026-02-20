"use client";

/**
 * StepAllergies.tsx — Allergy and sensitivity disclosure step
 *
 * What: Asks the user about common allergies (adhesive, latex, nickel,
 *       fragrances) and offers a free-text notes field for anything else.
 * Why: Safety requirement for lash and jewelry services. This step is
 *      conditionally shown — it only appears if the user selected "lash"
 *      or "jewelry" in the interests step (filtered in OnboardingFlow).
 * How: Each allergy is a boolean toggle. Selecting "None of the above"
 *      clears all other selections (mutual exclusion). Selecting any
 *      specific allergy clears the "None" option. Keyboard shortcuts
 *      (A-E) toggle options without clicking.
 *
 * Key concepts:
 * - Conditional step: This component always exists in code, but
 *   OnboardingFlow.tsx filters it out of the active step array when
 *   the user hasn't chosen lash/jewelry interests.
 * - Mutual exclusion: "None" and specific allergies are mutually exclusive.
 *   The toggle function handles this logic explicitly.
 * - Keyboard guard: The keydown handler checks if the user is typing in the
 *   notes input field and skips letter-key shortcuts if so (preventing "A"
 *   from toggling adhesive while typing notes).
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — conditionally includes this step
 * - components/onboarding/StepPanels.tsx — PanelAllergies is the paired right panel
 * - lib/onboarding-schema.ts — allergies field schema definition
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
      // Passing a function to setSelected gives you `prev` (the current state).
      // You must return a new object — never mutate `prev` directly.
      setSelected((prev) => {
        let next: Record<string, boolean>;
        if (field === "none") {
          // "None" is mutually exclusive: toggling it ON clears all specific
          // allergies; toggling it OFF leaves everything deselected.
          // Object.fromEntries converts an array of [key, value] pairs back into an object.
          // .map() transforms each option into a [field, boolean] pair.
          next = Object.fromEntries(
            ALLERGY_OPTIONS.map((o) => [o.field, o.field === "none" ? !prev.none : false]),
          );
        } else {
          // Selecting any specific allergy auto-clears the "None" option.
          // Spread operator { ...prev } copies all properties from prev into a new object.
          // [field] is a computed property name — the variable `field` becomes the key.
          // Together, { ...prev, [field]: !prev[field] } means "copy prev, but flip this one field."
          next = { ...prev, [field]: !prev[field], none: false };
        }
        for (const o of ALLERGY_OPTIONS) {
          // Same type assertion workaround as above for TanStack Form's strict field paths.
          form.setFieldValue(`allergies.${o.field}` as "allergies.adhesive", next[o.field]);
        }
        return next;
      });
    },
    [form],
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
          >
            <input
              type="text"
              placeholder="Anything else? (optional)"
              value={field.state.value ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              className="w-full max-w-[360px] px-0 py-2 text-sm bg-transparent border-b border-foreground/10
                placeholder:text-muted/30 text-foreground
                focus:outline-none focus:border-accent
                transition-colors duration-200"
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
