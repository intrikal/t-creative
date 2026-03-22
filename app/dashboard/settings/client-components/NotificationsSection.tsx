"use client";

/**
 * NotificationsSection.tsx — Granular notification preferences.
 *
 * Renders a matrix of checkboxes: rows = notification types,
 * columns = channels (email, SMS, push). Clients can control
 * exactly which notifications they receive on which channel.
 */

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { saveNotificationPreferences } from "../client-settings-actions";
import { StatefulSaveButton } from "../components/shared";

const CHANNELS = ["email", "sms", "push"] as const;
type Channel = (typeof CHANNELS)[number];

const TYPES = [
  "booking_reminder",
  "review_request",
  "fill_reminder",
  "birthday_promo",
  "marketing",
] as const;
type NotifType = (typeof TYPES)[number];

const TYPE_LABELS: Record<NotifType, { label: string; hint: string }> = {
  booking_reminder: {
    label: "Booking reminders",
    hint: "24h and 48h reminders before your appointments",
  },
  review_request: {
    label: "Review requests",
    hint: "Follow-up after appointments asking for feedback",
  },
  fill_reminder: {
    label: "Fill reminders",
    hint: "Reminder when your lash fill is due",
  },
  birthday_promo: {
    label: "Birthday offers",
    hint: "Special discount on your birthday",
  },
  marketing: {
    label: "Promotions & news",
    hint: "New services, seasonal deals, and studio updates",
  },
};

const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
};

export type NotificationPrefsMap = Record<string, boolean>;

export function NotificationsSection({ initial }: { initial: NotificationPrefsMap }) {
  const [prefs, setPrefs] = useState<NotificationPrefsMap>(initial);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(channel: Channel, type: NotifType) {
    const key = `${channel}:${type}`;
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isEnabled(channel: Channel, type: NotifType): boolean {
    return prefs[`${channel}:${type}`] ?? true;
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    startTransition(async () => {
      await saveNotificationPreferences(prefs);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Notifications</h2>
        <p className="text-xs text-muted mt-0.5">
          Choose which notifications you receive and how
        </p>
      </div>

      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 mb-3 px-1">
            <div />
            {CHANNELS.map((ch) => (
              <div key={ch} className="text-center text-xs font-medium text-muted">
                {CHANNEL_LABELS[ch]}
              </div>
            ))}
          </div>

          {/* Preference rows */}
          <div className="space-y-1">
            {TYPES.map((type) => (
              <div
                key={type}
                className="grid grid-cols-[1fr_60px_60px_60px] gap-2 items-center py-2.5 px-1 rounded-lg hover:bg-muted/5 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {TYPE_LABELS[type].label}
                  </div>
                  <div className="text-xs text-muted mt-0.5 hidden sm:block">
                    {TYPE_LABELS[type].hint}
                  </div>
                </div>
                {CHANNELS.map((ch) => (
                  <div key={ch} className="flex justify-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isEnabled(ch, type)}
                      onClick={() => toggle(ch, type)}
                      className={`w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${
                        isEnabled(ch, type)
                          ? "bg-accent border-accent text-white"
                          : "bg-transparent border-border/60 text-transparent"
                      }`}
                    >
                      {isEnabled(ch, type) && (
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="border-t border-border/50 pt-4 mt-3 flex justify-end">
            <StatefulSaveButton saving={isPending} saved={saved} onSave={handleSave} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
