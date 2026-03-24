"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import type { BusinessProfile, FinancialConfig, RevenueGoal } from "@/lib/types/settings.types";
import { cn } from "@/lib/utils";
import { saveBusinessProfile, saveFinancialConfig, saveRevenueGoals } from "../settings-actions";
import { FieldRow, AutoSaveStatus, INPUT_CLASS } from "./shared";

function formatMonth(ym: string) {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

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
  initialRevenueGoals,
}: {
  initial: BusinessProfile;
  initialFinancial: FinancialConfig;
  initialRevenueGoals: RevenueGoal[];
}) {
  const [data, setData] = useState(initial);
  const [financial, setFinancial] = useState(initialFinancial);
  const [goals, setGoals] = useState<RevenueGoal[]>(
    [...initialRevenueGoals].sort((a, b) => a.month.localeCompare(b.month)),
  );
  const [newMonth, setNewMonth] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const profileAuto = useAutoSave({ data, onSave: saveBusinessProfile });
  const financialAuto = useAutoSave({ data: financial, onSave: saveFinancialConfig });
  const goalsAuto = useAutoSave({ data: goals, onSave: saveRevenueGoals });

  function update<K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function addGoal() {
    if (!newMonth || !newAmount) return;
    const amount = Number(newAmount);
    if (isNaN(amount) || amount < 0) return;
    setGoals((prev) => {
      const filtered = prev.filter((g) => g.month !== newMonth);
      return [...filtered, { id: crypto.randomUUID(), month: newMonth, amount }].sort((a, b) =>
        a.month.localeCompare(b.month),
      );
    });
    setNewMonth("");
    setNewAmount("");
  }

  function removeGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  const fields: { label: string; key: keyof BusinessProfile }[] = [
    { label: "Business Name", key: "businessName" },
    { label: "Owner", key: "owner" },
    { label: "Email", key: "email" },
    { label: "Phone", key: "phone" },
    { label: "Location", key: "location" },
    { label: "Currency", key: "currency" },
    { label: "Booking Link", key: "bookingLink" },
    { label: "Email Sender Name", key: "emailSenderName" },
    { label: "Email From Address", key: "emailFromAddress" },
  ];

  return (
    <div className="space-y-5">
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
            <AutoSaveStatus
              status={profileAuto.status}
              error={profileAuto.error}
              onDismissError={profileAuto.dismissError}
            />
          </div>
        </CardContent>
      </Card>

      {/* Revenue Goals */}
      <div className="pt-4">
        <h2 className="text-base font-semibold text-foreground">Revenue Goals</h2>
        <p className="text-xs text-muted mt-0.5">
          Monthly targets that drive the goal ring on the analytics dashboard
        </p>
      </div>
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-3">
          {goals.length > 0 && (
            <div className="divide-y divide-border/50">
              {goals.map((goal) => (
                <div key={goal.id} className="flex items-center justify-between py-2.5 gap-4">
                  <span className="text-sm text-foreground">{formatMonth(goal.month)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-foreground">
                      ${goal.amount.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeGoal(goal.id)}
                      className="text-muted hover:text-destructive transition-colors"
                      aria-label={`Remove ${formatMonth(goal.month)} goal`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <input
              type="month"
              value={newMonth}
              onChange={(e) => setNewMonth(e.target.value)}
              className={cn(INPUT_CLASS, "w-full sm:w-auto")}
            />
            <input
              type="number"
              min={0}
              step={500}
              placeholder="Amount"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGoal()}
              className={cn(INPUT_CLASS, "w-full sm:w-32")}
            />
            <button
              type="button"
              onClick={addGoal}
              disabled={!newMonth || !newAmount}
              className="px-3 py-2 sm:py-1.5 text-sm font-medium rounded-lg bg-foreground/8 hover:bg-foreground/12 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>

          <div className="flex justify-end pt-2 border-t border-border/50">
            <AutoSaveStatus
              status={goalsAuto.status}
              error={goalsAuto.error}
              onDismissError={goalsAuto.dismissError}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tax Settings */}
      <div className="pt-4">
        <h2 className="text-base font-semibold text-foreground">Tax</h2>
        <p className="text-xs text-muted mt-0.5">
          Used for estimated tax calculations across financial dashboards
        </p>
      </div>
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
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
            <AutoSaveStatus
              status={financialAuto.status}
              error={financialAuto.error}
              onDismissError={financialAuto.dismissError}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
