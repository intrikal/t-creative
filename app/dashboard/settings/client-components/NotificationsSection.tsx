"use client";

/**
 * NotificationsSection.tsx — Notification preferences tab for the client settings page.
 *
 * Renders toggles for SMS, Email, and Marketing notifications.
 * Wired to the `profiles` table columns via `saveClientNotifications()`.
 */

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { saveClientNotifications } from "../client-settings-actions";
import type { ClientNotifications } from "../client-settings-actions";
import { ToggleRow, StatefulSaveButton } from "../components/shared";

const NOTIF_ITEMS: { key: keyof ClientNotifications; label: string; hint: string }[] = [
  {
    key: "notifyEmail",
    label: "Email Notifications",
    hint: "Booking confirmations, reminders, and receipts",
  },
  {
    key: "notifySms",
    label: "SMS Notifications",
    hint: "Text message reminders before your appointments",
  },
  {
    key: "notifyMarketing",
    label: "Marketing & Promotions",
    hint: "Special offers, new services, and seasonal deals",
  },
];

export function NotificationsSection({ initial }: { initial: ClientNotifications }) {
  const [prefs, setPrefs] = useState<ClientNotifications>(initial);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(key: keyof ClientNotifications) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    startTransition(async () => {
      await saveClientNotifications(prefs);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Notifications</h2>
        <p className="text-xs text-muted mt-0.5">Choose how you want to be contacted</p>
      </div>

      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-1">
          {NOTIF_ITEMS.map((item) => (
            <ToggleRow
              key={item.key}
              label={item.label}
              hint={item.hint}
              on={prefs[item.key]}
              onChange={() => toggle(item.key)}
            />
          ))}

          <div className="border-t border-border/50 pt-4 flex justify-end">
            <StatefulSaveButton saving={isPending} saved={saved} onSave={handleSave} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
