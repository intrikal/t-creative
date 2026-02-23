"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { AssistantOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AssistantOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

const POLICIES = [
  {
    key: "policyClientPhotos" as const,
    letter: "A",
    label: "Client photo consent",
    text: "I understand that sharing client photos online requires their explicit consent first",
  },
  {
    key: "policyConfidentiality" as const,
    letter: "B",
    label: "Confidentiality",
    text: "I will keep all client information private and not share it without permission",
  },
  {
    key: "policyConduct" as const,
    letter: "C",
    label: "Studio conduct",
    text: "I agree to represent T Creative Studio professionally in person and online",
  },
  {
    key: "policyCompensation" as const,
    letter: "D",
    label: "Compensation",
    text: "I acknowledge the compensation structure that was communicated to me",
  },
];

export function StepAssistantPolicies({ form, onNext, stepNum }: StepProps) {
  const [agreed, setAgreed] = useState<Record<string, boolean>>(() => ({
    policyClientPhotos: (form.getFieldValue("policyClientPhotos") as boolean) ?? false,
    policyConfidentiality: (form.getFieldValue("policyConfidentiality") as boolean) ?? false,
    policyConduct: (form.getFieldValue("policyConduct") as boolean) ?? false,
    policyCompensation: (form.getFieldValue("policyCompensation") as boolean) ?? false,
  }));

  const allAgreed = POLICIES.every((p) => agreed[p.key]);

  const handleAgree = useCallback(
    (key: string) => {
      setAgreed((prev) => {
        if (prev[key]) return prev;
        const next = { ...prev, [key]: true };
        form.setFieldValue(key as keyof typeof form.state.values, true);
        return next;
      });
    },
    [form],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && allAgreed) onNext();
      const letter = e.key.toUpperCase();
      const policy = POLICIES.find((p) => p.letter === letter);
      if (policy && !agreed[policy.key]) handleAgree(policy.key);
    },
    [allAgreed, agreed, onNext, handleAgree],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="space-y-3">
      {/* Header */}
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
          Studio policies
        </h1>
        <p className="text-muted text-sm mt-1">
          These protect you, your clients, and T Creative. Review the details on the right.
        </p>
      </motion.div>

      {/* Agreement toggles */}
      {POLICIES.map((policy, i) => (
        <motion.button
          key={policy.key}
          type="button"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => handleAgree(policy.key)}
          className={`
            group flex items-start gap-3 w-full px-4 py-3 rounded-md text-left
            transition-all duration-150 border
            ${
              agreed[policy.key]
                ? "border-accent bg-accent/5 shadow-sm"
                : "border-foreground/10 hover:border-foreground/20 hover:bg-surface/60"
            }
          `}
        >
          <span
            className={`
              inline-flex items-center justify-center w-7 h-7 rounded text-xs font-medium
              border transition-colors duration-150 shrink-0 mt-px
              ${
                agreed[policy.key]
                  ? "border-accent bg-accent text-white"
                  : "border-foreground/15 text-foreground/70 group-hover:border-foreground/25"
              }
            `}
          >
            {agreed[policy.key] ? (
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 8.5L6.5 11L12 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              policy.letter
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-0.5">
              {policy.label}
            </p>
            <p className="text-sm text-foreground leading-snug">{policy.text}</p>
          </div>
        </motion.button>
      ))}

      {/* OK */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-3 pt-1"
      >
        <button
          type="button"
          onClick={onNext}
          disabled={!allAgreed}
          className={`
            inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md
            transition-all duration-200
            ${
              allAgreed
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
        {allAgreed && (
          <span className="text-xs text-muted/50">
            press <strong className="text-muted/70">Enter &crarr;</strong>
          </span>
        )}
      </motion.div>
    </div>
  );
}
