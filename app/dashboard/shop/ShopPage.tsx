"use client";

import { useState, useTransition } from "react";
import { ShoppingCart, Package, Heart, ExternalLink } from "lucide-react";
import {
  placeOrder,
  addToWishlist,
  removeFromWishlist,
  type ShopProduct,
  type ClientOrder,
} from "@/app/shop/actions";
import { type ClientCommission } from "@/lib/types/commission.types";
import { cn } from "@/lib/utils";
import { useCartStore, cartItemCount } from "@/stores/useCartStore";
import { CommissionsTab } from "./CommissionsTab";
import { CartDrawer } from "./components/CartDrawer";
import { OrdersList } from "./components/OrdersList";
import { ProductCard } from "./components/ProductCard";
import { ProductModal } from "./components/ProductModal";
import { getCatConfig } from "./components/shop-helpers";

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientShopPage({
  products,
  orders,
  wishlistIds,
  commissions,
}: {
  products: ShopProduct[];
  orders: ClientOrder[];
  wishlistIds: number[];
  commissions: ClientCommission[];
}) {
  const [tab, setTab] = useState<"products" | "orders" | "saved" | "commissions">("products");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [savedIds, setSavedIds] = useState<Set<number>>(() => new Set(wishlistIds));
  const [, startWishlistTransition] = useTransition();
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

  function handleToggleWishlist(e: React.MouseEvent, product: ShopProduct) {
    e.stopPropagation();
    const isSaved = savedIds.has(product.id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(product.id) : next.add(product.id);
      return next;
    });
    startWishlistTransition(async () => {
      if (isSaved) {
        await removeFromWishlist(product.id);
      } else {
        await addToWishlist(product.id);
      }
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

        setTimeout(() => setOrderResult(null), 10000);
      }
    });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Shop
          </h1>
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

      {/* Products / Saved / Orders / Commissions tab toggle */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 w-fit">
        {(["products", "saved", "orders", "commissions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {t === "saved" && <Heart className="w-3 h-3" />}
            {t === "products"
              ? "Products"
              : t === "saved"
                ? `Saved${savedIds.size > 0 ? ` (${savedIds.size})` : ""}`
                : t === "orders"
                  ? "Order History"
                  : `Commissions${commissions.length > 0 ? ` (${commissions.length})` : ""}`}
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
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSaved={savedIds.has(product.id)}
                  inCart={items.some((i) => i.productId === product.id)}
                  onToggleWishlist={handleToggleWishlist}
                  onAddToCart={(e) => {
                    e.stopPropagation();
                    handleAddToCart(product);
                  }}
                  onClick={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Saved tab */}
      {tab === "saved" && (
        <>
          {savedIds.size === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-2xl">
              <Heart className="w-8 h-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">No saved products yet</p>
              <p className="text-xs text-muted/60 mt-1">Tap the heart on any product to save it</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {products
                .filter((p) => savedIds.has(p.id))
                .map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSaved={true}
                    inCart={items.some((i) => i.productId === product.id)}
                    onToggleWishlist={handleToggleWishlist}
                    onAddToCart={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                    onClick={() => setSelectedProduct(product)}
                  />
                ))}
            </div>
          )}
        </>
      )}

      {/* Orders tab */}
      {tab === "orders" && <OrdersList orders={orders} />}

      {/* Commissions tab */}
      {tab === "commissions" && <CommissionsTab commissions={commissions} />}

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
