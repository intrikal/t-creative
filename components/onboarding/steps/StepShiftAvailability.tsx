"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { AssistantOnboardingForm } from "../OnboardingFlow";

type DayField = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

const DAY_OPTIONS: { field: DayField; label: string; short: string }[] = [
  { field: "monday", label: "Monday", short: "Mon" },
  { field: "tuesday", label: "Tuesday", short: "Tue" },
  { field: "wednesday", label: "Wednesday", short: "Wed" },
  { field: "thursday", label: "Thursday", short: "Thu" },
  { field: "friday", label: "Friday", short: "Fri" },
  { field: "saturday", label: "Saturday", short: "Sat" },
  { field: "sunday", label: "Sunday", short: "Sun" },
];

const SHIFT_TIME_OPTIONS = [
  { id: "morning" as const, label: "Morning" },
  { id: "afternoon" as const, label: "Afternoon" },
  { id: "evening" as const, label: "Evening" },
  { id: "flexible" as const, label: "Flexible" },
];

interface StepProps {
  form: AssistantOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepShiftAvailability({ form, onNext, stepNum }: StepProps) {
  const [selectedDays, setSelectedDays] = useState<Record<DayField, boolean>>(() => {
    const vals: Record<string, boolean> = {};
    for (const o of DAY_OPTIONS) {
      vals[o.field] =
        form.getFieldValue(`shiftAvailability.${o.field}` as "shiftAvailability.monday") ?? false;
    }
    return vals as Record<DayField, boolean>;
  });

  const hasAnyDay = Object.values(selectedDays).some(Boolean);
  const allSelected = DAY_OPTIONS.every((o) => selectedDays[o.field]);

  const toggleDay = useCallback(
    (field: DayField) => {
      setSelectedDays((prev) => {
        const next = { ...prev, [field]: !prev[field] };
        for (const o of DAY_OPTIONS) {
          form.setFieldValue(
            `shiftAvailability.${o.field}` as "shiftAvailability.monday",
            next[o.field],
          );
        }
        return next;
      });
    },
    [form],
  );

  const toggleAll = useCallback(() => {
    setSelectedDays((prev) => {
      const allOn = DAY_OPTIONS.every((o) => prev[o.field]);
      const next = {} as Record<DayField, boolean>;
      for (const o of DAY_OPTIONS) {
        next[o.field] = !allOn;
        form.setFieldValue(`shiftAvailability.${o.field}` as "shiftAvailability.monday", !allOn);
      }
      return next;
    });
  }, [form]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && hasAnyDay) onNext();
    },
    [hasAnyDay, onNext],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
          When are you available?
        </h1>
        <p className="text-muted text-sm mt-2">Select the days and times you can work.</p>
      </motion.div>

      {/* Day toggles */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
            Available Days <span className="text-accent">*</span>
          </p>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            onClick={toggleAll}
            className="text-xs text-accent hover:text-accent/80 transition-colors font-medium"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </motion.button>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((day, i) => {
            const isSelected = selectedDays[day.field];
            return (
              <motion.button
                key={day.field}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => toggleDay(day.field)}
                className={`
                  px-3.5 py-2 text-xs rounded-lg border transition-all duration-150
                  ${
                    isSelected
                      ? "border-accent bg-accent/10 text-accent font-medium"
                      : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
                  }
                `}
              >
                {day.short}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Shift time preference */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-3">
          Preferred Shift Time
        </p>
        <form.Field name="preferredShiftTime">
          {(field) => (
            <div className="flex flex-wrap gap-2">
              {SHIFT_TIME_OPTIONS.map((option) => {
                const isSelected = field.state.value === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => field.handleChange(option.id)}
                    className={`
                      px-3.5 py-2 text-xs rounded-lg border transition-all duration-150
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

      {/* Max hours per week */}
      <form.Field name="maxHoursPerWeek">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <label className="block text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
              Max Hours / Week <span className="normal-case text-muted/50">(optional)</span>
            </label>
            <input
              type="number"
              min={1}
              max={60}
              placeholder="20"
              value={field.state.value ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                field.handleChange(val);
              }}
              onBlur={field.handleBlur}
              className="w-full max-w-[120px] px-0 py-2 text-lg bg-transparent border-b-2 border-foreground/15
                placeholder:text-muted/30 text-foreground
                focus:outline-none focus:border-accent
                transition-colors duration-200"
            />
          </motion.div>
        )}
      </form.Field>

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
          disabled={!hasAnyDay}
          className={`
            inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md
            transition-all duration-200
            ${
              hasAnyDay
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
        {hasAnyDay && (
          <span className="text-xs text-muted/50">
            press <strong className="text-muted/70">Enter &crarr;</strong>
          </span>
        )}
      </motion.div>
    </div>
  );
}
