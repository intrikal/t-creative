"use client";

/**
 * StepInterests.tsx — Service interest selection step
 *
 * What: Lets the user pick which T Creative services interest them (lash
 *       extensions, permanent jewelry, custom crochet, business consulting).
 * Why: Determines what content the user sees later and which services to
 *      recommend. Also controls whether the allergies step appears — if the
 *      user picks lash or jewelry, allergies becomes relevant.
 * How: Maintains a local `selected` array synced to the form for interests
 *      (multi-select). Keyboard shortcuts: A-D toggle interests,
 *      Enter advances. A "select all" toggle is provided.
 *
 * Key concepts:
 * - Keyboard shortcuts: Each interest has a letter (A-D) for toggling.
 * - Local state + form sync: `selected` is kept in local state for fast UI
 *   updates, then pushed to the form via `form.setFieldValue`. This avoids
 *   re-rendering the entire form on each toggle.
 * - ZONES import: Used to display a color dot for each service zone.
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — uses interests to conditionally show allergies step
 * - components/onboarding/StepPanels.tsx — PanelInterests is the paired right panel
 * - lib/zones.ts — defines service zone colors and metadata
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

  // Gate continue on at least 1 interest selected.
  // Experience always has a default ("first_time"), so it's always valid.
  const canContinue = selected.length > 0;

  // .map() transforms each option into just its id, producing an array like ["lash", "jewelry", ...].
  const allIds = INTEREST_OPTIONS.map((o) => o.id);
  // .every() returns true only if the condition holds for ALL elements in the array.
  // .includes() checks whether the array contains a specific value.
  const allSelected = allIds.every((id) => selected.includes(id));

  // useCallback wraps the function so React reuses the same reference between renders.
  // It only creates a new function when [form] changes (the dependency array).
  const toggle = useCallback(
    (id: ZoneId) => {
      // Passing a function to setSelected gives you `prev` (the current state).
      setSelected((prev) => {
        // .includes() checks if the id is already selected.
        // .filter() creates a new array with only the elements that pass the test (removing id).
        // [...prev, id] is the spread operator on arrays: copy all items from prev, then add id.
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        form.setFieldValue("interests", next);
        return next;
      });
    },
    [form],
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      // If all are selected, deselect all (empty array); otherwise select all.
      // [...allIds] creates a copy of the array (spreading it into a new one).
      const next = allIds.every((id) => prev.includes(id)) ? [] : [...allIds];
      form.setFieldValue("interests", next);
      return next;
    });
  }, [form, allIds]);

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
