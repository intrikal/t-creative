/**
 * UploadDialog.tsx
 * File upload dialog with drag/drop support, image previews, and metadata fields.
 */

"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, Star, X } from "lucide-react";
import type { MediaCategory } from "@/app/dashboard/media/actions";
import { uploadMedia } from "@/app/dashboard/media/actions";
import { Dialog, DialogFooter, Field, Select, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PendingFile } from "./helpers";

export function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<MediaCategory>("lash");
  const [featured, setFeatured] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, startUpload] = useTransition();

  function addFiles(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const next = imgs.map((file) => ({ file, objectUrl: URL.createObjectURL(file) }));
    setPending((prev) => [...prev, ...next]);
  }

  function removeFile(objectUrl: string) {
    URL.revokeObjectURL(objectUrl);
    setPending((prev) => prev.filter((p) => p.objectUrl !== objectUrl));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function handleConfirm() {
    const fd = new FormData();
    pending.forEach((p) => fd.append("files", p.file));
    if (caption.trim()) fd.append("caption", caption.trim());
    fd.append("category", category);
    fd.append("featured", String(featured));

    startUpload(async () => {
      await uploadMedia(fd);
      // cleanup
      pending.forEach((p) => URL.revokeObjectURL(p.objectUrl));
      setPending([]);
      setCaption("");
      setCategory("lash");
      setFeatured(false);
      onClose();
    });
  }

  function handleClose() {
    if (uploading) return;
    pending.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    setPending([]);
    setCaption("");
    setCategory("lash");
    setFeatured(false);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Upload Media"
      description="Add photos to your portfolio"
      size="md"
    >
      <div className="space-y-5">
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            dragging
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/50 hover:bg-surface",
          )}
        >
          <ImagePlus className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Drop photos here or click to browse</p>
          <p className="text-xs text-muted mt-1">JPG, PNG, WEBP — multiple files supported</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {/* Previews */}
        {pending.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {pending.map((p) => (
              <div
                key={p.objectUrl}
                className="relative group rounded-lg overflow-hidden aspect-square"
              >
                <Image
                  fill
                  src={p.objectUrl}
                  alt=""
                  className="object-cover"
                  sizes="25vw"
                  unoptimized
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(p.objectUrl);
                  }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Metadata */}
        <Field label="Category" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value as MediaCategory)}>
            <option value="lash">Lash</option>
            <option value="jewelry">Jewelry</option>
            <option value="crochet">Crochet</option>
            <option value="consulting">Consulting</option>
          </Select>
        </Field>

        <Field label="Caption">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            placeholder="Add a caption for these photos…"
          />
        </Field>

        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={featured}
            onClick={() => setFeatured(!featured)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
              featured ? "bg-[#d4a574]" : "bg-foreground/15",
            )}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                featured ? "translate-x-[18px]" : "translate-x-[3px]",
              )}
            />
          </button>
          <div>
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Star
                className={cn(
                  "w-3.5 h-3.5",
                  featured ? "fill-[#d4a574] text-[#d4a574]" : "text-muted",
                )}
              />
              Featured
            </span>
            <p className="text-xs text-muted">Show on public portfolio and auto-publish</p>
          </div>
        </label>
      </div>

      <DialogFooter
        onCancel={handleClose}
        onConfirm={handleConfirm}
        confirmLabel={
          uploading
            ? "Uploading…"
            : `Upload ${pending.length > 0 ? `${pending.length} photo${pending.length > 1 ? "s" : ""}` : ""}`
        }
        disabled={pending.length === 0 || uploading}
      />
    </Dialog>
  );
}
