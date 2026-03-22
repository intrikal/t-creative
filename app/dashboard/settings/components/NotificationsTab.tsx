/**
 * Notification Preferences tab — Email/SMS toggles for each alert type.
 *
 * DB-wired via the `notification_prefs` key in the `settings` table.
 * Stores an array of `{ label, email, sms }` items as a JSON blob.
 *
 * Default notification types (7): New booking, Cancellation, Payment received,
 * Low inventory, New inquiry, Review posted, Staff schedule change.
 *
 * Saves via `saveNotificationPrefs()` which upserts the full preferences array.
 *
 * @module settings/components/NotificationsTab
 * @see {@link ../settings-actions.ts} — `NotificationPrefs` type + save action
 */
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { NotificationPrefs } from "@/lib/types/settings.types";
import { saveNotificationPrefs } from "../settings-actions";
import { Toggle, StatefulSaveButton } from "./shared";

export function NotificationsTab({ initial }: { initial: NotificationPrefs }) {
  /** Local copy of notification preference items for optimistic editing. */
  const [prefs, setPrefs] = useState(initial.items);
  /** Whether the save action is in flight. */
  const [saving, setSaving] = useState(false);
  /** Briefly true after a successful save to show "Saved!" feedback. */
  const [saved, setSaved] = useState(false);
  /** Error message from save, if any. */
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * toggle — flips a single email/sms boolean for a preference row.
   * Uses .map() to produce a new array with only the targeted item changed,
   * using a computed property key ([channel]) so one function handles both channels.
   */
  function toggle(idx: number, channel: "email" | "sms") {
    setPrefs((prev) => prev.map((p, i) => (i === idx ? { ...p, [channel]: !p[channel] } : p)));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const result = await saveNotificationPrefs({ items: prefs });
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
        <h2 className="text-base font-semibold text-foreground">Notification Preferences</h2>
        <p className="text-xs text-muted mt-0.5">Choose how and when you get notified</p>
      </div>

      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5">
          <div className="grid grid-cols-[1fr_80px_80px] gap-x-4 mb-3 pb-2 border-b border-border/60">
            <span />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              Email
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              SMS
            </span>
          </div>
          <div className="space-y-1">
            {prefs.map((pref, idx) => (
              <div
                key={pref.label}
                className="grid grid-cols-[1fr_80px_80px] gap-x-4 items-center py-2.5 px-2 rounded-xl hover:bg-surface/60 transition-colors"
              >
                <span className="text-sm text-foreground">{pref.label}</span>
                <div className="flex justify-center">
                  <Toggle on={pref.email} onChange={() => toggle(idx, "email")} />
                </div>
                <div className="flex justify-center">
                  <Toggle on={pref.sms} onChange={() => toggle(idx, "sms")} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t border-border/50 mt-2">
            <StatefulSaveButton
              label="Save Preferences"
              saving={saving}
              saved={saved}
              onSave={handleSave}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
