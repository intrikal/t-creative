"use client";

/**
 * StepAdminServices — step 5 of the admin onboarding wizard.
 *
 * ## Responsibility
 * Lets the admin enable/disable the four service categories (lash, jewelry,
 * crochet, consulting) and set initial pricing details for each.
 *
 * ## Service card interaction
 * Each service renders as a collapsible card. The header row has:
 * - Service icon + name
 * - Live price preview (shows "$120" or "—" if unset)
 * - A toggle switch that enables/disables the service
 *
 * When enabled, the card expands to reveal three inputs:
 * - **Price ($)** — starting rate shown on the booking page
 * - **Duration** — split into separate hours and minutes inputs that combine
 *   into a single total-minutes value (e.g. 2h + 0m → "120")
 * - **Deposit ($)** — optional; if set, clients pay this upfront when booking
 *
 * ## Booking notice
 * Below the service cards, a single `bookingNotice` input sets the minimum
 * advance booking window (in hours). This applies globally to all services.
 *
 * ## Duration encoding
 * Duration is stored as a string of total minutes in the form state (e.g. "90"
 * for 1h 30m). The hours/minutes inputs split and re-combine this value:
 * `h * 60 + m → String`. This avoids storing fractional hours or separate fields.
 *
 * ## inputFocusedRef
 * Tracks whether any input is focused to prevent the global Enter listener from
 * advancing the step while the user is typing (shared pattern across all admin steps).
 *
 * ## Props
 * @prop form - the TanStack Form instance (AdminOnboardingForm)
 * @prop onNext - advances to step 6
 * @prop stepNum - displayed as the step badge number
 */
