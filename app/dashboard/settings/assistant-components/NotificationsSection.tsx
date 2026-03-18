/**
 * NotificationsSection.tsx
 *
 * Notification preference toggles with save button for assistant settings.
 */

import type { NotificationPrefs } from "@/app/dashboard/settings/assistant-settings-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface NotificationsSectionProps {
  notifications: NotificationPrefs;
  onChange: (updated: NotificationPrefs) => void;
  onSave: () => void;
  isPending: boolean;
  saved: boolean;
}

const NOTIFICATION_ITEMS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: "newBooking", label: "New booking added to my schedule" },
  { key: "bookingReminder", label: "Appointment reminders (1 hour before)" },
  { key: "cancellation", label: "Booking cancellations or changes" },
  { key: "messageFromTrini", label: "New messages from Trini" },
  { key: "trainingDue", label: "Training module due soon" },
  { key: "payoutProcessed", label: "Payout processed" },
  { key: "weeklyDigest", label: "Weekly earnings digest" },
];

export function NotificationsSection({
  notifications,
  onChange,
  onSave,
  isPending,
  saved,
}: NotificationsSectionProps) {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <CardTitle className="text-sm font-semibold">Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4 space-y-1">
        {NOTIFICATION_ITEMS.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between py-3 border-b border-border/40 last:border-0"
          >
            <span className="text-sm text-foreground">{item.label}</span>
            <button
              onClick={() => onChange({ ...notifications, [item.key]: !notifications[item.key] })}
              className={cn(
                "w-8 rounded-full transition-colors relative shrink-0",
                notifications[item.key] ? "bg-accent" : "bg-foreground/15",
              )}
              style={{ height: "18px", width: "32px" }}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform",
                  notifications[item.key] ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        ))}
        <div className="flex justify-end pt-3">
          <button
            onClick={onSave}
            disabled={isPending}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {saved ? "Saved!" : "Save preferences"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
