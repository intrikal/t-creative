"use client";

/**
 * StepFinalPrefs.tsx — Combined source/referral, photo consent + birthday step.
 * Compact layout: pill toggles for source, side-by-side consent buttons, inline birthday.
 */
// useState: creates reactive state. useEffect: runs side effects after render.
// useCallback: memoizes functions so they keep the same reference between renders.
// useRef: creates a persistent reference that survives re-renders without causing them.
import { useState, useEffect, useCallback, useRef } from "react";
// AnimatePresence enables exit animations for components that are conditionally
// rendered — without it, removed elements disappear instantly.
import { motion, AnimatePresence } from "framer-motion";
import type { OnboardingForm } from "../OnboardingFlow";

// "as const" freezes each id to its exact literal string type (e.g. "instagram"),
// rather than widening it to the generic `string` type. This lets TypeScript
// catch typos when you use these ids elsewhere.
const SOURCE_OPTIONS = [
  { id: "instagram" as const, label: "Instagram", letter: "A" },
  { id: "word_of_mouth" as const, label: "Word of Mouth", letter: "B" },
  { id: "google_search" as const, label: "Google Search", letter: "C" },
  { id: "referral" as const, label: "Friend Referral", letter: "D" },
  { id: "website_direct" as const, label: "Found the Website", letter: "E" },
];

// interface: TypeScript type contract defining the required shape for StepProps.
interface StepProps {
  form: OnboardingForm;
  onNext: () => void;
  stepNum: number;
}

