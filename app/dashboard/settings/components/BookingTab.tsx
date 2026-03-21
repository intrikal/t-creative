/**
 * Booking Rules tab — scheduling constraints, cancellation, and deposit settings.
 *
 * DB-wired via the `booking_rules` key in the `settings` table.
 *
 * @module settings/components/BookingTab
 */
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BookingRulesConfig } from "../settings-actions";
import { saveBookingRules } from "../settings-actions";
import { FieldRow, ToggleRow, StatefulSaveButton, NUM_INPUT_CLASS } from "./shared";

export function BookingTab({ initial }: { initial: BookingRulesConfig }) {
  /** Full booking rules config object — spread-updated on each field change. */
  const [rules, setRules] = useState(initial);
  /** Whether the save action is in flight. */
  const [saving, setSaving] = useState(false);
  /** Briefly true after a successful save to show "Saved!" feedback. */
  const [saved, setSaved] = useState(false);
  /** Error message from save, if any. */
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * updateNum — parses a numeric input and updates one booking rule field.
   * NaN values are silently ignored to prevent invalid state from reaching the DB.
   */
  function updateNum(key: keyof BookingRulesConfig, raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) setRules((prev) => ({ ...prev, [key]: n }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const result = await saveBookingRules(rules);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setSaveError(result.error);
    }
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
        <h2 className="text-base font-semibold text-foreground">Booking Rules</h2>
        <p className="text-xs text-muted mt-0.5">Control how and when clients can book with you</p>
      </div>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-sm font-semibold text-muted uppercase tracking-wide text-[10px]">
            Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <FieldRow label="Min notice (hours)">
            <input
              type="number"
              value={rules.minNoticeHours}
              onChange={(e) => updateNum("minNoticeHours", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Max advance (days)">
            <input
              type="number"
              value={rules.maxAdvanceDays}
              onChange={(e) => updateNum("maxAdvanceDays", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Buffer between appts (mins)">
            <input
              type="number"
              value={rules.bufferMinutes}
              onChange={(e) => updateNum("bufferMinutes", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Max daily bookings">
            <input
              type="number"
              value={rules.maxDailyBookings}
              onChange={(e) => updateNum("maxDailyBookings", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-sm font-semibold text-muted uppercase tracking-wide text-[10px]">
            Cancellations & Deposits
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <FieldRow label="Cancellation window (hours)">
            <input
              type="number"
              value={rules.cancelWindowHours}
              onChange={(e) => updateNum("cancelWindowHours", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <ToggleRow
            label="Require deposit"
            hint="Client must pay deposit to confirm booking"
            on={rules.depositRequired}
            onChange={(v) => setRules((prev) => ({ ...prev, depositRequired: v }))}
          />
          {rules.depositRequired && (
            <FieldRow label="Deposit amount (%)">
              <input
                type="number"
                value={rules.depositPct}
                onChange={(e) => updateNum("depositPct", e.target.value)}
                className={NUM_INPUT_CLASS}
              />
            </FieldRow>
          )}
          <ToggleRow
            label="Allow online booking"
            hint="Clients can book directly from your booking link"
            on={rules.allowOnlineBooking}
            onChange={(v) => setRules((prev) => ({ ...prev, allowOnlineBooking: v }))}
          />
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-sm font-semibold text-muted uppercase tracking-wide text-[10px]">
            Waitlist & Waivers
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <FieldRow label="Waitlist claim window (hours)">
            <input
              type="number"
              value={rules.waitlistClaimWindowHours}
              onChange={(e) => updateNum("waitlistClaimWindowHours", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Waiver token expiry (days)">
            <input
              type="number"
              value={rules.waiverTokenExpiryDays}
              onChange={(e) => updateNum("waiverTokenExpiryDays", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <StatefulSaveButton
          label="Save Booking Rules"
          saving={saving}
          saved={saved}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
