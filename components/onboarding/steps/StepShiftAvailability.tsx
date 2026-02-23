"use client";

/**
 * StepShiftAvailability — step 3 of the assistant onboarding wizard.
 *
 * ## Responsibility
 * Lets the assistant mark specific calendar dates as "available for shifts" and
 * configure their working hours — default start/end time, an optional lunch break,
 * and per-date time overrides.
 *
 * ## Calendar interaction
 * - Tapping an unselected date selects it and opens a per-day override panel.
 * - Tapping a selected date deselects it and removes any override for that date.
 * - Month navigation (`monthOffset` state) lets the assistant plan weeks or months ahead.
 * - Past dates are disabled (cannot be selected).
 *
 * ## Per-day overrides
 * When a date is selected, an `AnimatePresence`-animated override panel slides in
 * showing that date's custom start/end times (defaulting to the global defaults).
 * Changing these times writes to `availableDateOverrides`. "reset" removes the
 * override (reverting to defaults). ✕ closes the panel without deselecting the date.
 *
 * ## Lunch break
 * A toggle under "Default hours" mirrors the same pattern used in StepAdminHours.
 * When enabled, a time picker (start) and duration pill picker (30m / 45m / 1hr)
 * appear inline. These write to `availableLunchBreak`, `availableLunchStart`, and
 * `availableLunchDuration` form fields and are reflected in the right-side panel.
 *
 * ## JSON string encoding — why refs instead of setState
 * TanStack Form stores `availableDates` and `availableDateOverrides` as JSON strings
 * (to keep the schema flat and serializable). This component maintains local `Set` and
 * `Record` state mirroring the form values, and syncs them via `form.setFieldValue`
 * after every mutation.
 *
 * The key subtlety: `selectedDatesRef` and `dayOverridesRef` hold current values
 * synchronously, avoiding `form.setFieldValue` calls inside React `setState` updaters
 * (which would trigger a "Cannot update a component while rendering" warning).
 * Callbacks are only ever called from event handlers, not render functions.
 *
 * ## Props
 * @prop form     — the TanStack Form instance (AssistantOnboardingForm)
 * @prop onNext   — advances to step 4 (emergency contact)
 * @prop stepNum  — displayed as the step badge number
 */
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LuClock, LuX, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import type { AssistantOnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: AssistantOnboardingForm;
  onNext: () => void;
  stepNum: number;
}

const TIME_OPTIONS = [
  { value: "06:00", label: "6 am" },
  { value: "07:00", label: "7 am" },
  { value: "08:00", label: "8 am" },
  { value: "09:00", label: "9 am" },
  { value: "10:00", label: "10 am" },
  { value: "11:00", label: "11 am" },
  { value: "12:00", label: "12 pm" },
  { value: "13:00", label: "1 pm" },
  { value: "14:00", label: "2 pm" },
  { value: "15:00", label: "3 pm" },
  { value: "16:00", label: "4 pm" },
  { value: "17:00", label: "5 pm" },
  { value: "18:00", label: "6 pm" },
  { value: "19:00", label: "7 pm" },
  { value: "20:00", label: "8 pm" },
  { value: "21:00", label: "9 pm" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDateLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    m - 1
  ];
  return `${dow}, ${mon} ${d}`;
}

interface DayOverride {
  startTime: string;
  endTime: string;
}

