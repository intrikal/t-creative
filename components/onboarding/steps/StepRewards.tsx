"use client";

/**
 * StepRewards.tsx — Loyalty program intro + birthday + referral + source step.
 *
 * What: Introduces the T Creative rewards program and collects three pieces
 *       of data that feed directly into it:
 *       - Birthday (month/day only — auto-formatted "MM/DD"; earns +50 pts)
 *       - How they found the studio (`source` field — 7 options, letter shortcuts A-G)
 *       - Who referred them (name + email required; phone optional; earns referrer +100 pts)
 *
 * Why: Framing optional data collection as a reward-earning action dramatically
 *      increases fill rates. Clients share their birthday and referrer when they
 *      know there's something in it for them and their friend.
 *
 * How: Source selection uses local state (`currentSource`) synced to the form so
 *      the "Friend Referral" sub-form can animate in/out with AnimatePresence.
 *      Referral validation requires name + valid email before advancing (the OK
 *      button stays disabled until `referralValid` is true).
 *      Smart Enter-key focus chaining moves: name → email → phone → advance.
 *
 * Source → referral conditional:
 * Selecting "Friend Referral" expands the referrer sub-form and clears `skipped`.
 * Selecting any other source collapses it, clears referrer fields, and sets
 * `skipped = true` so the server action knows not to look up a referrer.
 *
 * Related files:
 * - components/onboarding/panels/PanelRewards.tsx — paired right panel (live points tally)
 * - components/onboarding/OnboardingFlow.tsx       — renders this step
 * - app/onboarding/actions.ts                      — awards the matching point values
 */
import { useState, useEffect, useCallback } from "react";
import { m, AnimatePresence } from "framer-motion";
import type { OnboardingForm } from "../OnboardingFlow";

const SOURCE_OPTIONS = [
  { id: "instagram" as const, label: "Instagram", letter: "A" },
  { id: "tiktok" as const, label: "TikTok", letter: "B" },
  { id: "pinterest" as const, label: "Pinterest", letter: "C" },
  { id: "word_of_mouth" as const, label: "Word of Mouth", letter: "D" },
  { id: "google_search" as const, label: "Google", letter: "E" },
  { id: "referral" as const, label: "Friend Referral", letter: "F" },
  { id: "website_direct" as const, label: "Website", letter: "G" },
];

interface StepProps {
  form: OnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepRewards({ form, onNext, stepNum }: StepProps) {
  const [currentSource, setCurrentSource] = useState(() => form.getFieldValue("source") as string);
  const isReferral = currentSource === "referral";

  const [referrerCode, setReferrerCode] = useState(
    () => (form.getFieldValue("referral.referrerCode" as "referral") as unknown as string) ?? "",
  );

  // Referral code format: XXXXX-XXXXXX (1-5 uppercase letters, dash, 6 alphanumeric).
  const REFERRAL_CODE_RE = /^[A-Z]{1,5}-[A-Z0-9]{6}$/;
  const referralValid = !isReferral || REFERRAL_CODE_RE.test(referrerCode.trim());

  const canContinue = referralValid;

  const handleSelect = useCallback(
    (id: (typeof SOURCE_OPTIONS)[number]["id"]) => {
      form.setFieldValue("source", id);
      setCurrentSource(id);
      if (id !== "referral") {
        setReferrerCode("");
        form.setFieldValue("referral.referrerCode" as "referral", "" as never);
        form.setFieldValue("referral.skipped" as "referral", true as never);
      } else {
        form.setFieldValue("referral.skipped" as "referral", false as never);
      }
    },
    [form],
  );

  const handleCodeChange = useCallback(
    (value: string) => {
      const formatted = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      setReferrerCode(formatted);
      form.setFieldValue("referral.referrerCode" as "referral", formatted as never);
    },
    [form],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Enter" && canContinue) onNext();
        // Suppress letter shortcuts while typing in an input.
        return;
      }

      if (e.key === "Enter" && canContinue) onNext();

      // Letter shortcuts A–G select the corresponding source option.
      const letter = e.key.toUpperCase();
      const option = SOURCE_OPTIONS.find((o) => o.letter === letter);
      if (option) handleSelect(option.id);
    },
    [canContinue, onNext, handleSelect],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-5">
      {/* Step header */}
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-accent font-medium">{stepNum}</span>
          <span className="text-accent">&rarr;</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-medium text-foreground leading-snug">
          Your loyalty perks
        </h1>
        <p className="text-muted text-sm mt-2">
          Earn points on every visit, birthday, and referral.
        </p>
      </m.div>

      {/* Birthday — optional, earns birthday bonus points */}
      <m.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-medium text-muted">
            Birthday <span className="text-muted/50 normal-case font-normal">(optional)</span>
          </p>
          {/* Points badge — ties birthday collection to the rewards program */}
          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
            +50 pts
          </span>
        </div>
        <form.Field name="birthday">
          {(field) => (
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM / DD"
              maxLength={5}
              value={field.state.value ?? ""}
              onChange={(e) => {
                let v = e.target.value.replace(/[^\d/]/g, "");
                if (v.length === 2 && !v.includes("/") && (field.state.value?.length ?? 0) < 2) {
                  v += "/";
                }
                field.handleChange(v);
              }}
              onBlur={field.handleBlur}
              className="w-full max-w-[180px] px-0 py-2 text-lg tracking-widest bg-transparent border-b-2 border-foreground/15
                placeholder:text-muted/30 text-foreground
                focus:outline-none focus:border-accent
                transition-colors duration-200"
            />
          )}
        </form.Field>
      </m.div>

      {/* Source — how they found T Creative */}
      <m.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-medium text-muted mb-2">How did you find us?</p>
        <form.Field name="source">
          {(field) => (
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((option, i) => {
                const isSelected = field.state.value === option.id;
                return (
                  <m.button
                    key={option.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => handleSelect(option.id)}
                    className={`
                      px-3 py-1.5 text-xs rounded-full border
                      transition-all duration-150
                      ${
                        isSelected
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
                      }
                    `}
                  >
                    {option.label}
                  </m.button>
                );
              })}
            </div>
          )}
        </form.Field>
      </m.div>

      {/* Referral code input — animates in when "Friend Referral" is selected */}
      <AnimatePresence>
        {isReferral && (
          <m.div
            key="referral-fields"
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 12, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted">Enter their referral code</p>
              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                You both earn +100 pts
              </span>
            </div>
            <div>
              <input
                type="text"
                autoFocus
                placeholder="SARAH-A1B2C3"
                value={referrerCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                maxLength={12}
                className="w-full sm:max-w-[260px] px-0 py-2 text-base font-mono tracking-widest bg-transparent border-b-2 border-accent/30
                  placeholder:text-muted/30 placeholder:tracking-normal text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
              <p className="text-xs text-muted/50 mt-1.5">
                Your friend&apos;s code — found in their loyalty dashboard
              </p>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* OK button */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
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
      </m.div>
    </div>
  );
}
