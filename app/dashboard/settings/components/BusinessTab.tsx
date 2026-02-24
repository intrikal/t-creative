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
import type { BusinessProfile } from "../settings-actions";
import { saveBusinessProfile } from "../settings-actions";
import { FieldRow, StatefulSaveButton, INPUT_CLASS } from "./shared";

export function BusinessTab({ initial }: { initial: BusinessProfile }) {
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const fields: { label: string; key: keyof BusinessProfile }[] = [
    { label: "Business Name", key: "businessName" },
    { label: "Owner", key: "owner" },
    { label: "Email", key: "email" },
    { label: "Phone", key: "phone" },
    { label: "Location", key: "location" },
    { label: "Timezone", key: "timezone" },
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
    </div>
  );
}
