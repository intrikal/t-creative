"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  Scissors,
  Printer,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  ImageIcon,
  FileBox,
  Paperclip,
} from "lucide-react";
import {
  submitCommissionRequest,
  uploadCommissionFile,
  acceptQuote,
  declineQuote,
  type ClientCommission,
  type CommissionCategory,
} from "@/app/dashboard/commissions/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Status config                                                       */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  inquiry: {
    label: "Under Review",
    color: "text-[#a07040]",
    bg: "bg-[#d4a574]/10",
    border: "border-[#d4a574]/20",
    icon: Clock,
  },
  quoted: {
    label: "Quote Ready",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
    icon: Clock,
  },
  accepted: {
    label: "Confirmed",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
    icon: CheckCircle2,
  },
  in_progress: {
    label: "In Progress",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
    icon: Clock,
  },
  ready_for_pickup: {
    label: "Ready for Pickup",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    icon: XCircle,
  },
};

const CAT_CONFIG: Record<
  CommissionCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  crochet: { label: "Custom Crochet", icon: Scissors, color: "text-[#4a7a7a]" },
  "3d_printing": { label: "3D Printing", icon: Printer, color: "text-[#5a5aaa]" },
};

/* ------------------------------------------------------------------ */
/*  Commission request form dialog                                     */
/* ------------------------------------------------------------------ */

type Attachment = {
  file: File;
  /** Object URL for image preview; null for design files. */
  preview: string | null;
  isDesignFile: boolean;
};

const DESIGN_EXTENSIONS = new Set(["stl", "obj", "3mf", "step", "stp", "amf"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function CommissionRequestDialog({ onClose }: { onClose: () => void }) {
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

/* ------------------------------------------------------------------ */
/*  Commission card                                                     */
/* ------------------------------------------------------------------ */

function CommissionCard({ commission }: { commission: ClientCommission }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionDone, setActionDone] = useState<"accepted" | "declined" | null>(null);

  const s = STATUS_CONFIG[commission.status] ?? STATUS_CONFIG.inquiry;
  const StatusIcon = s.icon;

  const catCfg = CAT_CONFIG[commission.category as CommissionCategory] ?? {
    label: commission.category ?? "Commission",
    icon: Package,
    color: "text-muted",
  };
  const CatIcon = catCfg.icon;

  const meta = commission.metadata as Record<string, unknown> | null;
  // Separate display fields from file URL arrays
  const SKIP_KEYS = new Set(["referenceUrls", "designUrls"]);
  const metaEntries = meta
    ? Object.entries(meta).filter(([k, v]) => !SKIP_KEYS.has(k) && v && typeof v === "string")
    : [];
  const referenceUrls = (meta?.referenceUrls as string[] | undefined) ?? [];
  const designUrls = (meta?.designUrls as string[] | undefined) ?? [];
  const hasFiles = referenceUrls.length > 0 || designUrls.length > 0;

  function handleAccept() {
    startTransition(async () => {
      await acceptQuote(commission.id);
      setActionDone("accepted");
    });
  }

  function handleDecline() {
    startTransition(async () => {
      await declineQuote(commission.id);
      setActionDone("declined");
    });
  }

  const effectiveStatus =
    actionDone === "accepted"
      ? "accepted"
      : actionDone === "declined"
        ? "cancelled"
        : commission.status;

  const effectiveCfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.inquiry;
  const EffectiveStatusIcon = effectiveCfg.icon;

  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5">
            <CatIcon className={cn("w-4 h-4", catCfg.color)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {commission.title}
                </p>
                <p className="text-[11px] text-muted/60 mt-0.5">
                  {catCfg.label} · {commission.orderNumber}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-medium border px-1.5 py-0.5 rounded-full shrink-0",
                  effectiveCfg.color,
                  effectiveCfg.bg,
                  effectiveCfg.border,
                )}
              >
                <EffectiveStatusIcon className="w-2.5 h-2.5" />
                {effectiveCfg.label}
              </span>
            </div>

            {/* Quote section */}
            {(effectiveStatus === "quoted" || effectiveStatus === "accepted") &&
              commission.quotedInCents != null && (
                <div className="mt-3 p-3 rounded-xl bg-surface border border-border">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-muted font-medium uppercase tracking-wide">
                        Quoted Price
                      </p>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        ${(commission.quotedInCents / 100).toFixed(0)}
                      </p>
                    </div>
                    {commission.estimatedCompletionAt && (
                      <div className="text-right">
                        <p className="text-[11px] text-muted font-medium uppercase tracking-wide">
                          Est. Completion
                        </p>
                        <p className="text-xs text-foreground mt-0.5">
                          {commission.estimatedCompletionAt}
                        </p>
                      </div>
                    )}
                  </div>

                  {effectiveStatus === "quoted" && !actionDone && (
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={handleAccept}
                        disabled={isPending}
                        className="flex-1 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {isPending ? "…" : "Accept"}
                      </button>
                      <button
                        onClick={handleDecline}
                        disabled={isPending}
                        className="flex-1 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              )}

            {/* Expandable details */}
            {(commission.description || metaEntries.length > 0 || hasFiles) && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 mt-2.5 text-[11px] text-muted hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> Show details
                    {hasFiles && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-muted/60">
                        <Paperclip className="w-2.5 h-2.5" />
                        {referenceUrls.length + designUrls.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            )}

            {expanded && (
              <div className="mt-2.5 space-y-3 text-xs text-muted border-t border-border/50 pt-2.5">
                {commission.description && <p>{commission.description}</p>}

                {metaEntries.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {metaEntries.map(([k, v]) => (
                      <div key={k}>
                        <span className="font-medium text-muted/70 capitalize">
                          {k.replace(/([A-Z])/g, " $1").toLowerCase()}:{" "}
                        </span>
                        {String(v)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reference images */}
                {referenceUrls.length > 0 && (
                  <div>
                    <p className="font-medium text-muted/70 mb-1.5 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Reference images
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {referenceUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-16 h-16 rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Reference ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Design files */}
                {designUrls.length > 0 && (
                  <div>
                    <p className="font-medium text-muted/70 mb-1.5 flex items-center gap-1">
                      <FileBox className="w-3 h-3" /> Design files
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {designUrls.map((url, i) => {
                        const filename = decodeURIComponent(
                          url.split("/").pop() ?? `file-${i + 1}`,
                        );
                        const ext = filename.split(".").pop()?.toUpperCase() ?? "FILE";
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-foreground/5 transition-colors"
                          >
                            <FileBox className="w-3.5 h-3.5 text-[#5a5aaa] shrink-0" />
                            <span className="text-foreground truncate flex-1">{filename}</span>
                            <span className="text-[10px] text-muted/60 shrink-0">{ext}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted/50 mt-2">{commission.createdAt}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function CommissionsTab({ commissions }: { commissions: ClientCommission[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted">
          Submit a custom crochet or 3D printing request. We&apos;ll review and send you a quote.
        </p>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New Request
        </button>
      </div>

      {/* Commission list */}
      {commissions.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl">
          <Package className="w-8 h-8 text-muted/40 mx-auto mb-2" />
          <p className="text-sm text-muted">No commission requests yet</p>
          <p className="text-xs text-muted/60 mt-1">Click &quot;New Request&quot; to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {commissions.map((c) => (
            <CommissionCard key={c.id} commission={c} />
          ))}
        </div>
      )}

      {dialogOpen && <CommissionRequestDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
