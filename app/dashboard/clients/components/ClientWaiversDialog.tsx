"use client";

import { useState } from "react";
import { FileText, Plus, ChevronDown, ChevronUp } from "lucide-react";
import {
  getFormSubmissions,
  getActiveForms,
  submitForm,
} from "@/app/dashboard/services/form-actions";
import type { FormSubmissionRow, FormRow } from "@/app/dashboard/services/form-actions";
import type { FormField, FormType } from "@/app/dashboard/services/types";
import { FORM_TYPE_CONFIG, DEFAULT_FIELDS } from "@/app/dashboard/services/types";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogFooter, Field, Select, Textarea, Input } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Submission detail accordion                                        */
/* ------------------------------------------------------------------ */

function SubmissionCard({ sub }: { sub: FormSubmissionRow }) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = FORM_TYPE_CONFIG[sub.formType];

  return (
    <div className="border border-border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/3 transition-colors"
      >
        <FileText className="w-4 h-4 text-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{sub.formName}</p>
          <p className="text-xs text-muted">{sub.submittedAt}</p>
        </div>
        <Badge className={cn("text-[10px] px-1.5 py-0.5 border", typeConfig.bg, typeConfig.color)}>
          {typeConfig.label}
        </Badge>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
        )}
      </button>
      {expanded && sub.data && (
        <div className="px-4 pb-3 border-t border-border/50 pt-3 space-y-2">
          {Object.entries(sub.data).map(([key, value]) => (
            <div key={key} className="flex gap-2 text-sm">
              <span className="text-muted font-medium shrink-0 w-32 truncate">{key}:</span>
              <span className="text-foreground">
                {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}
              </span>
            </div>
          ))}
          {sub.formVersion && (
            <p className="text-[10px] text-muted pt-1">Version: {sub.formVersion}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  New submission sub-dialog                                          */
/* ------------------------------------------------------------------ */

function NewSubmissionDialog({
  open,
  onClose,
  clientId,
  forms,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  forms: FormRow[];
  onSubmitted: () => void;
}) {
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const selectedForm = forms.find((f) => f.id === selectedFormId);
  const fields: FormField[] = selectedForm
    ? ((selectedForm.fields as FormField[] | null) ?? DEFAULT_FIELDS[selectedForm.type as FormType])
    : [];

  function handleFormSelect(id: string) {
    const numId = Number(id);
    setSelectedFormId(numId || null);
    setFormData({});
  }

  function setField(label: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [label]: value }));
  }

  async function handleSubmit() {
    if (!selectedFormId) return;
    setSaving(true);
    await submitForm({
      clientId,
      formId: selectedFormId,
      data: formData,
    });
    setSaving(false);
    onSubmitted();
    onClose();
  }

  const requiredMissing = fields
    .filter((f) => f.required)
    .some((f) => {
      const val = formData[f.label];
      return val === undefined || val === "" || val === false;
    });

  return (
    <Dialog open={open} onClose={onClose} title="Submit Form" size="lg">
      <div className="space-y-4">
        <Field label="Select Form" required>
          <Select
            value={selectedFormId?.toString() ?? ""}
            onChange={(e) => handleFormSelect(e.target.value)}
          >
            <option value="">Choose a form…</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>

        {selectedForm && fields.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            {fields.map((field) => (
              <Field key={field.id} label={field.label} required={field.required}>
                {field.type === "textarea" ? (
                  <Textarea
                    rows={2}
                    value={(formData[field.label] as string) ?? ""}
                    onChange={(e) => setField(field.label, e.target.value)}
                  />
                ) : field.type === "checkbox" ? (
                  <label className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData[field.label] as boolean) ?? false}
                      onChange={(e) => setField(field.label, e.target.checked)}
                      className="rounded border-border accent-accent"
                    />
                    <span className="text-sm text-foreground">Confirmed</span>
                  </label>
                ) : field.type === "date" ? (
                  <Input
                    type="date"
                    value={(formData[field.label] as string) ?? ""}
                    onChange={(e) => setField(field.label, e.target.value)}
                  />
                ) : field.type === "signature" ? (
                  <Textarea
                    rows={1}
                    placeholder="Type full name as signature…"
                    value={(formData[field.label] as string) ?? ""}
                    onChange={(e) => setField(field.label, e.target.value)}
                  />
                ) : (
                  <Input
                    type={
                      field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"
                    }
                    value={(formData[field.label] as string) ?? ""}
                    onChange={(e) => setField(field.label, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>
        )}
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSubmit}
        confirmLabel={saving ? "Submitting…" : "Submit"}
        disabled={!selectedFormId || requiredMissing || saving}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main dialog                                                        */
/* ------------------------------------------------------------------ */

export function ClientWaiversDialog({
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
  const [submissions, setSubmissions] = useState<FormSubmissionRow[]>([]);
  const [activeForms, setActiveForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedClientId, setLoadedClientId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Detect when a new client is opened and trigger fetch
  if (open && loadedClientId !== clientId) {
    setLoadedClientId(clientId);
    setLoading(true);
    setSubmissions([]);
    setActiveForms([]);
    Promise.all([getFormSubmissions(clientId), getActiveForms()]).then(([subs, forms]) => {
      setSubmissions(subs);
      setActiveForms(forms);
      setLoading(false);
    });
  }

  // Reset tracked clientId when dialog closes
  if (!open && loadedClientId !== null) {
    setLoadedClientId(null);
  }

  function handleSubmitted() {
    // Refresh submissions list
    getFormSubmissions(clientId).then(setSubmissions);
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Signed Waivers & Forms"
        description={`Form submissions for ${clientName}`}
        size="lg"
      >
        {loading ? (
          <div className="py-8 text-center text-sm text-muted">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
              >
                <Plus className="w-3 h-3" /> New Submission
              </button>
            </div>

            {submissions.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-8 h-8 text-muted/40 mx-auto mb-2" />
                <p className="text-sm text-muted">No forms submitted yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.map((sub) => (
                  <SubmissionCard key={sub.id} sub={sub} />
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Done" />
      </Dialog>

      {showNew && (
        <NewSubmissionDialog
          open
          onClose={() => setShowNew(false)}
          clientId={clientId}
          forms={activeForms}
          onSubmitted={handleSubmitted}
        />
      )}
    </>
  );
}
