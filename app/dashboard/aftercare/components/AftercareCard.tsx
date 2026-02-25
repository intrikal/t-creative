"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, Pencil, Save, X, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AftercareSection } from "../actions";
import { ItemList } from "./ItemList";

export function AftercareCard({
  section,
  onUpdate,
  onDelete,
}: {
  section: AftercareSection;
  onUpdate: (updated: AftercareSection) => void;
  onDelete: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);

  function saveTitle() {
    if (titleDraft.trim()) onUpdate({ ...section, title: titleDraft.trim() });
    setEditingTitle(false);
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-3 px-5">
        <div className="flex items-center justify-between gap-2">
          {editingTitle ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="text-sm font-semibold bg-surface border border-border rounded-lg px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-accent/40"
                autoFocus
              />
              <button
                onClick={saveTitle}
                className="flex items-center gap-1 text-xs text-[#4e6b51] px-2 py-1 rounded-lg bg-[#4e6b51]/8 hover:bg-[#4e6b51]/15 transition-colors"
              >
                <Save className="w-3 h-3" /> Save
              </button>
              <button
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(section.title);
                }}
                className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingTitle(true)}
                  className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-foreground/5"
                >
                  <Pencil className="w-3 h-3" /> Rename
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg hover:bg-destructive/8 text-muted hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4e6b51] mb-3 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> What to Do
            </p>
            <ItemList
              items={section.dos}
              accent="green"
              onAdd={(val) => onUpdate({ ...section, dos: [...section.dos, val] })}
              onEdit={(i, val) =>
                onUpdate({ ...section, dos: section.dos.map((d, idx) => (idx === i ? val : d)) })
              }
              onRemove={(i) =>
                onUpdate({ ...section, dos: section.dos.filter((_, idx) => idx !== i) })
              }
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> What NOT to Do
            </p>
            <ItemList
              items={section.donts}
              accent="red"
              onAdd={(val) => onUpdate({ ...section, donts: [...section.donts, val] })}
              onEdit={(i, val) =>
                onUpdate({
                  ...section,
                  donts: section.donts.map((d, idx) => (idx === i ? val : d)),
                })
              }
              onRemove={(i) =>
                onUpdate({ ...section, donts: section.donts.filter((_, idx) => idx !== i) })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
