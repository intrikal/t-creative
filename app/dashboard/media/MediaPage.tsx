"use client";

import { useState, useTransition } from "react";
import { Upload, Grid, List, Star, Filter, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaRow, MediaStats } from "@/lib/types/media.types";
import { togglePublish, toggleFeatured, deleteMediaItem } from "./actions";
import { CATEGORIES, formatBytes } from "./components/helpers";
import type { FilterCategory } from "./components/helpers";
import { MediaTile } from "./components/MediaTile";
import { UploadDialog } from "./components/UploadDialog";

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function MediaPage({
  initialItems,
  stats,
  embedded,
}: {
  initialItems: MediaRow[];
  stats: MediaStats;
  embedded?: boolean;
}) {
  const [category, setCategory] = useState<FilterCategory>("all");
  const [gridView, setGridView] = useState(true);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [, startTransition] = useTransition();
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
    <div className={cn("max-w-7xl mx-auto w-full space-y-5", embedded ? "" : "p-4 md:p-6 lg:p-8")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {!embedded && (
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Media</h1>
            <p className="text-sm text-muted mt-0.5">
              {stats.total} items · {stats.published} published · {stats.featured} featured
              {stats.totalSizeBytes > 0 && ` · ${formatBytes(stats.totalSizeBytes)}`}
            </p>
          </div>
        )}
        {embedded && (
          <p className="text-sm text-muted">
            {stats.total} items · {stats.published} published · {stats.featured} featured
          </p>
        )}
        <div className="flex items-center gap-2 ml-auto">
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
