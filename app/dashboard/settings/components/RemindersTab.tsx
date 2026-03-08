/**
 * Automated Reminders tab — configure the client communication sequence.
 *
 * DB-wired via the `reminder_config` key in the `settings` table.
 * Each reminder has Email, SMS, and Active toggles. SMS is powered by Square.
 *
 * @module settings/components/RemindersTab
 */
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RemindersConfig } from "../settings-actions";
import { saveReminders } from "../settings-actions";
import { Toggle, StatefulSaveButton } from "./shared";

export function RemindersTab({ initial }: { initial: RemindersConfig }) {
  const [reminders, setReminders] = useState(initial.items);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleField(id: number, field: "email" | "sms" | "active") {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: !r[field] } : r)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveReminders({ items: reminders });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Automated Reminders</h2>
        <p className="text-xs text-muted mt-0.5">
          Configure your client communication sequence. SMS is powered by Square.
        </p>
      </div>
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5">
          <div className="grid grid-cols-[1fr_60px_60px_56px] gap-x-4 mb-3 pb-2 border-b border-border/60 items-center">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Step
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              Email
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              SMS
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              On
            </span>
          </div>
          <div className="space-y-1">
            {reminders.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-[1fr_60px_60px_56px] gap-x-4 items-center py-3 px-2 rounded-xl transition-colors",
                  r.active ? "hover:bg-surface/60" : "opacity-50",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted mt-0.5">{r.timing}</p>
                </div>
                <div className="flex justify-center">
                  <Toggle on={r.email} onChange={() => toggleField(r.id, "email")} />
                </div>
                <div className="flex justify-center">
                  <Toggle on={r.sms} onChange={() => toggleField(r.id, "sms")} />
                </div>
                <div className="flex justify-center">
                  <Toggle on={r.active} onChange={() => toggleField(r.id, "active")} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <StatefulSaveButton
          label="Save Reminders"
          saving={saving}
          saved={saved}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
