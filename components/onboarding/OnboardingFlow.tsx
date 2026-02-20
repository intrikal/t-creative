"use client";

/**
 * OnboardingFlow.tsx — Main orchestrator for the multi-step onboarding wizard
 *
 * What: Manages the entire onboarding experience — tracks which step the user
 *       is on, holds all form state, animates transitions between steps, and
 *       renders the split-panel layout (form on the left, contextual panel
 *       on the right).
 * Why: Centralizes flow control so individual step components stay simple and
 *      focused on their own input. Each step just receives the form and an
 *      `onNext` callback — it doesn't need to know about navigation logic.
 * How: Uses TanStack Form for state management, Framer Motion for slide
 *      animations, and a filtered step array that dynamically adds/removes
 *      the allergies step based on the user's selected interests.
 *
 * Key concepts:
 * - "use client": Marks this as a client component (runs in the browser)
 *   because it uses React hooks (useState, useCallback, etc.) and animations.
 * - Conditional steps: The allergies step only appears if the user selected
 *   "lash" or "jewelry" as interests. The `steps` array is filtered via
 *   `useMemo` so the step count updates automatically.
 * - Split layout: Desktop shows form (left) + contextual panel (right).
 *   Mobile shows only the form. The panel provides visual context for each step.
 * - AnimatePresence: Framer Motion component that handles enter/exit animations
 *   when steps change. The `direction` state controls whether the animation
 *   slides up (forward) or down (backward).
 *
 * Related files:
 * - components/onboarding/steps/*.tsx — individual step form components
 * - components/onboarding/panels/*.tsx — right-side contextual panels
 * - components/onboarding/PanelSummary.tsx — completion summary panel
 * - lib/onboarding-schema.ts — validation schema and step definitions
 */
// useState: stores a value that persists across re-renders (e.g., which step we're on).
// useCallback: wraps a function so it keeps the same identity between renders —
//   prevents child components from unnecessarily re-rendering when passed as a prop.
// useMemo: caches a computed value (like the filtered steps array) and only
//   recalculates when its dependencies change.
// type ReactNode: a TypeScript type representing anything React can render (elements, strings, null, etc.).
//   The `type` keyword imports it as a type only — it's stripped at build time and doesn't add to bundle size.
import { useState, useCallback, useMemo, type ReactNode } from "react";
import { useForm } from "@tanstack/react-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  PanelName,
  PanelInterests,
  PanelAllergies,
  PanelContact,
  PanelWaiver,
  PanelPhotoConsent,
} from "./panels";
import { PanelSummary } from "./PanelSummary";
import { StepAllergies } from "./steps/StepAllergies";
import { StepComplete } from "./steps/StepComplete";
import { StepContact } from "./steps/StepContact";
import { StepFinalPrefs } from "./steps/StepFinalPrefs";
import { StepInterests } from "./steps/StepInterests";
import { StepName } from "./steps/StepName";
import { StepPolicies } from "./steps/StepPolicies";

/**
 * useOnboardingForm — Custom hook that creates and returns a TanStack Form instance.
 *
 * `useForm` from TanStack manages all form state (values, errors, touched fields)
 * in one place. The `defaultValues` object defines every field's initial value AND
 * its TypeScript type — TanStack infers the type from each default value.
 *
 * The `as` keyword (e.g., `[] as ("lash" | "jewelry")[]`) is a TypeScript
 * "type assertion" — it tells TypeScript "this empty array will only ever contain
 * these specific string values." Without it, TypeScript would infer `string[]`
 * which is too broad.
 */
function useOnboardingForm() {
  return useForm({
    defaultValues: {
      firstName: "",
      // `as (...)[]` tells TypeScript this array only holds these exact strings.
      // This is a "union type" — the value can be "lash" OR "jewelry" OR "crochet" OR "consulting".
      interests: [] as ("lash" | "jewelry" | "crochet" | "consulting")[],
      allergies: {
        adhesive: false,
        latex: false,
        nickel: false,
        fragrances: false,
        none: false,
        notes: "",
      },
      email: "",
      phone: "",
      availability: {
        weekdays: false,
        weekends: false,
        mornings: false,
        afternoons: false,
        evenings: false,
      },
      source: "instagram" as
        | "instagram"
        | "word_of_mouth"
        | "google_search"
        | "referral"
        | "website_direct",
      notifications: { sms: true, email: true, marketing: false },
      referral: { referrerName: "", referrerEmail: "", referrerPhone: "", skipped: false },
      waiverAgreed: false,
      cancellationAgreed: false,
      photoConsent: "" as "" | "yes" | "no",
      birthday: "",
    },
  });
}

/**
 * `ReturnType<typeof useOnboardingForm>` is a TypeScript utility type.
 * It automatically extracts the return type of the useOnboardingForm function.
 * This means if we add new form fields, every component using `OnboardingForm`
 * gets updated types automatically — no manual type maintenance.
 *
 * `export type` makes this type available to other files (step components)
 * so they can accept the form as a typed prop.
 */
export type OnboardingForm = ReturnType<typeof useOnboardingForm>;

/**
 * `interface` defines a shape/contract for an object in TypeScript.
 * StepDef describes what every step needs:
 * - id: unique string identifier for the step
 * - render: a function that takes the form, a callback, and step number, and returns JSX
 *   `() => void` means "a function that takes no arguments and returns nothing"
 * - panel: the right-side visual content (a React element)
 */
