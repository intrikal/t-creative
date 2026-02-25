"use client";

import { useState } from "react";
import { Dialog, Field, Input, Textarea, DialogFooter } from "@/components/ui/dialog";

export function NewPolicyDialog({
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
  return (
    <Dialog open={open} onClose={onClose} title="New Policy" size="md">
      <div className="space-y-4" key={String(open)}>
        <Field label="Policy title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Gift Card Policy"
            autoFocus
          />
        </Field>
        <Field label="Policy content" required>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Write the policy text here…"
          />
        </Field>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!title.trim()) return;
            onAdd(title.trim(), content);
            onClose();
          }}
          confirmLabel="Add policy"
          disabled={!title.trim()}
        />
      </div>
    </Dialog>
  );
}
