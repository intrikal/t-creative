/**
 * ProductThumb -- category-coloured placeholder thumbnail shown on product
 * cards and in the product detail modal.
 *
 * @see ./shop-helpers.ts  (getCatConfig)
 * @see ./ProductCard.tsx
 * @see ./ProductModal.tsx
 */
"use client";

import { cn } from "@/lib/utils";
import { getCatConfig } from "./shop-helpers";

export function ProductThumb({ category, available }: { category: string; available: boolean }) {
  const cat = getCatConfig(category);
  const Icon = cat.icon;
  return (
    <div
      className={cn(
        "w-full aspect-[4/3] rounded-xl flex items-center justify-center mb-4",
        cat.iconBg,
        !available && "opacity-50",
      )}
    >
      <Icon className={cn("w-10 h-10 opacity-40", cat.text)} />
    </div>
  );
}
