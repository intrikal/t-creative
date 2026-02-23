"use client";

/**
 * StepAdminIntake — step 7 of the admin onboarding wizard.
 *
 * ## Responsibility
 * Lets the admin configure per-service intake: what prep instructions clients
 * receive after booking, and which intake questions they'll answer at checkout.
 *
 * ## Dynamic rendering
 * Uses `form.Subscribe selector={(s) => s.values.services}` to read the enabled
 * services from the form without subscribing to the entire form state. Only
 * services that were enabled in step 5 (StepAdminServices) appear here —
 * if none are enabled, a message prompts the admin to go back.
 *
 * ## "Use suggested" shortcut
 * Each service has a pre-written `suggestedPrep` string. When the prep textarea
 * is empty, a "Use suggested" button appears that fills it in with one click.
 * This makes the step fast for admins who trust the defaults.
 *
 * ## Intake questions
 * Each service has 2–4 boolean question flags. They render as custom checkboxes
 * (styled `<button>` elements with a small SVG checkmark). The field names use
 * deep dot paths (e.g. `"intake.lash.adhesiveAllergy"`) — TanStack Form resolves
 * these to nested object paths in the form state.
 *
 * ## Data flow
 * All intake data is saved in `profiles.onboarding_data` JSONB in the database,
 * nested under an `intake` key with per-service sub-objects.
 *
 * ## Props
 * @prop form - the TanStack Form instance (AdminOnboardingForm)
 * @prop onNext - advances to step 8
 * @prop stepNum - displayed as the step badge number
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { LuEye, LuGem, LuScissors, LuLightbulb } from "react-icons/lu";
import type { AdminOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AdminOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

const INTAKE_CONFIG = [
  {
    key: "lash" as const,
    name: "Lash Extensions",
    icon: LuEye,
    color: "text-rose-400",
    bg: "bg-rose-400/12",
    suggestedPrep:
      "Come with completely clean lashes — no mascara, lash serum, or oil-based eye products. Remove contacts if possible.",
    prepField: "intake.lash.prep" as const,
    questions: [
      { field: "intake.lash.adhesiveAllergy" as const, label: "Any adhesive or latex allergies?" },
      { field: "intake.lash.contactLenses" as const, label: "Do you wear contact lenses?" },
      {
        field: "intake.lash.previousLashes" as const,
        label: "Have you had lash extensions before?",
      },
      {
        field: "intake.lash.desiredLook" as const,
        label: "Desired look (natural / volume / mega)?",
      },
    ],
  },
  {
    key: "jewelry" as const,
    name: "Permanent Jewelry",
    icon: LuGem,
    color: "text-amber-400",
    bg: "bg-amber-400/12",
    suggestedPrep:
      "Come with clean, dry skin. Avoid lotions or oils near where the piece will sit.",
    prepField: "intake.jewelry.prep" as const,
    questions: [
      { field: "intake.jewelry.metalAllergy" as const, label: "Any metal or nickel allergies?" },
      {
        field: "intake.jewelry.designPreference" as const,
        label: "Do you have a chain style or design in mind?",
      },
    ],
  },
  {
    key: "crochet" as const,
    name: "Crochet",
    icon: LuScissors,
    color: "text-violet-400",
    bg: "bg-violet-400/12",
    suggestedPrep: "Come with freshly washed, blow-dried, and stretched hair. No braids or twists.",
    prepField: "intake.crochet.prep" as const,
    questions: [
      { field: "intake.crochet.hairType" as const, label: "What's your hair type / texture?" },
      { field: "intake.crochet.desiredStyle" as const, label: "Desired style, length, and color?" },
      {
        field: "intake.crochet.scalpSensitivity" as const,
        label: "Any scalp sensitivities or conditions?",
      },
    ],
  },
  {
    key: "consulting" as const,
    name: "Consulting",
    icon: LuLightbulb,
    color: "text-teal-400",
    bg: "bg-teal-400/12",
    suggestedPrep:
      "Have 3–5 reference photos ready. Come with an open mind — we'll build the look together.",
    prepField: "intake.consulting.prep" as const,
    questions: [
      {
        field: "intake.consulting.serviceInterest" as const,
        label: "Which service(s) are you considering?",
      },
      {
        field: "intake.consulting.previousExperience" as const,
        label: "Have you had this service done before?",
      },
      {
        field: "intake.consulting.goal" as const,
        label: "Describe your goal or vision in a sentence.",
      },
    ],
  },
] as const;

export function StepAdminIntake({ form, onNext, stepNum }: StepProps) {
  const inputFocusedRef = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && !inputFocusedRef.current) onNext();
    },
    [onNext],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-3">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/12 text-accent text-xs font-bold">
            {stepNum}
          </span>
          <span className="text-xs font-medium text-muted/50 uppercase tracking-wider">of 9</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground leading-snug">
          Prepare your clients.
        </h1>
        <p className="text-sm text-foreground/60 mt-0.5">
          Prep auto-sends after booking. Questions fill out at checkout.
        </p>
      </motion.div>

      {/* Per-service intake — only enabled services */}
      <form.Subscribe selector={(s) => s.values.services}>
        {(services) => {
          const enabled = INTAKE_CONFIG.filter((c) => services[c.key]?.enabled);

          if (enabled.length === 0) {
            return (
              <p className="text-sm text-muted/50 italic">
                No services are enabled yet — go back to step 5 to turn them on.
              </p>
            );
          }

          return (
            <div className="space-y-2 max-w-[420px]">
              {enabled.map(
                ({ key, name, icon: Icon, color, bg, suggestedPrep, prepField, questions }, i) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.07 + i * 0.07, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-1"
                  >
                    {/* Service header */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded ${bg} flex items-center justify-center shrink-0`}
                      >
                        <Icon className={color} style={{ width: 9, height: 9 }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        {name}
                      </span>
                    </div>

                    <div className="pl-6 space-y-1">
                      {/* Prep instructions */}
                      <form.Field name={prepField}>
                        {(field) => (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted/40 uppercase tracking-wider font-semibold">
                                Prep — sent after booking
                              </span>
                              {!field.state.value && (
                                <button
                                  type="button"
                                  onClick={() => field.handleChange(suggestedPrep)}
                                  className="text-[10px] font-semibold text-accent/60 hover:text-accent transition-colors"
                                >
                                  Use suggested
                                </button>
                              )}
                            </div>
                            <textarea
                              rows={2}
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              onFocus={() => (inputFocusedRef.current = true)}
                              onBlur={() => {
                                inputFocusedRef.current = false;
                                field.handleBlur();
                              }}
                              placeholder={suggestedPrep}
                              className="w-full px-0 py-0.5 text-xs bg-transparent border-b border-foreground/12 text-foreground focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed placeholder:text-muted/25"
                            />
                          </div>
                        )}
                      </form.Field>

                      {/* Intake questions — no label, checkboxes speak for themselves */}
                      <div className="space-y-0.5">
                        {questions.map(({ field: qField, label }) => (
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          <form.Field key={qField} name={qField as any}>
                            {(field) => (
                              <button
                                type="button"
                                onClick={() => field.handleChange(!field.state.value)}
                                className="flex items-center gap-2 w-full text-left group"
                              >
                                <div
                                  className={`w-3 h-3 rounded flex items-center justify-center shrink-0 border transition-all duration-150
                                ${
                                  field.state.value
                                    ? "bg-accent border-accent"
                                    : "border-foreground/20 group-hover:border-foreground/40"
                                }`}
                                >
                                  {field.state.value && (
                                    <svg width="6" height="6" viewBox="0 0 8 8" fill="none">
                                      <path
                                        d="M1.5 4L3 5.5L6.5 2"
                                        stroke="white"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <span
                                  className={`text-xs leading-tight transition-colors ${field.state.value ? "text-foreground/70" : "text-foreground/30 group-hover:text-foreground/50"}`}
                                >
                                  {label}
                                </span>
                              </button>
                            )}
                          </form.Field>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ),
              )}
            </div>
          );
        }}
      </form.Subscribe>

      {/* Next */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-3 pt-1"
      >
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md bg-accent text-white hover:brightness-110 transition-all duration-200 cursor-pointer"
        >
          Next
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-xs text-muted/50">
          press <strong className="text-muted/70">Enter ↵</strong>
        </span>
      </motion.div>
    </div>
  );
}