import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { LuEye, LuGem, LuScissors, LuLightbulb } from "react-icons/lu";
import type { AdminOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AdminOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

const SERVICE_CONFIG = [
  {
    key: "lash" as const,
    icon: LuEye,
    name: "Lash Extensions",
    color: "text-rose-400",
    bg: "bg-rose-400/12",
    border: "border-rose-400/20",
    activeBg: "bg-rose-400/6",
    defaultPrice: "120",
    defaultHrs: "2",
    defaultMins: "0",
  },
  {
    key: "jewelry" as const,
    icon: LuGem,
    name: "Permanent Jewelry",
    color: "text-amber-400",
    bg: "bg-amber-400/12",
    border: "border-amber-400/20",
    activeBg: "bg-amber-400/6",
    defaultPrice: "85",
    defaultHrs: "1",
    defaultMins: "0",
  },
  {
    key: "crochet" as const,
    icon: LuScissors,
    name: "Crochet",
    color: "text-violet-400",
    bg: "bg-violet-400/12",
    border: "border-violet-400/20",
    activeBg: "bg-violet-400/6",
    defaultPrice: "150",
    defaultHrs: "3",
    defaultMins: "0",
  },
  {
    key: "consulting" as const,
    icon: LuLightbulb,
    name: "Consulting",
    color: "text-teal-400",
    bg: "bg-teal-400/12",
    border: "border-teal-400/20",
    activeBg: "bg-teal-400/6",
    defaultPrice: "75",
    defaultHrs: "1",
    defaultMins: "0",
  },
] as const;

function formatDuration(totalMins: number) {
  if (!totalMins) return null;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function StepAdminServices({ form, onNext, stepNum }: StepProps) {
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
    <div className="space-y-2">
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
          {firstName ? `Almost there, ${firstName}.` : "Turn on your services."}
        </h1>
        <p className="text-foreground/60 text-sm mt-0.5 leading-relaxed">
          Enable what you offer and set a starting price — build out the full menu from the
          dashboard.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-1"
      >
        {SERVICE_CONFIG.map(
          ({
            key,
            icon: Icon,
            name,
            color,
            bg,
            border,
            activeBg,
            defaultPrice,
            defaultHrs,
            defaultMins,
          }) => (
            <form.Field key={key} name={`services.${key}.enabled`}>
              {(enabledField) => {
                const enabled = enabledField.state.value;
                return (
                  <div
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${enabled ? `${activeBg} ${border}` : "bg-surface border-foreground/8"}`}
                  >
                    {/* Header row */}
                    <button
                      type="button"
                      onClick={() => enabledField.handleChange(!enabled)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
                    >
                      <div
                        className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}
                      >
                        <Icon className={color} style={{ width: 13, height: 13 }} />
                      </div>
                      <span
                        className={`flex-1 text-sm font-semibold ${enabled ? "text-foreground" : "text-foreground/50"}`}
                      >
                        {name}
                      </span>
                      <form.Field name={`services.${key}.price`}>
                        {(priceField) => (
                          <span
                            className={`text-sm font-semibold mr-2 ${enabled ? "text-foreground/70" : "text-foreground/25"}`}
                          >
                            {priceField.state.value ? `$${priceField.state.value}` : "—"}
                          </span>
                        )}
                      </form.Field>
                      <div
                        className={`w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${enabled ? "bg-accent" : "bg-foreground/15"}`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-[3px] ${enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`}
                        />
                      </div>
                    </button>

                    {/* Expanded inputs */}
                    {enabled && (
                      <div className="px-3 pb-2 flex flex-wrap gap-x-3 gap-y-1">
                        {/* Price */}
                        <form.Field name={`services.${key}.price`}>
                          {(priceField) => (
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">
                                Price ($)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={priceField.state.value}
                                onChange={(e) => priceField.handleChange(e.target.value)}
                                onFocus={() => (inputFocusedRef.current = true)}
                                onBlur={() => {
                                  inputFocusedRef.current = false;
                                  priceField.handleBlur();
                                }}
                                placeholder={defaultPrice}
                                className="w-16 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/15 focus:border-accent focus:outline-none transition-colors text-foreground placeholder:text-muted/30"
                              />
                            </div>
                          )}
                        </form.Field>

                        {/* Duration — hours + minutes */}
                        <form.Field name={`services.${key}.duration`}>
                          {(durField) => {
                            const totalMins = parseInt(durField.state.value) || 0;
                            const hrs = Math.floor(totalMins / 60);
                            const mins = totalMins % 60;
                            const label = formatDuration(totalMins);
                            return (
                              <div className="flex flex-col gap-0.5">
                                <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">
                                  Duration{label ? ` · ${label}` : ""}
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="12"
                                    value={hrs || ""}
                                    onChange={(e) => {
                                      const h = Math.max(0, parseInt(e.target.value) || 0);
                                      durField.handleChange(String(h * 60 + mins));
                                    }}
                                    onFocus={() => (inputFocusedRef.current = true)}
                                    onBlur={() => {
                                      inputFocusedRef.current = false;
                                      durField.handleBlur();
                                    }}
                                    placeholder={defaultHrs}
                                    className="w-9 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/15 focus:border-accent focus:outline-none transition-colors text-foreground placeholder:text-muted/30 text-center"
                                  />
                                  <span className="text-[10px] text-muted/40 font-medium">h</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    step="15"
                                    value={mins || ""}
                                    onChange={(e) => {
                                      const m = Math.min(
                                        59,
                                        Math.max(0, parseInt(e.target.value) || 0),
                                      );
                                      durField.handleChange(String(hrs * 60 + m));
                                    }}
                                    onFocus={() => (inputFocusedRef.current = true)}
                                    onBlur={() => {
                                      inputFocusedRef.current = false;
                                      durField.handleBlur();
                                    }}
                                    placeholder={defaultMins}
                                    className="w-9 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/15 focus:border-accent focus:outline-none transition-colors text-foreground placeholder:text-muted/30 text-center"
                                  />
                                  <span className="text-[10px] text-muted/40 font-medium">m</span>
                                </div>
                              </div>
                            );
                          }}
                        </form.Field>

                        {/* Deposit */}
                        <form.Field name={`services.${key}.deposit`}>
                          {(depField) => (
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">
                                Deposit ($)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={depField.state.value}
                                onChange={(e) => depField.handleChange(e.target.value)}
                                onFocus={() => (inputFocusedRef.current = true)}
                                onBlur={() => {
                                  inputFocusedRef.current = false;
                                  depField.handleBlur();
                                }}
                                placeholder="0"
                                className="w-16 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/15 focus:border-accent focus:outline-none transition-colors text-foreground placeholder:text-muted/30"
                              />
                            </div>
                          )}
                        </form.Field>
                      </div>
                    )}
                  </div>
                );
              }}
            </form.Field>
          ),
        )}
      </motion.div>

      {/* Booking notice */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <form.Field name="bookingNotice">
          {(field) => (
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/50">Min booking notice</span>
              <input
                type="number"
                min="1"
                step="1"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onFocus={() => (inputFocusedRef.current = true)}
                onBlur={() => {
                  inputFocusedRef.current = false;
                  field.handleBlur();
                }}
                placeholder="24"
                className="w-12 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/15 focus:border-accent focus:outline-none transition-colors text-foreground placeholder:text-muted/30 text-center"
              />
              <span className="text-xs text-foreground/50">
                {field.state.value === "1" ? "hour" : "hours"}
              </span>
              {field.state.value && (
                <span className="text-xs text-muted/40">
                  — clients book at least{" "}
                  <strong className="text-foreground/60">{field.state.value}h</strong> ahead
                </span>
              )}
            </div>
          )}
        </form.Field>
      </motion.div>

      {/* Next */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-3"
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
