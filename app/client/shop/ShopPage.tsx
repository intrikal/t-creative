"use client";

import { useState } from "react";
import {
  ShoppingCart,
  X,
  Plus,
  Minus,
  Package,
  Sparkles,
  Gem,
  Shirt,
  Heart,
  CheckCircle2,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & data                                                        */
/* ------------------------------------------------------------------ */

type ProductCategory = "aftercare" | "jewelry" | "crochet" | "merch";

interface JewelryVariant {
  id: string;
  name: string;
  priceLabel: string;
  price: number;
}

interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  description: string;
  longDescription: string;
  priceLabel: string;
  price: number;
  inStock: boolean;
  tags: string[];
  variants?: JewelryVariant[];
}

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Lash Aftercare Kit",
    category: "aftercare",
    description: "Cleanser + spoolie set — everything you need post-appointment.",
    longDescription:
      "Our signature aftercare kit includes a 60ml oil-free lash foam cleanser, 5 disposable spoolies, and a printed aftercare card. Designed to extend the life of your extensions and keep your natural lashes healthy. Recommended for all new lash clients.",
    priceLabel: "$18",
    price: 18,
    inStock: true,
    tags: ["aftercare", "lash", "kit"],
  },
  {
    id: 2,
    name: "T Creative Lash Cleanser",
    category: "aftercare",
    description: "Private label foam cleanser, 60ml. Oil-free formula.",
    longDescription:
      "Gentle foaming cleanser formulated specifically for lash extensions. Removes makeup, oil, and debris without weakening the adhesive bond. Fragrance-free, ophthalmologist tested. 60ml bottle — approximately 60 uses.",
    priceLabel: "$14",
    price: 14,
    inStock: true,
    tags: ["cleanser", "aftercare"],
  },
  {
    id: 3,
    name: "Custom Permanent Jewelry",
    category: "jewelry",
    description: "14k gold-filled chains welded on-site. Price varies by style.",
    longDescription:
      "Choose your chain style and length — our artist welds it on-site for a perfect, clasp-free fit. Available as bracelets, anklets, or necklaces. All chains are 14k gold-filled, nickel-free, and waterproof. Booking required for permanent jewelry services.",
    priceLabel: "From $55",
    price: 55,
    inStock: true,
    tags: ["permanent", "jewelry", "custom"],
    variants: [
      { id: "bracelet-box", name: "Bracelet — Box Chain", priceLabel: "$55", price: 55 },
      { id: "bracelet-rope", name: "Bracelet — Rope Chain", priceLabel: "$60", price: 60 },
      { id: "anklet-box", name: "Anklet — Box Chain", priceLabel: "$60", price: 60 },
      { id: "anklet-rope", name: "Anklet — Rope Chain", priceLabel: "$65", price: 65 },
      { id: "necklace-box", name: "Necklace — Box Chain", priceLabel: "$75", price: 75 },
      { id: "necklace-rope", name: "Necklace — Rope Chain", priceLabel: "$80", price: 80 },
    ],
  },
  {
    id: 4,
    name: "Jewelry Matching Set",
    category: "jewelry",
    description: "Coordinating bracelet + anklet combo. Perfect for gifting.",
    longDescription:
      "A curated matching set: one bracelet and one anklet in the same chain style, welded on-site. Both pieces are 14k gold-filled. The perfect gift for yourself or someone special — appointment required.",
    priceLabel: "From $110",
    price: 110,
    inStock: true,
    tags: ["matching", "jewelry", "gift"],
    variants: [
      { id: "set-box", name: "Box Chain Set (Bracelet + Anklet)", priceLabel: "$110", price: 110 },
      {
        id: "set-rope",
        name: "Rope Chain Set (Bracelet + Anklet)",
        priceLabel: "$120",
        price: 120,
      },
    ],
  },
  {
    id: 5,
    name: "Custom Crochet Set",
    category: "crochet",
    description: "Fully custom crochet install. Price depends on style and length.",
    longDescription:
      "Book a consultation to discuss your desired style, length, and hair type. We use high-quality crochet hair and our installs are designed to last 4–6 weeks with proper care. Pricing is determined after your consultation call.",
    priceLabel: "$80–$220",
    price: 80,
    inStock: true,
    tags: ["crochet", "custom", "hair"],
  },
  {
    id: 6,
    name: "T Creative Tote Bag",
    category: "merch",
    description: "Canvas tote with TC logo. Limited run — only 3 left.",
    longDescription:
      'Heavy-duty canvas tote in natural with the T Creative logo screen printed in muted black. 15" x 16" with 5" gusset. Great for the studio, the market, or everyday carry. This is a limited run — once they\'re gone, they\'re gone.',
    priceLabel: "$28",
    price: 28,
    inStock: true,
    tags: ["merch", "tote", "limited"],
  },
  {
    id: 7,
    name: "Lash Spoolie Set (5pk)",
    category: "aftercare",
    description: "Disposable mascara wands for lash maintenance between fills.",
    longDescription:
      "A pack of 5 disposable spoolies — the exact style used in the studio. Use one per brushing session to keep your lashes looking fresh. Replace weekly or whenever the bristles look worn.",
    priceLabel: "$5",
    price: 5,
    inStock: false,
    tags: ["spoolie", "lash", "aftercare"],
  },
];

