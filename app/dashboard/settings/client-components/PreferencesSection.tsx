"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { saveClientPreferences } from "../client-settings-actions";
import type { ClientPreferences } from "../client-settings-actions";
import { FieldRow, StatefulSaveButton, INPUT_CLASS } from "../components/shared";

const LASH_STYLE_OPTIONS = ["", "classic", "hybrid", "volume", "mega volume", "wispy"] as const;
const CURL_OPTIONS = ["", "B", "C", "CC", "D", "DD", "L", "L+", "M"] as const;
const DIAMETER_OPTIONS = [
  "",
  "0.03mm",
  "0.05mm",
  "0.07mm",
  "0.10mm",
  "0.12mm",
  "0.15mm",
  "0.18mm",
  "0.20mm",
] as const;
const CONTACT_OPTIONS = ["", "text", "email", "instagram DM", "phone call"] as const;
const REBOOK_CADENCE_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "7", label: "Every week" },
  { value: "14", label: "Every 2 weeks" },
  { value: "21", label: "Every 3 weeks" },
  { value: "30", label: "Every month" },
  { value: "42", label: "Every 6 weeks" },
  { value: "56", label: "Every 8 weeks" },
] as const;

const SELECT_CLASS =
  "w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition";

type FormState = {
  preferredLashStyle: string;
  preferredCurlType: string;
  preferredLengths: string;
  preferredDiameter: string;
  naturalLashNotes: string;
  retentionProfile: string;
  allergies: string;
  skinType: string;
  adhesiveSensitivity: boolean;
  healthNotes: string;
  birthday: string;
  preferredContactMethod: string;
  preferredServiceTypes: string;
  generalNotes: string;
  preferredRebookIntervalDays: string;
};

function toForm(prefs: ClientPreferences | null): FormState {
  return {
    preferredLashStyle: prefs?.preferredLashStyle ?? "",
    preferredCurlType: prefs?.preferredCurlType ?? "",
    preferredLengths: prefs?.preferredLengths ?? "",
    preferredDiameter: prefs?.preferredDiameter ?? "",
    naturalLashNotes: prefs?.naturalLashNotes ?? "",
    retentionProfile: prefs?.retentionProfile ?? "",
    allergies: prefs?.allergies ?? "",
    skinType: prefs?.skinType ?? "",
    adhesiveSensitivity: prefs?.adhesiveSensitivity ?? false,
    healthNotes: prefs?.healthNotes ?? "",
    birthday: prefs?.birthday ?? "",
    preferredContactMethod: prefs?.preferredContactMethod ?? "",
    preferredServiceTypes: prefs?.preferredServiceTypes ?? "",
    generalNotes: prefs?.generalNotes ?? "",
    preferredRebookIntervalDays: prefs?.preferredRebookIntervalDays?.toString() ?? "",
  };
}

