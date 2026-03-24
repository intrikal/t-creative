/**
 * Automated Reminders tab — configure the client communication sequence.
 *
 * DB-wired via the `reminder_config` key in the `settings` table.
 * Each reminder has Email, SMS, and Active toggles. SMS is powered by Square.
 *
 * @module settings/components/RemindersTab
 */
"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import type { RemindersConfig } from "@/lib/types/settings.types";
import { cn } from "@/lib/utils";
import { saveReminders } from "../settings-actions";
import { Toggle, FieldRow, AutoSaveStatus, NUM_INPUT_CLASS } from "./shared";

export function RemindersTab({ initial }: { initial: RemindersConfig }) {
  /** Reminder step configurations (label, timing, email/sms/active toggles). */
  const [reminders, setReminders] = useState(initial.items);
  /** Days after a visit to send a fill/rebook reminder. */
  const [fillReminderDays, setFillReminderDays] = useState(initial.fillReminderDays);
  /** Hours after appointment completion to send a review request. */
  const [reviewRequestDelayHours, setReviewRequestDelayHours] = useState(
    initial.reviewRequestDelayHours,
  );
  /** Comma-separated hour values for booking reminder windows (e.g. "24, 48"). */
  const [bookingReminderHours, setBookingReminderHours] = useState(
    initial.bookingReminderHours.join(", "),
  );

  /** Derived object combining all state for auto-save with parsed hours. */
  const autoSaveData = useMemo(() => {
    const parsedHours = bookingReminderHours
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    return {
      items: reminders,
      fillReminderDays,
      reviewRequestDelayHours,
      bookingReminderHours: parsedHours.length > 0 ? parsedHours : [24, 48],
    };
  }, [reminders, fillReminderDays, reviewRequestDelayHours, bookingReminderHours]);

  const { status, error, dismissError } = useAutoSave({
    data: autoSaveData,
    onSave: saveReminders,
  });

  /**
   * toggleField — flips a single boolean (email, sms, or active) on a reminder step.
   * Uses .map() to produce a new array with only the matched reminder changed,
   * and a computed property key so one function handles all three toggle types.
   */
  function toggleField(id: number, field: "email" | "sms" | "active") {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: !r[field] } : r)));
  }

  return (
    <div className="space-y-5">
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Cron Timing
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <FieldRow label="Fill reminder (days after visit)">
            <input
              type="number"
              value={fillReminderDays}
              onChange={(e) => setFillReminderDays(parseInt(e.target.value, 10) || 18)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Review request delay (hours)">
            <input
              type="number"
              value={reviewRequestDelayHours}
              onChange={(e) => setReviewRequestDelayHours(parseInt(e.target.value, 10) || 24)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Booking reminder windows (hours, comma-separated)">
            <input
              type="text"
              value={bookingReminderHours}
              onChange={(e) => setBookingReminderHours(e.target.value)}
              placeholder="24, 48"
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5">
          <div className="grid grid-cols-[1fr_44px_44px_44px] sm:grid-cols-[1fr_60px_60px_56px] gap-x-2 sm:gap-x-4 mb-3 pb-2 border-b border-border/60 items-center">
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
                  "grid grid-cols-[1fr_44px_44px_44px] sm:grid-cols-[1fr_60px_60px_56px] gap-x-2 sm:gap-x-4 items-center py-3 px-2 rounded-xl transition-colors",
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

      <div className="flex justify-end">
        <AutoSaveStatus status={status} error={error} onDismissError={dismissError} />
      </div>
    </div>
  );
}