const CAT_CONFIG: Record<
  ProductCategory,
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

type CartItem = { product: Product; qty: number; variantId?: string };

interface PastOrder {
  id: string;
  date: string;
  items: string;
  total: string;
  status: "completed" | "pending" | "ready";
}

const PAST_ORDERS: PastOrder[] = [
  {
    id: "ORD-0031",
    date: "Jan 18, 2026",
    items: "Lash Aftercare Kit × 1",
    total: "$18",
    status: "completed",
  },
  {
    id: "ORD-0024",
    date: "Dec 2, 2025",
    items: "T Creative Lash Cleanser × 2",
    total: "$28",
    status: "completed",
  },
  {
    id: "ORD-0019",
    date: "Oct 14, 2025",
    items: "Lash Spoolie Set × 1 · Lash Cleanser × 1",
    total: "$19",
    status: "completed",
  },
];

const STATUS_CONFIG = {
  completed: {
    label: "Picked up",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
  },
  pending: {
    label: "Pending",
    color: "text-[#a07040]",
    bg: "bg-[#d4a574]/10",
    border: "border-[#d4a574]/20",
  },
  ready: {
    label: "Ready for pickup",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
  },
};

/* ------------------------------------------------------------------ */
/*  Product image placeholder                                           */
/* ------------------------------------------------------------------ */