export function StepShiftAvailability({ form, onNext, stepNum }: StepProps) {
  const inputFocusedRef = useRef(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const [monthOffset, setMonthOffset] = useState(0);

  const displayMonth = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [today, monthOffset]);

  // Selected dates state — synced to form as JSON string
  const [selectedDates, setSelectedDates] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(form.state.values.availableDates || "[]") as string[]);
    } catch {
      return new Set<string>();
    }
  });

  const [dayOverrides, setDayOverrides] = useState<Record<string, DayOverride>>(() => {
    try {
      return JSON.parse(form.state.values.availableDateOverrides || "{}") as Record<
        string,
        DayOverride
      >;
    } catch {
      return {};
    }
  });

  // Refs hold current values so form.setFieldValue can be called outside setState updaters
  // (calling setFieldValue inside a setState updater triggers a React "update while rendering" warning)
  const selectedDatesRef = useRef(selectedDates);
  const dayOverridesRef = useRef(dayOverrides);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const toggleDate = useCallback(
    (key: string) => {
      const next = new Set(selectedDatesRef.current);
      const removing = next.has(key);
      if (removing) next.delete(key);
      else next.add(key);

      selectedDatesRef.current = next;
      setSelectedDates(new Set(next));
      form.setFieldValue("availableDates", JSON.stringify([...next].sort()));

      if (removing) {
        const newOverrides = { ...dayOverridesRef.current };
        delete newOverrides[key];
        dayOverridesRef.current = newOverrides;
        setDayOverrides(newOverrides);
        form.setFieldValue("availableDateOverrides", JSON.stringify(newOverrides));
        setExpandedDate((exp) => (exp === key ? null : exp));
      }
    },
    [form],
  );

  const updateOverride = useCallback(
    (key: string, override: DayOverride | null) => {
      const next = { ...dayOverridesRef.current };
      if (override) next[key] = override;
      else delete next[key];
      dayOverridesRef.current = next;
      setDayOverrides(next);
      form.setFieldValue("availableDateOverrides", JSON.stringify(next));
    },
    [form],
  );

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

  const selectedCount = selectedDates.size;
  const { year: dispYear, month: dispMonth } = displayMonth;
  const firstDow = new Date(dispYear, dispMonth - 1, 1).getDay();
  const daysInMonth = new Date(dispYear, dispMonth, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-3">
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
          When are you available?
        </h1>
        <p className="text-muted text-sm mt-1">
          Tap dates to mark yourself open. Navigate months to plan ahead.
        </p>
      </motion.div>

      {/* Default hours */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
          Default hours
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <LuClock className="w-3.5 h-3.5 text-muted/40 shrink-0" />
          <form.Field name="availableDefaultStart">
            {(field) => (
              <select
                value={field.state.value || "09:00"}
                onChange={(e) => field.handleChange(e.target.value)}
                onFocus={() => (inputFocusedRef.current = true)}
                onBlur={() => {
                  inputFocusedRef.current = false;
                  field.handleBlur();
                }}
                className="px-2 py-1.5 text-sm bg-surface border border-foreground/12 rounded-lg text-foreground focus:outline-none focus:border-accent transition-colors cursor-pointer"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </form.Field>
          <span className="text-sm text-muted/40">to</span>
          <form.Field name="availableDefaultEnd">
            {(field) => (
              <select
                value={field.state.value || "17:00"}
                onChange={(e) => field.handleChange(e.target.value)}
                onFocus={() => (inputFocusedRef.current = true)}
                onBlur={() => {
                  inputFocusedRef.current = false;
                  field.handleBlur();
                }}
                className="px-2 py-1.5 text-sm bg-surface border border-foreground/12 rounded-lg text-foreground focus:outline-none focus:border-accent transition-colors cursor-pointer"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </form.Field>
        </div>
      </motion.div>

      {/* Lunch break */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.11, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <form.Field name="availableLunchBreak">
          {(lunchField) => (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-foreground/45 w-12 shrink-0">Lunch</span>
              <button
                type="button"
                onClick={() => lunchField.handleChange(!lunchField.state.value)}
                className={`w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${lunchField.state.value ? "bg-accent" : "bg-foreground/15"}`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-[3px] ${lunchField.state.value ? "translate-x-[18px]" : "translate-x-[3px]"}`}
                />
              </button>
              {lunchField.state.value && (
                <>
                  <span className="text-xs text-foreground/40">at</span>
                  <form.Field name="availableLunchStart">
                    {(startField) => (
                      <select
                        value={startField.state.value || "12:00"}
                        onChange={(e) => startField.handleChange(e.target.value)}
                        onFocus={() => (inputFocusedRef.current = true)}
                        onBlur={() => {
                          inputFocusedRef.current = false;
                          startField.handleBlur();
                        }}
                        className="px-2 py-1 text-xs bg-surface border border-foreground/12 rounded-lg text-foreground focus:outline-none focus:border-accent transition-colors cursor-pointer"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </form.Field>
                  <span className="text-xs text-foreground/40">for</span>
                  <form.Field name="availableLunchDuration">
                    {(durField) => (
                      <div className="flex gap-1">
                        {[
                          { value: "30", label: "30m" },
                          { value: "45", label: "45m" },
                          { value: "60", label: "1 hr" },
                        ].map((l) => (
                          <button
                            key={l.value}
                            type="button"
                            onClick={() => durField.handleChange(l.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-150
                              ${
                                durField.state.value === l.value
                                  ? "bg-accent/12 text-accent border border-accent/25"
                                  : "bg-foreground/5 text-foreground/45 border border-transparent hover:text-foreground/65"
                              }`}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </form.Field>
                </>
              )}
            </div>
          )}
        </form.Field>
      </motion.div>

      {/* Calendar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-2"
      >
        {/* Month nav */}
        <div className="flex items-center justify-between max-w-[340px]">
          <button
            type="button"
            disabled={monthOffset === 0}
            onClick={() => {
              setMonthOffset((o) => o - 1);
              setExpandedDate(null);
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors
              ${monthOffset === 0 ? "text-foreground/15 cursor-not-allowed" : "text-foreground/50 hover:bg-foreground/8 hover:text-foreground"}`}
          >
            <LuChevronLeft className="w-4 h-4" />
          </button>
          <p className="text-sm font-semibold text-foreground/75">
            {MONTH_NAMES[dispMonth - 1]} {dispYear}
          </p>
          <button
            type="button"
            onClick={() => {
              setMonthOffset((o) => o + 1);
              setExpandedDate(null);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground/50 hover:bg-foreground/8 hover:text-foreground transition-colors"
          >
            <LuChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1 max-w-[340px]">
          {DOW_LABELS.map((d) => (
            <span
              key={d}
              className="text-[9px] text-center text-foreground/30 font-semibold py-0.5"
            >
              {d}
            </span>
          ))}
          {calCells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="h-9" />;
            const key = toDateKey(dispYear, dispMonth, day);
            const isPast = key < todayKey;
            const isToday = key === todayKey;
            const isSelected = selectedDates.has(key);
            const isExpanded = expandedDate === key;
            const hasOverride = !!dayOverrides[key];
            return (
              <button
                key={key}
                type="button"
                disabled={isPast}
                onClick={() => {
                  if (isSelected) {
                    toggleDate(key);
                    setExpandedDate(null);
                  } else {
                    toggleDate(key);
                    setExpandedDate(key);
                  }
                }}
                className={`h-9 w-full rounded-xl text-xs font-semibold transition-all duration-100 relative
                  ${
                    isPast
                      ? "text-foreground/15 cursor-not-allowed"
                      : isSelected
                        ? isExpanded
                          ? "bg-accent text-white shadow-md shadow-accent/30 scale-95"
                          : "bg-accent text-white shadow-sm shadow-accent/20"
                        : isToday
                          ? "text-accent bg-accent/10 ring-1 ring-accent/40 hover:bg-accent/20"
                          : "text-foreground/70 bg-foreground/5 hover:bg-accent/12 hover:text-accent"
                  }`}
              >
                {day}
                {hasOverride && isSelected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/60" />
                )}
              </button>
            );
          })}
        </div>

        {/* Per-day time override */}
        <AnimatePresence>
          {expandedDate && (
            <motion.div
              key={expandedDate}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden max-w-[340px]"
            >
              <form.Subscribe
                selector={(s) => ({
                  defaultStart: s.values.availableDefaultStart,
                  defaultEnd: s.values.availableDefaultEnd,
                })}
              >
                {({ defaultStart, defaultEnd }) => {
                  const override = dayOverrides[expandedDate];
                  const startVal = override?.startTime || defaultStart || "09:00";
                  const endVal = override?.endTime || defaultEnd || "17:00";
                  return (
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-accent/6 border border-accent/15 mt-1">
                      <span className="text-xs font-semibold text-foreground/70 flex-1 min-w-[90px]">
                        {formatDateLabel(expandedDate)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={startVal}
                          onChange={(e) =>
                            updateOverride(expandedDate, {
                              startTime: e.target.value,
                              endTime: endVal,
                            })
                          }
                          onFocus={() => (inputFocusedRef.current = true)}
                          onBlur={() => {
                            inputFocusedRef.current = false;
                          }}
                          className="px-1.5 py-1 text-xs bg-surface border border-foreground/15 rounded-lg text-foreground focus:outline-none focus:border-accent transition-colors cursor-pointer"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-muted/40">→</span>
                        <select
                          value={endVal}
                          onChange={(e) =>
                            updateOverride(expandedDate, {
                              startTime: startVal,
                              endTime: e.target.value,
                            })
                          }
                          onFocus={() => (inputFocusedRef.current = true)}
                          onBlur={() => {
                            inputFocusedRef.current = false;
                          }}
                          className="px-1.5 py-1 text-xs bg-surface border border-foreground/15 rounded-lg text-foreground focus:outline-none focus:border-accent transition-colors cursor-pointer"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        {override && (
                          <button
                            type="button"
                            onClick={() => updateOverride(expandedDate, null)}
                            className="text-[10px] text-muted/40 hover:text-foreground/60 transition-colors px-1.5 py-1 rounded border border-foreground/10"
                          >
                            reset
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => {
                            toggleDate(expandedDate);
                            setExpandedDate(null);
                          }}
                          className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedDate(null)}
                          className="text-muted/35 hover:text-foreground/60 transition-colors"
                        >
                          <LuX className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                }}
              </form.Subscribe>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-muted/45 max-w-[340px]">
          {selectedCount > 0 ? (
            <>
              <strong className="text-foreground/60">{selectedCount}</strong>{" "}
              {selectedCount === 1 ? "day" : "days"} selected — tap again to remove, or customize
              hours above
            </>
          ) : (
            "Tap any date to mark yourself available — tap again to remove"
          )}
        </p>
      </motion.div>

      {/* OK — always enabled, dates are optional */}
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
