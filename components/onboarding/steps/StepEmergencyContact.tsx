"use client";

import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import type { AssistantOnboardingForm } from "../OnboardingFlow";

function formatPhone(digits: string): string {
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

interface StepProps {
  form: AssistantOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepEmergencyContact({ form, onNext, stepNum }: StepProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const name = form.getFieldValue("emergencyContactName")?.trim();
        const phone = form.getFieldValue("emergencyContactPhone")?.trim();
        if (name && phone) onNext();
      }
    },
    [onNext, form],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    nameRef.current?.focus();
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
          Emergency contact
        </h1>
        <p className="text-muted text-sm mt-2">Someone we can reach in case of an emergency.</p>
      </motion.div>

      {/* Name */}
      <form.Field name="emergencyContactName">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
              Name <span className="text-accent">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              placeholder="Contact name"
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
      <form.Field name="emergencyContactPhone">
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
                Phone <span className="text-accent">*</span>
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

      {/* Relationship */}
      <form.Field name="emergencyContactRelation">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
              Relationship <span className="normal-case text-muted/50">(optional)</span>
            </label>
            <input
              type="text"
              placeholder='e.g. "Spouse", "Parent"'
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

      {/* OK */}
      <form.Field name="emergencyContactName">
        {(nameField) => (
          <form.Field name="emergencyContactPhone">
            {(phoneField) => {
              const canContinue =
                nameField.state.value.trim().length > 0 && phoneField.state.value.trim().length > 0;
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
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
        )}
      </form.Field>
    </div>
  );
}
