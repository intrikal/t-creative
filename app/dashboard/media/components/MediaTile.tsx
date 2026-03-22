/**
 * MediaTile.tsx
 * Renders a single media item in either grid or list view layout.
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Eye, EyeOff, ImagePlus, Trash2, MoreHorizontal } from "lucide-react";
import type { MediaRow } from "@/lib/types/media.types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { catLabel, catStyle } from "./helpers";

export function MediaTile({
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
