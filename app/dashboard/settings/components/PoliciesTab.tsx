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
import type { PolicySettings } from "../settings-actions";
import { savePolicies } from "../settings-actions";
import { FieldRow, ToggleRow, StatefulSaveButton, NUM_INPUT_CLASS } from "./shared";

export function PoliciesTab({ initial }: { initial: PolicySettings }) {
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateNum(key: keyof PolicySettings, raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) setData((prev) => ({ ...prev, [key]: n }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await savePolicies(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
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
