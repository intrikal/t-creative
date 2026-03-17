/**
 * Studio Profile tab — edit business name, bio, location, contact, and preferences.
 *
 * Controlled form backed by `useState(initial)`. On save, calls
 * `saveBusinessProfile()` which upserts the `business_profile` key in the
 * `settings` table. The server component re-fetches on next navigation.
 *
 * Fields: studioName, ownerName, bio, address, email, phone, timezone,
 * currency, bookingLink.
 *
 * @module settings/components/BusinessTab
 * @see {@link ../settings-actions.ts} — `BusinessProfile` type + save action
 */
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BusinessProfile, FinancialConfig } from "../settings-actions";
import { saveBusinessProfile, saveFinancialConfig } from "../settings-actions";
import { FieldRow, StatefulSaveButton, INPUT_CLASS } from "./shared";

const TIMEZONES = [
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "America/Anchorage", label: "Alaska (AKST)" },
  { value: "America/Los_Angeles", label: "Pacific (PST)" },
  { value: "America/Denver", label: "Mountain (MST)" },
  { value: "America/Chicago", label: "Central (CST)" },
  { value: "America/New_York", label: "Eastern (EST)" },
  { value: "America/Phoenix", label: "Arizona (MST, no DST)" },
  { value: "America/Puerto_Rico", label: "Atlantic (AST)" },
  { value: "Pacific/Guam", label: "Guam (ChST)" },
  { value: "America/Toronto", label: "Toronto (EST)" },
  { value: "America/Vancouver", label: "Vancouver (PST)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)" },
];

export function BusinessTab({
  initial,
  initialFinancial,
}: {
  initial: BusinessProfile;
  initialFinancial: FinancialConfig;
}) {
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [financial, setFinancial] = useState(initialFinancial);
  const [savingFinancial, setSavingFinancial] = useState(false);
  const [savedFinancial, setSavedFinancial] = useState(false);

  function update<K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveBusinessProfile(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFinancial() {
    setSavingFinancial(true);
    try {
      await saveFinancialConfig(financial);
      setSavedFinancial(true);
      setTimeout(() => setSavedFinancial(false), 2000);
    } finally {
      setSavingFinancial(false);
    }
  }

  const fields: { label: string; key: keyof BusinessProfile }[] = [
    { label: "Business Name", key: "businessName" },
    { label: "Owner", key: "owner" },
    { label: "Email", key: "email" },
    { label: "Phone", key: "phone" },
    { label: "Location", key: "location" },
    { label: "Currency", key: "currency" },
    { label: "Booking Link", key: "bookingLink" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Business Information</h2>
        <p className="text-xs text-muted mt-0.5">
          Your studio&apos;s public profile and contact details
        </p>
      </div>
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          {fields.map(({ label, key }) => (
            <FieldRow key={key} label={label}>
              <input
                type="text"
                value={data[key]}
                onChange={(e) => update(key, e.target.value)}
                className={INPUT_CLASS}
              />
            </FieldRow>
          ))}
          <FieldRow label="Timezone">
            <select
              value={data.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className={INPUT_CLASS}
            >
              {TIMEZONES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Bio / About">
            <textarea
              rows={3}
              value={data.bio}
              onChange={(e) => update("bio", e.target.value)}
              className={cn(INPUT_CLASS, "resize-none")}
            />
          </FieldRow>
          <div className="flex justify-end pt-2 border-t border-border/50">
            <StatefulSaveButton saving={saving} saved={saved} onSave={handleSave} />
          </div>
        </CardContent>
      </Card>

      {/* Financial Config */}
      <div className="pt-4">
        <h2 className="text-base font-semibold text-foreground">Financial</h2>
        <p className="text-xs text-muted mt-0.5">
          Revenue goals and tax settings used across analytics and financial dashboards
        </p>
      </div>
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <FieldRow label="Monthly Revenue Goal ($)">
            <input
              type="number"
              min={0}
              step={500}
              value={financial.revenueGoalMonthly}
              onChange={(e) =>
                setFinancial((prev) => ({ ...prev, revenueGoalMonthly: Number(e.target.value) }))
              }
              className={INPUT_CLASS}
            />
          </FieldRow>
          <FieldRow label="Estimated Tax Rate (%)">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={financial.estimatedTaxRate}
              onChange={(e) =>
                setFinancial((prev) => ({ ...prev, estimatedTaxRate: Number(e.target.value) }))
              }
              className={INPUT_CLASS}
            />
          </FieldRow>
          <div className="flex justify-end pt-2 border-t border-border/50">
            <StatefulSaveButton
              saving={savingFinancial}
              saved={savedFinancial}
              onSave={handleSaveFinancial}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
