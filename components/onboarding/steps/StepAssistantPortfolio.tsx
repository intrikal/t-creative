"use client";

import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import type { AssistantOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AssistantOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepAssistantPortfolio({ form, onNext, stepNum }: StepProps) {
  const inputFocusedRef = useRef(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // All fields are optional — always allow continuing
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
    firstInputRef.current?.focus();
  }, []);

  return (
    <div className="space-y-4">
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
          Portfolio &amp; socials
        </h1>
        <p className="text-muted text-sm mt-1">
          Where can clients and students find your work? All fields are optional.
        </p>
      </motion.div>

      {/* Portfolio Instagram */}
      <form.Field name="portfolioInstagram">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-1.5">
              Portfolio Instagram{" "}
              <span className="normal-case text-muted/50">(separate from personal, optional)</span>
            </label>
            <div className="relative max-w-[360px]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted/50 text-base select-none">
                @
              </span>
              <input
                ref={firstInputRef}
                type="text"
                placeholder="yourportfolio"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value.replace(/^@/, ""))}
                onFocus={() => (inputFocusedRef.current = true)}
                onBlur={() => {
                  inputFocusedRef.current = false;
                  field.handleBlur();
                }}
                className="w-full pl-4 pr-0 py-1.5 text-base bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/30 text-foreground focus:outline-none focus:border-accent transition-colors duration-200"
              />
            </div>
          </motion.div>
        )}
      </form.Field>

      {/* TikTok */}
      <form.Field name="tiktokHandle">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-1.5">
              TikTok <span className="normal-case text-muted/50">(optional)</span>
            </label>
            <div className="relative max-w-[360px]">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted/50 text-base select-none">
                @
              </span>
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
                className="w-full pl-4 pr-0 py-1.5 text-base bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/30 text-foreground focus:outline-none focus:border-accent transition-colors duration-200"
              />
            </div>
          </motion.div>
        )}
      </form.Field>

      {/* Website / portfolio link */}
      <form.Field name="portfolioWebsite">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-1.5">
              Website / Portfolio link <span className="normal-case text-muted/50">(optional)</span>
            </label>
            <input
              type="url"
              placeholder="yoursite.com"
              value={field.state.value ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onFocus={() => (inputFocusedRef.current = true)}
              onBlur={() => {
                inputFocusedRef.current = false;
                field.handleBlur();
              }}
              className="w-full max-w-[360px] px-0 py-1.5 text-base bg-transparent border-b-2 border-foreground/15
                placeholder:text-muted/30 text-foreground focus:outline-none focus:border-accent transition-colors duration-200"
            />
          </motion.div>
        )}
      </form.Field>

      {/* OK — always enabled */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="flex items-center gap-3 pt-1"
      >
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md
            bg-accent text-white hover:brightness-110 cursor-pointer transition-all duration-200"
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
