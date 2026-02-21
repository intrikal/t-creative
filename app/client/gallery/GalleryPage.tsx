"use client";

import { useState } from "react";
import { X, Sparkles, Gem, Heart, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & data                                                        */
/* ------------------------------------------------------------------ */

type GalleryCategory = "lash" | "jewelry" | "crochet";

interface GalleryItem {
  id: number;
  category: GalleryCategory;
  title: string;
  caption: string;
  palette: string; // Tailwind bg color for placeholder
  accentColor: string;
}

const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 1,
    category: "lash",
    title: "Classic Full Set",
    caption: "Natural, fluffy, J-curl — 10–12mm mix",
    palette: "bg-[#c4907a]/15",
    accentColor: "text-[#c4907a]",
  },
  {
    id: 2,
    category: "lash",
    title: "Mega Volume Set",
    caption: "20D fans, 14mm C-curl — dramatic finish",
    palette: "bg-[#b07d6a]/15",
    accentColor: "text-[#b07d6a]",
  },
  {
    id: 3,
    category: "jewelry",
    title: "Gold Box Chain Bracelet",
    caption: "14k gold-filled · permanently welded",
    palette: "bg-[#d4a574]/15",
    accentColor: "text-[#a07040]",
  },
  {
    id: 4,
    category: "lash",
    title: "Wispy Hybrid Set",
    caption: "Spiky top coat over classic base — CC curl",
    palette: "bg-[#c4907a]/20",
    accentColor: "text-[#c4907a]",
  },
  {
    id: 5,
    category: "jewelry",
    title: "Matching Bracelet + Anklet",
    caption: "Rope chain set · 14k gold-filled",
    palette: "bg-[#e8c99a]/20",
    accentColor: "text-[#a07040]",
  },
  {
    id: 6,
    category: "crochet",
    title: "Boho Box Braids",
    caption: "Distressed ends · shoulder length",
    palette: "bg-[#7ba3a3]/15",
    accentColor: "text-[#4a7a7a]",
  },
  {
    id: 7,
    category: "jewelry",
    title: "Delicate Necklace",
    caption: 'Fine box chain · 16" gold-filled',
    palette: "bg-[#d4a574]/20",
    accentColor: "text-[#a07040]",
  },
  {
    id: 8,
    category: "lash",
    title: "Cat-Eye Classic Set",
    caption: "Lifted outer corners · 13mm tip",
    palette: "bg-[#c4907a]/12",
    accentColor: "text-[#c4907a]",
  },
  {
    id: 9,
    category: "crochet",
    title: "Goddess Locs",
    caption: "Wavy bohemian locs · waist length",
    palette: "bg-[#6a9090]/15",
    accentColor: "text-[#4a7a7a]",
  },
  {
    id: 10,
    category: "lash",
    title: "Natural Kim K Set",
    caption: "Dense inner corners · open eye effect",
    palette: "bg-[#b87060]/15",
    accentColor: "text-[#c4907a]",
  },
  {
    id: 11,
    category: "jewelry",
    title: "Anklet Stack",
    caption: "Three-chain stack · mixed sizes",
    palette: "bg-[#e0b880]/15",
    accentColor: "text-[#a07040]",
  },
  {
    id: 12,
    category: "crochet",
    title: "Knotless Box Braids",
    caption: "Medium size · mid-back length",
    palette: "bg-[#7ba3a3]/20",
    accentColor: "text-[#4a7a7a]",
  },
];

const CAT_CONFIG: Record<
  GalleryCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bg: string;
    text: string;
    border: string;
  }
> = {
  lash: {
    label: "Lash",
    icon: Sparkles,
    bg: "bg-[#c4907a]/12",
    text: "text-[#c4907a]",
    border: "border-[#c4907a]/20",
  },
  jewelry: {
    label: "Jewelry",
    icon: Gem,
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/20",
  },
  crochet: {
    label: "Crochet",
    icon: Heart,
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4a7a7a]",
    border: "border-[#7ba3a3]/20",
  },
};

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

        {/* Image placeholder */}
        <div className={cn("w-full aspect-square flex items-center justify-center", item.palette)}>
          <CatIcon className={cn("w-16 h-16 opacity-25", item.accentColor)} />
        </div>

        {/* Caption */}
        <div className="px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="text-xs text-muted mt-0.5">{item.caption}</p>
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

export function ClientGalleryPage() {
  const [categoryFilter, setCategoryFilter] = useState<"all" | GalleryCategory>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filtered =
    categoryFilter === "all"
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter((i) => i.category === categoryFilter);

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

      {/* Category filter */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 w-fit">
        {(["all", "lash", "jewelry", "crochet"] as const).map((f) => {
          const cfg = f !== "all" ? CAT_CONFIG[f] : null;
          const Icon = cfg?.icon;
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
              {Icon && <Icon className="w-3 h-3" />}
              {f === "all" ? "All" : cfg!.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {filtered.map((item) => {
          const cat = CAT_CONFIG[item.category];
          const CatIcon = cat.icon;
          return (
            <button
              key={item.id}
              onClick={() => openLightbox(item)}
              className="group relative rounded-xl overflow-hidden border border-border hover:border-foreground/20 transition-all"
            >
              {/* Placeholder image */}
              <div
                className={cn(
                  "w-full aspect-square flex items-center justify-center transition-transform duration-300 group-hover:scale-105",
                  item.palette,
                )}
              >
                <CatIcon className={cn("w-8 h-8 opacity-30", item.accentColor)} />
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Bottom label */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-2 translate-y-full group-hover:translate-y-0 transition-transform">
                <p className="text-[11px] font-medium text-white leading-snug">{item.title}</p>
              </div>
            </button>
          );
        })}
      </div>

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
