"use client";

import { useState } from "react";
import { Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type LocalSection = {
  title: string;
  /** Paragraphs joined with "\n\n" for editing. */
  content: string;
};

export function SectionCard({
  section,
  index,
  total,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  section: LocalSection;
  index: number;
  total: number;
  onUpdate: (updated: LocalSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState(section.content);

  function commitTitle() {
    const next = titleDraft.trim() || section.title;
    onUpdate({ ...section, title: next });
    setTitleDraft(next);
    setEditingTitle(false);
  }

  function commitContent() {
    onUpdate({ ...section, content: contentDraft });
    setEditingContent(false);
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pt-4 pb-2 px-5">
        <div className="flex items-center gap-2">
          {/* Reorder */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-0.5 rounded hover:bg-foreground/8 text-muted hover:text-foreground transition-colors disabled:opacity-30"
              title="Move up"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="p-0.5 rounded hover:bg-foreground/8 text-muted hover:text-foreground transition-colors disabled:opacity-30"
              title="Move down"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title */}
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleDraft(section.title);
                  setEditingTitle(false);
                }
              }}
              className="flex-1 text-sm font-semibold bg-surface border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          ) : (
            <CardTitle
              className="flex-1 text-sm font-semibold cursor-text hover:text-foreground/70 transition-colors"
              onClick={() => setEditingTitle(true)}
              title="Click to edit heading"
            >
              {section.title}
            </CardTitle>
          )}

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/8 text-muted hover:text-destructive transition-colors shrink-0"
            title="Delete section"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        {editingContent ? (
          <textarea
            autoFocus
            value={contentDraft}
            onChange={(e) => setContentDraft(e.target.value)}
            onBlur={commitContent}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setContentDraft(section.content);
                setEditingContent(false);
              }
            }}
            rows={Math.max(4, contentDraft.split("\n").length + 1)}
            className="w-full resize-y bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        ) : (
          <div
            onClick={() => setEditingContent(true)}
            className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line cursor-text hover:text-foreground transition-colors min-h-[2rem]"
            title="Click to edit content"
          >
            {section.content || <span className="text-muted italic">Click to add content…</span>}
          </div>
        )}
        <p className="text-xs text-muted mt-2">
          Blank line = new paragraph · Lines starting with{" "}
          <code className="bg-surface px-1 rounded">-&nbsp;</code> = bullet list
        </p>
      </CardContent>
    </Card>
  );
}
