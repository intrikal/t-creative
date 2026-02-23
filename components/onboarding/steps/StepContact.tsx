"use client";

/**
 * StepContact.tsx — Contact information step (email + phone) for the client flow.
 *
 * What: Collects the client's phone number. The email is already known from
 *       the Supabase OAuth session, so it is shown as a non-editable "locked"
 *       identity chip alongside the user's profile photo (or an initial
 *       fallback). The phone field is optional.
 *
 * Why the email is locked:
 * The email address is the primary key that ties the profile to Supabase Auth.
 * Allowing edits here would create a mismatch between auth.users and profiles,
 * breaking RLS policies and notifications. Changes to email must go through
 * Supabase's own email-change flow, not this onboarding form.
 *
 * Phone auto-formatting:
 * The form stores raw digits (e.g. "4045550123") and `formatPhone()` renders
 * them as "(404) 555-0123" in the input. The raw digit string is what gets
 * saved to `profiles.phone` — formatting is presentation-only.
 *
 * Since email is always present, the OK button is always enabled (no gate on
 * phone). Enter from outside the input advances; Enter inside the input also
 * advances (handled separately to avoid conflict with the global listener).
 *
 * @prop avatarUrl    - Google OAuth profile photo URL; falls back to initial circle
 * @prop googleName   - Google display name used as alt text and initial fallback
 *
 * Related files:
 * - components/onboarding/panels/PanelContact.tsx — paired right panel
 * - components/onboarding/OnboardingFlow.tsx       — renders this step with OAuth props
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { LuLock, LuMail } from "react-icons/lu";
import type { OnboardingForm } from "../OnboardingFlow";

function formatPhone(digits: string): string {
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

interface StepProps {
  form: OnboardingForm;
  onNext: () => void;
  stepNum: number;
  avatarUrl?: string;
  googleName?: string;
}

export function StepContact({ form, onNext, stepNum, avatarUrl, googleName }: StepProps) {
  const phoneRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);
  const email = form.getFieldValue("email");

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

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

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
          How can we reach you?
        </h1>
        <p className="text-muted text-sm mt-2">For booking confirmations and reminders.</p>
      </motion.div>

      {/* Identity chip — avatar + locked email, same pattern as admin/assistant steps */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-3"
      >
        {/* Profile photo or initials fallback */}
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={googleName ?? ""}
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <span className="text-accent font-semibold text-sm">
              {googleName?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        )}

        {/* Locked email pill */}
        {email && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/8">
            <LuMail className="w-3 h-3 text-muted/40 shrink-0" />
            <span className="text-xs text-muted/60 truncate max-w-[220px]">{email}</span>
            <LuLock className="w-2.5 h-2.5 text-muted/25 shrink-0" />
          </div>
        )}
      </motion.div>

      {/* Phone input with auto-formatting */}
      <form.Field name="phone">
        {(field) => {
          const rawDigits = field.state.value ?? "";
          const displayValue = rawDigits.length > 0 ? formatPhone(rawDigits) : "";

          return (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-2"
            >
              <label className="text-xs font-medium text-muted uppercase tracking-wide">
                Phone <span className="normal-case text-muted/60">(optional)</span>
              </label>
              <input
                ref={phoneRef}
                type="tel"
                placeholder="(555) 123-4567"
                value={displayValue}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  field.handleChange(digits);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onNext();
                  }
                }}
                onFocus={() => (inputFocusedRef.current = true)}
                onBlur={() => {
                  inputFocusedRef.current = false;
                  field.handleBlur();
                }}
                className="w-full sm:max-w-[360px] px-0 py-2 text-lg bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </motion.div>
          );
        }}
      </form.Field>

      {/* OK — always enabled since email is pre-filled from OAuth */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex items-center gap-3"
      >
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md bg-accent text-white hover:brightness-110 transition-all duration-200 cursor-pointer"
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
        <span className="text-xs text-muted/50">
          press <strong className="text-muted/70">Enter &crarr;</strong>
        </span>
      </motion.div>
    </div>
  );
}
