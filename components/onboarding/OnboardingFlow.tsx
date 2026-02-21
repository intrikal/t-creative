"use client";

/**
 * OnboardingFlow.tsx — Orchestrator for the multi-step onboarding wizard.
 *
 * ## What this file does
 * This is the top-level controller for the onboarding experience. It manages:
 * - Which step the user is on (a simple index number)
 * - The form state (all answers across all steps live here)
 * - Navigation forward and backward
 * - Saving data to the server when the last step is completed
 * - Handing off the correct step content + side panel to OnboardingShell for rendering
 *
 * It does NOT handle UI layout, animations, or progress bars — that's OnboardingShell's job.
 *
 * ## Two separate flows
 * The wizard has two completely different step sequences based on the user's role:
 *
 * ### Client flow (default)
 * For customers booking beauty services. Collects:
 * name → interests → allergies (conditional) → contact → policies → final preferences
 *
 * ### Assistant flow
 * For staff members invited by the admin. Collects:
 * name → role/skills → shift availability → emergency contact → contact preferences
 *
 * Both flows share `OnboardingShell` for chrome (layout, progress, animations),
 * but have separate form state types and step definitions.
 *
 * ## Component hierarchy
 * OnboardingFlow (this file)
 *   → ClientOnboardingFlow  or  AssistantOnboardingFlow
 *     → OnboardingShell  (layout/chrome)
 *       → StepName, StepInterests, etc.  (individual step forms)
 *       → PanelName, PanelInterests, etc. (decorative right-side panels)
 */
import { useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useForm } from "@tanstack/react-form";
import { saveOnboardingData } from "@/app/onboarding/actions";
import { OnboardingShell } from "./OnboardingShell";
import { PanelAssistantSummary } from "./PanelAssistantSummary";
import {
  PanelName,
  PanelInterests,
  PanelAllergies,
  PanelContact,
  PanelWaiver,
  PanelPhotoConsent,
  PanelRoleSkills,
  PanelShiftAvailability,
  PanelEmergencyContact,
  PanelContactPrefs,
} from "./panels";
import { PanelSummary } from "./PanelSummary";
import { StepAllergies } from "./steps/StepAllergies";
import { StepComplete } from "./steps/StepComplete";
import { StepContact } from "./steps/StepContact";
import { StepContactPrefs } from "./steps/StepContactPrefs";
import { StepEmergencyContact } from "./steps/StepEmergencyContact";
import { StepFinalPrefs } from "./steps/StepFinalPrefs";
import { StepInterests } from "./steps/StepInterests";
import { StepName } from "./steps/StepName";
import { StepPolicies } from "./steps/StepPolicies";
import { StepRoleSkills } from "./steps/StepRoleSkills";
import { StepShiftAvailability } from "./steps/StepShiftAvailability";

/* ------------------------------------------------------------------ */
/*  Client form + types                                                */
/* ------------------------------------------------------------------ */

/**
 * useClientForm — creates the TanStack Form instance for the client onboarding flow.
 *
 * ## What is TanStack Form?
 * A library that manages form state without re-rendering the whole component tree
 * on every keystroke. It tracks field values, validation errors, and dirty/touched
 * state, all scoped to the fields that actually changed.
 *
 * The `defaultValues` object below defines every field the client wizard collects.
 * All values start empty/false and are filled in as the user progresses through steps.
 *
 * ## Field reference
 * - `firstName`         — display name used throughout the app after onboarding
 * - `interests`         — which services the client is interested in; drives step visibility
 * - `allergies`         — shown only if interests include "lash" or "jewelry"
 * - `availability`      — preferred appointment windows (used for scheduling suggestions)
 * - `source`            — how they heard about T Creative (shown as a pill on the client card)
 * - `notifications`     — communication preferences (SMS, email, marketing)
 * - `referral`          — who referred them, or skipped
 * - `waiverAgreed`      — must be true before the wizard advances past the policies step
 * - `cancellationAgreed`— same as above
 * - `photoConsent`      — whether we can use their photos for marketing
 * - `birthday`          — used for birthday promotions
 */
