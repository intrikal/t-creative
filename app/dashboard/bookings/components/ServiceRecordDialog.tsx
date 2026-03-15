"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, X } from "lucide-react";
import type { MediaCategory } from "@/app/dashboard/media/actions";
import { Dialog, DialogFooter, Field, Input, Select, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getServiceRecord,
  upsertServiceRecord,
  uploadServicePhoto,
  promoteToPortfolio,
} from "../actions";
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

const CATEGORY_OPTIONS: { value: MediaCategory; label: string }[] = [
  { value: "lash", label: "Lash" },
  { value: "jewelry", label: "Jewelry" },
  { value: "crochet", label: "Crochet" },
  { value: "consulting", label: "Consulting" },
];

/* ------------------------------------------------------------------ */
/*  Photo slot component                                               */
/* ------------------------------------------------------------------ */

function PhotoSlot({
  label,
  previewUrl,
  uploading,
  onPick,
  onClear,
}: {
  label: string;
  previewUrl: string | null;
  uploading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex-1">
      <p className="text-xs font-medium text-muted mb-1.5">{label}</p>
      <div
        className={cn(
          "relative rounded-xl overflow-hidden border border-dashed border-border aspect-[4/3] flex items-center justify-center cursor-pointer hover:border-accent/50 hover:bg-surface transition-colors",
          previewUrl && "border-solid border-border",
        )}
        onClick={() => !previewUrl && inputRef.current?.click()}
      >
        {previewUrl ? (
          <>
            <Image
              fill
              src={previewUrl}
              alt={label}
              className="object-cover"
              sizes="50vw"
              unoptimized
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : uploading ? (
          <p className="text-xs text-muted">Uploading…</p>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted">
            <Camera className="w-6 h-6 opacity-50" />
            <p className="text-xs">Add photo</p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main dialog                                                        */
/* ------------------------------------------------------------------ */

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

  // Photo state
  const [beforePath, setBeforePath] = useState<string | null>(null);
  const [afterPath, setAfterPath] = useState<string | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);

  // Promote state
  const [promoteCategory, setPromoteCategory] = useState<MediaCategory>(
    (serviceCategory as MediaCategory) ?? "lash",
  );
  const [promoteCaption, setPromoteCaption] = useState("");
  const [promoting, startPromoteTransition] = useTransition();
  const [promoted, setPromoted] = useState(false);

  const isLash = serviceCategory === "lash";
  const canPromote = !!beforePath && !!afterPath && !promoted;

  // Load record when dialog opens for a new booking
  if (open && loadedBookingId !== bookingId) {
    setLoadedBookingId(bookingId);
    setLoading(true);
    setForm(EMPTY);
    setBeforePath(null);
    setAfterPath(null);
    setBeforeUrl(null);
    setAfterUrl(null);
    setPromoted(false);

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
        setBeforePath(record.beforePhotoPath);
        setAfterPath(record.afterPhotoPath);
        setBeforeUrl(record.beforePhotoUrl);
        setAfterUrl(record.afterPhotoUrl);
      }
      setLoading(false);
    });
  }

  if (!open && loadedBookingId !== null) {
    setLoadedBookingId(null);
  }

  function set<K extends keyof ServiceRecordFormState>(key: K, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleUpload(file: File, slot: "before" | "after") {
    if (slot === "before") setUploadingBefore(true);
    else setUploadingAfter(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bookingId", String(bookingId));
      fd.append("slot", slot);
      const result = await uploadServicePhoto(fd);

      if (slot === "before") {
        setBeforePath(result.path);
        setBeforeUrl(result.publicUrl);
      } else {
        setAfterPath(result.path);
        setAfterUrl(result.publicUrl);
      }
    } finally {
      if (slot === "before") setUploadingBefore(false);
      else setUploadingAfter(false);
    }
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
      beforePhotoPath: beforePath ?? undefined,
      afterPhotoPath: afterPath ?? undefined,
    };
    await upsertServiceRecord(input);
    setSaving(false);
    onClose();
  }

  function handlePromote() {
    startPromoteTransition(async () => {
      await promoteToPortfolio({
        bookingId,
        category: promoteCategory,
        caption: promoteCaption || undefined,
      });
      setPromoted(true);
    });
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
        <div className="space-y-5">
          {/* Before / After photos */}
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
              Photos
            </p>
            <div className="flex gap-3">
              <PhotoSlot
                label="Before"
                previewUrl={beforeUrl}
                uploading={uploadingBefore}
                onPick={(f) => handleUpload(f, "before")}
                onClear={() => {
                  setBeforePath(null);
                  setBeforeUrl(null);
                }}
              />
              <PhotoSlot
                label="After"
                previewUrl={afterUrl}
                uploading={uploadingAfter}
                onPick={(f) => handleUpload(f, "after")}
                onClear={() => {
                  setAfterPath(null);
                  setAfterUrl(null);
                }}
              />
            </div>

            {/* Promote to portfolio */}
            {canPromote && (
              <div className="mt-3 rounded-xl border border-border bg-surface p-3 space-y-3">
                <p className="text-xs font-medium text-foreground">Submit to portfolio</p>
                <div className="flex gap-3">
                  <Field label="Category" className="flex-1">
                    <Select
                      value={promoteCategory}
                      onChange={(e) => setPromoteCategory(e.target.value as MediaCategory)}
                    >
                      {CATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Caption" hint="Optional — shown in the public gallery">
                  <Input
                    placeholder="e.g. Classic full set — CC curl, 10–14mm"
                    value={promoteCaption}
                    onChange={(e) => setPromoteCaption(e.target.value)}
                  />
                </Field>
                <button
                  onClick={handlePromote}
                  disabled={promoting}
                  className="w-full py-2 rounded-lg border border-accent text-accent text-xs font-medium hover:bg-accent/5 transition-colors disabled:opacity-50"
                >
                  {promoting ? "Sending…" : "Request client approval"}
                </button>
              </div>
            )}

            {promoted && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#4e6b51]/10 border border-[#4e6b51]/20 px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-[#4e6b51] shrink-0" />
                <p className="text-xs text-foreground">
                  Consent request sent — client will see it in their gallery.
                </p>
              </div>
            )}
          </div>

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

          {/* General fields */}
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
        disabled={loading || saving || uploadingBefore || uploadingAfter}
      />
    </Dialog>
  );
}
