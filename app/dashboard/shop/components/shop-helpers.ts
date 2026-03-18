/**
 * Shop helper utilities -- category config, order status config, pricing, and
 * cart-eligibility helpers shared across all shop components.
 *
 * @see ./ProductCard.tsx
 * @see ./ProductModal.tsx
 * @see ./OrdersList.tsx
 * @see ../ShopPage.tsx
 */

import { Package, Sparkles, Gem, Shirt, Heart } from "lucide-react";
import { type ShopProduct } from "@/app/shop/actions";

/* ------------------------------------------------------------------ */
/*  Category config                                                     */
/* ------------------------------------------------------------------ */

export type ProductCategory = "aftercare" | "jewelry" | "crochet" | "merch";

export const CAT_CONFIG: Record<
  string,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    iconBg: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  aftercare: {
    label: "Aftercare",
    bg: "bg-[#4e6b51]/12",
    text: "text-[#4e6b51]",
    border: "border-[#4e6b51]/20",
    iconBg: "bg-[#4e6b51]/10",
    icon: Sparkles,
  },
  jewelry: {
    label: "Jewelry",
    bg: "bg-[#d4a574]/12",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/20",
    iconBg: "bg-[#d4a574]/10",
    icon: Gem,
  },
  crochet: {
    label: "Crochet",
    bg: "bg-[#7ba3a3]/12",
    text: "text-[#4a7a7a]",
    border: "border-[#7ba3a3]/20",
    iconBg: "bg-[#7ba3a3]/10",
    icon: Heart,
  },
  merch: {
    label: "Merch",
    bg: "bg-accent/12",
    text: "text-accent",
    border: "border-accent/20",
    iconBg: "bg-accent/10",
    icon: Shirt,
  },
};

export function getCatConfig(category: string) {
  return (
    CAT_CONFIG[category] ?? {
      label: category,
      bg: "bg-foreground/8",
      text: "text-foreground",
      border: "border-foreground/15",
      iconBg: "bg-foreground/8",
      icon: Package,
    }
  );
}

/* ------------------------------------------------------------------ */
/*  Order status config                                                 */
/* ------------------------------------------------------------------ */

export const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  accepted: {
    label: "Confirmed",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
  },
  in_progress: {
    label: "Processing",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
  },
  ready: {
    label: "Ready for pickup",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
  },
  completed: {
    label: "Picked up",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export function canAddToCart(p: ShopProduct): boolean {
  return p.pricingType === "fixed_price" && !!p.priceInCents && p.availability !== "out_of_stock";
}

export function priceLabel(p: ShopProduct): string {
  if (p.pricingType === "fixed_price" && p.priceInCents) {
    return `$${(p.priceInCents / 100).toFixed(0)}`;
  }
  if (p.pricingType === "starting_at" && p.priceMinInCents) {
    return `From $${(p.priceMinInCents / 100).toFixed(0)}`;
  }
  if (p.pricingType === "price_range" && p.priceMinInCents && p.priceMaxInCents) {
    return `$${(p.priceMinInCents / 100).toFixed(0)}–$${(p.priceMaxInCents / 100).toFixed(0)}`;
  }
  return "Contact for quote";
}
