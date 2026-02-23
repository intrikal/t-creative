"use client";

/**
 * StepPolicies.tsx — Combined waiver + cancellation policy agreement step.
 *
 * What: A single step that collects two legally distinct agreements:
 *       A. Service waiver (liability, aftercare acknowledgment)
 *       B. Cancellation policy (24-hour notice, late arrivals, no-show fee)
 *       Policy text is shown inline; the full waiver document is shown in the
 *       right-side PanelWaiver. Both toggles must be checked before advancing.
 *
 * Why: Consolidating two consent gates into one step reduces drop-off while
 *      preserving legal coverage. Each toggle is independently tracked so
 *      partial agreement is captured if the user navigates away mid-step.
 *
 * Toggles are two-way: clicking again can un-agree. This is intentional —
 *       the user may want to re-read the policy before confirming. The
 *       `bothAgreed` gate on the OK button is sufficient protection.
 *
 * Keyboard shortcuts:
 * - "A" toggles `waiverAgreed`
 * - "B" toggles `cancellationAgreed`
 * - Enter advances when `bothAgreed` is true
 *
 * Derived value:
 * `bothAgreed = waiverAgreed && cancellationAgreed` is computed each render —
 * no separate `useState` needed because it fully depends on the two existing
 * boolean states.
 *
 * Related files:
 * - components/onboarding/panels/PanelWaiver     — right-side panel (full waiver text)
 * - components/onboarding/OnboardingFlow.tsx      — renders this step
 * - app/onboarding/actions.ts                     — persists waiverAgreed / cancellationAgreed
 * - lib/onboarding-schema.ts                      — validates both booleans
 */
// useState: React hook that creates a piece of state. Returns [currentValue, setterFunction].
// useEffect: React hook that runs side effects (like adding event listeners) after render.
// useCallback: React hook that memoizes a function so it's not recreated every render.
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { OnboardingForm } from "../OnboardingFlow";

// interface: defines a TypeScript type contract — the shape an object must match.
// This says any StepProps object must have these three properties with these types.
interface StepProps {
  form: OnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepPolicies({ form, onNext, stepNum }: StepProps) {
  // Two independent pieces of state — one for each agreement toggle.
  // useState with a lazy initializer: () => ... runs once on first render to compute
  // the initial value, instead of recalculating every render.
  const [waiverAgreed, setWaiverAgreed] = useState(
    // form.getFieldValue() reads a value from the TanStack Form state.
    // "as boolean" is a type assertion — it tells TypeScript to treat the value as a boolean.
    // ?? is the nullish coalescing operator: if the left side is null/undefined, use false.
    () => (form.getFieldValue("waiverAgreed") as boolean) ?? false,
  );
  const [cancellationAgreed, setCancellationAgreed] = useState(
    () => (form.getFieldValue("cancellationAgreed") as boolean) ?? false,
  );

  // Derived value — no need for a separate useState because this can always be
  // computed from the two booleans above. React will recalculate it each render.
  const bothAgreed = waiverAgreed && cancellationAgreed;

  // Both toggles are two-way so users can de-select if they clicked by mistake.
  const handleWaiverAgree = useCallback(() => {
    const next = !waiverAgreed;
    setWaiverAgreed(next);
    form.setFieldValue("waiverAgreed", next);
  }, [form, waiverAgreed]);

  const handleCancellationAgree = useCallback(() => {
    const next = !cancellationAgreed;
    setCancellationAgreed(next);
    form.setFieldValue("cancellationAgreed", next);
  }, [form, cancellationAgreed]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && bothAgreed) onNext();
      if (e.key.toUpperCase() === "A") handleWaiverAgree();
      if (e.key.toUpperCase() === "B") handleCancellationAgree();
    },
    [bothAgreed, onNext, handleWaiverAgree, handleCancellationAgree],
  );

  // useEffect runs after each render. The dependency array [handleKeyDown] means it
  // re-runs only when handleKeyDown changes.
  // The "return () => ..." is a cleanup function — React calls it before the next
  // effect runs (or on unmount) to remove the old event listener.
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-4">
      {/* Step number + arrow header */}
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
          Policies &amp; agreements
        </h1>
        <p className="text-muted text-sm mt-2">Review the waiver on the right, then agree below.</p>
      </motion.div>

      {/* Cancellation policy items — 3 compact items with inline bold titles */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-2"
      >
        {/* .map() iterates over the array and returns a React element for each item.
            The `key` prop helps React track which items changed between renders. */}
        {[
          {
            title: "Approval-based booking",
            desc: "All bookings require confirmation from your artist before they're locked in. You'll hear back within 24 hours.",
          },
          {
            title: "24-hour cancellation notice",
            desc: "Please cancel or reschedule at least 24 hours before your confirmed appointment.",
          },
          {
            title: "Late arrivals",
            desc: "Arriving 15+ minutes late may result in a shortened session or rescheduling.",
          },
          {
            title: "No-show fee",
            desc: "A fee of up to 50% of the service cost may apply for missed appointments.",
          },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.08 }}
          >
            <p className="text-xs text-muted leading-relaxed">
              <span className="font-bold text-foreground">{item.title}:</span> {item.desc}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Toggle A — waiver agreement */}
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={handleWaiverAgree}
        className={`
          group flex items-center gap-3 w-full px-4 py-2.5 rounded-md text-left
          transition-all duration-150 border
          ${
            waiverAgreed
              ? "border-accent bg-accent/5 shadow-sm"
              : "border-foreground/10 hover:border-foreground/20 hover:bg-surface/60"
          }
        `}
      >
        {/* The keyboard-shortcut badge: styled as a small rounded square with
            the letter inside. Changes color when the toggle is active. */}
        <span
          className={`
            inline-flex items-center justify-center w-7 h-7 rounded text-xs font-medium
            border transition-colors duration-150 shrink-0
            ${
              waiverAgreed
                ? "border-accent bg-accent text-white"
                : "border-foreground/15 text-foreground/70 group-hover:border-foreground/25"
            }
          `}
        >
          A
        </span>
        <span className="text-sm text-foreground">I have read and agree to the service waiver</span>
        {/* Animated checkmark — only renders when agreed.
            motion.svg animates the scale from 0 to 1 for a pop-in effect. */}
        {waiverAgreed && (
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

      {/* Toggle B — cancellation agreement */}
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={handleCancellationAgree}
        className={`
          group flex items-center gap-3 w-full px-4 py-2.5 rounded-md text-left
          transition-all duration-150 border
          ${
            cancellationAgreed
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
              cancellationAgreed
                ? "border-accent bg-accent text-white"
                : "border-foreground/15 text-foreground/70 group-hover:border-foreground/25"
            }
          `}
        >
          B
        </span>
        <span className="text-sm text-foreground">I understand the cancellation policy</span>
        {cancellationAgreed && (
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

      {/* OK button — disabled until BOTH agreements are checked */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-3 pt-2"
      >
        <button
          type="button"
          onClick={onNext}
          disabled={!bothAgreed}
          className={`
            inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md
            transition-all duration-200
            ${
              bothAgreed
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
        {bothAgreed && (
          <span className="text-xs text-muted/50">
            press <strong className="text-muted/70">Enter &crarr;</strong>
          </span>
        )}
      </motion.div>
    </div>
  );
}
