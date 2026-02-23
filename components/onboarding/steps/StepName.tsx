"use client";

/**
 * StepName.tsx — First/last name input step (step 1 of every flow).
 *
 * What: Two text inputs for first name and last name, arranged side-by-side
 *       on sm+ screens. First name is required (gates the OK button); last
 *       name is optional. If the session has a Google profile, an "identity
 *       chip" (avatar + locked email pill) appears above the inputs.
 *
 * Why first: Starting with the user's name creates an immediate sense of a
 *       personal conversation. It also allows the rest of the onboarding to
 *       address the user by name ("Almost done, Jane!"), which improves
 *       completion rates.
 *
 * Pre-filled from OAuth:
 *       `useClientForm()` in OnboardingFlow.tsx splits the Google full name
 *       ("Jane Smith") into `googleFirst` / `googleLast` and pre-populates the
 *       fields. The user can edit both freely.
 *
 * Enter key flow:
 *       Enter on the first-name input moves focus to last name (via `lastNameRef`).
 *       Enter on last name (or anywhere outside the inputs) advances to the next
 *       step — but only if `firstName.trim()` is non-empty.
 *
 * Shared by all three roles:
 *       This component is used by all three onboarding flows (client, assistant,
 *       admin). For the assistant flow, `form` is cast to `OnboardingForm` since
 *       both forms share the `firstName` field shape.
 *
 * @prop avatarUrl    - Google profile photo URL; optional (no chip rendered if absent)
 * @prop googleName   - Google full name for chip alt text and initial fallback
 * @prop email        - Google email shown in the locked pill; no chip if falsy
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — renders this as step 1 for all roles
 * - components/onboarding/panels/PanelName  — paired right-side panel (via barrel)
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { LuLock, LuMail } from "react-icons/lu";
import type { OnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: OnboardingForm;
  onNext: () => void;
  stepNum: number;
  avatarUrl?: string;
  googleName?: string;
  email?: string;
}

export function StepName({ form, onNext, stepNum, avatarUrl, googleName, email }: StepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        // If focused on firstName, move focus to lastName
        if (target === inputRef.current) {
          e.preventDefault();
          lastNameRef.current?.focus();
          return;
        }
        // Otherwise advance if first name is filled
        const val = form.getFieldValue("firstName")?.trim();
        if (val) onNext();
      }
    },
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
        <p className="text-muted text-sm mt-2">
          Feel free to use a nickname — this is how we&apos;ll greet you.
        </p>
      </motion.div>

      {/* Identity chip — avatar + locked email, same pattern as admin/assistant */}
      {email && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={googleName ?? ""}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <span className="text-accent font-semibold text-sm">
                {googleName?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/8">
            <LuMail className="w-3 h-3 text-muted/40 shrink-0" />
            <span className="text-xs text-muted/60 truncate max-w-[220px]">{email}</span>
            <LuLock className="w-2.5 h-2.5 text-muted/25 shrink-0" />
          </div>
        </motion.div>
      )}

      {/* Name inputs — stacked on mobile, side by side on sm+ */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form.Field name="firstName">
          {(field) => (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="First name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    lastNameRef.current?.focus();
                  }
                }}
                className="w-full sm:max-w-[200px] px-0 py-2 text-2xl bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </motion.div>
          )}
        </form.Field>

        <form.Field name="lastName">
          {(field) => (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <input
                ref={lastNameRef}
                type="text"
                placeholder="Last name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="w-full sm:max-w-[200px] px-0 py-2 text-2xl bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </motion.div>
          )}
        </form.Field>
      </div>

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
