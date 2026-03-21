/**
 * ProductsTab — Category-filterable grid of product cards.
 *
 * Renders a row of filter buttons (All, Lash Supplies, Jewelry, etc.)
 * and a responsive grid of ProductCard instances. When no products
 * match the active filter, shows an empty-state with a create CTA.
 */
"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductRow, ProductCategory } from "../actions";
import { CATEGORY_CONFIG } from "./helpers";
import { ProductCard } from "./ProductCard";

export function ProductsTab({
  products,
  filter,
  onFilterChange,
  pendingIds,
  onNew,
  onEdit,
  onDelete,
  onToggle,
}: {
  products: ProductRow[];
  filter: "all" | ProductCategory;
  onFilterChange: (f: "all" | ProductCategory) => void;
  pendingIds: Set<string>;
  onNew: () => void;
  onEdit: (p: ProductRow) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number) => void;
}) {
  // filter: when "all" is selected, show every product; otherwise narrow
  // to the chosen category so the admin can focus on one product line
  const filtered = filter === "all" ? products : products.filter((p) => p.category === filter);

  return (
    <>
      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        {/* map: render one filter pill per category, plus "All".
            The array is const-asserted so TS infers literal union types. */}
        {(["all", "lash-supplies", "jewelry", "crochet", "aftercare", "merch"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === f
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : CATEGORY_CONFIG[f as ProductCategory].label}
            </button>
          ),
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted">
            {products.length === 0 ? "No products yet." : "No products in this category."}
          </p>
          <button onClick={onNew} className="mt-2 text-sm text-accent hover:underline">
            + Add your first product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isPending={pendingIds.has(`p-${p.id}`)}
              onEdit={() => onEdit(p)}
              onDelete={() => onDelete(p.id)}
              onToggle={() => onToggle(p.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
