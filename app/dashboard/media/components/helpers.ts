/**
 * helpers.ts
 * Shared constants, types, and utility functions for the media module.
 */

import type { MediaCategory } from "@/app/dashboard/media/actions";

export type FilterCategory = "all" | MediaCategory;

export const CATEGORIES: { value: FilterCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lash", label: "Lash" },
  { value: "jewelry", label: "Jewelry" },
  { value: "crochet", label: "Crochet" },
  { value: "consulting", label: "Consulting" },
];

export const catLabel: Record<MediaCategory, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
};

export const catStyle: Record<MediaCategory, string> = {
  lash: "bg-[#c4907a]/12 text-[#96604a] border-[#c4907a]/20",
  jewelry: "bg-[#d4a574]/12 text-[#a07040] border-[#d4a574]/20",
  crochet: "bg-[#7ba3a3]/12 text-[#4a7a7a] border-[#7ba3a3]/20",
  consulting: "bg-[#5b8a8a]/12 text-[#3a6a6a] border-[#5b8a8a]/20",
};

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export interface PendingFile {
  file: File;
  objectUrl: string;
}
