"use client";

import { useState, useCallback } from "react";
import { Plus, Globe, CheckCircle2 } from "lucide-react";
import type { LegalSection } from "@/db/schema";
import type { LegalDocEntry, LegalDocInput } from "../actions";
import { AddSectionDialog } from "./AddSectionDialog";
import { SectionCard, type LocalSection } from "./SectionCard";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Convert DB LegalSection[] → editable LocalSection[] */
function toLocal(sections: LegalSection[]): LocalSection[] {
  return sections.map((s) => ({
    title: s.title,
    content: s.paragraphs.join("\n\n"),
  }));
}

/** Convert editable LocalSection[] → DB LegalSection[] */
function fromLocal(sections: LocalSection[]): LegalSection[] {
  return sections.map((s) => ({
    title: s.title,
    paragraphs: s.content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean),
  }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

interface DocumentEditorProps {
  docType: "privacy_policy" | "terms_of_service";
  doc: LegalDocEntry | null;
  saving: boolean;
  onSave: (input: LegalDocInput) => void;
}

export function DocumentEditor({ docType, doc, saving, onSave }: DocumentEditorProps) {
  const [effectiveDate, setEffectiveDate] = useState(doc?.effectiveDate ?? "");
  const [version, setVersion] = useState(doc?.version ?? "1.0");
  const [intro, setIntro] = useState(doc?.intro ?? "");
  const [editingIntro, setEditingIntro] = useState(false);
  const [sections, setSections] = useState<LocalSection[]>(() =>
    doc ? toLocal(doc.sections) : [],
  );
  const [changeNotes, setChangeNotes] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const handleUpdateSection = useCallback((index: number, updated: LocalSection) => {
    setSections((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }, []);

  const handleDeleteSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setSections((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setSections((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleAddSection = useCallback((title: string, content: string) => {
    setSections((prev) => [...prev, { title, content }]);
  }, []);

  function handleSave() {
    onSave({
      version,
      intro,
      sections: fromLocal(sections),
      effectiveDate,
      changeNotes: changeNotes.trim() || undefined,
    });
    setChangeNotes("");
  }

  const label = docType === "privacy_policy" ? "Privacy Policy" : "Terms of Service";
  const publicPath = docType === "privacy_policy" ? "/privacy" : "/terms";
  const isPublished = !!doc?.isPublished;
  const lastPublished = doc?.publishedAt
    ? new Date(doc.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Meta row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted uppercase tracking-wide">
            Effective Date
          </label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted uppercase tracking-wide">Version</label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-24 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
            placeholder="1.0"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {isPublished && lastPublished && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Published {lastPublished}
            </span>
          )}
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-foreground border border-border rounded-lg hover:bg-surface transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            View live
          </a>
        </div>
      </div>

      {/* Intro */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Intro paragraph</p>
        {editingIntro ? (
          <textarea
            autoFocus
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            onBlur={() => setEditingIntro(false)}
            rows={4}
            className="w-full resize-y bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        ) : (
          <div
            onClick={() => setEditingIntro(true)}
            className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line cursor-text hover:text-foreground transition-colors bg-surface border border-border rounded-lg px-3 py-2.5 min-h-[3rem]"
            title="Click to edit"
          >
            {intro || <span className="text-muted italic">Click to add intro text…</span>}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">
          Sections ({sections.length})
        </p>

        {sections.length === 0 && (
          <p className="text-sm text-muted py-4 text-center bg-surface rounded-xl border border-dashed border-border">
            No sections yet. Add the first one below.
          </p>
        )}

        {sections.map((section, i) => (
          <SectionCard
            key={i}
            section={section}
            index={i}
            total={sections.length}
            onUpdate={(updated) => handleUpdateSection(i, updated)}
            onDelete={() => handleDeleteSection(i)}
            onMoveUp={() => handleMoveUp(i)}
            onMoveDown={() => handleMoveDown(i)}
          />
        ))}

        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground border border-dashed border-border rounded-xl hover:bg-surface transition-colors w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Add section
        </button>
      </div>

      {/* Save footer */}
      <div className="flex items-end gap-3 pt-4 border-t border-border">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted uppercase tracking-wide">
            Change notes <span className="normal-case font-normal">(internal, optional)</span>
          </label>
          <input
            type="text"
            value={changeNotes}
            onChange={(e) => setChangeNotes(e.target.value)}
            placeholder='e.g. "Updated CCPA section with new email"'
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !effectiveDate}
          className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 shrink-0"
        >
          {saving ? "Saving…" : "Save & Publish"}
        </button>
      </div>

      <AddSectionDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddSection} />
    </div>
  );
}
