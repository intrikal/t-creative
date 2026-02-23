"use client";

/**
 * StepAdminContact — step 2 of the admin onboarding wizard.
 *
 * ## Responsibility
 * Collects the admin's phone number and notification preferences (SMS + email).
 * Email is read-only — it's the Google auth email and cannot be changed here.
 *
 * ## Phone formatting
 * `formatPhone()` transforms a raw digit string into US phone format:
 * - "305" → "(305"
 * - "3055551" → "(305) 555-1"
 * - "3055551234" → "(305) 555-1234"
 * The input's `onChange` strips all non-digits from the pasted/typed value
 * (via `.replace(/\D/g, "")`) and truncates to 10 digits before storing.
 * This keeps the form state as a clean digit string while showing formatted text.
 *
 * ## Notification toggles
 * SMS toggle reads the phone digit count via `form.Subscribe` to detect whether
 * a phone number has been entered:
 * - If SMS is on but phone is empty/short: toggle turns amber with a warning banner.
 * - This avoids needing two separate `form.Field` renders for the same toggle.
 *
 * ## Keyboard handling
 * - Enter in the phone input calls `onNext()` directly (skips global listener).
 * - Global window keydown listener fires `onNext()` when Enter is pressed and
 *   no input is focused (tracked by `inputFocusedRef`).
 *
 * ## Props
 * @prop form - the TanStack Form instance (AdminOnboardingForm)
 * @prop onNext - advances to step 3
 * @prop stepNum - displayed as the step badge number
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { LuLock, LuBell, LuMail, LuTriangleAlert } from "react-icons/lu";
import type { AdminOnboardingForm } from "../OnboardingFlow";

function formatPhone(digits: string): string {
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

interface StepProps {
  form: AdminOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepAdminContact({ form, onNext, stepNum }: StepProps) {
  const phoneRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);
  const firstName = form.getFieldValue("firstName");

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
          How do we reach you{firstName ? `, ${firstName}` : ""}?
        </h1>
        <p className="text-sm text-foreground/60 mt-0.5 leading-relaxed">
          Every booking, payment, and no-show — you&apos;ll know the second it happens.
        </p>
      </motion.div>

      {/* Email — read-only, no label */}
      <form.Field name="email">
        {(field) =>
          field.state.value ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/8"
            >
              <LuMail className="w-3 h-3 text-muted/40 shrink-0" />
              <span className="text-xs text-muted/60">{field.state.value}</span>
              <LuLock className="w-2.5 h-2.5 text-muted/25 shrink-0" />
            </motion.div>
          ) : null
        }
      </form.Field>

      {/* Phone */}
      <form.Field name="phone">
        {(field) => {
          const rawDigits = field.state.value ?? "";
          const displayValue = rawDigits.length > 0 ? formatPhone(rawDigits) : "";
          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1.5">
                Phone{" "}
                <span className="normal-case font-normal text-muted/50">
                  — for instant booking alerts
                </span>
              </p>
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
                className="w-full max-w-[320px] px-0 py-1.5 text-lg bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/30 text-foreground focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </motion.div>
          );
        }}
      </form.Field>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-1.5"
      >
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1">
          Notify me when
        </p>

        {/* SMS toggle — use Subscribe for phone to avoid nested form.Field */}
        <form.Subscribe selector={(s) => (s.values.phone ?? "").length >= 10}>
          {(hasPhone) => (
            <form.Field name="notifySms">
              {(smsField) => {
                const smsOn = smsField.state.value;
                const warn = smsOn && !hasPhone;
                return (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => smsField.handleChange(!smsOn)}
                      className="flex items-center justify-between w-full max-w-[360px]"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${warn ? "bg-amber-400/12" : "bg-rose-400/12"}`}
                        >
                          <LuBell
                            className={warn ? "text-amber-400" : "text-rose-400"}
                            style={{ width: 13, height: 13 }}
                          />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground leading-tight">
                            New booking or payment
                          </p>
                          <p
                            className={`text-xs leading-tight mt-0.5 ${warn ? "text-amber-500/70" : "text-muted/55"}`}
                          >
                            {hasPhone
                              ? "Text me instantly"
                              : smsOn
                                ? "Add a phone number to activate"
                                : "Text me for every booking"}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-9 h-5 rounded-full border transition-colors duration-200 shrink-0 ml-3
                        ${
                          smsOn
                            ? warn
                              ? "bg-amber-400 border-amber-400"
                              : "bg-accent border-accent"
                            : "bg-foreground/8 border-foreground/20"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-[3px] ${smsOn ? "translate-x-[18px]" : "translate-x-[3px]"}`}
                        />
                      </div>
                    </button>
                    {warn && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/8 border border-amber-400/20 max-w-[360px]">
                        <LuTriangleAlert className="w-3 h-3 text-amber-400 shrink-0" />
                        <p className="text-[11px] text-amber-500/80">
                          Add a phone number to receive SMS alerts.
                        </p>
                      </div>
                    )}
                  </div>
                );
              }}
            </form.Field>
          )}
        </form.Subscribe>

        {/* Email toggle */}
        <form.Field name="notifyEmail">
          {(field) => (
            <button
              type="button"
              onClick={() => field.handleChange(!field.state.value)}
              className="flex items-center justify-between w-full max-w-[360px]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent/12 flex items-center justify-center shrink-0">
                  <LuMail className="text-accent" style={{ width: 13, height: 13 }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    Booking confirmations
                  </p>
                  <p className="text-xs text-muted/55 leading-tight mt-0.5">
                    Email receipts and daily summaries
                  </p>
                </div>
              </div>
              <div
                className={`w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ml-3 ${field.state.value ? "bg-accent" : "bg-foreground/15"}`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-[3px] ${field.state.value ? "translate-x-[18px]" : "translate-x-[3px]"}`}
                />
              </div>
            </button>
          )}
        </form.Field>
      </motion.div>

      {/* Continue */}
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
          Got it
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
