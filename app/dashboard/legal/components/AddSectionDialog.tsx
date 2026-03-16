"use client";

import { useState } from "react";
import { Dialog, Field, Input, Textarea, DialogFooter } from "@/components/ui/dialog";

export function AddSectionDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, content: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  function handleConfirm() {
    if (!title.trim()) return;
    onAdd(title.trim(), content.trim());
    setTitle("");
    setContent("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add Section" size="md">
      <div className="space-y-4" key={String(open)}>
        <Field label="Section heading" required hint='e.g. "1. Information We Collect"'>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Section heading"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
          />
        </Field>
        <Field
          label="Content"
          hint="Each blank line creates a new paragraph. Start a line with '- ' for bullet points."
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder={"Paragraph one.\n\n- Bullet item one\n- Bullet item two\n\nParagraph two."}
          />
        </Field>
        <DialogFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Add section"
          disabled={!title.trim()}
        />
      </div>
    </Dialog>
  );
}
