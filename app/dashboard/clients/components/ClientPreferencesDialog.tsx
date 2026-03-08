"use client";

import { useState } from "react";
import { Dialog, DialogFooter, Field, Input, Textarea, Select } from "@/components/ui/dialog";
import { getClientPreferences, upsertClientPreferences } from "../actions";
import type { ClientPreferencesInput } from "../actions";

type PreferencesFormState = {
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
};

const EMPTY: PreferencesFormState = {
  preferredLashStyle: "",
  preferredCurlType: "",
  preferredLengths: "",
  preferredDiameter: "",
  naturalLashNotes: "",
  retentionProfile: "",
  allergies: "",
  skinType: "",
  adhesiveSensitivity: false,
  healthNotes: "",
  birthday: "",
  preferredContactMethod: "",
  preferredServiceTypes: "",
  generalNotes: "",
};

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
const LASH_STYLE_OPTIONS = ["", "classic", "hybrid", "volume", "mega volume", "wispy"] as const;
const CONTACT_OPTIONS = ["", "text", "email", "instagram DM", "phone call"] as const;

export function ClientPreferencesDialog({
  open,
  onClose,
  clientId,
  clientName,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}) {
  const [form, setForm] = useState<PreferencesFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedClientId, setLoadedClientId] = useState<string | null>(null);

  // Detect when a new client is opened and trigger fetch
  if (open && loadedClientId !== clientId) {
    setLoadedClientId(clientId);
    setLoading(true);
    setForm(EMPTY);
    getClientPreferences(clientId).then((record) => {
      if (record) {
        setForm({
          preferredLashStyle: record.preferredLashStyle ?? "",
          preferredCurlType: record.preferredCurlType ?? "",
          preferredLengths: record.preferredLengths ?? "",
          preferredDiameter: record.preferredDiameter ?? "",
          naturalLashNotes: record.naturalLashNotes ?? "",
          retentionProfile: record.retentionProfile ?? "",
          allergies: record.allergies ?? "",
          skinType: record.skinType ?? "",
          adhesiveSensitivity: record.adhesiveSensitivity,
          healthNotes: record.healthNotes ?? "",
          birthday: record.birthday ?? "",
          preferredContactMethod: record.preferredContactMethod ?? "",
          preferredServiceTypes: record.preferredServiceTypes ?? "",
          generalNotes: record.generalNotes ?? "",
        });
      }
      setLoading(false);
    });
  }

  // Reset tracked clientId when dialog closes
  if (!open && loadedClientId !== null) {
    setLoadedClientId(null);
  }

  function set<K extends keyof PreferencesFormState>(key: K, val: PreferencesFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    const input: ClientPreferencesInput = {
      profileId: clientId,
      preferredLashStyle: form.preferredLashStyle || undefined,
      preferredCurlType: form.preferredCurlType || undefined,
      preferredLengths: form.preferredLengths || undefined,
      preferredDiameter: form.preferredDiameter || undefined,
      naturalLashNotes: form.naturalLashNotes || undefined,
      retentionProfile: form.retentionProfile || undefined,
      allergies: form.allergies || undefined,
      skinType: form.skinType || undefined,
      adhesiveSensitivity: form.adhesiveSensitivity,
      healthNotes: form.healthNotes || undefined,
      birthday: form.birthday || undefined,
      preferredContactMethod: form.preferredContactMethod || undefined,
      preferredServiceTypes: form.preferredServiceTypes || undefined,
      generalNotes: form.generalNotes || undefined,
    };
    await upsertClientPreferences(input);
    setSaving(false);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Client Preferences"
      description={`Service preferences for ${clientName}`}
      size="lg"
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-muted">Loading…</div>
      ) : (
        <div className="space-y-5">
          {/* Lash Preferences */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
              Lash Preferences
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preferred Style">
                  <Select
                    value={form.preferredLashStyle}
                    onChange={(e) => set("preferredLashStyle", e.target.value)}
                  >
                    {LASH_STYLE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s ? s.charAt(0).toUpperCase() + s.slice(1) : "Select…"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Preferred Curl">
                  <Select
                    value={form.preferredCurlType}
                    onChange={(e) => set("preferredCurlType", e.target.value)}
                  >
                    {CURL_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c || "Select…"}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preferred Diameter">
                  <Select
                    value={form.preferredDiameter}
                    onChange={(e) => set("preferredDiameter", e.target.value)}
                  >
                    {DIAMETER_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d || "Select…"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Preferred Lengths" hint="e.g. 10-13mm">
                  <Input
                    placeholder="10-13mm"
                    value={form.preferredLengths}
                    onChange={(e) => set("preferredLengths", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Natural Lash Notes" hint="Condition, density, any weak areas">
                <Textarea
                  rows={2}
                  placeholder="e.g. thin on outer corners, sparse inner, strong overall"
                  value={form.naturalLashNotes}
                  onChange={(e) => set("naturalLashNotes", e.target.value)}
                />
              </Field>
              <Field label="Retention Profile" hint="How well lashes typically hold between fills">
                <Textarea
                  rows={2}
                  placeholder="e.g. good retention — 3 weeks, loses outer corners faster"
                  value={form.retentionProfile}
                  onChange={(e) => set("retentionProfile", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Health & Sensitivities */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
              Health & Sensitivities
            </h3>
            <div className="space-y-3">
              <Field label="Allergies" hint="Adhesive, latex, metals, fragrances, etc.">
                <Textarea
                  rows={2}
                  placeholder="None known, or list any allergies…"
                  value={form.allergies}
                  onChange={(e) => set("allergies", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Skin Type" hint="e.g. sensitive, oily lids">
                  <Input
                    placeholder="Normal"
                    value={form.skinType}
                    onChange={(e) => set("skinType", e.target.value)}
                  />
                </Field>
                <Field label="Adhesive Sensitivity">
                  <label className="flex items-center gap-2 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.adhesiveSensitivity}
                      onChange={(e) => set("adhesiveSensitivity", e.target.checked)}
                      className="rounded border-border accent-accent"
                    />
                    <span className="text-sm text-foreground">Has had a reaction</span>
                  </label>
                </Field>
              </div>
              <Field label="Health Notes" hint="Contact lenses, watery eyes, medications, etc.">
                <Textarea
                  rows={2}
                  placeholder="Any health-related notes for service…"
                  value={form.healthNotes}
                  onChange={(e) => set("healthNotes", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* General Preferences */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
              General Preferences
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Birthday" hint="For birthday promos">
                  <Input
                    type="date"
                    value={form.birthday}
                    onChange={(e) => set("birthday", e.target.value)}
                  />
                </Field>
                <Field label="Preferred Contact">
                  <Select
                    value={form.preferredContactMethod}
                    onChange={(e) => set("preferredContactMethod", e.target.value)}
                  >
                    {CONTACT_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m ? m.charAt(0).toUpperCase() + m.slice(1) : "Select…"}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Preferred Service Types" hint="e.g. lash, jewelry">
                <Input
                  placeholder="lash, jewelry"
                  value={form.preferredServiceTypes}
                  onChange={(e) => set("preferredServiceTypes", e.target.value)}
                />
              </Field>
              <Field label="General Notes" hint="Appointment preferences, music, ambiance, etc.">
                <Textarea
                  rows={2}
                  placeholder="e.g. prefers quiet appointments, likes warm towels"
                  value={form.generalNotes}
                  onChange={(e) => set("generalNotes", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>
      )}
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "Saving…" : "Save Preferences"}
        disabled={loading || saving}
      />
    </Dialog>
  );
}
