/**
 * ProductCard -- shared product card used in both the "Products" and "Saved"
 * grids so the card layout is defined in one place.
 *
 * @see ../ShopPage.tsx  (parent)
 * @see ./shop-helpers.ts
 * @see ./ProductThumb.tsx
 */
"use client";

import { Heart, ShoppingCart, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type ShopProduct } from "@/app/shop/actions";
import { getCatConfig, canAddToCart, priceLabel } from "./shop-helpers";
import { ProductThumb } from "./ProductThumb";

export function ProductCard({
  product,
  isSaved,
  inCart,
  onToggleWishlist,
  onAddToCart,
  onClick,
}: {
  product: ShopProduct;
  isSaved: boolean;
  inCart: boolean;
  onToggleWishlist: (e: React.MouseEvent, product: ShopProduct) => void;
  onAddToCart: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const cat = getCatConfig(product.category);
  const available = canAddToCart(product);

  return (
    <Card
      className={cn(
        "gap-0 flex flex-col h-full cursor-pointer group",
        !available && "opacity-60",
      )}
      onClick={onClick}
    >
      <CardContent className="px-4 pt-4 pb-4 flex flex-col h-full">
        <div className="relative">
          <ProductThumb category={product.category} available={available} />
          <button
            onClick={(e) => onToggleWishlist(e, product)}
            className={cn(
              "absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors",
              isSaved
                ? "bg-rose-50 text-rose-500"
                : "bg-background/80 text-muted hover:text-rose-400",
            )}
            aria-label={isSaved ? "Remove from saved" : "Save product"}
          >
            <Heart
              className="w-3.5 h-3.5"
              fill={isSaved ? "currentColor" : "none"}
            />
          </button>
        </div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-accent transition-colors">
            {product.title}
          </h3>
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
        <p className="text-xs text-muted leading-relaxed flex-1">
          {product.description}
        </p>
        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/50">
          <span className="text-base font-bold text-foreground">
            {priceLabel(product)}
          </span>
          {product.availability === "out_of_stock" ? (
            <span className="text-xs text-destructive font-medium">Out of stock</span>
          ) : available ? (
            <button
              onClick={onAddToCart}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                inCart
                  ? "bg-[#4e6b51] text-white"
                  : "bg-accent text-white hover:bg-accent/90",
              )}
            >
              {inCart ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> In cart
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3 h-3" /> Add
                </>
              )}
            </button>
          ) : (
            <a
              href="/contact"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium text-accent hover:underline"
            >
              Inquire <ChevronRight className="w-3 h-3 inline" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
