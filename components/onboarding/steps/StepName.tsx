"use client";

/**
 * StepName.tsx — First name input step
 *
 * What: Collects the user's first name via a minimal text input.
 * Why: Personalizes the rest of the onboarding flow and all future
 *      interactions. This is intentionally the first step to create an
 *      immediate sense of a personal, human experience.
 * How: Binds a text input to the form's "firstName" field. Listens for the
 *      Enter key globally so the user can advance without clicking. The input
 *      auto-focuses on mount for immediate typing.
 *
 * Key concepts:
 * - Global keydown listener: Attached to `window` so Enter works even if the
 *   input loses focus. Cleaned up on unmount to prevent memory leaks.
 * - form.Field: TanStack Form's render-prop pattern — it passes field state
 *   (value, error, etc.) and handlers (handleChange, handleBlur) to the child.
 * - The OK button is disabled until the name is non-empty (trimmed).
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — renders this as the first step
 * - components/onboarding/StepPanels.tsx — PanelName is the paired right panel
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
// `type` import: tells TypeScript this import is only used for type-checking,
// not at runtime. It gets stripped out when the code is compiled to JavaScript.
import type { OnboardingForm } from "../OnboardingFlow";

// `interface`: defines the shape of an object in TypeScript. Here it says
// StepProps must have a `form`, an `onNext` function, and a `stepNum` number.
interface StepProps {
  form: OnboardingForm;
  // `() => void` is an arrow function type: takes no arguments, returns nothing.
  onNext: () => void;
  stepNum: number;
}

// Destructuring: `{ form, onNext, stepNum }` unpacks properties from the
// props object so we can use them directly instead of writing `props.form`, etc.
export function StepName({ form, onNext, stepNum }: StepProps) {
  // useRef: creates a persistent reference that survives re-renders without
  // causing new renders. `.current` holds the actual DOM element (or null).
  const inputRef = useRef<HTMLInputElement>(null);

  // useCallback: wraps a function so React reuses the same function instance
  // between renders. Without it, a new function is created every render.
  const handleKeyDown = useCallback(
    // `KeyboardEvent` is a TypeScript type annotation — tells TS this parameter
    // is a keyboard event object, so you get autocomplete for `.key`, etc.
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        // `?.` optional chaining: safely access `.trim()` only if the value
        // isn't null/undefined. Without it, you'd get a runtime crash.
        const val = form.getFieldValue("firstName")?.trim();
        if (val) onNext();
      }
    },
    // Dependency array: useCallback only recreates the function when these
    // values change. If `onNext` or `form` stay the same, the function is reused.
    [onNext, form],
  );

  // useEffect: runs side-effect code after the component renders.
  // The arrow function `() => { ... }` is the effect to run.
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    // Cleanup return: this function runs when the component unmounts or before
    // the effect re-runs. Removes the listener to prevent memory leaks.
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Dependency array: the effect re-runs only when `handleKeyDown` changes.
    // An empty array `[]` would mean "run once on mount only."
  }, [handleKeyDown]);

  useEffect(() => {
    // `inputRef.current` is the actual <input> DOM element (or null).
    // `?.` optional chaining ensures we only call `.focus()` if the ref exists.
    inputRef.current?.focus();
    // Empty dependency array `[]`: this effect runs only once, when the component
    // first mounts (appears on screen).
  }, []);

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
          What should we call you?
        </h1>
        <p className="text-muted text-sm mt-2">We like to keep things personal around here.</p>
      </motion.div>

      {/* Input */}
      {/* form.Field render prop pattern: `{(field) => ...}` passes the field's
          state and handlers as an argument so you can use them inside. */}
      <form.Field name="firstName">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* field.state.value: TanStack Form stores each field's current
                value inside `field.state`. Read it here to display the input.
                field.handleChange: tells TanStack Form "the user typed something."
                field.handleBlur: tells the form "the user clicked away from the input." */}
            <input
              ref={inputRef}
              type="text"
              placeholder="Your first name"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              className="w-full max-w-[300px] px-0 py-2 text-2xl bg-transparent border-b-2 border-foreground/15
                placeholder:text-muted/30 text-foreground
                focus:outline-none focus:border-accent
                transition-colors duration-200"
            />
          </motion.div>
        )}
      </form.Field>

      {/* OK button */}
      <form.Field name="firstName">
        {(field) => {
          const canContinue = field.state.value.trim().length > 0;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-3 pt-2"
            >
              <button
                type="button"
                onClick={onNext}
                disabled={!canContinue}
                // Template literal with `${}`: the backtick string lets you embed
                // JS expressions inside `${ }`. Here it picks a CSS class string
                // based on whether `canContinue` is true or false.
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
          );
        }}
      </form.Field>
    </div>
  );
}
