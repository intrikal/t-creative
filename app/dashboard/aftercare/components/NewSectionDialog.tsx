"use client";

import { useState } from "react";
import { Dialog, Field, Input, DialogFooter } from "@/components/ui/dialog";

export function NewSectionDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="New Aftercare Section" size="sm">
      <div className="space-y-4" key={String(open)}>
        <Field label="Service / section title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sugaring Aftercare"
            autoFocus
          />
        </Field>
        <p className="text-xs text-muted">
          You can add do&apos;s and don&apos;ts inline after creating the section.
        </p>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!title.trim()) return;
            onAdd(title.trim());
            onClose();
          }}
          confirmLabel="Create section"
          disabled={!title.trim()}
        />
      </div>
    </Dialog>
  );
}
