"use client";

import { Tag, ToggleLeft, ToggleRight, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProductRow } from "../actions";
import { CATEGORY_CONFIG, statusConfig, priceDisplay, LOW_STOCK_THRESHOLD } from "./helpers";

export function ProductCard({
  product,
  isPending,
  onEdit,
  onDelete,
  onToggle,
}: {
  product: ProductRow;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const cat = CATEGORY_CONFIG[product.category];
  const sts = statusConfig(product.status);
  const isActive = product.status === "active";

  return (
    <Card className={cn("gap-0 h-full", isPending && "opacity-60")}>
      <CardContent className="px-5 pt-5 pb-4 flex flex-col h-full">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug">{product.name}</h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", cat.className)}>
                {cat.label}
              </Badge>
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                {sts.label}
              </Badge>
            </div>
          </div>
          <button
            onClick={onToggle}
            title={isActive ? "Deactivate" : "Activate"}
            className={cn(
              "shrink-0 transition-colors mt-0.5",
              isActive ? "text-[#4e6b51]" : "text-muted",
            )}
          >
            {isActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
          </button>
        </div>
        <p className="text-xs text-muted mt-2.5 leading-relaxed flex-1">{product.description}</p>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
          <span className="text-sm font-semibold text-foreground flex items-center gap-1">
            <Tag className="w-3 h-3 text-muted" />
            {priceDisplay(product)}
          </span>
          {product.stock !== undefined && (
            <span
              className={cn(
                "text-xs",
                product.stock === 0
                  ? "text-destructive"
                  : product.stock <= LOW_STOCK_THRESHOLD
                    ? "text-[#7a5c10]"
                    : "text-muted",
              )}
            >
              {product.stock === 0 ? "Out of stock" : `${product.stock} in stock`}
            </span>
          )}
          <span className="text-xs text-muted ml-auto">{product.sales} sold</span>
        </div>
        <div className="flex items-center gap-1 mt-3">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-foreground/5"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-destructive transition-colors px-2.5 py-1.5 rounded-lg hover:bg-destructive/5 ml-auto"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
