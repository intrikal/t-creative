/**
 * lib/types/media.types.ts
 * Shared types for the media library.
 * Source: app/dashboard/media/actions.ts
 */

export type MediaCategory = "lash" | "jewelry" | "crochet" | "consulting";

export type MediaRow = {
  id: number;
  type: "image" | "video" | "before_after";
  category: MediaCategory | null;
  client: string | null;
  title: string | null;
  caption: string | null;
  publicUrl: string | null;
  storagePath: string;
  fileSizeBytes: number | null;
  isPublished: boolean;
  isFeatured: boolean;
  date: string;
};

export type MediaStats = {
  total: number;
  published: number;
  featured: number;
  totalSizeBytes: number;
};
