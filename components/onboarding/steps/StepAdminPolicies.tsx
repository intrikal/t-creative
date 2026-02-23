"use client";

/**
 * StepAdminPolicies — step 8 of the admin onboarding wizard.
 *
 * ## Responsibility
 * Configures booking protection policies: confirmation mode, per-service waitlist
 * behavior, and financial protection fees (cancellation and no-show).
 *
 * ## Booking confirmation
 * Two options rendered as side-by-side card buttons:
 * - **Instant** — bookings auto-confirm without admin review
 * - **Review first** — each booking request is held until the admin approves
 *
 * ## Waitlist
 * Three standard services (lash, jewelry, crochet) have simple on/off toggles.
 * Consulting has a 3-option pill row:
 * - **Off** — no waitlist; consulting is only accessible via a direct link
 * - **Request-based** — clients submit a request that the admin reviews
 * - **Auto-waitlist** — clients are queued and auto-confirmed in order
 *
 * ## Protection fees
 * Three number inputs (no currency symbol — the label makes it clear):
 * - **Cancellation ($)** — charged when a client cancels inside the window
 * - **Within (hrs)** — the cancellation window in hours
 * - **No-show ($)** — charged when a client doesn't show up
 * All fees are stored as strings and converted to cents in `actions.ts`.
 *
 * ## Props
 * @prop form - the TanStack Form instance (AdminOnboardingForm)
 * @prop onNext - advances to step 9 (rewards) — button label is "Next"
 * @prop stepNum - displayed as the step badge number
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { LuSparkles, LuGem, LuScissors, LuLightbulb } from "react-icons/lu";
import type { AdminOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AdminOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

const WAITLIST_SERVICES = [
  {
    key: "lash" as const,
    label: "Lash Extensions",
    icon: LuSparkles,
    color: "text-rose-400",
    bg: "bg-rose-400/12",
  },
  {
    key: "jewelry" as const,
    label: "Permanent Jewelry",
    icon: LuGem,
    color: "text-amber-400",
    bg: "bg-amber-400/12",
  },
  {
    key: "crochet" as const,
    label: "Crochet",
    icon: LuScissors,
    color: "text-violet-400",
    bg: "bg-violet-400/12",
  },
] as const;

const CONSULTING_OPTIONS = [
  { value: "off" as const, label: "Off", desc: "Manual / direct link only" },
  { value: "request" as const, label: "Request-based", desc: "You review before accepting" },
  {
    value: "waitlist" as const,
    label: "Auto-waitlist",
    desc: "First-submitted gets the next slot",
  },
] as const;

export function StepAdminPolicies({ form, onNext, stepNum }: StepProps) {
  const inputFocusedRef = useRef(false);
  const firstName = form.getFieldValue("firstName");

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
      {/* Heading — compact */}
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
        <h1 className="text-xl font-semibold text-foreground leading-snug">
          {firstName ? `Protect your time, ${firstName}.` : "Protect your time."}
        </h1>
        <p className="text-sm text-foreground/60 mt-0.5">
          Set the rules once — it runs automatically.
        </p>
      </motion.div>

      {/* Booking confirmation */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1.5">
          Booking confirmation
        </p>
        <form.Field name="bookingConfirmation">
          {(field) => (
            <div className="flex gap-2 max-w-[420px]">
              <button
                type="button"
                onClick={() => field.handleChange("instant")}
                className={`flex-1 px-3 py-2 rounded-xl border text-left transition-all duration-150
                  ${field.state.value === "instant" ? "bg-accent/8 border-accent/25" : "bg-surface border-foreground/8 hover:border-foreground/15"}`}
              >
                <p
                  className={`text-sm font-semibold ${field.state.value === "instant" ? "text-accent" : "text-foreground/60"}`}
                >
                  Instant
                </p>
                <p className="text-xs text-muted/50 mt-0.5">Confirmed automatically</p>
              </button>
              <button
                type="button"
                onClick={() => field.handleChange("manual")}
                className={`flex-1 px-3 py-2 rounded-xl border text-left transition-all duration-150
                  ${field.state.value === "manual" ? "bg-accent/8 border-accent/25" : "bg-surface border-foreground/8 hover:border-foreground/15"}`}
              >
                <p
                  className={`text-sm font-semibold ${field.state.value === "manual" ? "text-accent" : "text-foreground/60"}`}
                >
                  Review first
                </p>
                <p className="text-xs text-muted/50 mt-0.5">You approve each request</p>
              </button>
            </div>
          )}
        </form.Field>
      </motion.div>

      {/* Waitlist — compact rows */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-1.5"
      >
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">
          Waitlist when fully booked
        </p>

        {/* Lash, Jewelry, Crochet — slim toggles */}
        {WAITLIST_SERVICES.map(({ key, label, icon: Icon, color, bg }) => (
          <form.Field key={key} name={`waitlist.${key}`}>
            {(field) => (
              <button
                type="button"
                onClick={() => field.handleChange(!field.state.value)}
                className="flex items-center justify-between w-full max-w-[420px]"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={color} style={{ width: 12, height: 12 }} />
                  </div>
                  <span
                    className={`text-sm font-medium ${field.state.value ? "text-foreground" : "text-foreground/50"}`}
                  >
                    {label}
                  </span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${field.state.value ? "bg-accent" : "bg-foreground/15"}`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-[3px] ${field.state.value ? "translate-x-[18px]" : "translate-x-[3px]"}`}
                  />
                </div>
              </button>
            )}
          </form.Field>
        ))}

        {/* Consulting — compact 3-option row */}
        <div className="flex items-center gap-2 max-w-[420px]">
          <div className="w-6 h-6 rounded-lg bg-teal-400/12 flex items-center justify-center shrink-0">
            <LuLightbulb className="text-teal-400" style={{ width: 12, height: 12 }} />
          </div>
          <span className="text-sm font-medium text-foreground flex-1">Consulting</span>
          <form.Field name="waitlist.consulting">
            {(field) => (
              <div className="flex gap-1">
                {CONSULTING_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => field.handleChange(value)}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-150
                      ${
                        field.state.value === value
                          ? "bg-teal-400/12 text-teal-500 border border-teal-400/25"
                          : "bg-foreground/5 text-foreground/40 border border-transparent hover:text-foreground/60"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </form.Field>
        </div>
      </motion.div>

      {/* Protection fees — compact inline row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1.5">
          Protection fees
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <form.Field name="cancellationFee">
            {(field) => (
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">
                  Cancellation ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onFocus={() => (inputFocusedRef.current = true)}
                  onBlur={() => {
                    inputFocusedRef.current = false;
                    field.handleBlur();
                  }}
                  placeholder="25"
                  className="w-20 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/15 focus:border-accent focus:outline-none transition-colors text-foreground placeholder:text-muted/30"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="cancellationWindow">
            {(field) => (
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">
                  Within (hrs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onFocus={() => (inputFocusedRef.current = true)}
                  onBlur={() => {
                    inputFocusedRef.current = false;
                    field.handleBlur();
                  }}
                  placeholder="24"
                  className="w-16 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/15 focus:border-accent focus:outline-none transition-colors text-foreground placeholder:text-muted/30"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="noShowFee">
            {(field) => (
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">
                  No-show ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onFocus={() => (inputFocusedRef.current = true)}
                  onBlur={() => {
                    inputFocusedRef.current = false;
                    field.handleBlur();
                  }}
                  placeholder="50"
                  className="w-16 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/15 focus:border-accent focus:outline-none transition-colors text-foreground placeholder:text-muted/30"
                />
              </div>
            )}
          </form.Field>
        </div>
      </motion.div>

      {/* Launch */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-3 pt-1"
      >
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md bg-accent text-white hover:brightness-110 transition-all duration-200 cursor-pointer"
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
        <span className="text-xs text-muted/50">
          press <strong className="text-muted/70">Enter &crarr;</strong>
        </span>
      </motion.div>
    </div>
  );
}
