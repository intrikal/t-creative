"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AvailabilityRow } from "../actions";
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

export function AvailabilityTab({
  assistants,
  availability,
}: {
  assistants: Assistant[];
  availability: AvailabilityRow[];
}) {
  // Group availability by staffId
  const scheduleMap = new Map<
    string,
    Map<ShiftDay, { opensAt: string | null; closesAt: string | null }>
  >();
  for (const row of availability) {
    if (!scheduleMap.has(row.staffId)) scheduleMap.set(row.staffId, new Map());
    const day = DAY_MAP[row.dayOfWeek];
    if (day && row.isOpen) {
      scheduleMap.get(row.staffId)!.set(day, { opensAt: row.opensAt, closesAt: row.closesAt });
    }
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4 md:px-5">
        <CardTitle className="text-sm font-semibold">Weekly Availability</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                  Assistant
                </th>
                {ALL_DAYS.map((d) => (
                  <th
                    key={d}
                    className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-2 pb-2.5"
                  >
                    {d}
                  </th>
                ))}
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5 hidden lg:table-cell">
                  Hours
                </th>
              </tr>
            </thead>
            <tbody>
              {assistants.map((a) => {
                const schedule = scheduleMap.get(a.id);
                // Derive hours from schedule or fall back to assistant.hours
                let hoursLabel = a.hours;
                if (schedule && schedule.size > 0) {
                  const first = schedule.values().next().value;
                  if (first?.opensAt && first?.closesAt) {
                    hoursLabel = `${first.opensAt} – ${first.closesAt}`;
                  }
                }

                return (
                  <tr
                    key={a.id}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
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
                      const hasSchedule = schedule?.has(day);
                      const worksDay = hasSchedule || a.shifts.includes(day);
                      return (
                        <td key={day} className="px-2 py-3 text-center align-middle">
                          {worksDay ? (
                            <CheckCircle2 className="w-4 h-4 text-[#4e6b51] mx-auto" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-muted/30 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 md:px-5 py-3 align-middle text-xs text-muted hidden lg:table-cell">
                      {hoursLabel}
                    </td>
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
