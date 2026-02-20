"use client";

/**
 * StepContact.tsx — Combined contact info, availability, and notification preferences step.
 * Collects email (required), phone (optional with auto-formatting), availability
 * (weekdays/weekends/time-of-day as pill toggles), and notification preferences
 * (SMS, email, marketing as compact toggle switches). Keyboard shortcuts A-E
 * toggle availability when not focused on an input. Enter advances if email is non-empty.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
// `type` import: only used at compile time for type-checking, stripped from
// the final JavaScript bundle. Keeps runtime code smaller.
import type { OnboardingForm } from "../OnboardingFlow";

/**
 * formatPhone — formats a string of raw digits into (XXX) XXX-XXXX display format.
 * Only handles up to 10 digits (US local number, no country code).
 */
function formatPhone(digits: string): string {
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

type AvailField = "weekdays" | "weekends" | "mornings" | "afternoons" | "evenings";

// Each availability option has a hidden `letter` for keyboard shortcuts (A-E).
// Labels are self-explanatory so descriptions are omitted from the UI.
const AVAILABILITY_OPTIONS: { field: AvailField; label: string; letter: string }[] = [
  { field: "weekdays", label: "Weekdays", letter: "A" },
  { field: "weekends", label: "Weekends", letter: "B" },
  { field: "mornings", label: "Mornings", letter: "C" },
  { field: "afternoons", label: "Afternoons", letter: "D" },
  { field: "evenings", label: "Evenings", letter: "E" },
];

// "as const" on each field value locks its type to the exact literal string
// (e.g. "sms" instead of generic string), enabling stricter type checking.
const NOTIFICATION_OPTIONS = [
  { field: "sms" as const, label: "Text Messages" },
  { field: "email" as const, label: "Email" },
  { field: "marketing" as const, label: "Promotions & News" },
];

// `interface`: a TypeScript construct that defines the required shape of an object.
// Components receiving StepProps must provide all three properties below.
interface StepProps {
  form: OnboardingForm;
  // Arrow function type: `() => void` means "a function that takes nothing and returns nothing."
  onNext: () => void;
  stepNum: number;
}

// Destructuring: `{ form, onNext, stepNum }` unpacks these properties from
// the props object so you use `form` directly instead of `props.form`.
export function StepContact({ form, onNext, stepNum }: StepProps) {
  // useRef: creates a mutable reference that persists across renders without
  // triggering re-renders. `.current` holds the actual DOM element (or null).
  const emailRef = useRef<HTMLInputElement>(null);

  // Track whether an input element is currently focused, so keyboard shortcuts
  // (A-E for availability) are suppressed while the user is typing.
  const inputFocusedRef = useRef(false);

  // useState returns [currentValue, setterFunction].
  // Record<AvailField, boolean> is a TypeScript utility type: an object where keys are
  // AvailField ("weekdays" | "weekends" | ...) and all values are booleans.
  // The () => { ... } is a lazy initializer — only runs on first render, not every re-render.
  const [selected, setSelected] = useState<Record<AvailField, boolean>>(() => {
    const vals: Record<string, boolean> = {};
    for (const o of AVAILABILITY_OPTIONS) {
      // `as "availability.weekdays"` is a type assertion — TanStack Form expects exact string
      // literal types for nested paths, so we cast the dynamic string to satisfy the type checker.
      vals[o.field] =
        form.getFieldValue(`availability.${o.field}` as "availability.weekdays") ?? false;
    }
    // `as Record<AvailField, boolean>` narrows the type from Record<string, boolean>
    // to the more specific AvailField keys, matching the useState type parameter above.
    return vals as Record<AvailField, boolean>;
  });

  // useCallback wraps the function so React reuses the same reference between renders.
  // It only creates a new function when [form] changes (the dependency array).
  const toggle = useCallback(
    (field: AvailField) => {
      // Passing a function to setSelected gives you `prev` (the current state).
      setSelected((prev) => {
        // { ...prev } spreads (copies) all properties from prev into a new object.
        // [field] is a computed property name — the variable's value becomes the key.
        // Together: "copy everything, but flip the value for this specific field."
        const next = { ...prev, [field]: !prev[field] };
        for (const o of AVAILABILITY_OPTIONS) {
          // Same type assertion workaround for TanStack Form's strict nested field paths.
          form.setFieldValue(`availability.${o.field}` as "availability.weekdays", next[o.field]);
        }
        return next;
      });
    },
    [form],
  );

  // useCallback: caches this function so React reuses the same instance across
  // renders. Only creates a new one when something in the dependency array changes.
  const handleKeyDown = useCallback(
    // `KeyboardEvent`: TypeScript type annotation for keyboard events,
    // giving autocomplete and type safety for properties like `.key`.
    (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        // `?.` optional chaining: if `getFieldValue` returns null/undefined,
        // `.trim()` is skipped instead of crashing with a TypeError.
        const email = form.getFieldValue("email")?.trim();
        if (email) onNext();
      }

      // Only handle letter shortcuts when not typing in an input field.
      // inputFocusedRef.current is true when an <input> has focus.
      if (!inputFocusedRef.current) {
        const letter = e.key.toUpperCase();
        // .find() returns the first element matching the condition, or undefined if none match.
        const option = AVAILABILITY_OPTIONS.find((o) => o.letter === letter);
        if (option) toggle(option.field);
      }
    },
    // Dependency array: only recreate the function when these values change.
    [onNext, form, toggle],
  );

  // useEffect: runs side-effect code after the component renders.
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    // Cleanup return: runs when the component unmounts or before the effect
    // re-runs. Removes the listener to prevent memory leaks.
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Dependency array: re-run only when `handleKeyDown` changes.
  }, [handleKeyDown]);

  useEffect(() => {
    // `emailRef.current` is the actual <input> DOM node (or null).
    // `?.` optional chaining safely calls `.focus()` only if the ref exists.
    emailRef.current?.focus();
    // Empty `[]`: runs once on mount (when the component first appears).
  }, []);

  return (
    <div className="space-y-4">
      {/* Question header */}
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
        <p className="text-muted text-sm mt-2">Your contact info and scheduling preferences.</p>
      </motion.div>

      {/* Email input */}
      {/* form.Field render prop: `{(field) => ...}` passes the field's state
          and event handlers as `field` so you can wire them to inputs. */}
      <form.Field name="email">
        {(field) => (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-1"
          >
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Email *
            </label>
            {/* field.state.value: the current value TanStack Form holds for this field.
                field.handleChange: updates the form state when the user types.
                field.handleBlur: notifies the form when the user leaves the input. */}
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

      {/* Phone input with auto-formatting */}
      <form.Field name="phone">
        {/* Render prop pattern: the function receives `field` with state/handlers. */}
        {(field) => {
          // The form stores raw digits only (e.g. "5551234567").
          // We format them for display as (555) 123-4567.
          const rawDigits = field.state.value ?? "";
          const displayValue = rawDigits.length > 0 ? formatPhone(rawDigits) : "";

          return (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-1"
            >
              <label className="text-xs font-medium text-muted uppercase tracking-wide">
                Phone <span className="normal-case text-muted/60">(optional)</span>
              </label>
              <input
                type="tel"
                placeholder="(555) 123-4567"
                // Display the formatted version, but store raw digits in form state.
                value={displayValue}
                onChange={(e) => {
                  // Strip all non-digit characters from the input, then cap at 10 digits.
                  // `.replace(/\D/g, "")` removes every character that isn't 0-9.
                  // `.slice(0, 10)` enforces the max length for a US local number.
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

      {/* Availability section — flex-wrap pill toggles with hidden keyboard shortcuts A-E */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
          Availability
        </p>

        {/* Pill/chip toggles in a wrapping row. Each pill is a small rounded button.
            Keyboard shortcuts A-E still work (handled in handleKeyDown above). */}
        <div className="flex flex-wrap gap-2">
          {/* .map() transforms each array element into a piece of UI (a pill button here). */}
          {AVAILABILITY_OPTIONS.map((option, i) => {
            const isSelected = selected[option.field];
            return (
              <motion.button
                key={option.field}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => toggle(option.field)}
                // Small rounded pill: accent border+bg when selected, foreground/10 border when not.
                className={`
                  px-3 py-1.5 text-xs rounded-full border transition-all duration-150
                  ${
                    isSelected
                      ? "border-accent bg-accent/10 text-accent font-medium"
                      : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
                  }
                `}
              >
                {option.label}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Notification preferences section — compact rows with label + toggle switch */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
          Notification preferences
        </p>

        {/* Each notification row: label on left, mini toggle switch on right. No card wrapper. */}
        <div className="space-y-1.5">
          {NOTIFICATION_OPTIONS.map((option, i) => (
            <form.Field key={option.field} name={`notifications.${option.field}`}>
              {(field) => (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  // field.handleChange(!field.state.value) toggles the boolean:
                  // if it's true, !true becomes false, and vice versa.
                  onClick={() => field.handleChange(!field.state.value)}
                  className="flex items-center justify-between w-full py-1 text-left"
                >
                  <span className="text-sm text-foreground">{option.label}</span>

                  {/* Toggle switch indicator — mini pill toggle */}
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

      {/* OK button — gated on email non-empty */}
      <form.Field name="email">
        {(field) => {
          const canContinue = field.state.value.trim().length > 0;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
              className="flex items-center gap-3"
            >
              <button
                type="button"
                onClick={onNext}
                disabled={!canContinue}
                // Template literal with `${}`: backtick strings let you embed
                // expressions. Here it conditionally picks CSS classes.
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
