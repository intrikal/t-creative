/**
 * ProductModal -- full-detail dialog for a single shop product with an
 * "Add to cart" button and tag listing.
 *
 * @see ../ShopPage.tsx  (parent)
 * @see ./shop-helpers.ts
 * @see ./ProductThumb.tsx
 */
"use client";

import { useState } from "react";
import { ShoppingCart, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type ShopProduct } from "@/app/shop/actions";
import { getCatConfig, canAddToCart, priceLabel } from "./shop-helpers";
import { ProductThumb } from "./ProductThumb";

export function ProductModal({
  product,
  onClose,
  onAddToCart,
}: {
  product: ShopProduct;
  onClose: () => void;
  onAddToCart: (product: ShopProduct) => void;
}) {
  const cat = getCatConfig(product.category);
  const [added, setAdded] = useState(false);
  const available = canAddToCart(product);

  function handleAdd() {
    if (!available) return;
    onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <Dialog open onClose={onClose} title={product.title} size="md">
      <div className="space-y-5">
        <ProductThumb category={product.category} available={available} />

        <div className="flex items-center justify-between gap-3">
          <Badge className={cn("border text-[10px] px-1.5 py-0.5", cat.bg, cat.text, cat.border)}>
            {cat.label}
          </Badge>
          {product.availability === "out_of_stock" && (
            <span className="text-xs font-medium text-destructive">Out of stock</span>
          )}
        </div>

        {product.description && (
          <p className="text-sm text-foreground leading-relaxed">{product.description}</p>
        )}

        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-surface border border-border text-muted/60 px-1.5 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
          <p className="text-xl font-bold text-foreground">{priceLabel(product)}</p>
          {available ? (
            <button
              onClick={handleAdd}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                added ? "bg-[#4e6b51] text-white" : "bg-accent text-white hover:bg-accent/90",
              )}
            >
              {added ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Added to cart
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" /> Add to cart
                </>
              )}
            </button>
          ) : product.availability === "out_of_stock" ? (
            <span className="text-sm font-medium text-muted">Currently unavailable</span>
          ) : (
            <a href="/contact" className="text-sm font-medium text-accent hover:underline">
              Inquire
            </a>
          )}
        </div>
      </div>
    </Dialog>
  );
}
