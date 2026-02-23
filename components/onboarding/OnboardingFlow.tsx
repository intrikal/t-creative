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
  PanelAdminWelcome,
  PanelAdminContact,
  PanelAdminSocials,
  PanelAdminStudio,
  PanelAdminComplete,
  PanelAdminServices,
  PanelAdminHours,
  PanelAdminIntake,
  PanelAdminPolicies,
  PanelAdminRewards,
  PanelAssistantPortfolio,
  PanelAssistantPolicies,
} from "./panels";
import { PanelSummary } from "./PanelSummary";
import { StepAdminContact } from "./steps/StepAdminContact";
import { StepAdminHours } from "./steps/StepAdminHours";
import { StepAdminIntake } from "./steps/StepAdminIntake";
import { StepAdminName } from "./steps/StepAdminName";
import { StepAdminPolicies } from "./steps/StepAdminPolicies";
import { StepAdminRewards } from "./steps/StepAdminRewards";
import { StepAdminServices } from "./steps/StepAdminServices";
import { StepAdminSocials } from "./steps/StepAdminSocials";
import { StepAdminStudio } from "./steps/StepAdminStudio";
import { StepAllergies } from "./steps/StepAllergies";
import { StepAssistantPolicies } from "./steps/StepAssistantPolicies";
import { StepAssistantPortfolio } from "./steps/StepAssistantPortfolio";
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
 * Accepts `email` and `googleName` from OAuth so the name/email fields are
 * pre-filled on first render without the assistant having to retype them.
 *
 * ## Field reference
 *
 * ### Identity & role (steps 1–2)
 * - `firstName`             — pre-filled from Google OAuth; editable
 * - `preferredTitle`        — how they'd like to be listed (e.g. "Lash Artist", "Senior Stylist")
 * - `skills`                — which services they're trained to perform
 * - `experienceLevel`       — junior / mid / senior, used for scheduling and display
 * - `bio`                   — short public-facing bio shown on their staff profile
 * - `certifications`        — completed training certificates (internal and external)
 * - `workStyle`             — client-facing, back-of-house, or both
 * - `offersTraining`        — whether they also teach/train other artists
 * - `trainingFormats`       — which training formats they offer (one-on-one, group, online, in-person)
 *
 * ### Availability (step 3)
 * - `availableDefaultStart` — "HH:MM" default shift start across all selected dates
 * - `availableDefaultEnd`   — "HH:MM" default shift end across all selected dates
 * - `availableDates`        — JSON string: string[] of "YYYY-MM-DD" dates they're open
 * - `availableDateOverrides`— JSON string: Record<string, {startTime, endTime}> per-date overrides
 * - `availableLunchBreak`   — whether a lunch break is blocked off during shifts
 * - `availableLunchStart`   — "HH:MM" start of the lunch break
 * - `availableLunchDuration`— duration in minutes as a string (e.g. "30", "45", "60")
 *
 * ### Emergency contact (step 4)
 * - `emergencyContactName/Phone/Relation` — required by HR before first shift
 *
 * ### Portfolio & socials (step 5)
 * - `portfolioInstagram`    — portfolio Instagram handle (may differ from personal)
 * - `tiktokHandle`          — TikTok handle
 * - `portfolioWebsite`      — personal or business website URL
 *
 * ### Contact & notifications (step 6)
 * - `email`                 — pre-filled from Supabase session; editable
 * - `phone`                 — optional phone number
 * - `instagramHandle`       — personal Instagram, displayed on the staff card
 * - `notifications`         — sms / email / marketing communication preferences
 *
 * ### Policies (step 7)
 * - `policyClientPhotos`    — consent to use client photos for marketing
 * - `policyConfidentiality` — agreement to keep client data private
 * - `policyConduct`         — agreement to studio conduct standards
 * - `policyCompensation`    — acknowledgment of compensation structure
 */