interface StepDef {
  id: string;
  render: (form: OnboardingForm, onNext: () => void, stepNum: number) => ReactNode;
  panel: ReactNode;
}

/**
 * All possible steps — some are filtered out dynamically at runtime.
 * Each step pairs a form component (render) with a contextual panel (panel).
 * The "allergies" step is conditionally removed if the user hasn't selected
 * lash or jewelry interests — see the `useMemo` filter in OnboardingFlow.
 */
const ALL_STEPS: StepDef[] = [
  // ── Step 1: Welcome ──
  {
    id: "name",
    render: (form, onNext, n) => <StepName form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelName />,
  },
  // ── Step 2: What services interest you ──
  {
    id: "interests",
    render: (form, onNext, n) => <StepInterests form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelInterests />,
  },
  // ── Step 3 (conditional): Allergies — only if lash or jewelry selected ──
  {
    id: "allergies",
    render: (form, onNext, n) => <StepAllergies form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelAllergies />,
  },
  // ── Step 4: Contact — email, phone, availability, notifications ──
  {
    id: "contact",
    render: (form, onNext, n) => <StepContact form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelContact />,
  },
  // ── Step 5: Policies — waiver + cancellation ──
  {
    id: "policies",
    render: (form, onNext, n) => <StepPolicies form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelWaiver />,
  },
  // ── Step 6: Extras — source/referral, photo consent, birthday ──
  {
    id: "final_prefs",
    render: (form, onNext, n) => <StepFinalPrefs form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelPhotoConsent />,
  },
];

// Framer Motion variants for step transitions.
// `d` (direction) is +1 for forward, -1 for back. This makes the slide
// animate downward when going forward and upward when going back,
// giving the user a natural sense of vertical progression.
const slideVariants = {
  enter: (d: number) => ({ y: d > 0 ? "40vh" : "-40vh", opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (d: number) => ({ y: d > 0 ? "-40vh" : "40vh", opacity: 0 }),
};

export function OnboardingFlow() {
  // useState returns a pair: [currentValue, setterFunction].
  // `step` tracks which step index (0, 1, 2...) the user is on.
  // `setStep` is the only way to update it — calling it triggers a re-render.
  const [step, setStep] = useState(0);
  // `direction` is 1 (forward) or -1 (backward) — controls animation direction.
  const [direction, setDirection] = useState(1);

  const form = useOnboardingForm();

  // Track interests to conditionally show allergies step.
  // Re-evaluated each render since form.getFieldValue is always current.
  const interests = form.getFieldValue("interests");
  const needsAllergies = interests.includes("lash") || interests.includes("jewelry");

  // useMemo caches the filtered array and only recalculates when `needsAllergies` changes.
  // Without useMemo, this filter would run on every single render (even if nothing changed).
  // The second argument `[needsAllergies]` is the "dependency array" — React only re-runs
  // the function when values in this array change.
  const steps = useMemo(
    () => ALL_STEPS.filter((s) => s.id !== "allergies" || needsAllergies),
    [needsAllergies],
  );

  const totalSteps = steps.length;
  const isComplete = step >= totalSteps;

  // useCallback wraps a function so React reuses the same function reference
  // between renders. This matters because we pass `next` and `back` as props
  // to child components — without useCallback, a new function would be created
  // every render, causing children to unnecessarily re-render.
  // The empty `[]` dependency array means the function never changes.
  //
  // `setStep((s) => s + 1)` uses the "functional updater" form — `s` is the
  // current value at the time of update, which avoids stale closure bugs.
  const next = useCallback(() => {
    setDirection(1);
    setStep((s) => s + 1);
  }, []);

  const back = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  // `as StepDef | undefined` is a type assertion — tells TypeScript this array
  // access might return undefined (when step index exceeds array length, i.e., completion).
  const currentStep = steps[step] as StepDef | undefined;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background overflow-hidden">
      {/* Progress bar — full width */}
      {!isComplete && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-surface z-20">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ─── Left: form content ─── */}
        <div className="relative flex-1 flex flex-col min-w-0">
          {/* Top spacer for visual balance */}
          {!isComplete && <div className="pt-5" />}

          {/* Step content — vertically centered */}
          <div className="flex-1 flex items-center px-6 sm:px-10 md:px-16 lg:px-20">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep?.id ?? "complete"}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg"
              >
                {currentStep ? (
                  currentStep.render(form, next, step + 1)
                ) : (
                  <StepComplete form={form} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom bar — step counter + navigation arrows */}
          {!isComplete && (
            <div className="flex items-center justify-between px-6 sm:px-10 pb-6">
              <div className="text-xs text-muted/60">
                {step + 1} of {totalSteps}
              </div>
              <div className="flex items-center gap-1">
                {/* Back (up) arrow */}
                <button
                  onClick={back}
                  disabled={step === 0}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                    step === 0
                      ? "text-muted/30 cursor-not-allowed"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                  aria-label="Previous step"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 10l5-5 5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {/* Next (down) arrow */}
                <button
                  onClick={next}
                  className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-surface transition-colors"
                  aria-label="Next step"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 6l5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Right: contextual panel (hidden on mobile) ─── */}
        <div className="hidden md:flex w-[45%] lg:w-1/2 relative bg-surface items-center justify-center p-8 lg:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={isComplete ? "summary" : currentStep?.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-full h-full"
            >
              {isComplete ? <PanelSummary form={form} /> : currentStep?.panel}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
