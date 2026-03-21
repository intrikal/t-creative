/**
 * Automated Reminders tab — configure the client communication sequence.
 *
 * DB-wired via the `reminder_config` key in the `settings` table.
 * Each reminder has Email, SMS, and Active toggles. SMS is powered by Square.
 *
 * @module settings/components/RemindersTab
 */
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTimeoutFlag } from "@/lib/hooks/use-timeout-flag";
import { cn } from "@/lib/utils";
import type { RemindersConfig } from "../settings-actions";
import { saveReminders } from "../settings-actions";
import { Toggle, FieldRow, StatefulSaveButton, NUM_INPUT_CLASS } from "./shared";

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
  /** Whether the save action is in flight. */
  const [saving, setSaving] = useState(false);
  /** Briefly true after a successful save; auto-resets via useTimeoutFlag. */
  const [saved, triggerSaved] = useTimeoutFlag(2000);
  /** Error message from save, if any. */
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * toggleField — flips a single boolean (email, sms, or active) on a reminder step.
   * Uses .map() to produce a new array with only the matched reminder changed,
   * and a computed property key so one function handles all three toggle types.
   */
  function toggleField(id: number, field: "email" | "sms" | "active") {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: !r[field] } : r)));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    // Parse the comma-separated hours string into an array of positive integers.
    // Invalid entries (NaN, <= 0) are filtered out; falls back to [24, 48] if empty.
    const parsedHours = bookingReminderHours
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    const result = await saveReminders({
      items: reminders,
      fillReminderDays,
      reviewRequestDelayHours,
      bookingReminderHours: parsedHours.length > 0 ? parsedHours : [24, 48],
    });
    setSaving(false);
    if (result.success) triggerSaved();
    else setSaveError(result.error);
  }

  return (
    <div className="space-y-5">
      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <span>{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}
      <div>
        <h2 className="text-base font-semibold text-foreground">Automated Reminders</h2>
        <p className="text-xs text-muted mt-0.5">
          Configure your client communication sequence. SMS is powered by Square.
        </p>
      </div>
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

      <div className="flex justify-end">
        <StatefulSaveButton
          label="Save Reminders"
          saving={saving}
          saved={saved}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
