"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, Grid, List, Star, Eye, Instagram, Filter, ImagePlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogFooter, Field, Input, Select, Textarea } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

type MediaCategory = "lash" | "jewelry" | "crochet" | "consulting" | "events" | "bts";

interface MediaItem {
  id: number;
  client?: string;
  category: MediaCategory;
  caption: string;
  date: string;
  featured: boolean;
  postedToIG: boolean;
  tags: string[];
  // Real upload uses `objectUrl`; mock items use gradient colors
  objectUrl?: string;
  colorA?: string;
  colorB?: string;
}

const MOCK_MEDIA: MediaItem[] = [
  {
    id: 1,
    client: "Sarah M.",
    category: "lash",
    caption: "Volume lash full set — graduation day ✨",
    date: "Feb 20",
    featured: true,
    postedToIG: true,
    tags: ["volume", "graduation", "lashes"],
    colorA: "#c4907a",
    colorB: "#e8c4b8",
  },
  {
    id: 2,
    client: "Destiny C.",
    category: "lash",
    caption: "Mega volume — obsessed with this set 🖤",
    date: "Feb 19",
    featured: true,
    postedToIG: true,
    tags: ["mega", "lashes", "dramatic"],
    colorA: "#2a2a2a",
    colorB: "#4a3a3a",
  },
  {
    id: 3,
    client: "Nina P.",
    category: "jewelry",
    caption: "Permanent anklet duo — sisters ✨",
    date: "Feb 17",
    featured: false,
    postedToIG: true,
    tags: ["anklet", "permanent", "matching"],
    colorA: "#d4a574",
    colorB: "#f0d4b0",
  },
  {
    id: 4,
    client: "Camille F.",
    category: "jewelry",
    caption: "Dainty wrist chain — the perfect everyday piece",
    date: "Feb 16",
    featured: false,
    postedToIG: false,
    tags: ["bracelet", "dainty", "everyday"],
    colorA: "#c0a060",
    colorB: "#e8d0a0",
  },
  {
    id: 5,
    client: "Keisha W.",
    category: "crochet",
    caption: "Goddess locs with pops of burgundy 🍇",
    date: "Feb 14",
    featured: false,
    postedToIG: true,
    tags: ["crochet", "goddesslocs", "braids"],
    colorA: "#5a2a4a",
    colorB: "#8a4a6a",
  },
  {
    id: 6,
    client: "Amara J.",
    category: "lash",
    caption: "Classic wispy — clean and natural 🤍",
    date: "Feb 13",
    featured: false,
    postedToIG: false,
    tags: ["classic", "wispy", "natural"],
    colorA: "#d4b8a8",
    colorB: "#f0e4dc",
  },
  {
    id: 7,
    client: "Lily N.",
    category: "lash",
    caption: "Bridal lashes — bride + bridesmaids all done 💍",
    date: "Feb 8",
    featured: true,
    postedToIG: true,
    tags: ["bridal", "wedding", "lashes"],
    colorA: "#e8d4c8",
    colorB: "#f8f0ec",
  },
  {
    id: 8,
    category: "events",
    caption: "Pop-up setup at Valley Fair 🛍️",
    date: "Feb 5",
    featured: false,
    postedToIG: true,
    tags: ["popup", "events", "jewelry"],
    colorA: "#5b8a8a",
    colorB: "#8ab0b0",
  },
  {
    id: 9,
    category: "bts",
    caption: "Studio setup day ✨ new light installed",
    date: "Feb 3",
    featured: false,
    postedToIG: true,
    tags: ["bts", "studio", "setup"],
    colorA: "#8fa89c",
    colorB: "#b4ccc6",
  },
  {
    id: 10,
    client: "Maya R.",
    category: "lash",
    caption: "Classic fill — always so easy to work with 🙏",
    date: "Jan 31",
    featured: false,
    postedToIG: false,
    tags: ["classic", "fill", "lashes"],
    colorA: "#c8a090",
    colorB: "#e0c0b0",
  },
  {
    id: 11,
    client: "Priya K.",
    category: "jewelry",
    caption: "Permanent necklace — minimal luxury",
    date: "Jan 28",
    featured: true,
    postedToIG: true,
    tags: ["necklace", "minimal", "jewelry"],
    colorA: "#b89060",
    colorB: "#d8b890",
  },
  {
    id: 12,
    category: "bts",
    caption: "New chain collection just dropped 🔗",
    date: "Jan 25",
    featured: false,
    postedToIG: true,
    tags: ["chains", "new", "jewelry"],
    colorA: "#a09070",
    colorB: "#c8b898",
  },
];

