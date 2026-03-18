"use client";

/** Commission request form dialog — multi-step form with file upload for crochet and 3D printing commissions. */

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { CheckCircle2, X, FileBox, Paperclip } from "lucide-react";
import {
  submitCommissionRequest,
  uploadCommissionFile,
  type CommissionCategory,
} from "@/app/dashboard/commissions/actions";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CAT_CONFIG } from "./commissions-helpers";

type Attachment = {
  file: File;
  /** Object URL for image preview; null for design files. */
  preview: string | null;
  isDesignFile: boolean;
};

const DESIGN_EXTENSIONS = new Set(["stl", "obj", "3mf", "step", "stp", "amf"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function CommissionRequestDialog({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [category, setCategory] = useState<CommissionCategory>("crochet");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [colors, setColors] = useState("");
  const [size, setSize] = useState("");
  const [material, setMaterial] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [referenceNotes, setReferenceNotes] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = 5 - attachments.length;
    const toAdd: Attachment[] = files.slice(0, remaining).map((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const isDesignFile = DESIGN_EXTENSIONS.has(ext);
      const isImage = IMAGE_TYPES.has(file.type);
      return {
        file,
        preview: isImage ? URL.createObjectURL(file) : null,
        isDesignFile: isDesignFile || !isImage,
      };
    });

    setAttachments((prev) => [...prev, ...toAdd]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);
    startTransition(async () => {
      // Upload files first, collect URLs by type
      const referenceUrls: string[] = [];
      const designUrls: string[] = [];

      for (const attachment of attachments) {
        const fd = new FormData();
        fd.append("file", attachment.file);
        try {
          const { url, isDesignFile } = await uploadCommissionFile(fd);
          if (isDesignFile) {
            designUrls.push(url);
          } else {
            referenceUrls.push(url);
          }
        } catch (err) {
          setUploadError(
            err instanceof Error ? err.message : "File upload failed. Please try again.",
          );
          return;
        }
      }

      const result = await submitCommissionRequest({
        category,
        title,
        description,
        quantity,
        metadata: {
          ...(colors ? { colors } : {}),
          ...(size ? { size } : {}),
          ...(material ? { material } : {}),
          ...(deadline ? { deadline } : {}),
          ...(budgetRange ? { budgetRange } : {}),
          ...(referenceNotes ? { referenceNotes } : {}),
          ...(referenceUrls.length ? { referenceUrls } : {}),
          ...(designUrls.length ? { designUrls } : {}),
        },
      });

      if (result.success) {
        setSubmitted(true);
        setOrderNumber(result.orderNumber);
      }
    });
  }

  if (submitted) {
    return (
      <Dialog open onClose={onClose} title="Request Submitted" size="sm">
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#4e6b51]/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-[#4e6b51]" />
          </div>
          <p className="text-sm text-foreground font-medium">Commission request received!</p>
          <p className="text-xs text-muted">
            We&apos;ll review your request and send you a quote within 2–3 business days.
          </p>
          {orderNumber && <p className="text-[11px] text-muted/60">Reference: {orderNumber}</p>}
          <button
            onClick={onClose}
            className="mt-4 px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Done
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} title="New Commission Request" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-2">
            Type of commission <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["crochet", "3d_printing"] as const).map((cat) => {
              const cfg = CAT_CONFIG[cat];
              const Icon = cfg.icon;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-colors",
                    category === cat
                      ? "border-accent bg-accent/8 text-accent"
                      : "border-border bg-surface text-muted hover:text-foreground hover:border-border/80",
                  )}
                >
                  <Icon className={cn("w-4 h-4", category === cat ? "text-accent" : cfg.color)} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            What do you want made? <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              category === "crochet"
                ? "e.g. Queen-size blanket in sage and ivory"
                : "e.g. Custom pendant of my dog"
            }
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Describe your vision <span className="text-destructive">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us as much as you'd like — the more detail, the more accurate the quote."
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Quantity</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-24 px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {category === "crochet" ? (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Colors / colorway
                </label>
                <input
                  type="text"
                  value={colors}
                  onChange={(e) => setColors(e.target.value)}
                  placeholder="e.g. Sage, ivory, dusty rose"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Size / dimensions
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g. Queen, 5×7 ft, toddler"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Preferred material / color
                </label>
                <input
                  type="text"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="e.g. White PLA, black resin"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Size / scale
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g. 2 inches tall, palm-sized"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Deadline (optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Budget range (optional)
            </label>
            <input
              type="text"
              value={budgetRange}
              onChange={(e) => setBudgetRange(e.target.value)}
              placeholder="e.g. $50–$100"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
        </div>

        {/* File attachments */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-foreground">
              {category === "3d_printing"
                ? "Design files & reference images (optional)"
                : "Reference images (optional)"}
            </label>
            <span className="text-[11px] text-muted/60">{attachments.length}/5</span>
          </div>

          {/* File previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative group">
                  {a.preview ? (
                    // Image thumbnail
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface">
                      <Image
                        src={a.preview}
                        alt=""
                        width={200}
                        height={200}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    // Design file icon
                    <div className="w-16 h-16 rounded-lg border border-border bg-surface flex flex-col items-center justify-center gap-0.5 px-1">
                      <FileBox className="w-5 h-5 text-[#5a5aaa]" />
                      <span className="text-[9px] text-muted/70 text-center leading-tight truncate w-full text-center">
                        {a.file.name.split(".").pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove file"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload trigger */}
          {attachments.length < 5 && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept={
                  category === "3d_printing" ? "image/*,.stl,.obj,.3mf,.step,.stp,.amf" : "image/*"
                }
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-surface text-xs text-muted hover:text-foreground hover:border-border/80 transition-colors w-full justify-center"
              >
                <Paperclip className="w-3.5 h-3.5" />
                {category === "3d_printing"
                  ? "Attach images or design files (.stl, .obj, .3mf, .step)"
                  : "Attach reference images"}
              </button>
            </>
          )}

          {uploadError && <p className="text-xs text-destructive mt-1.5">{uploadError}</p>}
        </div>

        {/* Reference notes */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Additional notes (optional)
          </label>
          <textarea
            rows={2}
            value={referenceNotes}
            onChange={(e) => setReferenceNotes(e.target.value)}
            placeholder="Describe any inspiration, style references, or special requirements."
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {isPending ? (attachments.length > 0 ? "Uploading…" : "Submitting…") : "Submit Request"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