function ProductThumb({ category, inStock }: { category: ProductCategory; inStock: boolean }) {
  const { iconBg, icon: Icon, text } = CAT_CONFIG[category];
  return (
    <div
      className={cn(
        "w-full aspect-[4/3] rounded-xl flex items-center justify-center mb-4",
        iconBg,
        !inStock && "opacity-50",
      )}
    >
      <Icon className={cn("w-10 h-10 opacity-40", text)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cart drawer                                                         */
/* ------------------------------------------------------------------ */

function CartDrawer({
  items,
  onClose,
  onUpdateQty,
  onCheckout,
}: {
  items: CartItem[];
  onClose: () => void;
  onUpdateQty: (id: number, qty: number, variantId?: string) => void;
  onCheckout: () => void;
}) {
  const total = items.reduce((s, i) => s + i.product.price * i.qty, 0);

  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="flex-1 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="w-80 bg-background border-l border-border flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Cart ({items.length})</p>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">Your cart is empty</p>
            </div>
          ) : (
            items.map(({ product, qty, variantId }) => {
              const variant = product.variants?.find((v) => v.id === variantId);
              return (
                <div
                  key={`${product.id}-${variantId ?? "default"}`}
                  className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {product.name}
                    </p>
                    {variant && <p className="text-[11px] text-muted mt-0.5">{variant.name}</p>}
                    <p className="text-xs text-muted mt-0.5">
                      {variant ? variant.priceLabel : product.priceLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onUpdateQty(product.id, qty - 1, variantId)}
                      className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium text-foreground w-5 text-center">
                      {qty}
                    </span>
                    <button
                      onClick={() => onUpdateQty(product.id, qty + 1, variantId)}
                      className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">Subtotal</p>
              <p className="text-base font-bold text-foreground">${total}</p>
            </div>
            <p className="text-[11px] text-muted">
              Orders are available for pickup at the studio or can be added to your next
              appointment.
            </p>
            <button
              onClick={onCheckout}
              className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Place Order
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Product detail modal                                                */
/* ------------------------------------------------------------------ */

function ProductModal({
  product,
  onClose,
  onAddToCart,
}: {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, variantId?: string) => void;
}) {
  const cat = CAT_CONFIG[product.category];
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(
    product.variants?.[0]?.id,
  );
  const [added, setAdded] = useState(false);

  const activeVariant = product.variants?.find((v) => v.id === selectedVariant);
  const displayPrice = activeVariant ? activeVariant.priceLabel : product.priceLabel;

  function handleAdd() {
    if (!product.inStock) return;
    onAddToCart(product, selectedVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <Dialog open onClose={onClose} title={product.name} size="md">
      <div className="space-y-5">
        <ProductThumb category={product.category} inStock={product.inStock} />

        <div className="flex items-center justify-between gap-3">
          <Badge className={cn("border text-[10px] px-1.5 py-0.5", cat.bg, cat.text, cat.border)}>
            {cat.label}
          </Badge>
          {!product.inStock && (
            <span className="text-xs font-medium text-destructive">Out of stock</span>
          )}
        </div>

        <p className="text-sm text-foreground leading-relaxed">{product.longDescription}</p>

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

        {/* Jewelry variants */}
        {product.variants && product.variants.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Choose Style</p>
            <div className="grid grid-cols-1 gap-1.5">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors",
                    selectedVariant === variant.id
                      ? "border-accent bg-accent/5 text-foreground"
                      : "border-border text-muted hover:text-foreground hover:border-foreground/20",
                  )}
                >
                  <span className="text-xs font-medium">{variant.name}</span>
                  <span className="text-xs font-bold text-foreground">{variant.priceLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
          <p className="text-xl font-bold text-foreground">{displayPrice}</p>
          {product.inStock ? (
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
          ) : (
            <span className="text-sm font-medium text-muted">Currently unavailable</span>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientShopPage() {
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ProductCategory>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered =
    categoryFilter === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === categoryFilter);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(product: Product, variantId?: string) {
    setCart((prev) => {
      const key = `${product.id}-${variantId ?? "default"}`;
      const existing = prev.find((i) => i.product.id === product.id && i.variantId === variantId);
      if (existing)
        return prev.map((i) =>
          i.product.id === product.id && i.variantId === variantId ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...prev, { product, qty: 1, variantId }];
    });
  }

  function updateQty(id: number, qty: number, variantId?: string) {
    if (qty <= 0)
      setCart((prev) => prev.filter((i) => !(i.product.id === id && i.variantId === variantId)));
    else
      setCart((prev) =>
        prev.map((i) => (i.product.id === id && i.variantId === variantId ? { ...i, qty } : i)),
      );
  }

  function handleCheckout() {
    setCart([]);
    setCartOpen(false);
    setOrdered(true);
    setTimeout(() => setOrdered(false), 5000);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Shop</h1>
          <p className="text-sm text-muted mt-0.5">Products from T Creative Studio</p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-surface text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          Cart
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Order confirmed banner */}
      {ordered && (
        <div className="bg-[#4e6b51]/10 border border-[#4e6b51]/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Package className="w-4 h-4 text-[#4e6b51] shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">Order placed!</span> T Creative Studio will confirm your
            order within 24 hours. Pickup available at the studio.
          </p>
        </div>
      )}

      {/* Products / Orders tab toggle */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 w-fit">
        {(["products", "orders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {t === "products" ? "Products" : "Order History"}
          </button>
        ))}
      </div>

      {/* ── Products tab ── */}
      {tab === "products" && (
        <>
          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {(["all", "aftercare", "jewelry", "crochet", "merch"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setCategoryFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  categoryFilter === f
                    ? "bg-foreground/8 text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {f === "all" ? "All Products" : CAT_CONFIG[f].label}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((product) => {
              const cat = CAT_CONFIG[product.category];
              const inCart = cart.find((i) => i.product.id === product.id);
              return (
                <Card
                  key={product.id}
                  className={cn(
                    "gap-0 flex flex-col h-full cursor-pointer group",
                    !product.inStock && "opacity-60",
                  )}
                  onClick={() => setSelectedProduct(product)}
                >
                  <CardContent className="px-4 pt-4 pb-4 flex flex-col h-full">
                    <ProductThumb category={product.category} inStock={product.inStock} />
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-accent transition-colors">
                        {product.name}
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
                    {product.variants && (
                      <p className="text-[10px] text-muted/60 mt-1">
                        {product.variants.length} styles available
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/50">
                      <span className="text-base font-bold text-foreground">
                        {product.priceLabel}
                      </span>
                      {!product.inStock ? (
                        <span className="text-xs text-destructive font-medium">Out of stock</span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (product.variants) {
                              setSelectedProduct(product);
                            } else {
                              addToCart(product);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            inCart && !product.variants
                              ? "bg-[#4e6b51] text-white"
                              : "bg-accent text-white hover:bg-accent/90",
                          )}
                        >
                          {inCart && !product.variants ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> In cart
                            </>
                          ) : product.variants ? (
                            <>
                              Choose style <ChevronRight className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-3 h-3" /> Add
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── Orders tab ── */}
      {tab === "orders" && (
        <div className="space-y-3">
          {PAST_ORDERS.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-2xl">
              <Package className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">No orders yet</p>
            </div>
          ) : (
            PAST_ORDERS.map((order) => {
              const s = STATUS_CONFIG[order.status];
              return (
                <Card key={order.id} className="gap-0">
                  <CardContent className="px-5 py-4 flex items-center gap-4">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        order.status === "completed" ? "bg-[#4e6b51]/10" : "bg-accent/10",
                      )}
                    >
                      {order.status === "completed" ? (
                        <CheckCircle2 className="w-4 h-4 text-[#4e6b51]" />
                      ) : (
                        <Clock className="w-4 h-4 text-accent" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{order.id}</p>
                        <span
                          className={cn(
                            "text-[10px] font-medium border px-1.5 py-0.5 rounded-full",
                            s.color,
                            s.bg,
                            s.border,
                          )}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">{order.items}</p>
                      <p className="text-[11px] text-muted/60 mt-0.5">{order.date}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground shrink-0">{order.total}</p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          items={cart}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateQty}
          onCheckout={handleCheckout}
        />
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(p, v) => {
            addToCart(p, v);
            setSelectedProduct(null);
            setCartOpen(true);
          }}
        />
      )}
    </div>
  );
}
