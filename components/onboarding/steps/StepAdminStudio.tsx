"use client";

/**
 * StepAdminStudio — step 4 of the admin onboarding wizard.
 *
 * ## Responsibility
 * Collects the admin's studio identity: name, bio, and location. This data
 * is displayed on the public booking page, in confirmation emails, and on
 * Square payment receipts — so it's the most visible part of the admin setup.
 *
 * ## Fields
 * - **Studio name** (required — gates the "Next" button and Enter to advance)
 * - **Bio** (optional textarea, Enter without Shift moves focus to the area input)
 * - **Location type** — pill button selector: Home Studio / Salon Suite / Mobile
 * - **Area** — context-sensitive placeholder changes with location type:
 *   - Home Studio → "e.g. Brickell, Miami"
 *   - Salon Suite → "e.g. Sola Salons, Miami"
 *   - Mobile → "e.g. Miami-Dade"
 *
 * ## Live h1 heading
 * The heading reacts to the studio name field via `form.Field`:
 * - Empty → "Make it feel like yours."
 * - "T Creative Studio" entered → "T Creative Studio — your booking page."
 * This gives immediate feedback that the name is being captured.
 *
 * ## Location type + area
 * `form.Subscribe selector={(s) => s.values.locationType}` drives the area
 * input placeholder without triggering a full re-render of the whole step.
 *
 * ## Props
 * @prop form - the TanStack Form instance (AdminOnboardingForm)
 * @prop onNext - advances to step 5
 * @prop stepNum - displayed as the step badge number
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { LuHouse, LuBuilding, LuMapPin } from "react-icons/lu";
import type { AdminOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AdminOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

const LOCATION_TYPES = [
  {
    value: "home_studio" as const,
    icon: LuHouse,
    label: "Home Studio",
    areaHint: "Neighborhood or city",
    areaPlaceholder: "e.g. Brickell, Miami",
  },
  {
    value: "salon_suite" as const,
    icon: LuBuilding,
    label: "Salon Suite",
    areaHint: "Salon name or city",
    areaPlaceholder: "e.g. Sola Salons, Miami",
  },
  {
    value: "mobile" as const,
    icon: LuMapPin,
    label: "Mobile",
    areaHint: "Area you cover",
    areaPlaceholder: "e.g. Miami-Dade",
  },
] as const;

export function StepAdminStudio({ form, onNext, stepNum }: StepProps) {
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const areaRef = useRef<HTMLInputElement>(null);
  const inputFocusedRef = useRef(false);

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

  return (
    <div className="space-y-3">
      {/* Heading — live studio name */}
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
        <form.Field name="studioName">
          {(f) => (
            <h1 className="text-xl font-semibold text-foreground leading-snug">
              {f.state.value.trim()
                ? `${f.state.value.trim()} — your booking page.`
                : "Make it feel like yours."}
            </h1>
          )}
        </form.Field>
        <p className="text-sm text-foreground/60 mt-0.5 leading-relaxed">
          Your name, story, and location — first thing clients see when they click your link.
        </p>
      </motion.div>

      {/* Studio name + Bio — side by side feel, stacked tight */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-3 max-w-[360px]"
      >
        <form.Field name="studioName">
          {(field) => (
            <div>
              <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mb-1">
                Studio name
              </p>
              <input
                type="text"
                placeholder="T Creative Studio"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    bioRef.current?.focus();
                  }
                }}
                onFocus={() => (inputFocusedRef.current = true)}
                onBlur={() => {
                  inputFocusedRef.current = false;
                  field.handleBlur();
                }}
                className="w-full px-0 py-1.5 text-xl bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/30 text-foreground focus:outline-none focus:border-accent
                  transition-colors duration-200"
              />
            </div>
          )}
        </form.Field>

        <form.Field name="bio">
          {(field) => (
            <div>
              <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mb-1">
                Bio <span className="normal-case font-normal text-muted/35">— optional</span>
              </p>
              <textarea
                ref={bioRef}
                rows={2}
                placeholder="Lash artist · jewelry · crochet. South Florida."
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    areaRef.current?.focus();
                  }
                }}
                onFocus={() => (inputFocusedRef.current = true)}
                onBlur={() => {
                  inputFocusedRef.current = false;
                  field.handleBlur();
                }}
                className="w-full px-0 py-1.5 text-sm bg-transparent border-b-2 border-foreground/15
                  placeholder:text-muted/25 text-foreground focus:outline-none focus:border-accent
                  transition-colors duration-200 resize-none leading-relaxed"
              />
            </div>
          )}
        </form.Field>
      </motion.div>

      {/* Location — compact inline row pills */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-2 max-w-[360px]"
      >
        <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">
          Where you work
        </p>

        <form.Field name="locationType">
          {(field) => (
            <div className="flex gap-2">
              {LOCATION_TYPES.map(({ value, icon: Icon, label }) => {
                const selected = field.state.value === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => field.handleChange(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-150
                      ${
                        selected
                          ? "bg-accent/10 border-accent/30 text-foreground"
                          : "bg-surface border-foreground/10 text-foreground/45 hover:border-foreground/25 hover:text-foreground/60"
                      }`}
                  >
                    <Icon
                      style={{ width: 11, height: 11 }}
                      className={selected ? "text-accent" : "text-muted/40"}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </form.Field>

        {/* Area input */}
        <form.Subscribe selector={(s) => s.values.locationType}>
          {(locType) => {
            const meta = LOCATION_TYPES.find((l) => l.value === locType) ?? LOCATION_TYPES[0];
            return (
              <form.Field name="locationArea">
                {(field) => (
                  <input
                    ref={areaRef}
                    type="text"
                    placeholder={meta.areaPlaceholder}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
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
                    className="w-full px-0 py-1.5 text-sm bg-transparent border-b-2 border-foreground/15
                      placeholder:text-muted/25 text-foreground focus:outline-none focus:border-accent
                      transition-colors duration-200"
                  />
                )}
              </form.Field>
            );
          }}
        </form.Subscribe>
      </motion.div>

      {/* Continue */}
      <form.Field name="studioName">
        {(field) => {
          const canContinue = field.state.value.trim().length > 0;
          return (
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
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-all duration-200
                  ${
                    canContinue
                      ? "bg-accent text-white hover:brightness-110 cursor-pointer"
                      : "bg-foreground/10 text-muted/50 cursor-not-allowed"
                  }`}
              >
                Next
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
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
