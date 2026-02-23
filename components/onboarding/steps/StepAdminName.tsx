"use client";

/**
 * StepAdminName — step 1 of the admin onboarding wizard.
 *
 * ## Responsibility
 * Collects the admin's first and last name. Pre-fills from Google OAuth metadata
 * when available. Doubles as a welcoming identity confirmation screen.
 *
 * ## UX design
 * - If a Google avatar + email are present (passed via props), they are shown
 *   as an inline identity chip above the greeting — reassures the user they're
 *   signed in as the right account.
 * - The h1 greeting updates live: "Welcome to your studio." → "Hey, Trini!" as
 *   they type, driven by a nested `form.Field` subscribe.
 * - Enter on the first name field moves focus to the last name field (via `lastRef`).
 * - Enter on the last name field (or the global window keydown listener) calls
 *   `onNext()` — but only if `firstName` is non-empty, so the form can't be
 *   advanced without a name.
 * - The "That's me" button is disabled (greyed out, not just visually) until
 *   `firstName.trim().length > 0`.
 *
 * ## Keyboard handling
 * A global `window.addEventListener("keydown", ...)` fires on Enter. This
 * pattern is used across all admin steps to match the fast keyboard-driven UX.
 * The listener is cleaned up in the useEffect return to prevent leaks.
 *
 * ## Props
 * @prop form - the TanStack Form instance (AdminOnboardingForm)
 * @prop onNext - advances to step 2
 * @prop stepNum - displayed as the step badge number
 * @prop avatarUrl - Google profile photo URL (optional)
 * @prop fullName - Google full name used for the identity chip and initials fallback
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { AdminOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AdminOnboardingForm;
  onNext: () => void;
  stepNum: number;
  avatarUrl?: string;
  fullName?: string;
}

export function StepAdminName({ form, onNext, stepNum, avatarUrl, fullName }: StepProps) {
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const first = form.getFieldValue("firstName")?.trim();
        if (first) onNext();
      }
    },
    [onNext, form],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    firstRef.current?.select();
  }, []);

  const initials = fullName
    ? fullName
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "TC";

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
      >
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/12 text-accent text-xs font-bold">
            {stepNum}
          </span>
          <span className="text-xs font-medium text-muted/50 uppercase tracking-wider">of 8</span>
        </div>

        {/* Identity — inline, no card, flows with the step */}
        <form.Field name="email">
          {(field) =>
            field.state.value ? (
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11 shrink-0 rounded-xl">
                  {avatarUrl && (
                    <AvatarImage
                      src={avatarUrl}
                      alt={fullName ?? "Profile"}
                      className="rounded-xl"
                    />
                  )}
                  <AvatarFallback className="bg-accent/15 text-accent text-sm font-semibold rounded-xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  {fullName && (
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">
                      {fullName}
                    </p>
                  )}
                  <p className="text-sm text-muted/60 truncate">{field.state.value}</p>
                </div>
              </div>
            ) : null
          }
        </form.Field>

        {/* Greeting */}
        <div className="space-y-2">
          <form.Field name="firstName">
            {(field) => (
              <h1 className="text-3xl sm:text-4xl font-semibold text-foreground leading-tight">
                {field.state.value ? `Hey, ${field.state.value}!` : "Welcome to your studio."}
              </h1>
            )}
          </form.Field>
          <p className="text-foreground/60 text-sm leading-relaxed">
            You&apos;ve built something real — lashes, jewelry, crochet, and consulting. Now
            let&apos;s give it a home. What should we call you?
          </p>
        </div>
      </motion.div>

      {/* First + last name inputs stacked */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4 max-w-[320px]"
      >
        <form.Field name="firstName">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                First name
              </label>
              <input
                ref={firstRef}
                type="text"
                placeholder="Trini"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (field.state.value.trim()) lastRef.current?.focus();
                  }
                }}
                onBlur={field.handleBlur}
                className="px-0 py-2 text-2xl bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/25 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="lastName">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                Last name
              </label>
              <input
                ref={lastRef}
                type="text"
                placeholder="Quach"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const first = form.getFieldValue("firstName")?.trim();
                    if (first) onNext();
                  }
                }}
                onBlur={field.handleBlur}
                className="px-0 py-2 text-2xl bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/25 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </div>
          )}
        </form.Field>
      </motion.div>

      {/* Continue */}
      <form.Field name="firstName">
        {(field) => {
          const canContinue = field.state.value.trim().length > 0;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-3 pt-2"
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
                That&apos;s me
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
