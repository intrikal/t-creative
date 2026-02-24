/**
 * Booking Rules tab — scheduling constraints, cancellation, and deposit settings.
 *
 * **Currently hardcoded** — no DB schema exists for booking rules yet.
 * Uses local `useState` with `INITIAL_BOOKING` defaults. When a `booking_rules`
 * settings key is added, this tab can be wired similarly to PoliciesTab.
 *
 * Fields: minNoticeHours, maxAdvanceDays, cancelWindowHours, depositPercent,
 * allowWaitlist, requireDeposit.
 *
 * @module settings/components/BookingTab
 */
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldRow, ToggleRow, NUM_INPUT_CLASS } from "./shared";

const INITIAL_BOOKING = {
  minNoticeHours: 24,
  maxAdvanceDays: 60,
  cancelWindowHours: 48,
  depositRequired: true,
  depositPct: 25,
  allowOnlineBooking: true,
  bufferMinutes: 15,
  maxDailyBookings: 8,
};

export function BookingTab() {
  const [rules, setRules] = useState(INITIAL_BOOKING);

  function toggleRule(key: "depositRequired" | "allowOnlineBooking") {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-5">
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
            <input type="number" defaultValue={rules.minNoticeHours} className={NUM_INPUT_CLASS} />
          </FieldRow>
          <FieldRow label="Max advance (days)">
            <input type="number" defaultValue={rules.maxAdvanceDays} className={NUM_INPUT_CLASS} />
          </FieldRow>
          <FieldRow label="Buffer between appts (mins)">
            <input type="number" defaultValue={rules.bufferMinutes} className={NUM_INPUT_CLASS} />
          </FieldRow>
          <FieldRow label="Max daily bookings">
            <input
              type="number"
              defaultValue={rules.maxDailyBookings}
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
              defaultValue={rules.cancelWindowHours}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Deposit amount (%)">
            <input type="number" defaultValue={rules.depositPct} className={NUM_INPUT_CLASS} />
          </FieldRow>
          <ToggleRow
            label="Require deposit"
            hint="Client must pay deposit to confirm booking"
            on={rules.depositRequired}
            onChange={() => toggleRule("depositRequired")}
          />
          <ToggleRow
            label="Allow online booking"
            hint="Clients can book directly from your booking link"
            on={rules.allowOnlineBooking}
            onChange={() => toggleRule("allowOnlineBooking")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
