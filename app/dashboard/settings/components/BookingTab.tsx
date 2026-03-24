"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import type { BookingRulesConfig } from "@/lib/types/settings.types";
import { saveBookingRules } from "../settings-actions";
import { FieldRow, ToggleRow, AutoSaveStatus, NUM_INPUT_CLASS } from "./shared";

export function BookingTab({ initial }: { initial: BookingRulesConfig }) {
  const [rules, setRules] = useState(initial);
  const { status, error, dismissError } = useAutoSave({ data: rules, onSave: saveBookingRules });

  function updateNum(key: keyof BookingRulesConfig, raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) setRules((prev) => ({ ...prev, [key]: n }));
  }

  return (
    <div className="space-y-5">
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
        <AutoSaveStatus status={status} error={error} onDismissError={dismissError} />
      </div>
    </div>
  );
}
