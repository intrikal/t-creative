"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import type { AssistantOnboardingForm } from "../OnboardingFlow";

const SKILL_OPTIONS: {
  id: "lash" | "jewelry" | "crochet" | "consulting";
  label: string;
  letter: string;
}[] = [
  { id: "lash", label: "Lash Extensions", letter: "A" },
  { id: "jewelry", label: "Permanent Jewelry", letter: "B" },
  { id: "crochet", label: "Custom Crochet", letter: "C" },
  { id: "consulting", label: "Business Consulting", letter: "D" },
];

const EXPERIENCE_OPTIONS = [
  { id: "junior" as const, label: "Junior", sub: "< 1 yr" },
  { id: "mid" as const, label: "Mid-level", sub: "1–3 yrs" },
  { id: "senior" as const, label: "Senior", sub: "3+ yrs" },
];

type CertId = "tcreative_lash" | "tcreative_jewelry" | "external_lash" | "external_jewelry";
const CERT_OPTIONS: { id: CertId; label: string }[] = [
  { id: "tcreative_lash", label: "T Creative Lash" },
  { id: "tcreative_jewelry", label: "T Creative Jewelry" },
  { id: "external_lash", label: "Lash (external)" },
  { id: "external_jewelry", label: "Jewelry (external)" },
];

const WORK_STYLE_OPTIONS = [
  { id: "client_facing" as const, label: "Client-facing" },
  { id: "back_of_house" as const, label: "Support" },
  { id: "both" as const, label: "Both" },
];

interface StepProps {
  form: AssistantOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepRoleSkills({ form, onNext, stepNum }: StepProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);

  const [selectedSkills, setSelectedSkills] = useState<
    ("lash" | "jewelry" | "crochet" | "consulting")[]
  >(() => form.getFieldValue("skills") ?? []);
  const [selectedCerts, setSelectedCerts] = useState<CertId[]>(
    () => (form.getFieldValue("certifications") as CertId[]) ?? [],
  );

  const canContinue = selectedSkills.length > 0;

  const toggleSkill = useCallback(
    (id: "lash" | "jewelry" | "crochet" | "consulting") => {
      setSelectedSkills((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        form.setFieldValue("skills", next);
        return next;
      });
    },
    [form],
  );

  const toggleCert = useCallback(
    (id: CertId) => {
      setSelectedCerts((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        form.setFieldValue("certifications", next);
        return next;
      });
    },
    [form],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && canContinue) onNext();
      if (!inputFocusedRef.current) {
        const letter = e.key.toUpperCase();
        const option = SKILL_OPTIONS.find((o) => o.letter === letter);
        if (option) toggleSkill(option.id);
      }
    },
    [canContinue, onNext, toggleSkill],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    titleRef.current?.focus();
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
          Tell us about your role
        </h1>
        <p className="text-muted text-sm mt-1">Your title, skills, and experience level.</p>
      </motion.div>

      {/* Preferred title */}
      <form.Field name="preferredTitle">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-1.5">
              Preferred Title <span className="normal-case text-muted/50">(optional)</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              placeholder='e.g. "Lash Tech", "Senior Assistant"'
              value={field.state.value}
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

      {/* Skills */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-1.5">
          Skills <span className="text-accent">*</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_OPTIONS.map((option, i) => {
            const isSelected = selectedSkills.includes(option.id);
            return (
              <motion.button
                key={option.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => toggleSkill(option.id)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border
                  transition-all duration-150
                  ${
                    isSelected
                      ? "border-accent bg-accent/10 text-accent font-medium"
                      : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
                  }
                `}
              >
                <span
                  className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-medium
                  ${isSelected ? "bg-accent text-white" : "bg-foreground/8 text-foreground/50"}`}
                >
                  {option.letter}
                </span>
                {option.label}
                {isSelected && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-accent"
                  >
                    <path
                      d="M4 8.5L6.5 11L12 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Experience level — pills */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-1.5">
          Experience
        </p>
        <form.Field name="experienceLevel">
          {(field) => (
            <div className="flex flex-wrap gap-1.5">
              {EXPERIENCE_OPTIONS.map((option) => {
                const isSelected = field.state.value === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => field.handleChange(option.id)}
                    className={`
                      inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border
                      transition-all duration-150
                      ${
                        isSelected
                          ? "border-accent bg-accent/10 text-accent font-medium"
                          : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
                      }
                    `}
                  >
                    {option.label}
                    <span
                      className={`text-[10px] ${isSelected ? "text-accent/70" : "text-muted/50"}`}
                    >
                      {option.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </form.Field>
      </motion.div>

      {/* Bio */}
      <form.Field name="bio">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-1.5">
              Short Bio <span className="normal-case text-muted/50">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="A few words about yourself..."
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onFocus={() => (inputFocusedRef.current = true)}
              onBlur={() => {
                inputFocusedRef.current = false;
                field.handleBlur();
              }}
              className="w-full max-w-[360px] px-0 py-1.5 text-sm bg-transparent border-b-2 border-foreground/15
                placeholder:text-muted/30 text-foreground focus:outline-none focus:border-accent transition-colors duration-200"
            />
          </motion.div>
        )}
      </form.Field>

      {/* Certifications */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-1.5">
          Certifications <span className="normal-case text-muted/50">(optional)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CERT_OPTIONS.map((cert) => {
            const isSelected = selectedCerts.includes(cert.id);
            return (
              <button
                key={cert.id}
                type="button"
                onClick={() => toggleCert(cert.id)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border
                  transition-all duration-150
                  ${
                    isSelected
                      ? "border-accent bg-accent/10 text-accent font-medium"
                      : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
                  }
                `}
              >
                {isSelected && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-accent"
                  >
                    <path
                      d="M4 8.5L6.5 11L12 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {cert.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Work style — pills */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-1.5">
          Work Style
        </p>
        <form.Field name="workStyle">
          {(field) => (
            <div className="flex flex-wrap gap-1.5">
              {WORK_STYLE_OPTIONS.map((option) => {
                const isSelected = field.state.value === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => field.handleChange(option.id)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs border transition-all duration-150
                      ${
                        isSelected
                          ? "border-accent bg-accent/10 text-accent font-medium"
                          : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
                      }
                    `}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </form.Field>
      </motion.div>

      {/* OK */}
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
    </div>
  );
}
