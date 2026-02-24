/**
 * Loyalty Program tab — configure point values and tier thresholds.
 *
 * DB-wired via the `loyalty_config` key in the `settings` table.
 *
 * **Point Values** (6 actions): profileComplete, birthdayAdded, referral,
 * firstBooking, rebook, review — each configurable as an integer.
 *
 * **Tier Thresholds**: Bronze (default, 0 pts) → Silver → Gold → Platinum.
 * Each tier has a minimum points threshold. Tier labels are colour-coded
 * (silver #8a8a8a, gold #d4a574, platinum #5b8a8a).
 *
 * @module settings/components/LoyaltyTab
 * @see {@link ../settings-actions.ts} — `LoyaltyConfig` type + save action
 */
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LoyaltyConfig } from "../settings-actions";
import { saveLoyaltyConfig } from "../settings-actions";
import { FieldRow, StatefulSaveButton, NUM_INPUT_CLASS } from "./shared";

export function LoyaltyTab({ initial }: { initial: LoyaltyConfig }) {
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateNum(key: keyof LoyaltyConfig, raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) setData((prev) => ({ ...prev, [key]: n }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveLoyaltyConfig(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const pointFields: { label: string; key: keyof LoyaltyConfig }[] = [
    { label: "Profile complete", key: "pointsProfileComplete" },
    { label: "Birthday added", key: "pointsBirthdayAdded" },
    { label: "Referral bonus", key: "pointsReferral" },
    { label: "First booking", key: "pointsFirstBooking" },
    { label: "Rebooking", key: "pointsRebook" },
    { label: "Review", key: "pointsReview" },
  ];

  const tierFields: { label: string; key: keyof LoyaltyConfig; color: string }[] = [
    { label: "Silver threshold", key: "tierSilver", color: "text-[#8a8a8a]" },
    { label: "Gold threshold", key: "tierGold", color: "text-[#d4a574]" },
    { label: "Platinum threshold", key: "tierPlatinum", color: "text-[#5b8a8a]" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Loyalty Program</h2>
        <p className="text-xs text-muted mt-0.5">
          Configure point values for actions and tier thresholds
        </p>
      </div>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Point Values
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          {pointFields.map(({ label, key }) => (
            <FieldRow key={key} label={label}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={data[key]}
                  onChange={(e) => updateNum(key, e.target.value)}
                  className={NUM_INPUT_CLASS}
                />
                <span className="text-xs text-muted">pts</span>
              </div>
            </FieldRow>
          ))}
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Tier Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <p className="text-xs text-muted">
            Bronze is the default tier (0 points). Set minimum points to reach each tier.
          </p>
          {tierFields.map(({ label, key, color }) => (
            <FieldRow key={key} label={label}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={data[key]}
                  onChange={(e) => updateNum(key, e.target.value)}
                  className={NUM_INPUT_CLASS}
                />
                <span className={cn("text-xs font-medium", color)}>pts</span>
              </div>
            </FieldRow>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <StatefulSaveButton
          label="Save Loyalty Config"
          saving={saving}
          saved={saved}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