export function StepFinalPrefs({ form, onNext, stepNum }: StepProps) {
  // --- Photo consent state ---
  // <"yes" | "no" | null> is a union type — choice can only be one of these three values.
  // useState returns [choice, setChoice]. The () => ... lazy initializer runs once on mount.
  const [choice, setChoice] = useState<"yes" | "no" | null>(() => {
    // form.getFieldValue() reads from TanStack Form state.
    // "as string" is a type assertion — tells TypeScript to treat this value as a string.
    const val = form.getFieldValue("photoConsent") as string;
    if (val === "yes" || val === "no") return val;
    return null;
  });

  // --- Referral state ---
  // useState returns [value, setter]. The () => ... is a lazy initializer —
  // the function runs only on the first render, avoiding repeated work.
  // Chained type assertions: `as "referral"` tells TanStack Form to accept
  // the dot-notation path, then `as unknown as string` converts through the
  // `unknown` escape hatch to get the actual string value type.
  const [referrerName, setReferrerName] = useState(
    () => (form.getFieldValue("referral.referrerName" as "referral") as unknown as string) ?? "",
  );
  const [referrerEmail, setReferrerEmail] = useState(
    () => (form.getFieldValue("referral.referrerEmail" as "referral") as unknown as string) ?? "",
  );
  const [referrerPhone, setReferrerPhone] = useState(
    () => (form.getFieldValue("referral.referrerPhone" as "referral") as unknown as string) ?? "",
  );

  // Track source in local state so changing it triggers a re-render for the
  // referral input reveal. form.getFieldValue() outside a form.Field render prop
  // does NOT subscribe to changes — reading it only gives a snapshot.
  const [currentSource, setCurrentSource] = useState(() => form.getFieldValue("source") as string);
  const isReferral = currentSource === "referral";

  // useRef<HTMLInputElement>(null) creates a typed DOM reference. The <HTMLInputElement>
  // part tells TypeScript this ref will point to an <input> element (so .focus() etc. are valid).
  const birthdayInputRef = useRef<HTMLInputElement>(null);
  // We use emailRef and phoneRef to programmatically chain focus via smart Enter.
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // canContinue: photo consent must be chosen AND (if referral is selected,
  // both referrer name and a valid email are required). Birthday is optional.
  // Regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/ is a basic email validation pattern:
  // [^\s@]+ = one or more chars that aren't whitespace or @, then @, then
  // another group, a literal dot, and a final group (e.g. "a@b.c").
  const referralValid =
    !isReferral ||
    (referrerName.trim().length > 0 &&
      referrerEmail.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referrerEmail.trim()));
  const canContinue = choice !== null && referralValid;

  // --- Source selection handler ---
  // useCallback(fn, deps) wraps `fn` so React keeps the same function reference
  // as long as the dependency array `deps` hasn't changed.
  const handleSelect = useCallback(
    // (typeof SOURCE_OPTIONS)[number]["id"] is a TypeScript indexed access type.
    // It reads the array type, grabs the element type via [number], then extracts
    // the "id" field — resulting in "instagram" | "word_of_mouth" | ... etc.
    (id: (typeof SOURCE_OPTIONS)[number]["id"]) => {
      form.setFieldValue("source", id);
      setCurrentSource(id);

      // When switching away from "referral", clear the referral fields and mark skipped.
      // When switching TO "referral", mark skipped=false so referral data is expected.
      if (id !== "referral") {
        setReferrerName("");
        setReferrerEmail("");
        setReferrerPhone("");
        // `as "referral"` asserts the field path for TanStack Form's strict types.
        // `as never` is a type assertion used when TanStack Form can't infer the
        // value type for nested field setters — it satisfies any expected type.
        form.setFieldValue("referral.referrerName" as "referral", "" as never);
        form.setFieldValue("referral.referrerEmail" as "referral", "" as never);
        form.setFieldValue("referral.referrerPhone" as "referral", "" as never);
        form.setFieldValue("referral.skipped" as "referral", true as never);
      } else {
        form.setFieldValue("referral.skipped" as "referral", false as never);
      }
    },
    [form],
  );

  // --- Referral input handlers ---
  const handleNameChange = useCallback(
    (value: string) => {
      setReferrerName(value);
      form.setFieldValue("referral.referrerName" as "referral", value as never);
    },
    [form],
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setReferrerEmail(value);
      form.setFieldValue("referral.referrerEmail" as "referral", value as never);
    },
    [form],
  );

  // Phone formatting helper — auto-formats digits as (XXX) XXX-XXXX.
  const formatReferrerPhone = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits.length ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }, []);

  const handlePhoneChange = useCallback(
    (value: string) => {
      const formatted = formatReferrerPhone(value);
      setReferrerPhone(formatted);
      form.setFieldValue("referral.referrerPhone" as "referral", formatted as never);
    },
    [form, formatReferrerPhone],
  );

  // --- Photo consent handlers ---
  // useCallback wraps selectYes so React reuses the same function reference.
  // [form] is the dependency array — only recreate if `form` changes.
  const selectYes = useCallback(() => {
    setChoice("yes");
    // form.setFieldValue() writes a value into TanStack Form state.
    form.setFieldValue("photoConsent", "yes");
  }, [form]);

  const selectNo = useCallback(() => {
    setChoice("no");
    form.setFieldValue("photoConsent", "no");
  }, [form]);

  // --- Keyboard handler ---
  // Dependency array includes all values referenced inside the callback.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check if the user is typing inside an input or textarea.
      // e.target is the DOM element that received the event; we cast it to
      // HTMLElement so we can read its tagName property.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Enter") {
          // Smart focus: when Enter is pressed in the referral name field and name is
          // already filled, move focus to email instead of advancing the step.
          if (
            (e.target as HTMLInputElement)?.placeholder === "Their first name" &&
            referrerName.trim()
          ) {
            e.preventDefault();
            emailRef.current?.focus();
          } else if (
            (e.target as HTMLInputElement)?.placeholder === "friend@example.com" &&
            referrerEmail.trim()
          ) {
            e.preventDefault();
            phoneRef.current?.focus();
          } else if (canContinue) {
            onNext();
          }
        }
        // Return early so letter shortcuts (A-E) don't fire while typing.
        return;
      }

      // Global Enter key advances when not inside an input.
      if (e.key === "Enter" && canContinue) onNext();

      // Letter shortcuts A-E select the corresponding source option.
      const letter = e.key.toUpperCase();
      const option = SOURCE_OPTIONS.find((o) => o.letter === letter);
      if (option) handleSelect(option.id);
    },
    [canContinue, onNext, handleSelect, referrerName, referrerEmail],
  );

  // useEffect registers a keydown listener after the component mounts.
  // The `return () => ...` is the cleanup function — React calls it before
  // re-running the effect or when the component unmounts, preventing duplicate listeners.
  // The dependency array [handleKeyDown] means: re-run this effect whenever handleKeyDown changes.
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    // Reduced from space-y-6 to space-y-4 for a more compact vertical layout.
    <div className="space-y-4">
      {/* Step number + arrow header */}
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
          Almost done!
        </h1>
        <p className="text-muted text-sm mt-2">Just a few optional things.</p>
      </motion.div>

      {/* Source options — compact pill/chip toggles in a flex-wrap row.
          Keyboard shortcuts A-E still work (no visible letter badges). */}
      <div>
        <p className="text-xs font-medium text-muted mb-2">How did you find us?</p>
        {/* form.Field is a TanStack Form render prop — it passes the field object
            (with state, handlers, etc.) to the child function below. */}
        <form.Field name="source">
          {/* (field) => ... is the render prop pattern: field.state.value holds the current
              value, and field.handleChange() updates it in the form. */}
          {(field) => (
            // flex-wrap row of small pills instead of stacked full-width buttons.
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((option, i) => {
                const isSelected = field.state.value === option.id;
                return (
                  <motion.button
                    key={option.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => handleSelect(option.id)}
                    className={`
                      px-3 py-1.5 text-xs rounded-full border
                      transition-all duration-150
                      ${
                        isSelected
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
                      }
                    `}
                  >
                    {option.label}
                  </motion.button>
                );
              })}
            </div>
          )}
        </form.Field>
      </div>

      {/* Referral inputs — shown only when "Friend Referral" (D) is selected.
          AnimatePresence enables exit animations for conditionally rendered children.
          The `key` on the inner motion.div lets Framer Motion track mount/unmount. */}
      <AnimatePresence>
        {isReferral && (
          <motion.div
            key="referral-fields"
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 12, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            // Reduced from space-y-5 to space-y-3 for tighter referral inputs.
            className="space-y-3 overflow-hidden"
          >
            <div>
              <label className="text-xs text-muted block mb-1">Their name</label>
              <input
                type="text"
                autoFocus
                placeholder="Their first name"
                value={referrerName}
                onChange={(e) => handleNameChange(e.target.value)}
                // Reduced from text-lg to text-base for a more compact input.
                className="w-full max-w-[360px] px-0 py-2 text-base bg-transparent border-b-2 border-accent/30
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Their email</label>
              <input
                ref={emailRef}
                type="email"
                placeholder="friend@example.com"
                value={referrerEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                // Reduced from text-lg to text-base for a more compact input.
                className="w-full max-w-[360px] px-0 py-2 text-base bg-transparent border-b-2 border-accent/30
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">
                Their phone <span className="text-muted/50">(optional)</span>
              </label>
              <input
                ref={phoneRef}
                type="tel"
                inputMode="numeric"
                placeholder="(555) 123-4567"
                value={referrerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full max-w-[360px] px-0 py-2 text-base bg-transparent border-b-2 border-accent/30
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
              <p className="text-xs text-muted/50 mt-1.5">So we can send them their reward too</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo consent — two side-by-side compact buttons instead of stacked full-width.
          No letter shortcuts (A-E are taken by source). */}
      <div>
        <p className="text-xs font-medium text-muted mb-2">Can we feature your results?</p>
        {/* Side-by-side row: each button is flex-1 so they split evenly. */}
        <div className="flex gap-2">
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={selectYes}
            className={`
              flex-1 px-3 py-2 text-xs rounded-md border text-center
              transition-all duration-150 inline-flex items-center justify-center gap-1.5
              ${
                choice === "yes"
                  ? "border-accent bg-accent/5 text-foreground"
                  : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
              }
            `}
          >
            {/* Small checkmark shown when selected */}
            {choice === "yes" && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0 text-accent"
              >
                <path
                  d="M4 8.5L6.5 11L12 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            )}
            Yes, feature me
          </motion.button>

          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.19, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={selectNo}
            className={`
              flex-1 px-3 py-2 text-xs rounded-md border text-center
              transition-all duration-150 inline-flex items-center justify-center gap-1.5
              ${
                choice === "no"
                  ? "border-accent bg-accent/5 text-foreground"
                  : "border-foreground/10 text-foreground/70 hover:border-foreground/20 hover:bg-surface/60"
              }
            `}
          >
            {choice === "no" && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0 text-accent"
              >
                <path
                  d="M4 8.5L6.5 11L12 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            )}
            No thanks
          </motion.button>
        </div>
      </div>

      {/* Birthday section — no mt-6, using parent space-y-4 for spacing. */}
      <div>
        <p className="text-xs font-medium text-muted mb-2">
          When&apos;s your birthday? <span className="text-muted/50">(optional)</span>
        </p>
        {/* form.Field is a TanStack Form render prop — it passes the field object
            (with state, handlers, etc.) to the child function below. */}
        <form.Field name="birthday">
          {/* (field) => ... is the render prop pattern: field.state.value holds the current
              value, and field.handleChange() updates it in the form. */}
          {(field) => (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <input
                ref={birthdayInputRef}
                type="text"
                // inputMode="numeric" hints mobile keyboards to show the number pad.
                inputMode="numeric"
                placeholder="MM / DD"
                maxLength={5}
                // field.state.value is the current value from TanStack Form state.
                // ?? (nullish coalescing): if field.state.value is null/undefined, use "".
                value={field.state.value ?? ""}
                onChange={(e) => {
                  // .replace(/[^\d/]/g, "") is a regex that strips everything except
                  // digits (\d) and slashes (/). The [^...] means "not these characters".
                  let v = e.target.value.replace(/[^\d/]/g, "");
                  // Auto-insert "/" after the 2-digit month — but only when the
                  // user is typing forward (length was < 2), not when deleting.
                  // ?? 0 (nullish coalescing): defaults to 0 if length is null/undefined.
                  if (v.length === 2 && !v.includes("/") && (field.state.value?.length ?? 0) < 2) {
                    v += "/";
                  }
                  // field.handleChange() updates the field value in TanStack Form state.
                  field.handleChange(v);
                }}
                onBlur={field.handleBlur}
                // Reduced from text-2xl to text-lg for a more compact birthday input.
                className="w-full max-w-[200px] px-0 py-2 text-lg tracking-widest bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/30 text-foreground
                  focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </motion.div>
          )}
        </form.Field>
      </div>

      {/* OK button — enabled when photo consent is chosen (and referral is valid if selected) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex items-center gap-3"
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
