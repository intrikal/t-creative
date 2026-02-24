"use client";

/**
 * NotificationsSection.tsx — Notification preferences tab for the client settings page.
 *
 * Renders a toggle per notification category. Controlled locally via `useState`
 * seeded from `INITIAL_NOTIFS`. Phase 2 will persist changes to the `profiles`
 * table's notification preference columns via a server action.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { INITIAL_NOTIFS, type NotifPref } from "../types";
import { Toggle } from "./Toggle";

/**
 * NotificationsSection — list of notification toggles, one per category.
 * Each toggle flips state locally; no network call yet (Phase 2).
 */
export function NotificationsSection() {
  const [notifs, setNotifs] = useState<NotifPref[]>(INITIAL_NOTIFS);

  function toggleNotif(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n)));
  }

  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-5 space-y-1">
        <p className="text-sm font-semibold text-foreground mb-3">Notification Preferences</p>
        {notifs.map((notif) => (
          <div
            key={notif.id}
            className="flex items-center justify-between gap-4 py-3 border-b border-border/40 last:border-0"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{notif.label}</p>
              <p className="text-xs text-muted mt-0.5">{notif.description}</p>
            </div>
            <Toggle enabled={notif.enabled} onChange={() => toggleNotif(notif.id)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