export function PreferencesSection({ initial }: { initial: ClientPreferences | null }) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    startTransition(async () => {
      await saveClientPreferences({
        preferredLashStyle: form.preferredLashStyle || null,
        preferredCurlType: form.preferredCurlType || null,
        preferredLengths: form.preferredLengths || null,
        preferredDiameter: form.preferredDiameter || null,
        naturalLashNotes: form.naturalLashNotes || null,
        retentionProfile: form.retentionProfile || null,
        allergies: form.allergies || null,
        skinType: form.skinType || null,
        adhesiveSensitivity: form.adhesiveSensitivity,
        healthNotes: form.healthNotes || null,
        birthday: form.birthday || null,
        preferredContactMethod: form.preferredContactMethod || null,
        preferredServiceTypes: form.preferredServiceTypes || null,
        generalNotes: form.generalNotes || null,
        preferredRebookIntervalDays: form.preferredRebookIntervalDays
          ? Number(form.preferredRebookIntervalDays)
          : null,
      });
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Beauty Preferences</h2>
        <p className="text-xs text-muted mt-0.5">
          Saved with your profile so your tech always knows your go-to look
        </p>
      </div>

      {/* Lash Preferences */}
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Lash Preferences
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Preferred Style">
                <select
                  value={form.preferredLashStyle}
                  onChange={(e) => set("preferredLashStyle", e.target.value)}
                  className={SELECT_CLASS}
                >
                  {LASH_STYLE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s ? s.charAt(0).toUpperCase() + s.slice(1) : "Select…"}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="Preferred Curl">
                <select
                  value={form.preferredCurlType}
                  onChange={(e) => set("preferredCurlType", e.target.value)}
                  className={SELECT_CLASS}
                >
                  {CURL_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c || "Select…"}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Preferred Diameter">
                <select
                  value={form.preferredDiameter}
                  onChange={(e) => set("preferredDiameter", e.target.value)}
                  className={SELECT_CLASS}
                >
                  {DIAMETER_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d || "Select…"}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="Preferred Lengths">
                <input
                  type="text"
                  placeholder="e.g. 10–13mm"
                  value={form.preferredLengths}
                  onChange={(e) => set("preferredLengths", e.target.value)}
                  className={INPUT_CLASS}
                />
              </FieldRow>
            </div>

            <FieldRow label="Natural Lash Notes">
              <textarea
                rows={2}
                placeholder="e.g. thin on outer corners, sparse inner, strong overall"
                value={form.naturalLashNotes}
                onChange={(e) => set("naturalLashNotes", e.target.value)}
                className={INPUT_CLASS + " resize-none"}
              />
            </FieldRow>

            <FieldRow label="Retention Profile">
              <textarea
                rows={2}
                placeholder="e.g. good retention — 3 weeks, loses outer corners faster"
                value={form.retentionProfile}
                onChange={(e) => set("retentionProfile", e.target.value)}
                className={INPUT_CLASS + " resize-none"}
              />
            </FieldRow>
          </div>
        </CardContent>
      </Card>

      {/* Health & Sensitivities */}
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Health & Sensitivities
          </h3>

          <div className="space-y-4">
            <FieldRow label="Allergies">
              <textarea
                rows={2}
                placeholder="None known, or list any allergies…"
                value={form.allergies}
                onChange={(e) => set("allergies", e.target.value)}
                className={INPUT_CLASS + " resize-none"}
              />
            </FieldRow>

            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Skin Type">
                <input
                  type="text"
                  placeholder="e.g. sensitive, oily lids"
                  value={form.skinType}
                  onChange={(e) => set("skinType", e.target.value)}
                  className={INPUT_CLASS}
                />
              </FieldRow>
              <FieldRow label="Adhesive Sensitivity">
                <label className="flex items-center gap-2 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.adhesiveSensitivity}
                    onChange={(e) => set("adhesiveSensitivity", e.target.checked)}
                    className="rounded border-border accent-accent"
                  />
                  <span className="text-sm text-foreground">Has had a reaction</span>
                </label>
              </FieldRow>
            </div>

            <FieldRow label="Health Notes">
              <textarea
                rows={2}
                placeholder="Contact lenses, watery eyes, medications, etc."
                value={form.healthNotes}
                onChange={(e) => set("healthNotes", e.target.value)}
                className={INPUT_CLASS + " resize-none"}
              />
            </FieldRow>
          </div>
        </CardContent>
      </Card>

      {/* General Preferences */}
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            General Preferences
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Birthday">
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => set("birthday", e.target.value)}
                  className={INPUT_CLASS}
                />
              </FieldRow>
              <FieldRow label="Preferred Contact">
                <select
                  value={form.preferredContactMethod}
                  onChange={(e) => set("preferredContactMethod", e.target.value)}
                  className={SELECT_CLASS}
                >
                  {CONTACT_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m ? m.charAt(0).toUpperCase() + m.slice(1) : "Select…"}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>

            <FieldRow label="Rebook Cadence">
              <select
                value={form.preferredRebookIntervalDays}
                onChange={(e) => set("preferredRebookIntervalDays", e.target.value)}
                className={SELECT_CLASS}
              >
                {REBOOK_CADENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow label="Service Types">
              <input
                type="text"
                placeholder="e.g. lash, jewelry"
                value={form.preferredServiceTypes}
                onChange={(e) => set("preferredServiceTypes", e.target.value)}
                className={INPUT_CLASS}
              />
            </FieldRow>

            <FieldRow label="General Notes">
              <textarea
                rows={2}
                placeholder="e.g. prefers quiet appointments, likes warm towels"
                value={form.generalNotes}
                onChange={(e) => set("generalNotes", e.target.value)}
                className={INPUT_CLASS + " resize-none"}
              />
            </FieldRow>
          </div>

          <div className="border-t border-border/50 pt-4 flex justify-end">
            <StatefulSaveButton saving={isPending} saved={saved} onSave={handleSave} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
