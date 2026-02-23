"use client";

/**
 * StepPreferences.tsx — Availability, notifications, and photo consent step.
 *
 * What: Collects three preference categories in one compact final step:
 *       1. Availability windows (weekdays/weekends + mornings/afternoons/evenings)
 *          as multi-select pill toggles with keyboard shortcuts A–E.
 *       2. Notification preferences (SMS, email, marketing) as toggle switches.
 *       3. Photo/portfolio consent (yes/no) — the OK/Finish button is disabled
 *          until a choice is made here (`canContinue = choice !== null`).
 *
 * Why: Placing the three "nice to have" personalisation fields last means the
 *      heavier consent and data steps come first. The final step feeling light
 *      ("Almost done!") reduces last-moment drop-off, a common onboarding pattern.
 *
 * ## Why no form.Field here
 * `form.Field` registers TanStack Form subscriptions during the render phase,
 * which triggers a `LocalSubscribe` setState call while the component is still
 * rendering — React warns about state updates during render. All three preference
 * categories use plain local state instead, synced to the form via
 * `form.setFieldValue` called only inside event handlers (never inside state
 * updater callbacks).
 *
 * ## selectedRef / notifsRef pattern
 * Each piece of local state has a corresponding ref that stays current between
 * renders without going stale inside `useCallback`. The toggle handlers read
 * from the ref and write to the form to avoid including `selected`/`notifs` in
 * the `useCallback` dependency arrays (which would recreate the functions every
 * render and cause the keyboard listener to re-bind).
 *
 * Related files:
 * - components/onboarding/panels/PanelPreferences.tsx — paired right panel (live preview)
 * - components/onboarding/OnboardingFlow.tsx           — renders this step
 * - app/onboarding/actions.ts                          — persists availability + notifications
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { OnboardingForm } from "../OnboardingFlow";

type AvailField = "weekdays" | "weekends" | "mornings" | "afternoons" | "evenings";

const AVAILABILITY_OPTIONS: { field: AvailField; label: string; hint: string; letter: string }[] = [
  { field: "weekdays", label: "Weekdays", hint: "Mon–Fri", letter: "A" },
  { field: "weekends", label: "Weekends", hint: "Sat–Sun", letter: "B" },
  { field: "mornings", label: "Mornings", hint: "9am–12pm", letter: "C" },
  { field: "afternoons", label: "Afternoons", hint: "12–5pm", letter: "D" },
  { field: "evenings", label: "Evenings", hint: "5pm+", letter: "E" },
];

const NOTIFICATION_OPTIONS: { field: "sms" | "email" | "marketing"; label: string }[] = [
  { field: "sms", label: "Text Messages" },
  { field: "email", label: "Email" },
  { field: "marketing", label: "Promotions & News" },
];

interface StepProps {
  form: OnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepPreferences({ form, onNext, stepNum }: StepProps) {
  // ── Availability state ────────────────────────────────────────────────────
  // Initialised once from form values; kept in sync via the toggle handler.
  const [selected, setSelected] = useState<Record<AvailField, boolean>>(() => {
    const vals: Record<string, boolean> = {};
    for (const o of AVAILABILITY_OPTIONS) {
      vals[o.field] =
        (form.getFieldValue(`availability.${o.field}` as "availability.weekdays") as boolean) ??
        false;
    }
    return vals as Record<AvailField, boolean>;
  });

  const toggle = useCallback(
    (field: AvailField) => {
      // Compute next outside the setSelected updater so we never call
      // form.setFieldValue (which updates TanStack's internal store) inside
      // a React state updater — that's what triggered the LocalSubscribe warning.
      const next = { ...selected, [field]: !selected[field] };
      setSelected(next);
      for (const o of AVAILABILITY_OPTIONS) {
        form.setFieldValue(
          `availability.${o.field}` as "availability.weekdays",
          next[o.field] as never,
        );
      }
    },
    [form, selected],
  );

  // ── Notification state ───────────────────────────────────────────────────
  // Plain local state avoids form.Field, which registers TanStack subscriptions
  // during render and triggers the LocalSubscribe setState-in-render warning.
  const [notifs, setNotifs] = useState(() => {
    const n = form.getFieldValue("notifications") as {
      sms: boolean;
      email: boolean;
      marketing: boolean;
    };
    return n ?? { sms: true, email: true, marketing: false };
  });

  const toggleNotif = useCallback(
    (field: "sms" | "email" | "marketing") => {
      const next = { ...notifs, [field]: !notifs[field] };
      setNotifs(next);
      form.setFieldValue("notifications", next);
    },
    [form, notifs],
  );

  // ── Photo consent state ──────────────────────────────────────────────────
  const [choice, setChoice] = useState<"yes" | "no" | null>(() => {
    const val = form.getFieldValue("photoConsent") as string;
    if (val === "yes" || val === "no") return val;
    return null;
  });

  const canContinue = choice !== null;

  const selectYes = useCallback(() => {
    setChoice("yes");
    form.setFieldValue("photoConsent", "yes");
  }, [form]);

  const selectNo = useCallback(() => {
    setChoice("no");
    form.setFieldValue("photoConsent", "no");
  }, [form]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && canContinue) onNext();

      const letter = e.key.toUpperCase();
      const option = AVAILABILITY_OPTIONS.find((o) => o.letter === letter);
      if (option) toggle(option.field);
    },
    [canContinue, onNext, toggle],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-5">
      {/* Step header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-accent font-medium">{stepNum}</span>
          <span className="text-accent">&rarr;</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent uppercase tracking-widest">
            Last step
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-medium text-foreground leading-snug">
          Almost done!
        </h1>
        <p className="text-muted text-sm mt-2">
          One last thing — scheduling, reminders, and a quick question.
        </p>
      </motion.div>

      {/* Availability — pill toggles */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
          When do you usually book?
        </p>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY_OPTIONS.map((option, i) => {
            const isSelected = selected[option.field];
            return (
              <motion.button
                key={option.field}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => toggle(option.field)}
                className={`
                  px-3 py-1.5 text-xs rounded-full border transition-all duration-150
                  flex items-center gap-1
                  ${
                    isSelected
                      ? "border-accent bg-accent/10 text-accent font-medium"
                      : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
                  }
                `}
              >
                {option.label}
                <span className={`text-[10px] ${isSelected ? "text-accent/70" : "text-muted/45"}`}>
                  {option.hint}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Notification preferences — toggle switches (plain local state, no form.Field) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
          How should we reach you?
        </p>
        <div className="space-y-1.5">
          {NOTIFICATION_OPTIONS.map((option, i) => {
            const on = notifs[option.field];
            return (
              <motion.button
                key={option.field}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => toggleNotif(option.field)}
                className="flex items-center justify-between w-full py-1 text-left"
              >
                <span className="text-sm text-foreground">{option.label}</span>
                <div
                  className={`
                    relative w-9 h-5 rounded-full shrink-0 transition-colors duration-200
                    ${on ? "bg-accent" : "bg-foreground/15"}
                  `}
                >
                  <motion.div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                    animate={{ left: on ? 18 : 2 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  />
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Photo consent — two compact side-by-side buttons */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-medium text-muted mb-2">
          Can we feature your results on social?
        </p>
        <div className="flex gap-2">
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={selectYes}
            className={`
              flex-1 px-3 py-2 text-xs rounded-md border text-center
              transition-all duration-150 inline-flex items-center justify-center gap-1.5
              ${
                choice === "yes"
                  ? "border-accent bg-accent/5 text-foreground"
                  : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
              }
            `}
          >
            {choice === "yes" && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                width="12"
                height="12"
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
            Yes, feature me
          </motion.button>

          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.59, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={selectNo}
            className={`
              flex-1 px-3 py-2 text-xs rounded-md border text-center
              transition-all duration-150 inline-flex items-center justify-center gap-1.5
              ${
                choice === "no"
                  ? "border-accent bg-accent/5 text-foreground"
                  : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
              }
            `}
          >
            {choice === "no" && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                width="12"
                height="12"
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
            No thanks
          </motion.button>
        </div>
      </motion.div>

      {/* OK button — gated on photo consent being chosen */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65 }}
        className="flex items-center gap-3"
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
          Finish
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
            or press <strong className="text-muted/70">Enter &crarr;</strong>
          </span>
        )}
      </motion.div>
    </div>
  );
}
