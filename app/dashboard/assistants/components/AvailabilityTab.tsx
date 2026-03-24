/**
 * AvailabilityTab — Editable weekly availability grid for all assistants.
 *
 * Each cell is clickable to toggle a day on/off. When a day is enabled,
 * time inputs appear inline to set open/close hours. Changes are saved
 * immediately via the upsertAssistantAvailability server action.
 */
"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AvailabilityRow } from "../actions";
import { upsertAssistantAvailability } from "../actions";
import { type Assistant, ALL_DAYS, type ShiftDay } from "../AssistantsPage";

const DAY_MAP: Record<number, ShiftDay> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

const DAY_TO_NUM: Record<ShiftDay, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

type DaySchedule = {
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
};

type StaffSchedule = Record<ShiftDay, DaySchedule>;

function buildScheduleMap(availability: AvailabilityRow[]): Map<string, StaffSchedule> {
  const map = new Map<string, StaffSchedule>();

  const defaultDay = (): DaySchedule => ({ isOpen: false, opensAt: "09:00", closesAt: "17:00" });
  const defaultSchedule = (): StaffSchedule =>
    Object.fromEntries(ALL_DAYS.map((d) => [d, defaultDay()])) as StaffSchedule;

  for (const row of availability) {
    const day = DAY_MAP[row.dayOfWeek];
    if (!day) continue;
    if (!map.has(row.staffId)) map.set(row.staffId, defaultSchedule());
    map.get(row.staffId)![day] = {
      isOpen: row.isOpen,
      opensAt: row.opensAt ?? "09:00",
      closesAt: row.closesAt ?? "17:00",
    };
  }

  return map;
}

export function AvailabilityTab({
  assistants,
  availability,
}: {
  assistants: Assistant[];
  availability: AvailabilityRow[];
}) {
  const [schedules, setSchedules] = useState<Map<string, StaffSchedule>>(() =>
    buildScheduleMap(availability),
  );
  const [, startTransition] = useTransition();
  // Track which cells are saving for visual feedback
  const [saving, setSaving] = useState<Set<string>>(new Set());

  function getSchedule(staffId: string): StaffSchedule {
    if (!schedules.has(staffId)) {
      const s = Object.fromEntries(
        ALL_DAYS.map((d) => [d, { isOpen: false, opensAt: "09:00", closesAt: "17:00" }]),
      ) as StaffSchedule;
      return s;
    }
    return schedules.get(staffId)!;
  }

  function updateDay(staffId: string, day: ShiftDay, patch: Partial<DaySchedule>) {
    setSchedules((prev) => {
      const next = new Map(prev);
      const current = getSchedule(staffId);
      next.set(staffId, { ...current, [day]: { ...current[day], ...patch } });
      return next;
    });
  }

  function saveDay(staffId: string, day: ShiftDay, updated: DaySchedule) {
    const key = `${staffId}-${day}`;
    setSaving((s) => new Set(s).add(key));
    startTransition(async () => {
      await upsertAssistantAvailability(
        staffId,
        DAY_TO_NUM[day],
        updated.isOpen,
        updated.isOpen ? updated.opensAt : null,
        updated.isOpen ? updated.closesAt : null,
      );
      setSaving((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    });
  }

  function toggleDay(staffId: string, day: ShiftDay) {
    const current = getSchedule(staffId)[day];
    const updated = { ...current, isOpen: !current.isOpen };
    updateDay(staffId, day, { isOpen: updated.isOpen });
    saveDay(staffId, day, updated);
  }

  function updateTime(
    staffId: string,
    day: ShiftDay,
    field: "opensAt" | "closesAt",
    value: string,
  ) {
    updateDay(staffId, day, { [field]: value });
    // Debounce save — save on blur instead
  }

  function saveTime(staffId: string, day: ShiftDay) {
    const updated = getSchedule(staffId)[day];
    if (updated.isOpen) saveDay(staffId, day, updated);
  }

  if (assistants.length === 0) {
    return (
      <Card className="gap-0">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mb-4">
            <Clock className="w-5 h-5 text-muted" />
          </div>
          <p className="text-sm font-semibold text-foreground">No team members yet</p>
          <p className="text-xs text-muted mt-1">
            Add assistants to manage their weekly availability.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4 md:px-5">
        <CardTitle className="text-sm font-semibold">Weekly Availability</CardTitle>
        <p className="text-xs text-muted mt-0.5">
          Click a day to toggle it on or off. Set hours when a day is active.
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5 min-w-[140px]">
                  Assistant
                </th>
                {ALL_DAYS.map((d) => (
                  <th
                    key={d}
                    className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-2 pb-2.5 min-w-[72px]"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assistants.map((a) => {
                const schedule = getSchedule(a.id);
                return (
                  <tr key={a.id} className="border-b border-border/40 last:border-0 align-top">
                    <td className="px-4 md:px-5 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                            {a.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-foreground">{a.name}</span>
                      </div>
                    </td>
                    {ALL_DAYS.map((day) => {
                      const cell = schedule[day];
                      const key = `${a.id}-${day}`;
                      const isSaving = saving.has(key);
                      return (
                        <td key={day} className="px-1.5 py-2.5 text-center align-top">
                          <div className="flex flex-col items-center gap-1.5">
                            {/* Toggle pill */}
                            <button
                              onClick={() => toggleDay(a.id, day)}
                              disabled={isSaving}
                              className={cn(
                                "w-full text-[10px] font-semibold px-2 py-1 rounded-md border transition-all",
                                isSaving && "opacity-50 cursor-wait",
                                cell.isOpen
                                  ? "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/25 hover:bg-[#4e6b51]/15"
                                  : "bg-transparent text-muted/50 border-border/40 hover:border-border hover:text-muted",
                              )}
                            >
                              {cell.isOpen ? "On" : "Off"}
                            </button>

                            {/* Time inputs — only when open */}
                            {cell.isOpen && (
                              <div className="flex flex-col gap-1 w-full">
                                <input
                                  type="time"
                                  value={cell.opensAt}
                                  onChange={(e) => updateTime(a.id, day, "opensAt", e.target.value)}
                                  onBlur={() => saveTime(a.id, day)}
                                  className="w-full text-[10px] text-foreground bg-surface border border-border/60 rounded px-1 py-0.5 tabular-nums focus:outline-none focus:ring-1 focus:ring-accent/50"
                                />
                                <input
                                  type="time"
                                  value={cell.closesAt}
                                  onChange={(e) =>
                                    updateTime(a.id, day, "closesAt", e.target.value)
                                  }
                                  onBlur={() => saveTime(a.id, day)}
                                  className="w-full text-[10px] text-foreground bg-surface border border-border/60 rounded px-1 py-0.5 tabular-nums focus:outline-none focus:ring-1 focus:ring-accent/50"
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
