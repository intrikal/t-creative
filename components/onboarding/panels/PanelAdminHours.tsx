"use client";

/**
 * PanelAdminHours — the right-panel for step 6 (admin working hours step).
 *
 * ## Purpose
 * Gives the admin an at-a-glance summary of their availability configuration
 * — a 2-month calendar heatmap, a daily timeline bar, and capacity stats.
 *
 * ## Sections
 * 1. **2-month mini calendar heatmap** — shows the current month and the
 *    next month side by side. Selected dates are filled with `bg-accent`.
 *    Past dates are dimmed. Today has a ring indicator. Dates with per-day
 *    overrides show a white dot at the bottom of the filled cell.
 * 2. **Timeline bar** — visualizes the work day from `defaultStartTime` to
 *    `defaultEndTime`. If `lunchBreak` is enabled, a gap is cut out at the
 *    correct proportional position using `lunchOffPct` and `lunchWPct`.
 * 3. **Stat chips** — three cards showing:
 *    - Days open (count of selected dates)
 *    - Estimated clients per day (derived by dividing work minutes by
 *      average-service-duration + buffer gap, assuming 90 min avg service)
 *    - Buffer gap (appointment gap in minutes)
 *
 * ## JSON parsing
 * `workingHours.selectedDates` and `workingHours.dayOverrides` are JSON
 * strings (set by StepAdminHours via `form.setFieldValue`). This panel
 * parses them with try/catch and falls back to empty structures on error.
 * `useMemo` prevents re-parsing on every render.
 *
 * ## Props
 * @prop workingHours - the `workingHours` object from the form values, where:
 *   - `selectedDates` is a JSON-serialized string[] of "YYYY-MM-DD" keys
 *   - `dayOverrides` is a JSON-serialized Record<string, {startTime, endTime}>
 *   - Other fields are plain strings (times like "10:00", booleans, etc.)
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { LuCalendar } from "react-icons/lu";
import { fadeUp, stagger } from "./shared";

interface WorkingHours {
  defaultStartTime: string;
  defaultEndTime: string;
  appointmentGap: string;
  lunchBreak: boolean;
  lunchStart: string;
  lunchDuration: string;
  selectedDates: string;
  dayOverrides: string;
}

interface Props {
  workingHours: WorkingHours;
}

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

export function PanelAdminHours({ workingHours }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const months = useMemo(() => {
    return [0, 1].map((offset) => {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }, [today]);

  const selectedDates = useMemo<Set<string>>(() => {
    try {
      return new Set(JSON.parse(workingHours.selectedDates || "[]") as string[]);
    } catch {
      return new Set<string>();
    }
  }, [workingHours.selectedDates]);

  const dayOverrides = useMemo<Record<string, { startTime: string; endTime: string }>>(() => {
    try {
      return JSON.parse(workingHours.dayOverrides || "{}");
    } catch {
      return {};
    }
  }, [workingHours.dayOverrides]);

  const selectedCount = selectedDates.size;
  const overrideCount = Object.keys(dayOverrides).length;

  // Stats
  const startMin = timeToMinutes(workingHours.defaultStartTime || "10:00");
  const endMin = timeToMinutes(workingHours.defaultEndTime || "19:00");
  const totalMin = Math.max(endMin - startMin, 0);
  const lunchMin = workingHours.lunchBreak ? parseInt(workingHours.lunchDuration) || 30 : 0;
  const gapMin = parseInt(workingHours.appointmentGap) || 0;
  const workMin = Math.max(totalMin - lunchMin, 0);
  const avgService = 90;
  const slotMin = avgService + gapMin;
  const estClients = slotMin > 0 ? Math.floor(workMin / slotMin) : 0;
  const workHrs =
    totalMin >= 60
      ? `${Math.floor(totalMin / 60)}h${totalMin % 60 ? ` ${totalMin % 60}m` : ""}`
      : `${totalMin}m`;

  // Lunch bar position
  const lunchStartMin = timeToMinutes(workingHours.lunchStart || "12:00");
  const lunchOffPct =
    totalMin > 0 ? Math.min(Math.max(((lunchStartMin - startMin) / totalMin) * 100, 5), 85) : 50;
  const lunchWPct = totalMin > 0 ? (lunchMin / totalMin) * 100 : 0;

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
            Clients can only book the days you mark open — your schedule, your rules.
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
              <span>{formatTime(workingHours.defaultStartTime || "10:00")}</span>
              <span className="text-[10px] text-muted/35">{workHrs} / day</span>
              <span>{formatTime(workingHours.defaultEndTime || "19:00")}</span>
            </div>
            <div className="relative h-2.5 bg-accent/12 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-accent/25 rounded-full" />
              {workingHours.lunchBreak && lunchMin > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-background/70 rounded"
                  style={{ left: `${lunchOffPct}%`, width: `${lunchWPct}%` }}
                />
              )}
            </div>
            {workingHours.lunchBreak && lunchMin > 0 && (
              <p className="text-[10px] text-muted/40">
                Lunch at {formatTime(workingHours.lunchStart || "12:00")} ·{" "}
                {workingHours.lunchDuration} min
              </p>
            )}
          </motion.div>
        )}

        {/* Stat chips */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2">
          <div className="px-2 py-2.5 rounded-xl bg-surface border border-foreground/8 text-center">
            <p className="text-xl font-bold text-foreground">{selectedCount}</p>
            <p className="text-[10px] text-muted/50 mt-0.5 leading-tight">days open</p>
          </div>
          <div className="px-2 py-2.5 rounded-xl bg-surface border border-foreground/8 text-center">
            <p className="text-xl font-bold text-foreground">~{estClients}</p>
            <p className="text-[10px] text-muted/50 mt-0.5 leading-tight">clients / day</p>
          </div>
          <div className="px-2 py-2.5 rounded-xl bg-surface border border-foreground/8 text-center">
            <p className="text-xl font-bold text-foreground">{gapMin > 0 ? `${gapMin}m` : "—"}</p>
            <p className="text-[10px] text-muted/50 mt-0.5 leading-tight">buffer</p>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div variants={fadeUp} className="flex items-start gap-2 px-1">
          <LuCalendar className="w-3 h-3 text-muted/30 shrink-0 mt-0.5" />
          <p className="text-xs text-muted/40 leading-relaxed">
            {selectedCount > 0 && estClients > 0
              ? `Up to ${estClients} clients/day across ${selectedCount} open days${overrideCount > 0 ? ` — ${overrideCount} with custom hours` : ""}.`
              : "Select dates on the calendar to see your capacity."}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
