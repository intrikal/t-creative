/**
 * Automated Reminders tab — configure the client communication sequence.
 *
 * **Currently hardcoded** — local state with 6 pre-defined reminder steps:
 * booking confirmation, 48h reminder, 24h reminder, day-of reminder,
 * 4-week follow-up, and review request.
 *
 * Each reminder has Email, SMS, and Active toggles. SMS is powered by Square.
 * When a DB schema for reminders is added, this can be wired similarly to
 * NotificationsTab.
 *
 * @module settings/components/RemindersTab
 */
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Toggle } from "./shared";

const INITIAL_REMINDERS = [
  {
    id: 1,
    label: "Booking confirmation",
    timing: "Immediately after booking",
    email: true,
    sms: true,
    active: true,
  },
  {
    id: 2,
    label: "48-hour reminder",
    timing: "2 days before appointment",
    email: true,
    sms: true,
    active: true,
  },
  {
    id: 3,
    label: "24-hour reminder",
    timing: "1 day before appointment",
    email: false,
    sms: true,
    active: true,
  },
  {
    id: 4,
    label: "Day-of reminder",
    timing: "Morning of appointment",
    email: false,
    sms: true,
    active: false,
  },
  {
    id: 5,
    label: "4-week follow-up",
    timing: "28 days after appointment",
    email: true,
    sms: false,
    active: true,
  },
  {
    id: 6,
    label: "Review request",
    timing: "2 days after appointment",
    email: true,
    sms: false,
    active: true,
  },
];

export function RemindersTab() {
  const [reminders, setReminders] = useState(INITIAL_REMINDERS);

  function toggleField(id: number, field: "email" | "sms" | "active") {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: !r[field] } : r)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Automated Reminders</h2>
        <p className="text-xs text-muted mt-0.5">
          Configure your client communication sequence. SMS is powered by Square.
        </p>
      </div>
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5">
          <div className="grid grid-cols-[1fr_60px_60px_56px] gap-x-4 mb-3 pb-2 border-b border-border/60 items-center">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Step
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              Email
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              SMS
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              On
            </span>
          </div>
          <div className="space-y-1">
            {reminders.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-[1fr_60px_60px_56px] gap-x-4 items-center py-3 px-2 rounded-xl transition-colors",
                  r.active ? "hover:bg-surface/60" : "opacity-50",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted mt-0.5">{r.timing}</p>
                </div>
                <div className="flex justify-center">
                  <Toggle on={r.email} onChange={() => toggleField(r.id, "email")} />
                </div>
                <div className="flex justify-center">
                  <Toggle on={r.sms} onChange={() => toggleField(r.id, "sms")} />
                </div>
                <div className="flex justify-center">
                  <Toggle on={r.active} onChange={() => toggleField(r.id, "active")} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
