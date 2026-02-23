"use client";

/**
 * StepContactPrefs — step 6 of the assistant onboarding wizard.
 *
 * ## Responsibility
 * Collects the assistant's phone number, personal Instagram handle, and
 * notification preferences. Email is read-only — it's the Google auth email
 * and cannot be changed here (same pattern as StepAdminContact).
 *
 * ## Avatar display
 * The Google profile photo (`avatarUrl` prop) is shown at the top alongside
 * the locked email pill to visually confirm whose account is being set up.
 * Uses a plain <img> with referrerPolicy="no-referrer" (required for Google
 * CDN URLs). Falls back to an initials circle if no avatar is provided.
 *
 * ## Email — read-only
 * Email is displayed as a locked pill (same as StepAdminContact), not an
 * editable input. The assistant cannot change it during onboarding — it must
 * match their Google account. This removes one field to fill in and reduces
 * friction.
 *
 * ## Keyboard handling
 * Enter advances when email is present (always true — it's pre-filled from OAuth).
 * Global window keydown fires onNext() unless an input is focused.
 *
 * ## Props
 * @prop form      — the TanStack Form instance (AssistantOnboardingForm)
 * @prop onNext    — advances to step 7 (policies)
 * @prop stepNum   — displayed as the step badge number
 * @prop avatarUrl — Google profile photo URL (from OAuth metadata)
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { LuLock, LuMail } from "react-icons/lu";
import type { AssistantOnboardingForm } from "../OnboardingFlow";

function formatPhone(digits: string): string {
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

const NOTIFICATION_OPTIONS = [
  { field: "sms" as const, label: "Text Messages" },
  { field: "email" as const, label: "Email" },
  { field: "marketing" as const, label: "Promotions & News" },
];

interface StepProps {
  form: AssistantOnboardingForm;
  onNext: () => void;
  stepNum: number;
  avatarUrl?: string;
}

export function StepContactPrefs({ form, onNext, stepNum, avatarUrl }: StepProps) {
  const phoneRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);
  const firstName = form.getFieldValue("firstName");
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
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-accent font-medium">{stepNum}</span>
          <span className="text-accent">&rarr;</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-medium text-foreground leading-snug">
          Contact preferences
        </h1>
        <p className="text-muted text-sm mt-2">How should we reach you about shifts and updates?</p>
      </motion.div>

      {/* Avatar + locked email */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-3"
      >
        {/* Profile photo or initials */}
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={firstName ?? ""}
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <span className="text-accent font-semibold text-sm">
              {firstName?.[0]?.toUpperCase() ?? "?"}
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

      {/* Phone with auto-formatting */}
      <form.Field name="phone">
        {(field) => {
          const rawDigits = field.state.value ?? "";
          const displayValue = rawDigits.length > 0 ? formatPhone(rawDigits) : "";

          return (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
                Phone <span className="normal-case text-muted/50">(optional)</span>
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
                className="w-full max-w-[360px] px-0 py-2 text-lg bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </motion.div>
          );
        }}
      </form.Field>

      {/* Instagram handle */}
      <form.Field name="instagramHandle">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
              Instagram{" "}
              <span className="normal-case text-muted/50">(optional — for your portfolio)</span>
            </label>
            <div className="flex items-center max-w-[360px] border-b-2 border-foreground/15 focus-within:border-accent transition-colors duration-200">
              <span className="text-muted/50 text-lg pb-2 pr-0.5 select-none">@</span>
              <input
                type="text"
                placeholder="yourhandle"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value.replace(/^@/, ""))}
                onFocus={() => (inputFocusedRef.current = true)}
                onBlur={() => {
                  inputFocusedRef.current = false;
                  field.handleBlur();
                }}
                className="flex-1 px-0 py-2 text-lg bg-transparent
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none"
              />
            </div>
          </motion.div>
        )}
      </form.Field>

      {/* Notification preferences */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-3">
          Notifications
        </p>
        <div className="space-y-2">
          {NOTIFICATION_OPTIONS.map((option, i) => (
            <form.Field key={option.field} name={`notifications.${option.field}`}>
              {(field) => (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => field.handleChange(!field.state.value)}
                  className="flex items-center justify-between w-full max-w-[360px] py-1.5 text-left"
                >
                  <span className="text-sm text-foreground">{option.label}</span>
                  <div
                    className={`
                      relative w-9 h-5 rounded-full shrink-0 transition-colors duration-200
                      ${field.state.value ? "bg-accent" : "bg-foreground/15"}
                    `}
                  >
                    <motion.div
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                      animate={{ left: field.state.value ? 18 : 2 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                  </div>
                </motion.button>
              )}
            </form.Field>
          ))}
        </div>
      </motion.div>

      {/* OK — always enabled since email is pre-filled */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-3 pt-1"
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
