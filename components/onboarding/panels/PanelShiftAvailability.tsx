"use client";

/**
 * PanelShiftAvailability — right-side preview panel for StepShiftAvailability.
 *
 * ## What it shows
 * A live read-only summary of the assistant's availability as they build it on
 * the left side. Updates in real time via `form.Subscribe` in OnboardingFlow.
 *
 * ### 2-month mini calendar heatmap
 * Renders the current month and next month side by side as small grids.
 * Selected dates appear filled with the accent color. Dates with per-day time
 * overrides get a small dot indicator. Past dates are dimmed.
 *
 * ### Timeline bar
 * A horizontal bar showing the default shift window (start → end). When a lunch
 * break is enabled, a gap cut-out appears at the correct proportional position.
 * A small label below shows the lunch time and duration.
 *
 * ### Stats
 * Two tiles: days selected and work hours per day (excluding lunch if enabled).
 * The label changes from "hrs / day" to "work hrs" when lunch is active to make
 * clear the number excludes the break.
 *
 * ## Props
 * All props are optional — the panel renders gracefully with defaults when the
 * assistant hasn't filled anything in yet.
 *
 * @prop availableDefaultStart   — "HH:MM" default shift start (e.g. "09:00")
 * @prop availableDefaultEnd     — "HH:MM" default shift end (e.g. "17:00")
 * @prop availableDates          — JSON string: string[] of "YYYY-MM-DD"
 * @prop availableDateOverrides  — JSON string: Record<string, {startTime, endTime}>
 * @prop availableLunchBreak     — whether a lunch break is blocked off
 * @prop availableLunchStart     — "HH:MM" start of the lunch break
 * @prop availableLunchDuration  — duration in minutes as a string (e.g. "30")
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { LuCalendar } from "react-icons/lu";
import { fadeUp, stagger } from "./shared";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTime(t: string): string {
  const h = parseInt(t.split(":")[0], 10);
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

interface PanelShiftAvailabilityProps {
  availableDefaultStart?: string;
  availableDefaultEnd?: string;
  availableDates?: string;
  availableDateOverrides?: string;
  availableLunchBreak?: boolean;
  availableLunchStart?: string;
  availableLunchDuration?: string;
}

export function PanelShiftAvailability({
  availableDefaultStart = "09:00",
  availableDefaultEnd = "17:00",
  availableDates = "[]",
  availableDateOverrides = "{}",
  availableLunchBreak = false,
  availableLunchStart = "12:00",
  availableLunchDuration = "30",
}: PanelShiftAvailabilityProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // Show current month + next month side by side
  const months = useMemo(() => {
    return [0, 1].map((offset) => {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }, [today]);

  const selectedDates = useMemo<Set<string>>(() => {
    try {
      return new Set(JSON.parse(availableDates) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [availableDates]);

  const dayOverrides = useMemo<Record<string, { startTime: string; endTime: string }>>(() => {
    try {
      return JSON.parse(availableDateOverrides);
    } catch {
      return {};
    }
  }, [availableDateOverrides]);

  const selectedCount = selectedDates.size;
  const overrideCount = Object.keys(dayOverrides).length;

  // Timeline stats
  const startMin = timeToMinutes(availableDefaultStart);
  const endMin = timeToMinutes(availableDefaultEnd);
  const totalMin = Math.max(endMin - startMin, 0);
  const lunchMin = availableLunchBreak ? parseInt(availableLunchDuration) || 30 : 0;
  const workMin = Math.max(totalMin - lunchMin, 0);
  const workHrs =
    workMin >= 60
      ? `${Math.floor(workMin / 60)}h${workMin % 60 ? ` ${workMin % 60}m` : ""}`
      : workMin > 0
        ? `${workMin}m`
        : totalMin >= 60
          ? `${Math.floor(totalMin / 60)}h${totalMin % 60 ? ` ${totalMin % 60}m` : ""}`
          : `${totalMin}m`;

  // Lunch gap bar position (as % of total span)
  const lunchStartMin = availableLunchBreak ? timeToMinutes(availableLunchStart) : 0;
  const lunchOffsetPct =
    totalMin > 0 ? Math.max(0, Math.min(((lunchStartMin - startMin) / totalMin) * 100, 100)) : 0;
  const lunchWidthPct =
    totalMin > 0 ? Math.min((lunchMin / totalMin) * 100, 100 - lunchOffsetPct) : 0;

  return (
    <div className="flex flex-col justify-center h-full px-6 py-5">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[380px] space-y-4"
      >
        {/* Header */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-accent uppercase tracking-[0.15em] mb-0.5">
            Your availability
          </p>
          <h2 className="text-lg font-semibold text-foreground leading-tight">Your open days.</h2>
          <p className="text-sm text-muted/60 mt-0.5 leading-snug">
            Tap dates on the left to mark yourself available — tap again to remove.
          </p>
        </motion.div>

        {/* 2-month mini calendar heatmap */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
          {months.map(({ year, month }) => {
            const firstDow = new Date(year, month - 1, 1).getDay();
            const daysInMonth = new Date(year, month, 0).getDate();
            const cells: (number | null)[] = [
              ...Array<null>(firstDow).fill(null),
              ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
            ];
            return (
              <div key={`${year}-${month}`}>
                <p className="text-[9px] font-bold text-foreground/35 uppercase tracking-wider mb-1">
                  {MONTH_NAMES[month - 1]}
                </p>
                <div className="grid grid-cols-7 gap-px">
                  {DOW_LABELS.map((d) => (
                    <span
                      key={d}
                      className="text-[7px] text-center text-foreground/20 font-semibold pb-px"
                    >
                      {d}
                    </span>
                  ))}
                  {cells.map((day, i) => {
                    if (!day) return <div key={`e-${i}`} className="h-5" />;
                    const key = toDateKey(year, month, day);
                    const isPast = key < todayKey;
                    const isToday = key === todayKey;
                    const isSelected = selectedDates.has(key);
                    const hasOverride = !!dayOverrides[key];
                    return (
                      <div
                        key={key}
                        className={`h-5 w-full rounded-sm text-[9px] font-medium flex items-center justify-center relative
                          ${
                            isPast
                              ? "text-foreground/10"
                              : isSelected
                                ? "bg-accent text-white"
                                : isToday
                                  ? "text-accent bg-accent/10 ring-1 ring-accent/30"
                                  : "text-foreground/40 bg-foreground/4"
                          }`}
                      >
                        {day}
                        {hasOverride && isSelected && (
                          <span className="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full bg-white/60" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Timeline bar */}
        {totalMin > 0 && (
          <motion.div variants={fadeUp} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted/50 font-medium">
              <span>{formatTime(availableDefaultStart)}</span>
              <span className="text-[10px] text-muted/35">{workHrs} / day</span>
              <span>{formatTime(availableDefaultEnd)}</span>
            </div>
            <div className="relative h-2.5 bg-accent/12 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-accent/25 rounded-full" />
              {availableLunchBreak && lunchWidthPct > 0 && (
                <div
                  className="absolute top-0 h-full bg-background/80"
                  style={{ left: `${lunchOffsetPct}%`, width: `${lunchWidthPct}%` }}
                />
              )}
            </div>
            {availableLunchBreak && (
              <p className="text-[10px] text-muted/40">
                Lunch {formatTime(availableLunchStart)} · {availableLunchDuration}m break
              </p>
            )}
          </motion.div>
        )}

        {/* Stats */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2">
          <div className="px-2 py-2.5 rounded-xl bg-surface border border-foreground/8 text-center">
            <p className="text-xl font-bold text-foreground">{selectedCount}</p>
            <p className="text-[10px] text-muted/50 mt-0.5 leading-tight">days open</p>
          </div>
          <div className="px-2 py-2.5 rounded-xl bg-surface border border-foreground/8 text-center">
            <p className="text-xl font-bold text-foreground">{totalMin > 0 ? workHrs : "—"}</p>
            <p className="text-[10px] text-muted/50 mt-0.5 leading-tight">
              {availableLunchBreak ? "work hrs" : "hrs / day"}
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div variants={fadeUp} className="flex items-start gap-2 px-1">
          <LuCalendar className="w-3 h-3 text-muted/30 shrink-0 mt-0.5" />
          <p className="text-xs text-muted/40 leading-relaxed">
            {selectedCount > 0
              ? `${selectedCount} day${selectedCount !== 1 ? "s" : ""} selected${overrideCount > 0 ? ` — ${overrideCount} with custom hours` : ""}.`
              : "Select dates on the left calendar to see your schedule here."}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
