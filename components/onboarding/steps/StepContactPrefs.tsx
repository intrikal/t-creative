"use client";

import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
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
}

export function StepContactPrefs({ form, onNext, stepNum }: StepProps) {
  const emailRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const email = form.getFieldValue("email")?.trim();
        if (email) onNext();
      }
    },
    [onNext, form],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  return (
    <div className="space-y-6">
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

      {/* Email */}
      <form.Field name="email">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
              Email <span className="text-accent">*</span>
            </label>
            <input
              ref={emailRef}
              type="email"
              placeholder="you@email.com"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
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
        )}
      </form.Field>

      {/* Phone with auto-formatting */}
      <form.Field name="phone">
        {(field) => {
          const rawDigits = field.state.value ?? "";
          const displayValue = rawDigits.length > 0 ? formatPhone(rawDigits) : "";

          return (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
                Phone <span className="normal-case text-muted/50">(optional)</span>
              </label>
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={displayValue}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  field.handleChange(digits);
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
            transition={{ delay: 0.3, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
        transition={{ delay: 0.4, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
                  transition={{ delay: 0.45 + i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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

      {/* OK */}
      <form.Field name="email">
        {(field) => {
          const canContinue = field.state.value.trim().length > 0;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="flex items-center gap-3 pt-1"
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
          );
        }}
      </form.Field>
    </div>
  );
}
