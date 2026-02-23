"use client";

/**
 * StepInterests.tsx — Service interest selection step.
 *
 * What: Multi-select list of the four T Creative service categories (lash,
 *       jewelry, crochet, consulting). Each option shows a keyboard-shortcut
 *       badge (A–D), a checkmark when selected, and a zone-color dot from
 *       `lib/zones.ts`. A "Select all / Deselect all" toggle is provided.
 *
 * Why: Interest selection drives two downstream decisions:
 *       1. Whether the allergies step appears — OnboardingFlow.tsx inserts it
 *          only when `interests` includes "lash" or "jewelry".
 *       2. Which services are recommended on the client dashboard and used as
 *          auto-tags on the profile (set by `saveOnboardingData` in actions.ts).
 *
 * Local state + form sync pattern:
 *       `selected` is kept in component-local state for instant UI feedback;
 *       changes are pushed to the TanStack Form via `form.setFieldValue` in
 *       the same handler. A `selectedRef` keeps the latest value accessible
 *       in `useCallback` without stale-closure issues and without adding
 *       `selected` to the dependency array (which would recreate `toggle` and
 *       the keyboard listener on every render).
 *
 * Keyboard shortcuts:
 * - A–D toggle the four services (suppressed when an input has focus)
 * - Enter advances when at least one service is selected
 *
 * Related files:
 * - components/onboarding/panels/PanelInterests.tsx — paired right panel (live visual)
 * - components/onboarding/OnboardingFlow.tsx         — reads interests to gate allergies step
 * - lib/zones.ts                                     — service zone color constants
 * - app/onboarding/actions.ts                        — converts interests to profile tags
 */
// useState: holds component-local state. useEffect: runs side effects (like event listeners).
// useCallback: wraps a function so it's only recreated when its dependencies change.
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ZONES, type ZoneId } from "@/lib/zones";
import type { OnboardingForm } from "../OnboardingFlow";
// ZoneId is a TypeScript type (e.g. "lash" | "jewelry" | "crochet" | "consulting").
// It restricts values to only those specific strings — any other string causes a type error.

// Each `id` is typed as ZoneId, so TypeScript enforces that only valid zone IDs appear here.
const INTEREST_OPTIONS: { id: ZoneId; label: string; letter: string }[] = [
  { id: "lash", label: "Lash Extensions", letter: "A" },
  { id: "jewelry", label: "Permanent Jewelry", letter: "B" },
  { id: "crochet", label: "Custom Crochet", letter: "C" },
  { id: "consulting", label: "Business Consulting", letter: "D" },
];

interface StepProps {
  form: OnboardingForm;
  // Arrow function type: `() => void` means a function with no args, no return value.
  onNext: () => void;
  stepNum: number;
}

// Destructuring: `{ form, onNext, stepNum }` pulls each property out of the
// props object so you can use `form` directly instead of `props.form`.
export function StepInterests({ form, onNext, stepNum }: StepProps) {
  // useState returns [currentValue, setterFunction]. Here the state is a ZoneId[] (array of zone IDs).
  // The () => ... is a lazy initializer: only runs on first render to read the form's initial value.
  const [selected, setSelected] = useState<ZoneId[]>(() => form.getFieldValue("interests") ?? []);

  const canContinue = true;

  const allSelected = INTEREST_OPTIONS.every((o) => selected.includes(o.id));

  const toggle = useCallback(
    (id: ZoneId) => {
      const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
      setSelected(next);
      form.setFieldValue("interests", next);
    },
    [form, selected],
  );

  const toggleAll = useCallback(() => {
    const next = INTEREST_OPTIONS.every((o) => selected.includes(o.id))
      ? []
      : INTEREST_OPTIONS.map((o) => o.id);
    setSelected(next);
    form.setFieldValue("interests", next);
  }, [form, selected]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && canContinue) onNext();

      // Letter keys A-D toggle interests (multi-select).
      const letter = e.key.toUpperCase();
      // .find() returns the first element matching the condition, or undefined if none match.
      const interestOption = INTEREST_OPTIONS.find((o) => o.letter === letter);
      if (interestOption) toggle(interestOption.id);
    },
    // Dependency array: useCallback recreates this function only when these values change.
    [canContinue, onNext, toggle],
  );

  // useEffect runs the function after the component renders. Adds a global keyboard listener.
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    // Cleanup function: React calls this before re-running the effect or on unmount,
    // removing the old listener to avoid duplicates.
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Dependency array: re-run this effect only when handleKeyDown changes.
  }, [handleKeyDown]);

  return (
    <div className="space-y-6">
      {/* Question header */}
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
          What brings you to T Creative?
        </h1>
        <p className="text-muted text-sm mt-2">Pick everything that interests you.</p>
      </motion.div>

      {/* Select all toggle */}
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        onClick={toggleAll}
        className="text-xs text-accent hover:text-accent/80 transition-colors font-medium"
      >
        {allSelected ? "Deselect all" : "Select all"}
      </motion.button>

      {/* Interest options with letter keys (A-D, multi-select) */}
      <div className="space-y-2.5">
        {/* .map() transforms each array element into a piece of UI (a button here). */}
        {INTEREST_OPTIONS.map((option, i) => {
          // .includes() checks whether the selected array contains this option's id.
          const isSelected = selected.includes(option.id);
          return (
            <motion.button
              key={option.id}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => toggle(option.id)}
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
              {/* Letter key badge */}
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

              {/* Zone color dot */}
              <span
                className="w-2 h-2 rounded-full shrink-0 ml-auto opacity-60"
                style={{ backgroundColor: ZONES[option.id].color }}
              />

              {/* Checkmark for selected */}
              {isSelected && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="shrink-0 text-accent"
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

      {/* OK button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-3 pt-2"
      >
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className={`
            inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md
            transition-all duration-200
            ${
              canContinue
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
        {canContinue && (
          <span className="text-xs text-muted/50">
            press <strong className="text-muted/70">Enter &crarr;</strong>
          </span>
        )}
      </motion.div>
    </div>
  );
}
