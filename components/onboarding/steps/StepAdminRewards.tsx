"use client";

/**
 * StepAdminRewards — step 9 (final step) of the admin onboarding wizard.
 *
 * ## Responsibility
 * Lets the admin configure a loyalty rewards program for their clients — or
 * skip it entirely. This is the last step before the data is saved.
 *
 * ## Enable toggle
 * A single toggle at the top controls `rewards.enabled`. When off, the
 * configuration section is hidden via `AnimatePresence` with a height animation.
 * When on, the full config reveals with a smooth expand.
 *
 * ## Configuration sections (visible when enabled)
 * 1. **Rate** — `pointsPerDollar` (how many points per $1 spent) and
 *    `pointsToRedeem` (how many points equal $1 off). Inline inputs, no labels.
 * 2. **Tiers** — 4 rows (Member/Regular/VIP/Elite). Each has a name input,
 *    a threshold input (except tier 1 which is locked at 0), and a multiplier
 *    input. Tier 1's threshold shows "0 pts" as read-only text.
 * 3. **Bonus events** — 4 groups (Visits / Community / Account /
 *    Purchases & Training) with 15 total event types. Each event shows as:
 *    - A "+" button when disabled → clicking sets the field to the placeholder value
 *    - An inline number input + "×" clear button when enabled
 * 4. **Points expiry** — defaults to "Points never expire". Clicking "+ Set limit"
 *    sets `pointsExpiry` to "12" and shows an inline input. Clicking "×" clears it.
 *
 * ## CTA label
 * The final button says "Launch my studio" (not "Next") — this step submits the
 * entire onboarding form.
 *
 * ## Props
 * @prop form - the TanStack Form instance (AdminOnboardingForm)
 * @prop onNext - triggers the form submission and transitions to the completion screen
 * @prop stepNum - displayed as the step badge number
 */
import { useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LuGift,
  LuCalendarCheck,
  LuCake,
  LuUsers,
  LuStar,
  LuRepeat,
  LuMessageSquare,
  LuClock,
  LuShare2,
  LuShoppingBag,
  LuUserCheck,
  LuPartyPopper,
  LuTrophy,
  LuZap,
  LuGraduationCap,
  LuPackage,
  LuBookOpen,
  LuBadgeCheck,
} from "react-icons/lu";
import type { AdminOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AdminOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

const BONUS_GROUPS = [
  {
    label: "Visits",
    events: [
      {
        name: "rewards.firstBookingBonus" as const,
        icon: LuCalendarCheck,
        label: "First booking",
        placeholder: "100",
        color: "text-rose-400",
        bg: "bg-rose-400/12",
      },
      {
        name: "rewards.rebookBonus" as const,
        icon: LuRepeat,
        label: "Rebook same day",
        placeholder: "50",
        color: "text-teal-400",
        bg: "bg-teal-400/12",
      },
      {
        name: "rewards.milestoneBonus" as const,
        icon: LuMessageSquare,
        label: "5th visit",
        placeholder: "200",
        color: "text-emerald-400",
        bg: "bg-emerald-400/12",
      },
      {
        name: "rewards.milestone10thBonus" as const,
        icon: LuTrophy,
        label: "10th visit",
        placeholder: "400",
        color: "text-amber-400",
        bg: "bg-amber-400/12",
      },
      {
        name: "rewards.newServiceBonus" as const,
        icon: LuZap,
        label: "New service",
        placeholder: "75",
        color: "text-teal-400",
        bg: "bg-teal-400/12",
      },
    ],
  },
  {
    label: "Community",
    events: [
      {
        name: "rewards.referralBonus" as const,
        icon: LuUsers,
        label: "You refer",
        placeholder: "100",
        color: "text-violet-400",
        bg: "bg-violet-400/12",
      },
      {
        name: "rewards.refereeBonus" as const,
        icon: LuUsers,
        label: "They join",
        placeholder: "50",
        color: "text-violet-400",
        bg: "bg-violet-400/12",
      },
      {
        name: "rewards.reviewBonus" as const,
        icon: LuStar,
        label: "Leave a review",
        placeholder: "75",
        color: "text-amber-400",
        bg: "bg-amber-400/12",
      },
      {
        name: "rewards.socialShareBonus" as const,
        icon: LuShare2,
        label: "Tag us on social",
        placeholder: "50",
        color: "text-rose-400",
        bg: "bg-rose-400/12",
      },
    ],
  },
  {
    label: "Account",
    events: [
      {
        name: "rewards.profileCompleteBonus" as const,
        icon: LuUserCheck,
        label: "Complete profile",
        placeholder: "25",
        color: "text-emerald-400",
        bg: "bg-emerald-400/12",
      },
      {
        name: "rewards.birthdayBonus" as const,
        icon: LuCake,
        label: "Birthday",
        placeholder: "50",
        color: "text-amber-400",
        bg: "bg-amber-400/12",
      },
      {
        name: "rewards.anniversaryBonus" as const,
        icon: LuPartyPopper,
        label: "Anniversary",
        placeholder: "100",
        color: "text-violet-400",
        bg: "bg-violet-400/12",
      },
    ],
  },
  {
    label: "Purchases & Training",
    events: [
      {
        name: "rewards.productPurchaseBonus" as const,
        icon: LuShoppingBag,
        label: "Buy a product",
        placeholder: "25",
        color: "text-teal-400",
        bg: "bg-teal-400/12",
      },
      {
        name: "rewards.packagePurchaseBonus" as const,
        icon: LuPackage,
        label: "Buy a package",
        placeholder: "200",
        color: "text-sky-400",
        bg: "bg-sky-400/12",
      },
      {
        name: "rewards.classAttendanceBonus" as const,
        icon: LuGraduationCap,
        label: "Attend a class",
        placeholder: "150",
        color: "text-rose-400",
        bg: "bg-rose-400/12",
      },
      {
        name: "rewards.programCompleteBonus" as const,
        icon: LuBookOpen,
        label: "Complete a program",
        placeholder: "300",
        color: "text-indigo-400",
        bg: "bg-indigo-400/12",
      },
      {
        name: "rewards.certificationBonus" as const,
        icon: LuBadgeCheck,
        label: "Get certified",
        placeholder: "500",
        color: "text-amber-500",
        bg: "bg-amber-500/12",
      },
    ],
  },
] as const;

const TIERS = [
  {
    nameField: "rewards.tier1Name" as const,
    threshField: "rewards.tier1Threshold" as const,
    multField: "rewards.tier1Multiplier" as const,
    locked: true,
  },
  {
    nameField: "rewards.tier2Name" as const,
    threshField: "rewards.tier2Threshold" as const,
    multField: "rewards.tier2Multiplier" as const,
    locked: false,
  },
  {
    nameField: "rewards.tier3Name" as const,
    threshField: "rewards.tier3Threshold" as const,
    multField: "rewards.tier3Multiplier" as const,
    locked: false,
  },
  {
    nameField: "rewards.tier4Name" as const,
    threshField: "rewards.tier4Threshold" as const,
    multField: "rewards.tier4Multiplier" as const,
    locked: false,
  },
] as const;

export function StepAdminRewards({ form, onNext, stepNum }: StepProps) {
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
    <div className="space-y-2.5">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-2.5"
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/12 text-accent text-xs font-bold shrink-0">
          {stepNum}
        </span>
        <h1 className="text-lg font-semibold text-foreground leading-snug">
          Build your loyalty program.
        </h1>
      </motion.div>

      {/* Enable toggle */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <form.Field name="rewards.enabled">
          {(field) => (
            <button
              type="button"
              onClick={() => field.handleChange(!field.state.value)}
              className="flex items-center justify-between w-full max-w-[420px]"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${field.state.value ? "bg-accent/15" : "bg-foreground/6"}`}
                >
                  <LuGift
                    style={{ width: 12, height: 12 }}
                    className={field.state.value ? "text-accent" : "text-muted/40"}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  Loyalty rewards program
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
      </motion.div>

      {/* Config — animated reveal */}
      <form.Subscribe selector={(s) => s.values.rewards.enabled}>
        {(enabled) => (
          <AnimatePresence>
            {enabled && (
              <motion.div
                key="rewards-config"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 max-w-[420px]">
                  {/* Points rate — inline */}
                  <div className="flex items-center gap-5">
                    <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider shrink-0">
                      Rate
                    </p>
                    <form.Field name="rewards.pointsPerDollar">
                      {(field) => (
                        <div className="flex items-baseline gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={field.state.value ?? ""}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onFocus={() => (inputFocusedRef.current = true)}
                            onBlur={() => {
                              inputFocusedRef.current = false;
                              field.handleBlur();
                            }}
                            className="w-12 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/20 text-foreground focus:outline-none focus:border-accent transition-colors text-center"
                          />
                          <span className="text-xs text-foreground/50">pts / $1</span>
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="rewards.pointsToRedeem">
                      {(field) => (
                        <div className="flex items-baseline gap-1.5">
                          <input
                            type="number"
                            min="1"
                            value={field.state.value ?? ""}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onFocus={() => (inputFocusedRef.current = true)}
                            onBlur={() => {
                              inputFocusedRef.current = false;
                              field.handleBlur();
                            }}
                            className="w-14 px-0 py-0.5 text-sm bg-transparent border-b-2 border-foreground/20 text-foreground focus:outline-none focus:border-accent transition-colors text-center"
                          />
                          <span className="text-xs text-foreground/50">pts = $1 off</span>
                        </div>
                      )}
                    </form.Field>
                  </div>

                  {/* Tiers */}
                  <div>
                    <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-1">
                      Tiers{" "}
                      <span className="normal-case font-normal text-muted/35">
                        — name · threshold · multiplier
                      </span>
                    </p>
                    <div className="space-y-1">
                      {TIERS.map(({ nameField, threshField, multField, locked }, i) => (
                        <div key={nameField} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted/35 w-3 shrink-0">
                            {i + 1}
                          </span>
                          <form.Field name={nameField}>
                            {(field) => (
                              <input
                                type="text"
                                value={field.state.value ?? ""}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onFocus={() => (inputFocusedRef.current = true)}
                                onBlur={() => {
                                  inputFocusedRef.current = false;
                                  field.handleBlur();
                                }}
                                placeholder={["Member", "Regular", "VIP", "Elite"][i]}
                                className="flex-1 min-w-0 px-0 py-0.5 text-sm bg-transparent border-b border-foreground/20 text-foreground focus:outline-none focus:border-accent transition-colors placeholder:text-muted/25"
                              />
                            )}
                          </form.Field>
                          <form.Field name={threshField}>
                            {(field) =>
                              locked ? (
                                <span className="text-xs text-muted/35 shrink-0 w-14 text-center">
                                  0 pts
                                </span>
                              ) : (
                                <div className="flex items-baseline gap-0.5 shrink-0">
                                  <input
                                    type="number"
                                    min="1"
                                    value={field.state.value ?? ""}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onFocus={() => (inputFocusedRef.current = true)}
                                    onBlur={() => {
                                      inputFocusedRef.current = false;
                                      field.handleBlur();
                                    }}
                                    className="w-14 px-0 py-0.5 text-sm bg-transparent border-b border-foreground/20 text-foreground focus:outline-none focus:border-accent text-center transition-colors"
                                  />
                                  <span className="text-xs text-muted/35">pts</span>
                                </div>
                              )
                            }
                          </form.Field>
                          <form.Field name={multField}>
                            {(field) => (
                              <div className="flex items-baseline gap-0.5 shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  step="0.25"
                                  value={field.state.value ?? ""}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  onFocus={() => (inputFocusedRef.current = true)}
                                  onBlur={() => {
                                    inputFocusedRef.current = false;
                                    field.handleBlur();
                                  }}
                                  className="w-12 px-0 py-0.5 text-sm bg-transparent border-b border-foreground/20 text-foreground focus:outline-none focus:border-accent text-center transition-colors"
                                />
                                <span className="text-xs text-muted/35">×</span>
                              </div>
                            )}
                          </form.Field>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bonus events — grouped */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">
                      Bonus events
                    </p>
                    {BONUS_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className="text-[10px] font-semibold text-muted/40 uppercase tracking-wider mb-1">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {group.events.map(
                            ({ name, icon: Icon, label, placeholder, color, bg }) => (
                              <form.Field key={name} name={name}>
                                {(field) => {
                                  const on = !!field.state.value;
                                  return (
                                    <div className="flex items-center gap-1.5">
                                      <div
                                        className={`w-4 h-4 rounded-md ${bg} flex items-center justify-center shrink-0`}
                                      >
                                        <Icon className={color} style={{ width: 9, height: 9 }} />
                                      </div>
                                      <span className="text-xs text-foreground/60 flex-1 leading-tight">
                                        {label}
                                      </span>
                                      {on ? (
                                        <div className="flex items-center gap-0.5 shrink-0">
                                          <input
                                            type="number"
                                            min="1"
                                            value={field.state.value ?? ""}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onFocus={() => (inputFocusedRef.current = true)}
                                            onBlur={() => {
                                              inputFocusedRef.current = false;
                                              field.handleBlur();
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-10 px-0 text-xs bg-transparent border-b border-foreground/25 text-foreground focus:outline-none focus:border-accent text-center transition-colors"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => field.handleChange("")}
                                            className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors text-[9px] text-foreground/50 hover:text-foreground/70 leading-none"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => field.handleChange(placeholder)}
                                          className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-foreground/8 hover:bg-accent/15 transition-colors text-[10px] font-bold text-muted/40 hover:text-accent leading-none shrink-0"
                                        >
                                          +
                                        </button>
                                      )}
                                    </div>
                                  );
                                }}
                              </form.Field>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Point expiry */}
                  <form.Field name="rewards.pointsExpiry">
                    {(field) => {
                      const on = !!field.state.value;
                      return (
                        <div className="flex items-center gap-2">
                          <LuClock className="w-3.5 h-3.5 text-muted/30 shrink-0" />
                          {on ? (
                            <>
                              <span className="text-xs text-foreground/55">Expire after</span>
                              <div className="flex items-baseline gap-1 shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  max="36"
                                  value={field.state.value ?? ""}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  onFocus={() => (inputFocusedRef.current = true)}
                                  onBlur={() => {
                                    inputFocusedRef.current = false;
                                    field.handleBlur();
                                  }}
                                  className="w-9 px-0 text-xs bg-transparent border-b border-foreground/25 text-foreground focus:outline-none focus:border-accent text-center transition-colors"
                                />
                                <span className="text-xs text-muted/40">months of inactivity</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => field.handleChange("")}
                                className="w-4 h-4 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors text-[10px] text-foreground/50 hover:text-foreground/70 leading-none shrink-0 ml-auto"
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-foreground/40 flex-1">
                                Points never expire
                              </span>
                              <button
                                type="button"
                                onClick={() => field.handleChange("12")}
                                className="text-xs font-semibold text-muted/35 hover:text-foreground/60 transition-colors shrink-0"
                              >
                                + Set limit
                              </button>
                            </>
                          )}
                        </div>
                      );
                    }}
                  </form.Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </form.Subscribe>

      {/* Continue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex items-center gap-3 pt-1"
      >
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md bg-accent text-white hover:brightness-110 cursor-pointer transition-all duration-200"
        >
          Launch my studio
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
          press <strong className="text-muted/70">Enter ↵</strong>
        </span>
      </motion.div>
    </div>
  );
}