function useAssistantForm(email: string, googleName: string) {
  return useForm({
    defaultValues: {
      firstName: googleName,
      preferredTitle: "",
      skills: [] as ("lash" | "jewelry" | "crochet" | "consulting")[],
      experienceLevel: "mid" as "junior" | "mid" | "senior",
      bio: "",
      availableDefaultStart: "09:00",
      availableDefaultEnd: "17:00",
      availableDates: "[]",
      availableDateOverrides: "{}",
      availableLunchBreak: false,
      availableLunchStart: "12:00",
      availableLunchDuration: "30",
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
      email,
      phone: "",
      instagramHandle: "",
      notifications: { sms: true, email: true, marketing: false },
      offersTraining: false,
      trainingFormats: [] as ("one_on_one" | "group" | "online" | "in_person")[],
      portfolioInstagram: "",
      tiktokHandle: "",
      portfolioWebsite: "",
      policyClientPhotos: false,
      policyConfidentiality: false,
      policyConduct: false,
      policyCompensation: false,
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

// ASSISTANT_STEP_DEFS is now built inside AssistantOnboardingFlow so panels can
// access the live form instance via form.Subscribe. See AssistantOnboardingFlow below.

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
function AssistantOnboardingFlow({
  email,
  googleName,
  avatarUrl,
}: {
  email: string;
  googleName: string;
  avatarUrl: string;
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const form = useAssistantForm(email, googleName);
  const savedRef = useRef(false);

  const ASSISTANT_STEPS: StepDef<AssistantOnboardingForm>[] = [
    {
      id: "name",
      render: (f, onNext, n) => (
        <StepName form={f as unknown as OnboardingForm} onNext={onNext} stepNum={n} />
      ),
      panel: <PanelName />,
    },
    {
      id: "role_skills",
      render: (f, onNext, n) => <StepRoleSkills form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe
          selector={(s) => ({
            firstName: s.values.firstName,
            preferredTitle: s.values.preferredTitle,
            bio: s.values.bio,
            experienceLevel: s.values.experienceLevel,
            workStyle: s.values.workStyle,
            skills: s.values.skills,
            certifications: s.values.certifications,
            offersTraining: s.values.offersTraining,
            trainingFormats: s.values.trainingFormats,
          })}
        >
          {(props) => <PanelRoleSkills {...props} />}
        </form.Subscribe>
      ),
    },
    {
      id: "shift_availability",
      render: (f, onNext, n) => <StepShiftAvailability form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe
          selector={(s) => ({
            availableDefaultStart: s.values.availableDefaultStart,
            availableDefaultEnd: s.values.availableDefaultEnd,
            availableDates: s.values.availableDates,
            availableDateOverrides: s.values.availableDateOverrides,
            availableLunchBreak: s.values.availableLunchBreak,
            availableLunchStart: s.values.availableLunchStart,
            availableLunchDuration: s.values.availableLunchDuration,
          })}
        >
          {(props) => <PanelShiftAvailability {...props} />}
        </form.Subscribe>
      ),
    },
    {
      id: "emergency_contact",
      render: (f, onNext, n) => <StepEmergencyContact form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe
          selector={(s) => ({
            name: s.values.emergencyContactName,
            phone: s.values.emergencyContactPhone,
            relationship: s.values.emergencyContactRelation,
          })}
        >
          {(props) => <PanelEmergencyContact {...props} />}
        </form.Subscribe>
      ),
    },
    {
      id: "portfolio",
      render: (f, onNext, n) => <StepAssistantPortfolio form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe
          selector={(s) => ({
            portfolioInstagram: s.values.portfolioInstagram,
            tiktokHandle: s.values.tiktokHandle,
            portfolioWebsite: s.values.portfolioWebsite,
          })}
        >
          {({ portfolioInstagram, tiktokHandle, portfolioWebsite }) => (
            <PanelAssistantPortfolio
              portfolioInstagram={portfolioInstagram}
              tiktokHandle={tiktokHandle}
              portfolioWebsite={portfolioWebsite}
            />
          )}
        </form.Subscribe>
      ),
    },
    {
      id: "contact_prefs",
      render: (f, onNext, n) => (
        <StepContactPrefs form={f} onNext={onNext} stepNum={n} avatarUrl={avatarUrl} />
      ),
      panel: (
        <form.Subscribe
          selector={(s) => ({
            email: s.values.email,
            phone: s.values.phone,
            instagramHandle: s.values.instagramHandle,
            notifications: s.values.notifications,
          })}
        >
          {(props) => <PanelContactPrefs {...props} />}
        </form.Subscribe>
      ),
    },
    {
      id: "policies",
      render: (f, onNext, n) => <StepAssistantPolicies form={f} onNext={onNext} stepNum={n} />,
      panel: <PanelAssistantPolicies />,
    },
  ];

  const totalSteps = ASSISTANT_STEPS.length;
  const isComplete = step >= totalSteps;

  const next = useCallback(() => {
    const nextStep = step + 1;
    setDirection(1);
    setStep(nextStep);
    if (nextStep >= totalSteps && !savedRef.current) {
      savedRef.current = true;
      setIsSaving(true);
      const values = form.state.values;
      saveOnboardingData(values, "assistant")
        .then(() => setIsSaving(false))
        .catch(() => {
          savedRef.current = false;
          setIsSaving(false);
          setSaveError(true);
        });
    }
  }, [step, totalSteps, form]);

  const back = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  function handleRetry() {
    setSaveError(false);
    savedRef.current = true;
    setIsSaving(true);
    saveOnboardingData(form.state.values, "assistant")
      .then(() => setIsSaving(false))
      .catch(() => {
        savedRef.current = false;
        setIsSaving(false);
        setSaveError(true);
      });
  }

  const currentStep = ASSISTANT_STEPS[step] as StepDef<AssistantOnboardingForm> | undefined;

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
      completionContent={
        <StepComplete
          form={form as unknown as OnboardingForm}
          role="assistant"
          saveError={saveError}
          isSaving={isSaving}
          onRetry={handleRetry}
        />
      }
      completionPanel={<PanelAssistantSummary form={form} />}
      onBack={back}
      onNext={next}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Admin onboarding flow                                             */
/* ------------------------------------------------------------------ */

/**
 * AdminOnboardingFlow — minimal one-step flow for the admin.
 *
 * Admins only need to set their display name to complete setup.
 * Everything else (business settings, preferences) lives in the admin dashboard.
 */
function useAdminForm(email: string, firstName: string, lastName: string) {
  return useForm({
    defaultValues: {
      firstName,
      lastName,
      email,
      phone: "",
      notifySms: true,
      notifyEmail: true,
      socials: {
        instagram: "",
        instagram2: "",
        instagram3: "",
        instagram4: "",
        tiktok: "",
        facebook: "",
        youtube: "",
        pinterest: "",
        linkedin: "",
        google: "",
        website: "",
      },
      services: {
        lash: { enabled: true, price: "120", duration: "120", deposit: "50" },
        jewelry: { enabled: true, price: "85", duration: "60", deposit: "" },
        crochet: { enabled: true, price: "150", duration: "180", deposit: "75" },
        consulting: { enabled: false, price: "75", duration: "60", deposit: "" },
      },
      studioName: "T Creative Studio",
      bio: "A luxury studio specializing in lash extensions, permanent jewelry, crochet & consulting.",
      locationType: "home_studio" as "home_studio" | "salon_suite" | "mobile",
      locationArea: "",
      bookingNotice: "24",
      waitlist: {
        lash: true,
        jewelry: true,
        crochet: true,
        consulting: "request" as "off" | "request" | "waitlist",
      },
      workingHours: {
        defaultStartTime: "10:00",
        defaultEndTime: "19:00",
        appointmentGap: "15", // minutes between bookings
        lunchBreak: true,
        lunchStart: "12:00",
        lunchDuration: "30", // minutes
        selectedDates: "[]", // JSON string: string[] of "YYYY-MM-DD"
        dayOverrides: "{}", // JSON string: Record<string, {startTime, endTime}>
      },
      intake: {
        lash: {
          prep: "",
          adhesiveAllergy: true,
          contactLenses: true,
          previousLashes: true,
          desiredLook: true,
        },
        jewelry: {
          prep: "",
          metalAllergy: true,
          designPreference: true,
        },
        crochet: {
          prep: "",
          hairType: true,
          desiredStyle: true,
          scalpSensitivity: false,
        },
        consulting: {
          prep: "",
          serviceInterest: true,
          previousExperience: false,
          goal: true,
        },
      },
      bookingConfirmation: "instant" as "instant" | "manual",
      cancellationFee: "25",
      cancellationWindow: "24",
      noShowFee: "50",
      rewards: {
        enabled: true,
        pointsPerDollar: "10",
        pointsToRedeem: "100",
        // Bonus events
        firstBookingBonus: "100",
        birthdayBonus: "50",
        referralBonus: "100", // referrer
        refereeBonus: "50", // person being referred, on their first booking
        reviewBonus: "75",
        rebookBonus: "50",
        milestoneBonus: "200", // 5th visit
        milestone10thBonus: "400", // 10th visit
        socialShareBonus: "50",
        productPurchaseBonus: "25",
        profileCompleteBonus: "25",
        anniversaryBonus: "100",
        newServiceBonus: "75",
        classAttendanceBonus: "150",
        packagePurchaseBonus: "200",
        programCompleteBonus: "300",
        certificationBonus: "500",
        // Tiers (flat fields to avoid array complexity)
        tier1Name: "Member",
        tier1Threshold: "0",
        tier1Multiplier: "1",
        tier2Name: "Regular",
        tier2Threshold: "500",
        tier2Multiplier: "1.25",
        tier3Name: "VIP",
        tier3Threshold: "2000",
        tier3Multiplier: "1.5",
        tier4Name: "Elite",
        tier4Threshold: "5000",
        tier4Multiplier: "2",
        // Expiry — "" means never expires
        pointsExpiry: "",
      },
    },
  });
}

export type AdminOnboardingForm = ReturnType<typeof useAdminForm>;

function AdminOnboardingFlow({
  email,
  googleName,
  fullName,
  avatarUrl,
}: {
  email: string;
  googleName: string;
  fullName: string;
  avatarUrl: string;
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const lastName = fullName.split(" ").slice(1).join(" ");
  const form = useAdminForm(email, googleName, lastName);
  const savedRef = useRef(false);

  const ADMIN_STEPS: StepDef<AdminOnboardingForm>[] = [
    {
      id: "name",
      render: (f, onNext, n) => (
        <StepAdminName
          form={f}
          onNext={onNext}
          stepNum={n}
          avatarUrl={avatarUrl}
          fullName={fullName}
        />
      ),
      panel: <PanelAdminWelcome />,
    },
    {
      id: "contact",
      render: (f, onNext, n) => <StepAdminContact form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe
          selector={(s) => ({
            phone: s.values.phone,
            email: s.values.email,
            notifySms: s.values.notifySms,
            notifyEmail: s.values.notifyEmail,
          })}
        >
          {(contact) => <PanelAdminContact contact={contact} />}
        </form.Subscribe>
      ),
    },
    {
      id: "socials",
      render: (f, onNext, n) => <StepAdminSocials form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe selector={(state) => state.values.socials}>
          {(socials) => <PanelAdminSocials socials={socials} />}
        </form.Subscribe>
      ),
    },
    {
      id: "studio",
      render: (f, onNext, n) => <StepAdminStudio form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe
          selector={(s) => ({
            name: s.values.studioName,
            bio: s.values.bio,
            locationType: s.values.locationType,
            locationArea: s.values.locationArea,
          })}
        >
          {(studio) => <PanelAdminStudio studio={studio} />}
        </form.Subscribe>
      ),
    },
    {
      id: "services",
      render: (f, onNext, n) => <StepAdminServices form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe
          selector={(s) => ({
            services: s.values.services,
            studioName: s.values.studioName,
            bookingNotice: s.values.bookingNotice,
          })}
        >
          {({ services, studioName, bookingNotice }) => (
            <PanelAdminServices
              services={services}
              studioName={studioName}
              bookingNotice={bookingNotice}
            />
          )}
        </form.Subscribe>
      ),
    },
    {
      id: "hours",
      render: (f, onNext, n) => <StepAdminHours form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe selector={(s) => s.values.workingHours}>
          {(wh) => <PanelAdminHours workingHours={wh} />}
        </form.Subscribe>
      ),
    },
    {
      id: "intake",
      render: (f, onNext, n) => <StepAdminIntake form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe
          selector={(s) => ({ services: s.values.services, intake: s.values.intake })}
        >
          {({ services, intake }) => <PanelAdminIntake services={services} intake={intake} />}
        </form.Subscribe>
      ),
    },
    {
      id: "policies",
      render: (f, onNext, n) => <StepAdminPolicies form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe
          selector={(s) => ({
            waitlist: s.values.waitlist,
            bookingConfirmation: s.values.bookingConfirmation,
            cancellationFee: s.values.cancellationFee,
            cancellationWindow: s.values.cancellationWindow,
            noShowFee: s.values.noShowFee,
          })}
        >
          {(vals) => (
            <PanelAdminPolicies
              waitlist={vals.waitlist}
              bookingConfirmation={vals.bookingConfirmation}
              cancellationFee={vals.cancellationFee}
              cancellationWindow={vals.cancellationWindow}
              noShowFee={vals.noShowFee}
            />
          )}
        </form.Subscribe>
      ),
    },
    {
      id: "rewards",
      render: (f, onNext, n) => <StepAdminRewards form={f} onNext={onNext} stepNum={n} />,
      panel: (
        <form.Subscribe selector={(s) => s.values.rewards ?? null}>
          {(r) => (r ? <PanelAdminRewards rewards={r} /> : null)}
        </form.Subscribe>
      ),
    },
  ];

  const totalSteps = ADMIN_STEPS.length;
  const isComplete = step >= totalSteps;

  const next = useCallback(() => {
    const nextStep = step + 1;
    setDirection(1);
    setStep(nextStep);
    if (nextStep >= totalSteps && !savedRef.current) {
      savedRef.current = true;
      setIsSaving(true);
      const {
        firstName,
        lastName,
        email,
        phone,
        notifySms,
        notifyEmail,
        socials,
        studioName,
        bio,
        locationType,
        locationArea,
        bookingNotice,
        services,
        workingHours,
        intake,
        waitlist,
        bookingConfirmation,
        cancellationFee,
        cancellationWindow,
        noShowFee,
        rewards,
      } = form.state.values;
      saveOnboardingData(
        {
          firstName,
          lastName,
          email,
          phone,
          notifySms,
          notifyEmail,
          socials,
          studioName,
          bio,
          locationType,
          locationArea,
          bookingNotice,
          services,
          workingHours,
          intake,
          waitlist,
          bookingConfirmation,
          cancellationFee,
          cancellationWindow,
          noShowFee,
          rewards,
        },
        "admin",
      )
        .then(() => setIsSaving(false))
        .catch(() => {
          savedRef.current = false;
          setIsSaving(false);
          setSaveError(true);
        });
    }
  }, [step, totalSteps, form]);

  const back = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const currentStep = ADMIN_STEPS[step] as StepDef<AdminOnboardingForm> | undefined;

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
      completionContent={
        <StepComplete
          form={form as unknown as OnboardingForm}
          role="admin"
          onBack={back}
          saveError={saveError}
          isSaving={isSaving}
          studioName={form.getFieldValue("studioName")}
          onRetry={() => {
            setSaveError(false);
            savedRef.current = true;
            setIsSaving(true);
            const {
              firstName,
              lastName,
              email,
              phone,
              notifySms,
              notifyEmail,
              socials,
              studioName,
              bio,
              locationType,
              locationArea,
              bookingNotice,
              services,
              workingHours,
              intake,
              waitlist,
              bookingConfirmation,
              cancellationFee,
              cancellationWindow,
              noShowFee,
              rewards,
            } = form.state.values;
            saveOnboardingData(
              {
                firstName,
                lastName,
                email,
                phone,
                notifySms,
                notifyEmail,
                socials,
                studioName,
                bio,
                locationType,
                locationArea,
                bookingNotice,
                services,
                workingHours,
                intake,
                waitlist,
                bookingConfirmation,
                cancellationFee,
                cancellationWindow,
                noShowFee,
                rewards,
              },
              "admin",
            )
              .then(() => setIsSaving(false))
              .catch(() => {
                savedRef.current = false;
                setIsSaving(false);
                setSaveError(true);
              });
          }}
        />
      }
      completionPanel={
        <form.Subscribe selector={(s) => s.values.studioName}>
          {(studioName) => <PanelAdminComplete studioName={studioName} />}
        </form.Subscribe>
      }
      onBack={back}
      onNext={next}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

interface OnboardingFlowProps {
  role?: "client" | "assistant" | "admin";
  /** Pre-filled email from the auth session — passed to the admin flow. */
  email?: string;
  /** First name from Google OAuth metadata — used for the personalized admin greeting. */
  googleName?: string;
  /** Full name from Google OAuth metadata — displayed in the admin profile card. */
  fullName?: string;
  /** Profile photo URL from Google OAuth — displayed on the admin name step. */
  avatarUrl?: string;
}

export function OnboardingFlow({
  role = "client",
  email = "",
  googleName = "",
  fullName = "",
  avatarUrl = "",
}: OnboardingFlowProps) {
  if (role === "assistant")
    return <AssistantOnboardingFlow email={email} googleName={googleName} avatarUrl={avatarUrl} />;
  if (role === "admin")
    return (
      <AdminOnboardingFlow
        email={email}
        googleName={googleName}
        fullName={fullName}
        avatarUrl={avatarUrl}
      />
    );
  return <ClientOnboardingFlow />;
}
