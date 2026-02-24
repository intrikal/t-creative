"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  Upload,
  Grid,
  List,
  Star,
  Eye,
  EyeOff,
  Filter,
  ImagePlus,
  X,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogFooter, Field, Select, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaRow, MediaStats, MediaCategory } from "./actions";
import { uploadMedia, togglePublish, toggleFeatured, deleteMediaItem } from "./actions";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type FilterCategory = "all" | MediaCategory;

const CATEGORIES: { value: FilterCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lash", label: "Lash" },
  { value: "jewelry", label: "Jewelry" },
  { value: "crochet", label: "Crochet" },
  { value: "consulting", label: "Consulting" },
];

const catLabel: Record<MediaCategory, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
};

const catStyle: Record<MediaCategory, string> = {
  lash: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20",
  jewelry: "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/20",
  crochet: "bg-[#7ba3a3]/12 text-[#4a7a7a] border-[#7ba3a3]/20",
  consulting: "bg-[#5b8a8a]/12 text-[#3a6a6a] border-[#5b8a8a]/20",
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/* ------------------------------------------------------------------ */
/*  Media tile                                                         */
/* ------------------------------------------------------------------ */

function MediaTile({
  item,
  grid,
  isPending,
  onTogglePublish,
  onToggleFeatured,
  onDelete,
}: {
  item: MediaRow;
  grid: boolean;
  isPending: boolean;
  onTogglePublish: () => void;
  onToggleFeatured: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (grid) {
    return (
      <div
        className={cn(
          "group relative rounded-xl overflow-hidden border border-border cursor-pointer transition-opacity",
          isPending && "opacity-60",
        )}
      >
        <div className="relative aspect-square w-full bg-surface">
          {item.publicUrl ? (
            <Image
              fill
              src={item.publicUrl}
              alt={item.caption ?? item.title ?? "Media"}
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 33vw"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              <ImagePlus className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {item.isFeatured && <Star className="w-3.5 h-3.5 text-[#d4a574] fill-[#d4a574]" />}
              {item.isPublished && <Eye className="w-3.5 h-3.5 text-white" />}
            </div>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-border py-1 z-10 min-w-[140px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      onTogglePublish();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface flex items-center gap-2"
                  >
                    {item.isPublished ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Unpublish
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Publish
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onToggleFeatured();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface flex items-center gap-2"
                  >
                    <Star className="w-3 h-3" />
                    {item.isFeatured ? "Unfeature" : "Feature"}
                  </button>
                  <button
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface text-red-600 flex items-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
          <div>
            <p className="text-white text-[11px] font-medium line-clamp-2 leading-snug">
              {item.caption ?? item.title}
            </p>
            {item.client && <p className="text-white/70 text-[10px] mt-0.5">{item.client}</p>}
          </div>
        </div>
        {item.isFeatured && (
          <div className="absolute top-1.5 right-1.5 group-hover:opacity-0 transition-opacity">
            <span className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center">
              <Star className="w-2.5 h-2.5 text-[#d4a574] fill-[#d4a574]" />
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("gap-0", isPending && "opacity-60")}>
      <CardContent className="px-4 py-3 flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-lg shrink-0 overflow-hidden bg-surface">
          {item.publicUrl ? (
            <Image
              fill
              src={item.publicUrl}
              alt={item.caption ?? item.title ?? "Media"}
              className="object-cover"
              sizes="48px"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              <ImagePlus className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.category && (
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", catStyle[item.category])}>
                {catLabel[item.category]}
              </Badge>
            )}
            {item.client && <span className="text-xs text-muted">{item.client}</span>}
          </div>
          <p className="text-sm text-foreground mt-0.5 truncate">
            {item.caption ?? item.title ?? "Untitled"}
          </p>
          <p className="text-[10px] text-muted mt-0.5">{item.date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.isFeatured && <Star className="w-3.5 h-3.5 text-[#d4a574] fill-[#d4a574]" />}
          {item.isPublished && <Eye className="w-3.5 h-3.5 text-muted" />}
          <button
            onClick={onTogglePublish}
            className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors"
            title={item.isPublished ? "Unpublish" : "Publish"}
          >
            {item.isPublished ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onToggleFeatured}
            className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors"
            title={item.isFeatured ? "Unfeature" : "Feature"}
          >
            <Star
              className={cn("w-3.5 h-3.5", item.isFeatured && "fill-[#d4a574] text-[#d4a574]")}
            />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-foreground/5 text-red-400 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Upload dialog                                                      */
/* ------------------------------------------------------------------ */

interface PendingFile {
  file: File;
  objectUrl: string;
}

function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function MediaPage({
  initialItems,
  stats,
}: {
  initialItems: MediaRow[];
  stats: MediaStats;
}) {
  const [category, setCategory] = useState<FilterCategory>("all");
  const [gridView, setGridView] = useState(true);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  const filtered = initialItems.filter((m) => {
    if (category !== "all" && m.category !== category) return false;
    if (featuredOnly && !m.isFeatured) return false;
    return true;
  });

  function handleTogglePublish(id: number, currentState: boolean) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await togglePublish(id, !currentState);
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  function handleToggleFeatured(id: number, currentState: boolean) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await toggleFeatured(id, !currentState);
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  function handleDelete(id: number) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await deleteMediaItem(id);
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Media</h1>
          <p className="text-sm text-muted mt-0.5">
            {stats.total} items · {stats.published} published · {stats.featured} featured
            {stats.totalSizeBytes > 0 && ` · ${formatBytes(stats.totalSizeBytes)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5">
            <button
              onClick={() => setGridView(true)}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                gridView ? "bg-foreground text-background" : "text-muted hover:text-foreground",
              )}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setGridView(false)}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                !gridView ? "bg-foreground text-background" : "text-muted hover:text-foreground",
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                category === value
                  ? "bg-foreground text-background"
                  : "text-muted hover:bg-foreground/8 hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFeaturedOnly(!featuredOnly)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            featuredOnly
              ? "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/25"
              : "text-muted border-transparent hover:text-foreground",
          )}
        >
          <Star className={cn("w-3 h-3", featuredOnly && "fill-[#d4a574] text-[#d4a574]")} />
          Featured only
        </button>
        <span className="text-xs text-muted ml-auto flex items-center gap-1">
          <Filter className="w-3 h-3" /> {filtered.length} items
        </span>
      </div>

      {/* Grid / List view */}
      {gridView ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
          {filtered.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              grid={true}
              isPending={pendingIds.has(item.id)}
              onTogglePublish={() => handleTogglePublish(item.id, item.isPublished)}
              onToggleFeatured={() => handleToggleFeatured(item.id, item.isFeatured)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              grid={false}
              isPending={pendingIds.has(item.id)}
              onTogglePublish={() => handleTogglePublish(item.id, item.isPublished)}
              onToggleFeatured={() => handleToggleFeatured(item.id, item.isFeatured)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <ImagePlus className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">
            {initialItems.length === 0
              ? "No media yet. Upload your first photo!"
              : "No media matches your filters."}
          </p>
        </div>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