const CATEGORIES: { value: "all" | MediaCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lash", label: "Lash" },
  { value: "jewelry", label: "Jewelry" },
  { value: "crochet", label: "Crochet" },
  { value: "events", label: "Events" },
  { value: "bts", label: "BTS" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const catLabel: Record<MediaCategory, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
  events: "Events",
  bts: "BTS",
};

const catStyle: Record<MediaCategory, string> = {
  lash: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20",
  jewelry: "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/20",
  crochet: "bg-[#7ba3a3]/12 text-[#4a7a7a] border-[#7ba3a3]/20",
  consulting: "bg-[#5b8a8a]/12 text-[#3a6a6a] border-[#5b8a8a]/20",
  events: "bg-purple-50 text-purple-700 border-purple-100",
  bts: "bg-foreground/8 text-muted border-foreground/12",
};

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Media tile                                                          */
/* ------------------------------------------------------------------ */

function MediaTile({ item, grid }: { item: MediaItem; grid: boolean }) {
  const bg = item.objectUrl
    ? undefined
    : { background: `linear-gradient(135deg, ${item.colorA}, ${item.colorB})` };

  if (grid) {
    return (
      <div className="group relative rounded-xl overflow-hidden border border-border cursor-pointer">
        <div className="relative aspect-square w-full" style={bg}>
          {item.objectUrl && (
            <Image
              fill
              src={item.objectUrl}
              alt={item.caption}
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 33vw"
              unoptimized
            />
          )}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100">
          <div className="flex items-center justify-between">
            {item.featured && <Star className="w-3.5 h-3.5 text-[#d4a574] fill-[#d4a574]" />}
            {item.postedToIG && <Instagram className="w-3.5 h-3.5 text-white" />}
          </div>
          <div>
            <p className="text-white text-[11px] font-medium line-clamp-2 leading-snug">
              {item.caption}
            </p>
            {item.client && <p className="text-white/70 text-[10px] mt-0.5">{item.client}</p>}
          </div>
        </div>
        {item.featured && (
          <div className="absolute top-1.5 right-1.5">
            <span className="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center">
              <Star className="w-2.5 h-2.5 text-[#d4a574] fill-[#d4a574]" />
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="gap-0">
      <CardContent className="px-4 py-3 flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-lg shrink-0 overflow-hidden" style={bg}>
          {item.objectUrl && (
            <Image
              fill
              src={item.objectUrl}
              alt={item.caption}
              className="object-cover"
              sizes="48px"
              unoptimized
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("border text-[10px] px-1.5 py-0.5", catStyle[item.category])}>
              {catLabel[item.category]}
            </Badge>
            {item.client && <span className="text-xs text-muted">{item.client}</span>}
          </div>
          <p className="text-sm text-foreground mt-0.5 truncate">{item.caption}</p>
          <p className="text-[10px] text-muted mt-0.5">{item.date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.featured && <Star className="w-3.5 h-3.5 text-[#d4a574] fill-[#d4a574]" />}
          {item.postedToIG && <Instagram className="w-3.5 h-3.5 text-muted" />}
          <button className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors">
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Upload dialog                                                       */
/* ------------------------------------------------------------------ */

interface PendingFile {
  file: File;
  objectUrl: string;
}

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (items: Omit<MediaItem, "id">[]) => void;
}

function UploadDialog({ open, onClose, onUpload }: UploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [caption, setCaption] = useState("");
  const [client, setClient] = useState("");
  const [category, setCategory] = useState<MediaCategory>("lash");
  const [dragging, setDragging] = useState(false);

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
    const today = todayLabel();
    const newItems: Omit<MediaItem, "id">[] = pending.map((p) => ({
      objectUrl: p.objectUrl,
      category,
      caption: caption || p.file.name.replace(/\.[^.]+$/, ""),
      client: client || undefined,
      date: today,
      featured: false,
      postedToIG: false,
      tags: [],
    }));
    onUpload(newItems);
    // reset
    setPending([]);
    setCaption("");
    setClient("");
    setCategory("lash");
    onClose();
  }

  function handleClose() {
    pending.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    setPending([]);
    setCaption("");
    setClient("");
    setCategory("lash");
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
            <option value="events">Events</option>
            <option value="bts">BTS</option>
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

        <Field label="Client name" hint="Optional — used for internal labeling only">
          <Input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. Sarah M."
          />
        </Field>
      </div>

      <DialogFooter
        onCancel={handleClose}
        onConfirm={handleConfirm}
        confirmLabel={`Upload ${pending.length > 0 ? `${pending.length} photo${pending.length > 1 ? "s" : ""}` : ""}`}
        disabled={pending.length === 0}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>(MOCK_MEDIA);
  const [category, setCategory] = useState<"all" | MediaCategory>("all");
  const [gridView, setGridView] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtered = media.filter((m) => {
    if (category !== "all" && m.category !== category) return false;
    if (featured && !m.featured) return false;
    return true;
  });

  function handleUpload(newItems: Omit<MediaItem, "id">[]) {
    const maxId = media.reduce((max, m) => Math.max(max, m.id), 0);
    const withIds: MediaItem[] = newItems.map((item, i) => ({ ...item, id: maxId + i + 1 }));
    setMedia((prev) => [...withIds, ...prev]);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Media</h1>
          <p className="text-sm text-muted mt-0.5">
            Portfolio photos organized by service and client
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
          onClick={() => setFeatured(!featured)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            featured
              ? "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/25"
              : "text-muted border-transparent hover:text-foreground",
          )}
        >
          <Star className={cn("w-3 h-3", featured && "fill-[#d4a574] text-[#d4a574]")} />
          Featured only
        </button>
        <span className="text-xs text-muted ml-auto flex items-center gap-1">
          <Filter className="w-3 h-3" /> {filtered.length} items
        </span>
      </div>

      {/* Grid view */}
      {gridView ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
          {filtered.map((item) => (
            <MediaTile key={item.id} item={item} grid={true} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <MediaTile key={item.id} item={item} grid={false} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-muted">No media matches your filters.</p>
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  );
}
