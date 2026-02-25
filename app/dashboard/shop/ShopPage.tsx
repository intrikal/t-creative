"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  ExternalLink,
} from "lucide-react";
import { placeOrder, type ShopProduct, type ClientOrder } from "@/app/shop/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCartStore, cartTotalInCents, cartItemCount } from "@/stores/useCartStore";

/* ------------------------------------------------------------------ */
/*  Category config                                                     */
/* ------------------------------------------------------------------ */

type ProductCategory = "aftercare" | "jewelry" | "crochet" | "merch";

const CAT_CONFIG: Record<
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

function getCatConfig(category: string) {
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

const ORDER_STATUS_CONFIG: Record<
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

function canAddToCart(p: ShopProduct): boolean {
  return p.pricingType === "fixed_price" && !!p.priceInCents && p.availability !== "out_of_stock";
}

function priceLabel(p: ShopProduct): string {
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

/* ------------------------------------------------------------------ */
/*  Product image placeholder                                           */
/* ------------------------------------------------------------------ */

function ProductThumb({ category, available }: { category: string; available: boolean }) {
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

/* ------------------------------------------------------------------ */
/*  Cart drawer                                                         */
/* ------------------------------------------------------------------ */

function CartDrawer({
  onClose,
  onCheckout,
  checkingOut,
}: {
  onClose: () => void;
  onCheckout: (method: "pickup_cash" | "pickup_online") => void;
  checkingOut: boolean;
}) {
  const { items, updateQuantity, removeItem } = useCartStore();
  const total = cartTotalInCents(items);
  const count = cartItemCount(items);

  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="flex-1 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="w-80 bg-background border-l border-border flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Cart ({count})</p>
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
            items.map((item) => (
              <div
                key={item.productId}
                className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
                  <p className="text-xs text-muted mt-0.5">
                    ${(item.priceInCents / 100).toFixed(0)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() =>
                      item.quantity <= 1
                        ? removeItem(item.productId)
                        : updateQuantity(item.productId, item.quantity - 1)
                    }
                    className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-medium text-foreground w-5 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">Subtotal</p>
              <p className="text-base font-bold text-foreground">${(total / 100).toFixed(0)}</p>
            </div>
            <p className="text-[11px] text-muted">
              Orders are available for pickup at the studio or can be added to your next
              appointment.
            </p>
            <button
              onClick={() => onCheckout("pickup_online")}
              disabled={checkingOut}
              className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {checkingOut ? "Placing order…" : "Pay Now"}
            </button>
            <button
              onClick={() => onCheckout("pickup_cash")}
              disabled={checkingOut}
              className="w-full py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
            >
              Pick Up & Pay Cash
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

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientShopPage({
  products,
  orders,
}: {
  products: ShopProduct[];
  orders: ClientOrder[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [orderResult, setOrderResult] = useState<{
    orderNumber: string;
    paymentUrl?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const { items, addItem, clearCart } = useCartStore();
  const cartCount = cartItemCount(items);

  const categories = ["all", ...new Set(products.map((p) => p.category))];
  const filtered =
    categoryFilter === "all" ? products : products.filter((p) => p.category === categoryFilter);

  function handleAddToCart(product: ShopProduct) {
    addItem({
      productId: product.id,
      title: product.title,
      priceInCents: product.priceInCents!,
      imageUrl: product.imageUrl,
    });
  }

  function handleCheckout(method: "pickup_cash" | "pickup_online") {
    startTransition(async () => {
      const result = await placeOrder({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        fulfillmentMethod: method,
      });

      if (result.success) {
        clearCart();
        setCartOpen(false);

        if (result.paymentUrl) {
          // Redirect to Square checkout
          window.open(result.paymentUrl, "_blank");
          setOrderResult({
            orderNumber: result.orderNumber!,
            paymentUrl: result.paymentUrl,
          });
        } else {
          setOrderResult({ orderNumber: result.orderNumber! });
        }

        router.refresh();
        setTimeout(() => setOrderResult(null), 10000);
      }
    });
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
      {orderResult && (
        <div className="bg-[#4e6b51]/10 border border-[#4e6b51]/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Package className="w-4 h-4 text-[#4e6b51] shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-foreground">
              <span className="font-semibold">Order placed!</span>{" "}
              {orderResult.paymentUrl
                ? "Complete your payment to confirm the order."
                : "T Creative Studio will have your order ready for pickup."}
            </p>
            {orderResult.paymentUrl && (
              <a
                href={orderResult.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
              >
                Complete payment <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
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

      {/* Products tab */}
      {tab === "products" && (
        <>
          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {categories.map((f) => (
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
                {f === "all" ? "All Products" : getCatConfig(f).label}
              </button>
            ))}
          </div>

          {/* Product grid */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-2xl">
              <Package className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">No products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((product) => {
                const cat = getCatConfig(product.category);
                const available = canAddToCart(product);
                const inCart = items.some((i) => i.productId === product.id);
                return (
                  <Card
                    key={product.id}
                    className={cn(
                      "gap-0 flex flex-col h-full cursor-pointer group",
                      !available && "opacity-60",
                    )}
                    onClick={() => setSelectedProduct(product)}
                  >
                    <CardContent className="px-4 pt-4 pb-4 flex flex-col h-full">
                      <ProductThumb category={product.category} available={available} />
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product);
                            }}
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
              })}
            </div>
          )}
        </>
      )}

      {/* Orders tab */}
      {tab === "orders" && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-2xl">
              <Package className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">No orders yet</p>
            </div>
          ) : (
            orders.map((order) => {
              const s = ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.accepted;
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
                        <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
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
                      <p className="text-xs text-muted mt-0.5">
                        {order.title}
                        {order.quantity > 1 ? ` × ${order.quantity}` : ""}
                      </p>
                      <p className="text-[11px] text-muted/60 mt-0.5">{order.createdAt}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground shrink-0">
                      {order.finalInCents != null
                        ? `$${(order.finalInCents / 100).toFixed(0)}`
                        : "—"}
                    </p>
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
          onClose={() => setCartOpen(false)}
          onCheckout={handleCheckout}
          checkingOut={isPending}
        />
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(p) => {
            handleAddToCart(p);
            setSelectedProduct(null);
            setCartOpen(true);
          }}
        />
      )}
    </div>
  );
}
