"use client";

import { useState } from "react";
import { Dialog, DialogFooter, Field, Input, Textarea, Select } from "@/components/ui/dialog";
import { getServiceRecord, upsertServiceRecord } from "../actions";
import type { ServiceRecordInput } from "../actions";

export type ServiceRecordFormState = {
  lashMapping: string;
  curlType: string;
  diameter: string;
  lengths: string;
  adhesive: string;
  retentionNotes: string;
  productsUsed: string;
  notes: string;
  reactions: string;
  nextVisitNotes: string;
};

const EMPTY: ServiceRecordFormState = {
  lashMapping: "",
  curlType: "",
  diameter: "",
  lengths: "",
  adhesive: "",
  retentionNotes: "",
  productsUsed: "",
  notes: "",
  reactions: "",
  nextVisitNotes: "",
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

export function ServiceRecordDialog({
  open,
  onClose,
  bookingId,
  clientId,
  serviceName,
  serviceCategory,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  clientId: string;
  serviceName: string;
  serviceCategory: string;
}) {
  const [form, setForm] = useState<ServiceRecordFormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedBookingId, setLoadedBookingId] = useState<number | null>(null);
  const isLash = serviceCategory === "lash";

  // Detect when a new booking is opened and trigger fetch
  if (open && loadedBookingId !== bookingId) {
    setLoadedBookingId(bookingId);
    setLoading(true);
    setForm(EMPTY);
    getServiceRecord(bookingId).then((record) => {
      if (record) {
        setForm({
          lashMapping: record.lashMapping ?? "",
          curlType: record.curlType ?? "",
          diameter: record.diameter ?? "",
          lengths: record.lengths ?? "",
          adhesive: record.adhesive ?? "",
          retentionNotes: record.retentionNotes ?? "",
          productsUsed: record.productsUsed ?? "",
          notes: record.notes ?? "",
          reactions: record.reactions ?? "",
          nextVisitNotes: record.nextVisitNotes ?? "",
        });
      }
      setLoading(false);
    });
  }

  // Reset tracked bookingId when dialog closes
  if (!open && loadedBookingId !== null) {
    setLoadedBookingId(null);
  }

  function set<K extends keyof ServiceRecordFormState>(key: K, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    const input: ServiceRecordInput = {
      bookingId,
      clientId,
      lashMapping: form.lashMapping || undefined,
      curlType: form.curlType || undefined,
      diameter: form.diameter || undefined,
      lengths: form.lengths || undefined,
      adhesive: form.adhesive || undefined,
      retentionNotes: form.retentionNotes || undefined,
      productsUsed: form.productsUsed || undefined,
      notes: form.notes || undefined,
      reactions: form.reactions || undefined,
      nextVisitNotes: form.nextVisitNotes || undefined,
    };
    await upsertServiceRecord(input);
    setSaving(false);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Service Notes"
      description={`Post-service documentation for ${serviceName}`}
      size="lg"
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-muted">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* Lash-specific fields */}
          {isLash && (
            <>
              <Field label="Lash Mapping" hint="e.g. cat-eye, doll, natural, wispy">
                <Textarea
                  rows={2}
                  placeholder="Describe the lash map used…"
                  value={form.lashMapping}
                  onChange={(e) => set("lashMapping", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Curl Type">
                  <Select value={form.curlType} onChange={(e) => set("curlType", e.target.value)}>
                    {CURL_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c || "Select…"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Diameter">
                  <Select value={form.diameter} onChange={(e) => set("diameter", e.target.value)}>
                    {DIAMETER_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d || "Select…"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Lengths" hint="e.g. 9-12mm mixed">
                  <Input
                    placeholder="9-12mm"
                    value={form.lengths}
                    onChange={(e) => set("lengths", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Adhesive" hint="Brand/type and drying conditions">
                <Input
                  placeholder="e.g. Stacy Lash, 1-2 sec dry, 55% humidity"
                  value={form.adhesive}
                  onChange={(e) => set("adhesive", e.target.value)}
                />
              </Field>
              <Field label="Retention Notes" hint="How well the previous set held up">
                <Textarea
                  rows={2}
                  placeholder="e.g. Good retention — 3 weeks, lost a few on outer corners"
                  value={form.retentionNotes}
                  onChange={(e) => set("retentionNotes", e.target.value)}
                />
              </Field>
            </>
          )}

          {/* General fields (all service types) */}
          <Field label="Products Used">
            <Textarea
              rows={2}
              placeholder="List products, materials, or supplies used…"
              value={form.productsUsed}
              onChange={(e) => set("productsUsed", e.target.value)}
            />
          </Field>
          <Field label="General Notes">
            <Textarea
              rows={3}
              placeholder="Any observations, adjustments, or notes about the session…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
          <Field
            label="Reactions / Sensitivities"
            hint="Any redness, irritation, or allergic reactions observed"
          >
            <Textarea
              rows={2}
              placeholder="None observed, or describe any reactions…"
              value={form.reactions}
              onChange={(e) => set("reactions", e.target.value)}
            />
          </Field>
          <Field label="Notes for Next Visit" hint="Reminders for the next appointment">
            <Textarea
              rows={2}
              placeholder="e.g. adjust mapping on outer corners, try different curl on right eye"
              value={form.nextVisitNotes}
              onChange={(e) => set("nextVisitNotes", e.target.value)}
            />
          </Field>
        </div>
      )}
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "Saving…" : "Save Notes"}
        disabled={loading || saving}
      />
    </Dialog>
  );
}