function useClientForm() {
  return useForm({
    defaultValues: {
      firstName: "",
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
 * OnboardingForm — the TypeScript type of the TanStack Form instance.
 *
 * Inferred from the return type of useClientForm() so it always stays in sync
 * with the defaultValues above. Used as a prop type in every client step component.
 */
export type OnboardingForm = ReturnType<typeof useClientForm>;

/* ------------------------------------------------------------------ */
/*  Assistant form + types                                             */
/* ------------------------------------------------------------------ */

/**
 * useAssistantForm — creates the TanStack Form instance for the assistant onboarding flow.
 *
 * Mirrors useClientForm but with staff-specific fields instead of client preferences.
 *
 * ## Field reference
 * - `preferredTitle`        — how they'd like to be listed (e.g. "Lash Artist", "Senior Stylist")
 * - `skills`                — which services they're trained to perform
 * - `experienceLevel`       — junior / mid / senior, used for scheduling and display
 * - `bio`                   — short public-facing bio shown on their staff profile
 * - `shiftAvailability`     — per-day availability for the weekly schedule view
 * - `preferredShiftTime`    — morning / afternoon / evening / flexible
 * - `maxHoursPerWeek`       — optional cap (undefined = no limit)
 * - `emergencyContactName/Phone/Relation` — required by HR before first shift
 * - `certifications`        — completed training certificates (internal and external)
 * - `workStyle`             — whether they work client-facing, back-of-house, or both
 * - `instagramHandle`       — optional, displayed on their public staff card
 * - `notifications`         — same communication preferences as the client form
 */
function useAssistantForm() {
  return useForm({
    defaultValues: {
      firstName: "",
      preferredTitle: "",
      skills: [] as ("lash" | "jewelry" | "crochet" | "consulting")[],
      experienceLevel: "mid" as "junior" | "mid" | "senior",
      bio: "",
      shiftAvailability: {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
      },
      preferredShiftTime: "flexible" as "morning" | "afternoon" | "evening" | "flexible",
      maxHoursPerWeek: undefined as number | undefined,
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
      certifications: [] as (
        | "tcreative_lash"
        | "tcreative_jewelry"
        | "external_lash"
        | "external_jewelry"
      )[],
      workStyle: "both" as "client_facing" | "back_of_house" | "both",
      email: "",
      phone: "",
      instagramHandle: "",
      notifications: { sms: true, email: true, marketing: false },
    },
  });
}

/** AssistantOnboardingForm — TanStack Form instance type for the assistant flow. */
export type AssistantOnboardingForm = ReturnType<typeof useAssistantForm>;

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */

/**
 * StepDef<F> — describes a single wizard step in a type-safe, data-driven way.
 *
 * Rather than writing a giant switch statement or a chain of if/else blocks
 * to decide what to render at each step, we store all the rendering logic in
 * an array of StepDef objects. The flow component just reads `steps[currentIndex]`
 * to know what to show.
 *
 * The generic type parameter `<F>` is the form instance type (either
 * `OnboardingForm` for clients or `AssistantOnboardingForm` for assistants).
 * This ensures TypeScript catches mismatches between the form and the step.
 *
 * ## Properties
 * - `id`     — stable string identifier for this step (used as a React key and
 *              passed to OnboardingShell for step-specific panel logic)
 * - `render` — function that produces the step's main form content; receives
 *              the form instance, an `onNext` callback to advance, and the
 *              1-based step number for display purposes
 * - `panel`  — the decorative right-side panel content shown alongside this step
 *              (a static JSX element — it doesn't change based on form state)
 */
interface StepDef<F> {
  id: string;
  render: (form: F, onNext: () => void, stepNum: number) => ReactNode;
  panel: ReactNode;
}

/**
 * CLIENT_STEPS — the master list of every possible step in the client flow.
 *
 * Note that "allergies" is not always shown — see the `needsAllergies` logic
 * in ClientOnboardingFlow below, which filters this array dynamically.
 * All other steps are always present.
 */
const CLIENT_STEPS: StepDef<OnboardingForm>[] = [
  {
    id: "name",
    render: (form, onNext, n) => <StepName form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelName />,
  },
  {
    id: "interests",
    render: (form, onNext, n) => <StepInterests form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelInterests />,
  },
  {
    // Only included in the active step list when the client selects "lash" or "jewelry"
    id: "allergies",
    render: (form, onNext, n) => <StepAllergies form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelAllergies />,
  },
  {
    id: "contact",
    render: (form, onNext, n) => <StepContact form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelContact />,
  },
  {
    id: "policies",
    render: (form, onNext, n) => <StepPolicies form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelWaiver />,
  },
  {
    id: "final_prefs",
    render: (form, onNext, n) => <StepFinalPrefs form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelPhotoConsent />,
  },
];

/** ASSISTANT_STEP_DEFS — the fixed list of steps in the assistant onboarding flow. */
const ASSISTANT_STEP_DEFS: StepDef<AssistantOnboardingForm>[] = [
  {
    id: "name",
    /**
     * StepName is shared between client and assistant flows — it only reads/writes
     * `firstName`, which exists on both form types. However, TypeScript can't verify
     * this automatically because the two form types are structurally distinct generics.
     * The `as unknown as OnboardingForm` cast sidesteps the type error while keeping
     * the runtime behavior correct: StepName only touches `firstName` regardless.
     */
    render: (form, onNext, n) => (
      <StepName form={form as unknown as OnboardingForm} onNext={onNext} stepNum={n} />
    ),
    panel: <PanelName />,
  },
  {
    id: "role_skills",
    render: (form, onNext, n) => <StepRoleSkills form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelRoleSkills />,
  },
  {
    id: "shift_availability",
    render: (form, onNext, n) => <StepShiftAvailability form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelShiftAvailability />,
  },
  {
    id: "emergency_contact",
    render: (form, onNext, n) => <StepEmergencyContact form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelEmergencyContact />,
  },
  {
    id: "contact_prefs",
    render: (form, onNext, n) => <StepContactPrefs form={form} onNext={onNext} stepNum={n} />,
    panel: <PanelContactPrefs />,
  },
];

/* ------------------------------------------------------------------ */
/*  Step content renderer                                             */
/* ------------------------------------------------------------------ */

/**
 * StepContent — thin wrapper that calls a StepDef's render function inside
 * its own component render, so `form` arrives as a prop rather than being
 * accessed directly as a ref value in the parent's render body. This keeps
 * the react-hooks/refs linter rule satisfied.
 */
function StepContent<F>({
  step,
  form,
  onNext,
  stepNum,
}: {
  step: StepDef<F>;
  form: F;
  onNext: () => void;
  stepNum: number;
}): ReactNode {
  return step.render(form, onNext, stepNum);
}

/* ------------------------------------------------------------------ */
/*  Client onboarding flow                                             */
/* ------------------------------------------------------------------ */

function ClientOnboardingFlow() {
  /**
   * `step` is the current zero-based index into the `steps` array below.
   * When `step >= steps.length`, the wizard is complete and shows the summary screen.
   */
  const [step, setStep] = useState(0);

  /**
   * `direction` tracks whether the user is moving forward (1) or backward (-1).
   * This value is passed to OnboardingShell, which uses it to determine
   * which direction the slide animation should play.
   */
  const [direction, setDirection] = useState(1);

  /** The TanStack Form instance — holds all field values for this wizard run. */
  const form = useClientForm();

  /**
   * `savedRef` is a ref (not state) that acts as a one-shot flag to prevent
   * the save from being triggered more than once.
   *
   * Why a ref and not state?
   * State updates cause re-renders. Setting `saved = true` in state would cause
   * an extra render just before the completion screen, potentially causing
   * flicker or a double-save. A ref changes instantly and silently with no re-render.
   *
   * The `.catch()` resets it to false so a retry is possible if the save fails.
   */
  const savedRef = useRef(false);

  /**
   * Allergies step is conditional — it only appears if the client has selected
   * "lash" or "jewelry" as an interest (those services involve adhesives and metals).
   * We read the current interests value live from the form so this reacts
   * immediately when the user changes their selection on the interests step.
   */
  const interests = form.getFieldValue("interests");
  const needsAllergies = interests.includes("lash") || interests.includes("jewelry");

  /**
   * Dynamically filter the master CLIENT_STEPS list based on whether the
   * allergies step is needed. `useMemo` caches the result so we don't
   * rebuild the array on every render — only when `needsAllergies` changes.
   */
  const steps = useMemo(
    () => CLIENT_STEPS.filter((s) => s.id !== "allergies" || needsAllergies),
    [needsAllergies],
  );

  const totalSteps = steps.length;
  /** The wizard is "complete" once the step index moves past the last step. */
  const isComplete = step >= totalSteps;

  /**
   * `next` — advance to the next step. Wrapped in `useCallback` so it doesn't
   * get recreated on every render (important because it's passed as a prop to
   * every step component; recreating it would unnecessarily re-render them all).
   *
   * When the user completes the LAST step (`nextStep >= totalSteps`), we
   * fire the save immediately and optimistically advance to the completion screen.
   * The `savedRef` flag ensures we only ever save once, even if `next` is
   * somehow called twice rapidly.
   */
  const next = useCallback(() => {
    const nextStep = step + 1;
    setDirection(1);
    setStep(nextStep);
    if (nextStep >= totalSteps && !savedRef.current) {
      savedRef.current = true;
      const values = form.state.values;
      saveOnboardingData(values, "client").catch(() => {
        // If save fails, reset the flag so a retry is possible
        savedRef.current = false;
      });
    }
  }, [step, totalSteps, form]);

  /** `back` — go one step back, but never below step 0 (Math.max guard). */
  const back = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  /** The step object for the current index (undefined when complete). */
  const currentStep = steps[step] as StepDef<OnboardingForm> | undefined;

  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      direction={direction}
      isComplete={isComplete}
      stepId={currentStep?.id}
      // `step + 1` converts 0-based index to 1-based display number for "Step 1 of N"
      stepContent={
        currentStep ? (
          <StepContent step={currentStep} form={form} onNext={next} stepNum={step + 1} />
        ) : null
      }
      panelContent={currentStep?.panel ?? null}
      completionContent={<StepComplete form={form} />}
      completionPanel={<PanelSummary form={form} />}
      onBack={back}
      onNext={next}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Assistant onboarding flow                                          */
/* ------------------------------------------------------------------ */

/**
 * AssistantOnboardingFlow — mirrors ClientOnboardingFlow but uses the
 * assistant form and step definitions. No conditional steps in this flow;
 * all steps are always present.
 *
 * The same savedRef + next/back pattern is used here for the same reasons
 * documented in ClientOnboardingFlow above.
 */
function AssistantOnboardingFlow() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const form = useAssistantForm();
  const savedRef = useRef(false);

  const totalSteps = ASSISTANT_STEP_DEFS.length;
  const isComplete = step >= totalSteps;

  const next = useCallback(() => {
    const nextStep = step + 1;
    setDirection(1);
    setStep(nextStep);
    if (nextStep >= totalSteps && !savedRef.current) {
      savedRef.current = true;
      const values = form.state.values;
      saveOnboardingData(values, "assistant").catch(() => {
        savedRef.current = false;
      });
    }
  }, [step, totalSteps, form]);

  const back = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const currentStep = ASSISTANT_STEP_DEFS[step] as StepDef<AssistantOnboardingForm> | undefined;

  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      direction={direction}
      isComplete={isComplete}
      stepId={currentStep?.id}
      stepContent={
        currentStep ? (
          <StepContent step={currentStep} form={form} onNext={next} stepNum={step + 1} />
        ) : null
      }
      panelContent={currentStep?.panel ?? null}
      /**
       * StepComplete is shared between both flows but needs the client form type
       * as its prop (it was originally built for clients). The cast is safe here
       * because StepComplete only reads `firstName` from the form, which exists
       * on both form types.
       */
      completionContent={<StepComplete form={form as unknown as OnboardingForm} role="assistant" />}
      completionPanel={<PanelAssistantSummary form={form} />}
      onBack={back}
      onNext={next}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

interface OnboardingFlowProps {
  /**
   * Which onboarding sequence to show.
   * - "client" (default): the customer-facing multi-step wizard
   * - "assistant": the staff-facing wizard with shift/skills/HR fields
   *
   * This value comes from the `?role=` query parameter set in the auth callback
   * route, which reads it from either the invite token or the user's existing
   * profile role.
   */
  role?: "client" | "assistant";
}

/**
 * OnboardingFlow — the single component to drop in anywhere you need the wizard.
 *
 * Usage:
 *   <OnboardingFlow role="client" />    ← shows the client flow (default)
 *   <OnboardingFlow role="assistant" /> ← shows the assistant flow
 *
 * Internally delegates to the role-specific sub-component so each flow has
 * its own isolated state and form instance.
 */
export function OnboardingFlow({ role = "client" }: OnboardingFlowProps) {
  if (role === "assistant") return <AssistantOnboardingFlow />;
  return <ClientOnboardingFlow />;
}
