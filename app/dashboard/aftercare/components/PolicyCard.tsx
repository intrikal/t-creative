"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PolicyEntry } from "../actions";

export function PolicyCard({
  policy,
  onUpdate,
  onDelete,
}: {
  policy: PolicyEntry;
  onUpdate: (updated: PolicyEntry) => void;
  onDelete: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(policy.title);
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState(policy.content);

  function commitTitle() {
    onUpdate({ ...policy, title: titleDraft.trim() || policy.title });
    setEditingTitle(false);
  }

  function commitContent() {
    onUpdate({ ...policy, content: contentDraft });
    setEditingContent(false);
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pt-4 pb-2 px-5">
        <div className="flex items-center justify-between gap-2">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleDraft(policy.title);
                  setEditingTitle(false);
                }
              }}
              className="text-sm font-semibold bg-surface border border-border rounded-lg px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          ) : (
            <CardTitle
              className="text-sm font-semibold cursor-text hover:text-foreground/70 transition-colors"
              onClick={() => setEditingTitle(true)}
              title="Click to edit title"
            >
              {policy.title}
            </CardTitle>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/8 text-muted hover:text-destructive transition-colors shrink-0"
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
                setContentDraft(policy.content);
                setEditingContent(false);
              }
            }}
            rows={7}
            className="w-full resize-y bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        ) : (
          <div
            onClick={() => setEditingContent(true)}
            className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line cursor-text hover:text-foreground transition-colors"
            title="Click to edit"
          >
            {policy.content}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
