/**
 * Hours & Availability tab — weekly schedule, lunch break, and blocked dates.
 *
 * Three sections:
 * 1. **Weekly Hours** — 7 day rows (Mon–Sun) with open/close time inputs and
 *    an active toggle. Saves via `saveBusinessHours()` to `business_hours` table.
 * 2. **Lunch Break** — global toggle + time range. Saves via `saveLunchBreak()`
 *    to the `settings` table under the `lunch_break` key.
 * 3. **Blocked Dates** — add/remove date ranges stored in the `time_off` table.
 *    Uses `addTimeOff()` / `deleteTimeOff()` server actions.
 *
 * All three sections are independently saveable. Data is DB-wired via
 * `hours-actions.ts`.
 *
 * @module settings/components/HoursTab
 * @see {@link ../hours-actions.ts} — server actions for schedule data
 */
"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BusinessHourRow, LunchBreak, TimeOffRow } from "../hours-actions";
import { addTimeOff, deleteTimeOff, saveLunchBreak, saveBusinessHours } from "../hours-actions";
import { StatefulSaveButton, ToggleRow, Toggle } from "./shared";

const DAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function formatBlockedDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function HoursTab({
  initialHours,
  initialTimeOff,
  initialLunchBreak,
}: {
  initialHours: BusinessHourRow[];
  initialTimeOff: TimeOffRow[];
  initialLunchBreak: LunchBreak | null;
}) {
  const [days, setDays] = useState(() =>
    initialHours.map((h) => ({
      id: h.id,
      dayOfWeek: h.dayOfWeek,
      isOpen: h.isOpen,
      opensAt: h.opensAt ?? "09:00",
      closesAt: h.closesAt ?? "18:00",
    })),
  );
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  const [lunch, setLunch] = useState<LunchBreak>(
    initialLunchBreak ?? { enabled: false, start: "12:00", end: "13:00" },
  );
  const [lunchSaving, setLunchSaving] = useState(false);
  const [lunchSaved, setLunchSaved] = useState(false);

  const [blocked, setBlocked] = useState(initialTimeOff);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<"day_off" | "vacation">("day_off");
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleSaveHours() {
    setHoursSaving(true);
    try {
      await saveBusinessHours(
        days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isOpen: d.isOpen,
          opensAt: d.isOpen ? d.opensAt : null,
          closesAt: d.isOpen ? d.closesAt : null,
        })),
      );
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 2000);
    } finally {
      setHoursSaving(false);
    }
  }

  async function handleSaveLunch() {
    setLunchSaving(true);
    try {
      await saveLunchBreak(lunch);
      setLunchSaved(true);
      setTimeout(() => setLunchSaved(false), 2000);
    } finally {
      setLunchSaving(false);
    }
  }

  async function handleAddBlocked() {
    if (!addStart) return;
    setAdding(true);
    try {
      const row = await addTimeOff({
        type: addType,
        startDate: addStart,
        endDate: addType === "day_off" ? addStart : addEnd || addStart,
        label: addLabel || undefined,
      });
      setBlocked((prev) => [...prev, row]);
      setShowAddForm(false);
      setAddStart("");
      setAddEnd("");
      setAddLabel("");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteBlocked(id: number) {
    await deleteTimeOff(id);
    setBlocked((prev) => prev.filter((b) => b.id !== id));
  }

  const timeInputClass =
    "px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Working Hours</h2>
        <p className="text-xs text-muted mt-0.5">
          Manage your weekly schedule, lunch break, and blocked dates
        </p>
      </div>

      {/* Weekly Schedule */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-1">
          {days.map((row, idx) => (
            <div
              key={row.dayOfWeek}
              className="flex items-center gap-4 py-3 rounded-xl px-3 hover:bg-surface/60 transition-colors"
            >
              <span
                className={cn(
                  "text-sm w-28 shrink-0 font-medium",
                  row.isOpen ? "text-foreground" : "text-muted/60",
                )}
              >
                {DAY_NAMES[row.dayOfWeek]}
              </span>
              <div className="flex-1 flex items-center gap-2">
                {row.isOpen ? (
                  <>
                    <input
                      type="time"
                      value={row.opensAt}
                      onChange={(e) =>
                        setDays((prev) =>
                          prev.map((d, i) => (i === idx ? { ...d, opensAt: e.target.value } : d)),
                        )
                      }
                      className={cn(timeInputClass, "w-28")}
                    />
                    <span className="text-muted text-xs shrink-0">to</span>
                    <input
                      type="time"
                      value={row.closesAt}
                      onChange={(e) =>
                        setDays((prev) =>
                          prev.map((d, i) => (i === idx ? { ...d, closesAt: e.target.value } : d)),
                        )
                      }
                      className={cn(timeInputClass, "w-28")}
                    />
                  </>
                ) : (
                  <span className="text-sm text-muted/40 italic">Closed</span>
                )}
              </div>
              <Toggle
                on={row.isOpen}
                onChange={() =>
                  setDays((prev) =>
                    prev.map((d, i) => (i === idx ? { ...d, isOpen: !d.isOpen } : d)),
                  )
                }
              />
            </div>
          ))}
          <div className="flex justify-end pt-3 border-t border-border/50 mt-2">
            <StatefulSaveButton
              label="Save Hours"
              saving={hoursSaving}
              saved={hoursSaved}
              onSave={handleSaveHours}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lunch Break */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Lunch Break
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <ToggleRow
            label="Block lunch break"
            hint="Prevent new bookings during your lunch window"
            on={lunch.enabled}
            onChange={(v) => setLunch((prev) => ({ ...prev, enabled: v }))}
          />
          {lunch.enabled && (
            <div className="flex items-center gap-3 pl-1">
              <input
                type="time"
                value={lunch.start}
                onChange={(e) => setLunch((prev) => ({ ...prev, start: e.target.value }))}
                className={cn(timeInputClass, "w-28")}
              />
              <span className="text-muted text-xs shrink-0">to</span>
              <input
                type="time"
                value={lunch.end}
                onChange={(e) => setLunch((prev) => ({ ...prev, end: e.target.value }))}
                className={cn(timeInputClass, "w-28")}
              />
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-border/50">
            <StatefulSaveButton
              label="Save Lunch Break"
              saving={lunchSaving}
              saved={lunchSaved}
              onSave={handleSaveLunch}
            />
          </div>
        </CardContent>
      </Card>

      {/* Blocked Dates */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Blocked Dates
            </CardTitle>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-foreground/5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-3">
          {showAddForm && (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    Type
                  </label>
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as "day_off" | "vacation")}
                    className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none"
                  >
                    <option value="day_off">Day Off</option>
                    <option value="vacation">Vacation</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    {addType === "day_off" ? "Date" : "Start Date"}
                  </label>
                  <input
                    type="date"
                    value={addStart}
                    onChange={(e) => setAddStart(e.target.value)}
                    className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none"
                  />
                </div>
                {addType === "vacation" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted uppercase tracking-wide">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={addEnd}
                      min={addStart}
                      onChange={(e) => setAddEnd(e.target.value)}
                      className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                  <label className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    Label (optional)
                  </label>
                  <input
                    type="text"
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value)}
                    placeholder="e.g. Hawaii trip"
                    className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddBlocked}
                  disabled={!addStart || adding}
                  className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1 disabled:opacity-60"
                >
                  <Check className="w-3 h-3" />
                  {adding ? "Adding…" : "Add"}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs font-medium text-muted rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {blocked.length === 0 && !showAddForm && (
            <p className="text-sm text-muted/60 italic text-center py-4">
              No blocked dates — your schedule is fully open.
            </p>
          )}

          {blocked.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-surface/60"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                      entry.type === "day_off"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-blue-50 text-blue-600",
                    )}
                  >
                    {entry.type === "day_off" ? "Day Off" : "Vacation"}
                  </span>
                  {entry.label && (
                    <span className="text-sm font-medium text-foreground truncate">
                      {entry.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {entry.startDate === entry.endDate
                    ? formatBlockedDate(entry.startDate)
                    : `${formatBlockedDate(entry.startDate)} – ${formatBlockedDate(entry.endDate)}`}
                </p>
              </div>
              <button
                onClick={() => handleDeleteBlocked(entry.id)}
                className="text-muted hover:text-destructive transition-colors shrink-0 p-1.5 rounded-lg hover:bg-destructive/10"
                title="Remove blocked date"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
