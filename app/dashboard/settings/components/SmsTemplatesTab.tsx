"use client";
/**
 * SmsTemplatesTab — Admin editor for automated SMS message templates.
 *
 * Shows each template as an editable card with a live preview panel.
 * Available variables are listed below the editor as clickable chips
 * that insert the variable at the cursor position.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ChevronLeft, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SmsTemplate } from "@/lib/sms-templates";
import { cn } from "@/lib/utils";
import { previewTemplate, resetTemplate, updateTemplate } from "../sms-template-actions";
import { StatefulSaveButton } from "./shared";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Segment colour based on character count. */
function charCountColor(len: number): string {
  if (len <= 160) return "text-green-600";
  if (len <= 320) return "text-amber-500";
  return "text-red-500";
}

function segmentLabel(len: number): string {
  if (len <= 160) return "1 SMS segment";
  if (len <= 320) return "2 SMS segments";
  return "Exceeds 320 — will be truncated";
}

/* ------------------------------------------------------------------ */
/*  Template card (list view)                                          */
/* ------------------------------------------------------------------ */

function TemplateCard({ template, onClick }: { template: SmsTemplate; onClick: () => void }) {
  const charLen = template.body.length;

  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <Card className="gap-0 hover:border-accent/40 transition-colors cursor-pointer">
        <CardContent className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground truncate">{template.name}</h3>
                <span
                  className={cn(
                    "shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                    template.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
                  )}
                >
                  {template.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {template.description && (
                <p className="text-xs text-muted mt-1 line-clamp-2">{template.description}</p>
              )}
            </div>
            <span className={cn("text-xs font-mono shrink-0 mt-0.5", charCountColor(charLen))}>
              {charLen} chars
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Template editor (detail view)                                      */
/* ------------------------------------------------------------------ */

function TemplateEditor({
  template,
  onBack,
  onUpdated,
}: {
  template: SmsTemplate;
  onBack: () => void;
  onUpdated: (updated: SmsTemplate) => void;
}) {
  const [body, setBody] = useState(template.body);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isPreviewing, startPreviewTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const variables = useMemo(() => (template.variables ?? []) as string[], [template.variables]);
  const charLen = body.length;

  /* Debounced preview ------------------------------------------------ */
  const fetchPreview = useCallback(() => {
    startPreviewTransition(async () => {
      const result = await previewTemplate(template.slug);
      if (result.success) {
        // Re-render with current body instead of DB body for live preview
        let rendered = body;
        for (const v of variables) {
          rendered = rendered.replaceAll(`{{${v}}}`, `[${v}]`);
        }
        setPreview(rendered);
      }
    });
  }, [body, template.slug, variables]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchPreview, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchPreview]);

  /* Insert variable at cursor --------------------------------------- */
  function insertVariable(varName: string) {
    const ta = textareaRef.current;
    if (!ta) return;

    const token = `{{${varName}}}`;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const next = before + token + after;

    setBody(next);
    setSaved(false);

    // Restore cursor after the inserted token
    requestAnimationFrame(() => {
      const pos = start + token.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  /* Save -------------------------------------------------------------- */
  async function handleSave() {
    if (charLen > 320) return;
    setSaving(true);
    setError(null);
    const result = await updateTemplate(template.slug, body);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      onUpdated({ ...template, body });
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(result.error);
    }
  }

  /* Reset to default ------------------------------------------------- */
  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }

    startResetTransition(async () => {
      const result = await resetTemplate(template.slug);
      if (result.success) {
        // Refetch is simpler — just re-read defaults client-side
        const { getDefaultBody } = await import("@/lib/sms-templates");
        const defaultBody = getDefaultBody(template.slug);
        if (defaultBody) {
          setBody(defaultBody);
          onUpdated({ ...template, body: defaultBody });
        }
        setConfirmReset(false);
        setSaved(false);
      } else {
        setError(result.error);
        setConfirmReset(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        All templates
      </button>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Editor panel */}
        <Card className="gap-0 flex-1">
          <CardContent className="px-5 py-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
              {template.description && (
                <p className="text-xs text-muted mt-0.5">{template.description}</p>
              )}
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setSaved(false);
                }}
                maxLength={320}
                rows={5}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition resize-none font-mono"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted">{segmentLabel(charLen)}</span>
                <span className={cn("text-xs font-mono", charCountColor(charLen))}>
                  {charLen}/320
                </span>
              </div>
            </div>

            {/* Variable chips */}
            {variables.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                  Available variables
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="px-2 py-1 text-xs font-mono bg-surface border border-border rounded-md hover:border-accent/50 hover:bg-accent/5 transition-colors"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-500">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleReset}
                disabled={isResetting}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors",
                  confirmReset
                    ? "text-red-500 hover:text-red-600"
                    : "text-muted hover:text-foreground",
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {confirmReset ? "Click again to confirm reset" : "Reset to default"}
              </button>

              <StatefulSaveButton saving={saving} saved={saved} onSave={handleSave} />
            </div>
          </CardContent>
        </Card>

        {/* Preview panel */}
        <Card className="gap-0 lg:w-80">
          <CardContent className="px-5 py-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Preview</p>
            <div
              className={cn(
                "rounded-lg bg-surface border border-border p-3 text-sm text-foreground min-h-[80px] whitespace-pre-wrap",
                isPreviewing && "opacity-50",
              )}
            >
              {preview ?? body}
            </div>
            <p className="text-[10px] text-muted">Variables shown as [variableName] in preview</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function SmsTemplatesTab({ initialTemplates }: { initialTemplates: SmsTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const editing = editingSlug ? (templates.find((t) => t.slug === editingSlug) ?? null) : null;

  function handleUpdated(updated: SmsTemplate) {
    setTemplates((prev) => prev.map((t) => (t.slug === updated.slug ? updated : t)));
  }

  if (editing) {
    return (
      <TemplateEditor
        key={editing.slug}
        template={editing}
        onBack={() => setEditingSlug(null)}
        onUpdated={handleUpdated}
      />
    );
  }

  return (
    <div className="space-y-3">
      {templates.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">No SMS templates configured yet.</p>
      )}
      {templates.map((t) => (
        <TemplateCard key={t.slug} template={t} onClick={() => setEditingSlug(t.slug)} />
      ))}
    </div>
  );
}
