/**
 * Policies tab — cancellation, no-show, and deposit fee configuration.
 *
 * DB-wired via the `policy_settings` key in the `settings` table.
 * Fields: cancellationWindowHours, lateCancelFeePercent, noShowFeePercent,
 * requireDeposit (toggle), depositPercent.
 *
 * Saves via `savePolicies()` which upserts the JSON blob. Defaults are
 * provided by `DEFAULT_POLICIES` in `settings-actions.ts` so the form
 * always renders valid data even before the first save.
 *
 * @module settings/components/PoliciesTab
 * @see {@link ../settings-actions.ts} — `PolicySettings` type + save action
 */
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PolicySettings } from "@/lib/types/settings.types";
import { savePolicies } from "../settings-actions";
import { FieldRow, ToggleRow, StatefulSaveButton, NUM_INPUT_CLASS, INPUT_CLASS } from "./shared";

export function PoliciesTab({ initial }: { initial: PolicySettings }) {
  /** Full policy config object — spread-updated on each field change. */
  const [data, setData] = useState(initial);
  /** Whether the save action is in flight. */
  const [saving, setSaving] = useState(false);
  /** Briefly true after a successful save to show "Saved!" feedback. */
  const [saved, setSaved] = useState(false);
  /** Error message from save, if any. */
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * updateNum — parses a numeric input string and updates one policy field.
   * Uses computed property key so a single function handles all numeric fields.
   * NaN values are silently ignored to prevent invalid state.
   */
  function updateNum(key: keyof PolicySettings, raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) setData((prev) => ({ ...prev, [key]: n }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const result = await savePolicies(data);
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
        <h2 className="text-base font-semibold text-foreground">Policies</h2>
        <p className="text-xs text-muted mt-0.5">
          Cancellation window, fee percentages, and deposit rules
        </p>
      </div>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Cancellation & No-Show
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <FieldRow label="Cancellation window (hours)">
            <input
              type="number"
              value={data.cancelWindowHours}
              onChange={(e) => updateNum("cancelWindowHours", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Late cancel fee (%)">
            <input
              type="number"
              value={data.lateCancelFeePercent}
              onChange={(e) => updateNum("lateCancelFeePercent", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="No-show fee (%)">
            <input
              type="number"
              value={data.noShowFeePercent}
              onChange={(e) => updateNum("noShowFeePercent", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Cancellation Refund Tiers
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <FieldRow label="Full refund if cancelled before (hours)">
            <input
              type="number"
              value={data.fullRefundHours}
              onChange={(e) => updateNum("fullRefundHours", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Partial refund (% of deposit)">
            <input
              type="number"
              value={data.partialRefundPct}
              onChange={(e) => updateNum("partialRefundPct", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Partial refund minimum (hours)">
            <input
              type="number"
              value={data.partialRefundMinHours}
              onChange={(e) => updateNum("partialRefundMinHours", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="No refund within (hours)">
            <input
              type="number"
              value={data.noRefundHours}
              onChange={(e) => updateNum("noRefundHours", e.target.value)}
              className={NUM_INPUT_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Deposits
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <ToggleRow
            label="Require deposit"
            hint="Client must pay deposit to confirm booking"
            on={data.depositRequired}
            onChange={(v) => setData((prev) => ({ ...prev, depositRequired: v }))}
          />
          {data.depositRequired && (
            <FieldRow label="Deposit amount (%)">
              <input
                type="number"
                value={data.depositPercent}
                onChange={(e) => updateNum("depositPercent", e.target.value)}
                className={NUM_INPUT_CLASS}
              />
            </FieldRow>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Booking Terms of Service
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Cancellation policy text</label>
            <p className="text-[11px] text-muted">
              Shown to clients as a required checkbox on the booking form. Plain text only.
            </p>
            <textarea
              value={data.cancellationPolicy}
              onChange={(e) => setData((prev) => ({ ...prev, cancellationPolicy: e.target.value }))}
              rows={4}
              className={INPUT_CLASS + " resize-none"}
            />
          </div>
          <FieldRow label="Policy version">
            <input
              type="text"
              value={data.tosVersion}
              onChange={(e) => setData((prev) => ({ ...prev, tosVersion: e.target.value }))}
              placeholder="e.g. 2025-01"
              className={INPUT_CLASS}
            />
          </FieldRow>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <StatefulSaveButton
          label="Save Policies"
          saving={saving}
          saved={saved}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
