"use client";

import { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  Gem,
  Heart,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Camera,
  ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GalleryItem, GalleryCategory, ClientGalleryData } from "./actions";

/* ------------------------------------------------------------------ */
/*  Config                                                              */
/* ------------------------------------------------------------------ */

const CAT_CONFIG: Record<
  GalleryCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bg: string;
    text: string;
    border: string;
    placeholder: string;
    accentColor: string;
  }
> = {
  lash: {
    label: "Lash",
    icon: Sparkles,
    bg: "bg-[#c4907a]/12",
    text: "text-[#c4907a]",
    border: "border-[#c4907a]/20",
    placeholder: "bg-[#c4907a]/15",
    accentColor: "text-[#c4907a]",
  },
  jewelry: {
    label: "Jewelry",
    icon: Gem,
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/20",
    placeholder: "bg-[#d4a574]/15",
    accentColor: "text-[#a07040]",
  },
  crochet: {
    label: "Crochet",
    icon: Heart,
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4a7a7a]",
    border: "border-[#7ba3a3]/20",
    placeholder: "bg-[#7ba3a3]/15",
    accentColor: "text-[#4a7a7a]",
  },
  consulting: {
    label: "Consulting",
    icon: Briefcase,
    bg: "bg-[#8b7bb5]/12",
    text: "text-[#6a5a9e]",
    border: "border-[#8b7bb5]/20",
    placeholder: "bg-[#8b7bb5]/15",
    accentColor: "text-[#6a5a9e]",
  },
};

/* ------------------------------------------------------------------ */
/*  Gallery thumbnail                                                   */
/* ------------------------------------------------------------------ */

function GalleryThumb({ item, onClick }: { item: GalleryItem; onClick: () => void }) {
  const cat = CAT_CONFIG[item.category];
  const CatIcon = cat.icon;

  return (
    <button
      onClick={onClick}
      className="group relative rounded-xl overflow-hidden border border-border hover:border-foreground/20 transition-all"
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.title || item.caption}
          className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div
          className={cn(
            "w-full aspect-square flex items-center justify-center transition-transform duration-300 group-hover:scale-105",
            cat.placeholder,
          )}
        >
          <CatIcon className={cn("w-8 h-8 opacity-30", cat.accentColor)} />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Featured badge */}
      {item.isFeatured && (
        <div className="absolute top-2 left-2">
          <Badge className="bg-[#d4a574]/90 text-white border-0 text-[9px] px-1.5 py-0">
            Featured
          </Badge>
        </div>
      )}

      {/* Before/after badge */}
      {item.type === "before_after" && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-foreground/70 text-background border-0 text-[9px] px-1.5 py-0">
            B / A
          </Badge>
        </div>
      )}

      {/* Bottom label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-2 translate-y-full group-hover:translate-y-0 transition-transform">
        <p className="text-[11px] font-medium text-white leading-snug">{item.title}</p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Lightbox                                                            */
/* ------------------------------------------------------------------ */

function Lightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = items[index];
  const cat = CAT_CONFIG[item.category];
  const CatIcon = cat.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-background border border-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-background/80 border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Nav arrows */}
        {index > 0 && (
          <button
            onClick={onPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {index < items.length - 1 && (
          <button
            onClick={onNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Image or placeholder */}
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title || item.caption}
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div
            className={cn("w-full aspect-square flex items-center justify-center", cat.placeholder)}
          >
            <CatIcon className={cn("w-16 h-16 opacity-25", cat.accentColor)} />
          </div>
        )}

        {/* Caption */}
        <div className="px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            {item.caption && <p className="text-xs text-muted mt-0.5">{item.caption}</p>}
          </div>
          <Badge
            className={cn(
              "border text-[10px] px-1.5 py-0.5 shrink-0",
              cat.bg,
              cat.text,
              cat.border,
            )}
          >
            {cat.label}
          </Badge>
        </div>

        {/* Counter */}
        <div className="px-5 pb-4">
          <p className="text-[11px] text-muted/50">
            {index + 1} of {items.length}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

type Tab = "portfolio" | "my-photos";

export function ClientGalleryPage({ data }: { data: ClientGalleryData }) {
  const [tab, setTab] = useState<Tab>(data.myPhotos.length > 0 ? "my-photos" : "portfolio");
  const [categoryFilter, setCategoryFilter] = useState<"all" | GalleryCategory>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const items = tab === "my-photos" ? data.myPhotos : data.portfolio;

  const filtered = useMemo(
    () => (categoryFilter === "all" ? items : items.filter((i) => i.category === categoryFilter)),
    [items, categoryFilter],
  );

  // Determine which categories exist in the current tab
  const activeCategories = useMemo(() => {
    const cats = new Set<GalleryCategory>();
    for (const item of items) cats.add(item.category);
    return cats;
  }, [items]);

  function openLightbox(item: GalleryItem) {
    const idx = filtered.indexOf(item);
    setLightboxIndex(idx);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Gallery</h1>
        <p className="text-sm text-muted mt-0.5">Lookbook from T Creative Studio</p>
      </div>

      {/* Tab switcher — only show if client has tagged photos */}
      {data.myPhotos.length > 0 && (
        <div className="flex gap-1">
          <button
            onClick={() => {
              setTab("my-photos");
              setCategoryFilter("all");
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              tab === "my-photos" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground",
            )}
          >
            <Camera className="w-3 h-3" />
            My Photos
            <span className="text-[10px] opacity-60">({data.myPhotos.length})</span>
          </button>
          <button
            onClick={() => {
              setTab("portfolio");
              setCategoryFilter("all");
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              tab === "portfolio" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground",
            )}
          >
            <ImageIcon className="w-3 h-3" />
            Portfolio
            <span className="text-[10px] opacity-60">({data.portfolio.length})</span>
          </button>
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setCategoryFilter("all")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            categoryFilter === "all"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted hover:text-foreground",
          )}
        >
          All
        </button>
        {(["lash", "jewelry", "crochet", "consulting"] as const)
          .filter((cat) => activeCategories.has(cat))
          .map((f) => {
            const cfg = CAT_CONFIG[f];
            const Icon = cfg.icon;
            return (
              <button
                key={f}
                onClick={() => setCategoryFilter(f)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  categoryFilter === f
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="w-3 h-3" />
                {cfg.label}
              </button>
            );
          })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl">
          <ImageIcon className="w-8 h-8 text-muted/40 mx-auto mb-2" />
          <p className="text-sm text-muted">
            {items.length === 0
              ? tab === "my-photos"
                ? "No photos from your sessions yet"
                : "No portfolio items yet"
              : "No items in this category"}
          </p>
          {tab === "my-photos" && items.length === 0 && (
            <p className="text-xs text-muted/60 mt-1">
              Photos from your appointments will appear here.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {filtered.map((item) => (
            <GalleryThumb key={item.id} item={item} onClick={() => openLightbox(item)} />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          items={filtered}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() =>
            setLightboxIndex((i) => (i !== null && i < filtered.length - 1 ? i + 1 : i))
          }
        />
      )}
    </div>
  );
}
