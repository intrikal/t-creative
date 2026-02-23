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
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [currentSource, setCurrentSource] = useState(() => form.getFieldValue("source") as string);
  const isReferral = currentSource === "referral";

  const [referrerName, setReferrerName] = useState(
    () => (form.getFieldValue("referral.referrerName" as "referral") as unknown as string) ?? "",
  );
  const [referrerEmail, setReferrerEmail] = useState(
    () => (form.getFieldValue("referral.referrerEmail" as "referral") as unknown as string) ?? "",
  );
  const [referrerPhone, setReferrerPhone] = useState(
    () => (form.getFieldValue("referral.referrerPhone" as "referral") as unknown as string) ?? "",
  );

  // Referral is only valid when: not selected, OR name+email are both filled and email is valid.
  const referralValid =
    !isReferral ||
    (referrerName.trim().length > 0 &&
      referrerEmail.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referrerEmail.trim()));

  const canContinue = referralValid;

  const handleSelect = useCallback(
    (id: (typeof SOURCE_OPTIONS)[number]["id"]) => {
      form.setFieldValue("source", id);
      setCurrentSource(id);
      if (id !== "referral") {
        setReferrerName("");
        setReferrerEmail("");
        setReferrerPhone("");
        form.setFieldValue("referral.referrerName" as "referral", "" as never);
        form.setFieldValue("referral.referrerEmail" as "referral", "" as never);
        form.setFieldValue("referral.referrerPhone" as "referral", "" as never);
        form.setFieldValue("referral.skipped" as "referral", true as never);
      } else {
        form.setFieldValue("referral.skipped" as "referral", false as never);
      }
    },
    [form],
  );

  const handleNameChange = useCallback(
    (value: string) => {
      setReferrerName(value);
      form.setFieldValue("referral.referrerName" as "referral", value as never);
    },
    [form],
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setReferrerEmail(value);
      form.setFieldValue("referral.referrerEmail" as "referral", value as never);
    },
    [form],
  );

  const formatReferrerPhone = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits.length ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }, []);

  const handlePhoneChange = useCallback(
    (value: string) => {
      const formatted = formatReferrerPhone(value);
      setReferrerPhone(formatted);
      form.setFieldValue("referral.referrerPhone" as "referral", formatted as never);
    },
    [form, formatReferrerPhone],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Enter") {
          // Smart focus chaining through the referral inputs.
          if (
            (e.target as HTMLInputElement)?.placeholder === "Their first name" &&
            referrerName.trim()
          ) {
            e.preventDefault();
            emailRef.current?.focus();
          } else if (
            (e.target as HTMLInputElement)?.placeholder === "friend@example.com" &&
            referrerEmail.trim()
          ) {
            e.preventDefault();
            phoneRef.current?.focus();
          } else if (canContinue) {
            onNext();
          }
        }
        // Suppress letter shortcuts (A–E) while typing in an input.
        return;
      }

      if (e.key === "Enter" && canContinue) onNext();

      // Letter shortcuts A–E select the corresponding source option.
      const letter = e.key.toUpperCase();
      const option = SOURCE_OPTIONS.find((o) => o.letter === letter);
      if (option) handleSelect(option.id);
    },
    [canContinue, onNext, handleSelect, referrerName, referrerEmail],
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
      </motion.div>

      {/* Birthday — optional, earns birthday bonus points */}
      <motion.div
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
      </motion.div>

      {/* Source — how they found T Creative */}
      <motion.div
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
                  <motion.button
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
                  </motion.button>
                );
              })}
            </div>
          )}
        </form.Field>
      </motion.div>

      {/* Referral inputs — animate in when "Friend Referral" is selected */}
      <AnimatePresence>
        {isReferral && (
          <motion.div
            key="referral-fields"
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 12, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted">Who referred you?</p>
              {/* Reward context for the referrer */}
              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                They earn +100 pts
              </span>
            </div>
            <div>
              <input
                type="text"
                autoFocus
                placeholder="Their first name"
                value={referrerName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full sm:max-w-[360px] px-0 py-2 text-base bg-transparent border-b-2 border-accent/30
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </div>
            <div>
              <input
                ref={emailRef}
                type="email"
                placeholder="friend@example.com"
                value={referrerEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                className="w-full sm:max-w-[360px] px-0 py-2 text-base bg-transparent border-b-2 border-accent/30
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </div>
            <div>
              <input
                ref={phoneRef}
                type="tel"
                inputMode="numeric"
                placeholder="(555) 123-4567"
                value={referrerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full sm:max-w-[360px] px-0 py-2 text-base bg-transparent border-b-2 border-accent/30
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
              <p className="text-xs text-muted/50 mt-1.5">So we can credit their account too</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OK button */}
      <motion.div
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
      </motion.div>
    </div>
  );
}
